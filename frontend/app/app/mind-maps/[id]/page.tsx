"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ArrowLeft,
  Network,
  Info,
  ExternalLink,
  HelpCircle,
  Tv,
  List,
  Layers,
  GraduationCap,
  Sparkles,
  Play,
  Pause,
  Square,
  Volume2,
  BookOpen,
  Award,
  CheckCircle2,
  Lock,
  X,
  Share2,
  Copy,
  Check,
  Download,
  Users,
  StickyNote,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import useSWR from "swr";
import { authenticatedFetcher, apiRequest } from "@/lib/api";
import { useNotebook } from "@/context/NotebookContext";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface MindMapNode3 {
  id: string;
  level: 3;
  title: string;
  desc: string;
  youtube_query: string;
  youtube_url?: string;
  youtube_embed?: string;
}

interface MindMapNode2 {
  id: string;
  level: 2;
  title: string;
  desc: string;
  children: MindMapNode3[];
}

interface MindMapNode1 {
  id: string;
  level: 1;
  title: string;
  desc: string;
  children: MindMapNode2[];
}

interface MindMapDetail {
  id: string;
  topic: string;
  title: string;
  desc: string;
  status: "PROCESSING" | "READY" | "FAILED";
  nodes: MindMapNode1[];
  completed_nodes?: string[];
  notes?: Record<string, string>;
  created_at: string;
  is_owner?: boolean;
  is_shared?: boolean;
  language?: string;
  import_count?: number;
}

type SelectedNodeType =
  | { type: 1; data: MindMapNode1 }
  | { type: 2; data: MindMapNode2 }
  | { type: 3; data: MindMapNode3 };

export default function MindMapDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();

  // Toggles between "canvas" (dotted flowchart) and "list" (vertical course outlines)
  const [viewMode, setViewMode] = useState<"canvas" | "list">("canvas");
  const [showRoadmap, setShowRoadmap] = useState(true);
  const [selectedNode, setSelectedNode] = useState<SelectedNodeType | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // SWR for Mind Map Detail
  const { data: mindMap, isLoading, mutate: mutateMindMap } = useSWR<MindMapDetail>(
    session?.accessToken && params?.id
      ? [
        `${process.env.NEXT_PUBLIC_API_URL}/mind-maps/${params.id}`,
        session.accessToken,
      ]
      : null,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  // Active sub-tab inside selected node details (video, reading, quiz)
  const [activeSideTab, setActiveSideTab] = useState<"video" | "reading" | "quiz">("video");

  // States for user-dragged/resized nodes
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [customSizes, setCustomSizes] = useState<Record<string, { width: number; height: number }>>({});

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeResizeId, setActiveResizeId] = useState<string | null>(null);

  const dragStartOffset = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0, x: 0, y: 0 });

  // Pointer drag event handlers
  const handleCardPointerDown = (e: React.PointerEvent, nodeId: string) => {
    const target = e.target as HTMLElement;
    if (target.closest(".resize-handle") || target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActiveDragId(nodeId);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      const currentX = rect.left - canvasRect.left;
      const currentY = rect.top - canvasRect.top;
      dragStartOffset.current = {
        x: e.clientX - currentX,
        y: e.clientY - currentY,
      };
    }
    e.stopPropagation();
  };

  const handleCardPointerMove = (e: React.PointerEvent, nodeId: string) => {
    if (activeDragId !== nodeId) return;
    
    let newX = e.clientX - dragStartOffset.current.x;
    let newY = e.clientY - dragStartOffset.current.y;
    
    // Snap to 12px grid for satisfying design tool snapping!
    newX = Math.round(newX / 12) * 12;
    newY = Math.round(newY / 12) * 12;
    
    const currentSize = customSizes[nodeId] || { width: 230, height: 86 };
    newX = Math.max(0, Math.min(1500 - currentSize.width, newX));
    newY = Math.max(0, newY);
    
    setCustomPositions(prev => ({
      ...prev,
      [nodeId]: { x: newX, y: newY }
    }));
    e.stopPropagation();
  };

  const handleCardPointerUp = (e: React.PointerEvent, nodeId: string) => {
    if (activeDragId === nodeId) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      setActiveDragId(null);
    }
    e.stopPropagation();
  };

  // Pointer resize event handlers
  const handleResizePointerDown = (e: React.PointerEvent, nodeId: string) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActiveResizeId(nodeId);
    
    const currentSize = customSizes[nodeId] || { width: 230, height: 86 };
    resizeStartSize.current = {
      width: currentSize.width,
      height: currentSize.height,
      x: e.clientX,
      y: e.clientY,
    };
    
    e.stopPropagation();
    e.preventDefault();
  };

  const handleResizePointerMove = (e: React.PointerEvent, nodeId: string) => {
    if (activeResizeId !== nodeId) return;
    
    const deltaX = e.clientX - resizeStartSize.current.x;
    const deltaY = e.clientY - resizeStartSize.current.y;
    
    let newWidth = resizeStartSize.current.width + deltaX;
    let newHeight = resizeStartSize.current.height + deltaY;
    
    newWidth = Math.round(newWidth / 12) * 12;
    newHeight = Math.round(newHeight / 12) * 12;
    
    newWidth = Math.max(160, Math.min(480, newWidth));
    newHeight = Math.max(60, Math.min(240, newHeight));
    
    setCustomSizes(prev => ({
      ...prev,
      [nodeId]: { width: newWidth, height: newHeight }
    }));
    
    e.stopPropagation();
  };

  const handleResizePointerUp = (e: React.PointerEvent, nodeId: string) => {
    if (activeResizeId === nodeId) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      setActiveResizeId(null);
    }
    e.stopPropagation();
  };

  // ── Panel splitter state (left panel width in percent) ──────────────────
  const [splitPct, setSplitPct] = useState<number>(58); // default ~7/12 ≈ 58%
  const isSplitting = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handleSplitterPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isSplitting.current = true;
    e.preventDefault();
  };

  const handleSplitterPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSplitting.current) return;
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
    // Clamp between 25% and 75%
    setSplitPct(Math.min(75, Math.max(25, rawPct)));
  };

  const handleSplitterPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    isSplitting.current = false;
  };
  // ─────────────────────────────────────────────────────────────────────────

  // --- Sharing, Duplication, and progression skipping states ---
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Deriving isOwner safely
  const isOwner = mindMap?.is_owner !== false;
  const { openFolhaForMindMapNode } = useNotebook();

  const toggleShare = async () => {
    setIsSharingLoading(true);
    try {
      const res = await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/mind-maps/${params.id}/share`,
        { method: "POST" }
      );
      toast.success(res.is_shared ? "Mapa mental agora é público! 🌐" : "Acesso público removido.");
      mutateMindMap();
    } catch (err) {
      toast.error("Erro ao alterar as definições de partilha.");
    } finally {
      setIsSharingLoading(false);
    }
  };

  const importMindMap = async () => {
    setIsImporting(true);
    try {
      const res = await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/mind-maps/${params.id}/duplicate`,
        { method: "POST" }
      );
      toast.success("Mapa mental importado com sucesso! 📥");
      router.push(`/app/mind-maps/${res.id}`);
    } catch (err) {
      toast.error("Erro ao importar o mapa mental.");
    } finally {
      setIsImporting(false);
    }
  };

  // All nodes are unlocked and accessible by default
  const isNodeLocked = (nodeId: string): boolean => {
    return false;
  };

  // Reset side tab when node changes
  useEffect(() => {
    setActiveSideTab("video");
    // setIsEditingNotes(false);
  }, [selectedNode?.data.id]);

  // --- Dynamic Reading Material On-Demand Content Generation ---
  const [nodeContent, setNodeContent] = useState<{ text_content: string; additional_resources?: any[] } | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const fetchNodeContent = async (nodeId: string) => {
    setLoadingContent(true);
    try {
      const data = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/mind-maps/${params.id}/node/${nodeId}/content`);
      setNodeContent(data);
    } catch (err: any) {
      toast.error("Erro ao carregar o conteúdo teórico.");
    } finally {
      setLoadingContent(false);
    }
  };

  useEffect(() => {
    if (selectedNode?.type === 3 && activeSideTab === "reading") {
      setNodeContent(null);
      fetchNodeContent(selectedNode.data.id);
    }
  }, [selectedNode?.data.id, activeSideTab]);

  // --- Text-to-Speech (TTS) SpeechSynthesis Engine ---
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [isPausedTTS, setIsPausedTTS] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        const preferredLang = mindMap?.language === "pt" ? "pt" : mindMap?.language === "es" ? "es" : "en";
        const matches = availableVoices.filter(v => v.lang.toLowerCase().includes(preferredLang));
        if (matches.length > 0) {
          setSelectedVoiceName(matches[0].name);
        } else if (availableVoices.length > 0) {
          setSelectedVoiceName(availableVoices[0].name);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [mindMap?.language]);

  const startTTS = () => {
    if (!nodeContent?.text_content || typeof window === "undefined") return;
    window.speechSynthesis.cancel();

    const cleanText = nodeContent.text_content
      .replace(/[#*`_\[\]()]/g, "")
      .replace(/[-+\d\.]+\s+/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = ttsSpeed;
    if (selectedVoiceName) {
      const voice = voices.find(v => v.name === selectedVoiceName);
      if (voice) utterance.voice = voice;
    }

    utterance.onend = () => {
      setIsPlayingTTS(false);
      setIsPausedTTS(false);
    };
    utterance.onerror = () => {
      setIsPlayingTTS(false);
      setIsPausedTTS(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlayingTTS(true);
    setIsPausedTTS(false);
  };

  const pauseTTS = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setIsPausedTTS(true);
      }
    }
  };

  const resumeTTS = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPausedTTS(false);
      }
    }
  };

  const stopTTS = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingTTS(false);
      setIsPausedTTS(false);
    }
  };

  // --- Dynamic Quiz Generation & Evaluation Flow ---
  const [quizData, setQuizData] = useState<{ questions: any[] } | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizFeedback, setQuizFeedback] = useState<any | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  const fetchQuiz = async (nodeId: string) => {
    setLoadingQuiz(true);
    setQuizFeedback(null);
    setQuizAnswers({});
    try {
      const data = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/mind-maps/${params.id}/node/${nodeId}/quiz`);
      setQuizData(data);
    } catch (err: any) {
      toast.error("Erro ao carregar o questionário.");
    } finally {
      setLoadingQuiz(false);
    }
  };

  useEffect(() => {
    if (selectedNode?.type === 3 && activeSideTab === "quiz") {
      setQuizData(null);
      fetchQuiz(selectedNode.data.id);
    }
  }, [selectedNode?.data.id, activeSideTab]);

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    setSubmittingQuiz(true);
    try {
      const res = await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/mind-maps/${params.id}/node/${selectedNode.data.id}/quiz/submit`,
        {
          method: "POST",
          body: JSON.stringify({ answers: quizAnswers }),
        }
      );
      setQuizFeedback(res);
      if (res.passed) {
        toast.success("Excelente! Você foi aprovado e desbloqueou a próxima trilha!");
        mutateMindMap();
      } else {
        toast.error(`Sua nota foi de ${res.score.toFixed(0)}%. É necessário pelo menos 70% para passar.`);
      }
    } catch (err: any) {
      toast.error("Erro ao enviar respostas.");
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const handleAnotar = () => {
    if (!selectedNode || selectedNode.type !== 3 || !params.id) return;
    if (!isOwner) {
      toast.warning("Importa este mapa mental para criar anotações.");
      return;
    }
    openFolhaForMindMapNode(
      params.id as string,
      selectedNode.data.id,
      selectedNode.data.title,
      mindMap?.notes?.[selectedNode.data.id]
    );
  };

  // Automatically select the first Level 3 node on initial load
  useEffect(() => {
    if (mindMap?.nodes && mindMap.nodes.length > 0 && !selectedNode) {
      const firstNode1 = mindMap.nodes[0];
      if (firstNode1.children && firstNode1.children.length > 0) {
        const firstNode2 = firstNode1.children[0];
        if (firstNode2.children && firstNode2.children.length > 0) {
          setSelectedNode({ type: 3, data: firstNode2.children[0] });
        } else {
          setSelectedNode({ type: 2, data: firstNode2 });
        }
      } else {
        setSelectedNode({ type: 1, data: firstNode1 });
      }
    }
  }, [mindMap, selectedNode]);

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mx-auto" />
          <p className="text-muted-foreground font-medium">
            Carregando mapa mental...
          </p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  if (!mindMap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground font-medium">
            Mapa mental não encontrado.
          </p>
          <Button
            asChild
            className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-8"
          >
            <Link href="/app/mind-maps">Meus Mapas Mentais</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Visual Node Positioning Coordinates Calculation Engine
  const positions: Record<string, { x: number; y: number }> = {};
  const connections: Array<{ from: string; to: string }> = [];

  let totalRow = 0;
  const cardWidth = 230;
  const cardHeight = 86;
  const verticalGap = 120;

  if (mindMap.nodes) {
    // 1. Give sequential vertical positions to all Level 3 (Lesson) nodes
    mindMap.nodes.forEach((n1) => {
      const children1 = n1.children || [];
      children1.forEach((n2) => {
        const children2 = n2.children || [];
        children2.forEach((n3) => {
          positions[n3.id] = {
            x: 580,
            y: totalRow * verticalGap + 40,
          };
          totalRow++;
        });
      });
    });

    // 2. Compute Level 2 positions centered around their children
    mindMap.nodes.forEach((n1) => {
      const children1 = n1.children || [];
      children1.forEach((n2) => {
        const children2 = n2.children || [];
        if (children2.length > 0) {
          const ys = children2.map((n3) => positions[n3.id]?.y ?? 0);
          const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
          positions[n2.id] = {
            x: 300,
            y: avgY,
          };
          // Create links
          children2.forEach((n3) => {
            connections.push({ from: n2.id, to: n3.id });
          });
        } else {
          positions[n2.id] = {
            x: 300,
            y: totalRow * verticalGap + 40,
          };
          totalRow++;
        }
      });
    });

    // 3. Compute Level 1 positions centered around their children
    mindMap.nodes.forEach((n1) => {
      const children1 = n1.children || [];
      if (children1.length > 0) {
        const ys = children1.map((n2) => positions[n2.id]?.y ?? 0);
        const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
        positions[n1.id] = {
          x: 20,
          y: avgY,
        };
        // Create links
        children1.forEach((n2) => {
          connections.push({ from: n1.id, to: n2.id });
        });
      } else {
        positions[n1.id] = {
          x: 20,
          y: totalRow * verticalGap + 40,
        };
        totalRow++;
      }
    });
  }

  // Calculates a dynamic Bezier curve link connecting node ports dynamically
  const drawDynamicBezier = (
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number
  ) => {
    const startX = x1 + w1;
    const startY = y1 + h1 / 2;
    const endX = x2;
    const endY = y2 + h2 / 2;
    const controlPointX = (startX + endX) / 2;
    return `M ${startX} ${startY} C ${controlPointX} ${startY}, ${controlPointX} ${endY}, ${endX} ${endY}`;
  };

  // Dynamic canvas bounding expansion based on nodes (both default and custom)
  let maxNodeX = 860;
  let maxNodeY = 580;

  if (mindMap.nodes) {
    Object.keys(positions).forEach((id) => {
      const pos = customPositions[id] || positions[id];
      const size = customSizes[id] || { width: cardWidth, height: cardHeight };
      if (pos) {
        if (pos.x + size.width > maxNodeX) maxNodeX = pos.x + size.width + 120;
        if (pos.y + size.height > maxNodeY) maxNodeY = pos.y + size.height + 120;
      }
    });
  }

  const canvasWidth = maxNodeX;
  const canvasHeight = maxNodeY;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Back and View Toggle Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link href="/app/mind-maps">
            <Button
              variant="ghost"
              className="pl-0 hover:pl-2 transition-all gap-2 group text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Voltar para Mapas Mentais
            </Button>
          </Link>

          <div className="flex items-center bg-muted/60 p-1.5 rounded-full border border-slate-200/50 self-start sm:self-center shadow-inner">
            <Button
              size="sm"
              variant={showRoadmap ? "secondary" : "ghost"}
              onClick={() => setShowRoadmap(!showRoadmap)}
              className={`rounded-full gap-1.5 h-8 text-xs font-bold px-4 transition-all duration-300 ${showRoadmap
                ? "bg-cyan-500 text-white shadow-sm hover:bg-cyan-600"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Network className="w-3.5 h-3.5" />
              {showRoadmap ? "Ocultar Trilha" : "Ver Trilha / Mapa"}
            </Button>

            {showRoadmap && (
              <>
                <div className="h-4 w-px bg-slate-300 mx-1" />

                <Button
                  size="sm"
                  variant={viewMode === "canvas" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("canvas")}
                  className={`rounded-full gap-1.5 h-8 text-xs font-semibold px-4 transition-all duration-300 ${viewMode === "canvas" ? "bg-white text-cyan-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  Mapa Canvas
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("list")}
                  className={`rounded-full gap-1.5 h-8 text-xs font-semibold px-4 transition-all duration-300 ${viewMode === "list" ? "bg-white text-cyan-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <List className="w-3.5 h-3.5" />
                  Visualização em Lista
                </Button>

                {viewMode === "canvas" && (Object.keys(customPositions).length > 0 || Object.keys(customSizes).length > 0) && (
                  <>
                    <div className="h-4 w-px bg-slate-300 mx-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCustomPositions({});
                        setCustomSizes({});
                      }}
                      className="rounded-full gap-1.5 h-8 text-xs font-bold px-3 text-cyan-600 hover:text-cyan-750 hover:bg-cyan-50/50 transition-all duration-300 animate-fade-in"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
                      Resetar Mapa
                    </Button>
                  </>
                )}
              </>
            )}

            {isOwner && (
              <>
                <div className="h-4 w-px bg-slate-300 mx-1" />
                <div className="relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowShareModal(!showShareModal)}
                    className="rounded-full gap-1.5 h-8 text-xs font-bold px-3 text-slate-650 hover:text-slate-800 hover:bg-slate-100/80 transition-all duration-300"
                  >
                    <Share2 className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
                    Partilhar
                  </Button>
                  
                  {/* Share Dropdown Tooltip */}
                  <AnimatePresence>
                    {showShareModal && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 p-4 rounded-2xl shadow-xl z-50 space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-extrabold text-slate-800">Partilhar Mapa Mental</h4>
                          <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Ative a partilha pública para gerar um link de acesso direto que pode enviar a qualquer pessoa.</p>

                        {/* Import counter badge */}
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-cyan-50 to-slate-50 border border-cyan-100">
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 text-cyan-600" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-medium leading-none mb-0.5">Importações</p>
                            <p className="text-sm font-extrabold text-slate-800 leading-none">
                              {mindMap.import_count ?? 0}
                              <span className="text-[10px] font-medium text-slate-400 ml-1">
                                {(mindMap.import_count ?? 0) === 1 ? "pessoa importou" : "pessoas importaram"}
                              </span>
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[11px] font-bold text-slate-700">Link Público</span>
                          <button
                            onClick={toggleShare}
                            disabled={isSharingLoading}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              mindMap.is_shared ? "bg-cyan-500" : "bg-slate-200"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                mindMap.is_shared ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        {mindMap.is_shared && (
                          <div className="space-y-2 pt-1">
                            <div className="flex gap-1.5">
                              <Input
                                readOnly
                                value={typeof window !== "undefined" ? `${window.location.origin}/app/mind-maps/${mindMap.id}` : ""}
                                className="h-8 text-[10px] font-mono select-all bg-slate-50 border-slate-200"
                              />
                              <Button
                                size="sm"
                                className="h-8 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg px-2.5 flex-shrink-0 transition-transform active:scale-95"
                                onClick={() => {
                                  if (typeof window !== "undefined") {
                                    navigator.clipboard.writeText(`${window.location.origin}/app/mind-maps/${mindMap.id}`);
                                    toast.success("Link de partilha copiado! 📋");
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                  }
                                }}
                              >
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Premium Shared Mind Map Preview Banner */}
        {!isOwner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-3xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 border border-cyan-400/20 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 text-white"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 backdrop-blur-md">
                <Sparkles className="w-5.5 h-5.5 text-white animate-pulse" />
              </div>
              <div className="space-y-0.5 text-left">
                <h3 className="font-extrabold text-sm md:text-base tracking-tight">Mapa Mental Partilhado! 🌐</h3>
                <p className="text-[11px] md:text-xs text-cyan-50/90 leading-relaxed max-w-xl">
                  Este roteiro de aprendizagem foi partilhado consigo! Importe-o agora para guardar o seu próprio progresso, realizar os testes e fazer anotações de estudo personalizadas.
                </p>
              </div>
            </div>
            <Button
              onClick={importMindMap}
              disabled={isImporting}
              className="bg-white hover:bg-cyan-50 text-cyan-600 font-extrabold rounded-full px-6 py-2 text-xs flex items-center gap-1.5 shadow-md flex-shrink-0 transition-all hover:scale-[1.03] active:scale-95"
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Importar para Minha Conta
            </Button>
          </motion.div>
        )}

        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent border border-cyan-500/10 shadow-sm relative overflow-hidden">
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-5 hidden lg:block">
            <Network className="w-40 h-40 text-cyan-500" />
          </div>
          <div className="max-w-3xl space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold capitalize text-gray-900 leading-tight">
              {mindMap.title}
            </h1>
            <p className="text-sm md:text-base text-gray-500 leading-relaxed">
              {mindMap.desc}
            </p>
          </div>
        </div>

        {/* ── Resizable split layout ───────────────────────────────────── */}
        <div
          ref={splitContainerRef}
          className="flex flex-col lg:flex-row items-start gap-0 w-full"
          onPointerMove={handleSplitterPointerMove}
          onPointerUp={handleSplitterPointerUp}
        >
          {showRoadmap && (
            <div
              className="split-left space-y-6 min-w-0 w-full flex-shrink-0"
              style={{ ['--split-w' as string]: `${splitPct}%` } as React.CSSProperties}
            >
              {/* inline style for desktop only — Tailwind cannot express dynamic % widths */}
              <style>{`.split-left { width: 100%; } @media (min-width: 1024px) { .split-left { width: var(--split-w); } }`}</style>
              {viewMode === "canvas" ? (
                // 1. DOTTED MAP CANVAS CONTAINER (NotebookLM Styled)
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <Network className="w-5 h-5 text-cyan-500" />
                      Trilha de Aprendizagem
                    </h2>
                    <span className="text-xs text-muted-foreground font-medium">Use a barra de rolagem para navegar horizontalmente</span>
                  </div>

                  <div className="w-full bg-white border border-slate-200/80 rounded-3xl min-h-[580px] relative shadow-lg shadow-slate-100/50 overflow-auto">
                    {/* NotebookLM Style Dotted Canvas Background Grid */}
                    <div
                      ref={canvasRef}
                      className={`absolute inset-0 select-none ${activeDragId || activeResizeId ? "cursor-grabbing" : ""}`}
                      style={{
                        width: `${canvasWidth}px`,
                        height: `${canvasHeight}px`,
                        backgroundImage: "radial-gradient(#cbd5e1 1.5px, transparent 1.5px)",
                        backgroundSize: "24px 24px",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      {/* SVG Connector Lines Overlay */}
                      <svg
                        className="absolute inset-0 pointer-events-none"
                        style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
                      >
                        {connections.map((conn, idx) => {
                          const fromPos = customPositions[conn.from] || positions[conn.from];
                          const toPos = customPositions[conn.to] || positions[conn.to];
                          if (!fromPos || !toPos) return null;

                          const fromSize = customSizes[conn.from] || { width: cardWidth, height: cardHeight };
                          const toSize = customSizes[conn.to] || { width: cardWidth, height: cardHeight };

                          return (
                            <g key={`conn-${idx}`}>
                              {/* Glow behind connection line */}
                              <path
                                d={drawDynamicBezier(fromPos.x, fromPos.y, fromSize.width, fromSize.height, toPos.x, toPos.y, toSize.width, toSize.height)}
                                fill="none"
                                stroke="rgba(6, 182, 212, 0.12)"
                                strokeWidth="5"
                                className="transition-all duration-300"
                              />
                              {/* Standard connecting spline */}
                              <path
                                d={drawDynamicBezier(fromPos.x, fromPos.y, fromSize.width, fromSize.height, toPos.x, toPos.y, toSize.width, toSize.height)}
                                fill="none"
                                stroke="rgba(6, 182, 212, 0.45)"
                                strokeWidth="2"
                                strokeDasharray="4,4"
                                className="transition-all duration-300"
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Nodes Render Array */}
                      {mindMap.nodes?.map((n1, idx1) => {
                        const pos1 = customPositions[n1.id] || positions[n1.id];
                        const size1 = customSizes[n1.id] || { width: cardWidth, height: cardHeight };
                        const isSel1 = selectedNode?.type === 1 && selectedNode.data.id === n1.id;

                        return (
                          <div key={n1.id}>
                            {/* Level 1 Node (Module Card) */}
                            {pos1 && (
                              <div
                                onPointerDown={(e) => handleCardPointerDown(e, n1.id)}
                                onPointerMove={(e) => handleCardPointerMove(e, n1.id)}
                                onPointerUp={(e) => handleCardPointerUp(e, n1.id)}
                                onClick={() => setSelectedNode({ type: 1, data: n1 })}
                                className="absolute cursor-grab active:cursor-grabbing select-none group"
                                style={{
                                  left: `${pos1.x}px`,
                                  top: `${pos1.y}px`,
                                  width: `${size1.width}px`,
                                  height: `${size1.height}px`,
                                  touchAction: "none",
                                }}
                              >
                                <Card
                                  className={`w-full h-full p-4.5 rounded-2xl flex flex-col justify-center border-2 border-t-[6px] transition-all hover:shadow-md ${isSel1
                                    ? "bg-cyan-50/50 border-cyan-500 border-t-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                                    : "bg-slate-50/80 border-slate-200 border-t-slate-700 hover:border-cyan-500/40"
                                    }`}
                                >
                                  <div className="flex gap-2.5 items-center">
                                    <div className={`p-1.5 rounded-lg ${isSel1 ? 'bg-cyan-500/10 text-cyan-600' : 'bg-slate-200/80 text-slate-600'}`}>
                                      <GraduationCap className="w-4 h-4" />
                                    </div>
                                    <div className="space-y-0.5 min-w-0 flex-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-400">Módulo {idx1 + 1}</span>
                                      <h3 className="font-bold text-xs text-slate-800 capitalize truncate leading-tight">
                                        {n1.title}
                                      </h3>
                                    </div>
                                  </div>

                                  {/* Resize Handle */}
                                  <div
                                    onPointerDown={(e) => handleResizePointerDown(e, n1.id)}
                                    onPointerMove={(e) => handleResizePointerMove(e, n1.id)}
                                    onPointerUp={(e) => handleResizePointerUp(e, n1.id)}
                                    className="resize-handle absolute bottom-1.5 right-1.5 w-3.5 h-3.5 cursor-se-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
                                  >
                                    <svg width="8" height="8" viewBox="0 0 8 8" className="text-slate-400 fill-current">
                                      <path d="M6 0h2v2H6V0zm-3 3h2v2H3V3zm3 0h2v2H6V3zM0 6h2v2H0V6zm3 0h2v2H3V6zm3 0h2v2H6V6z" />
                                    </svg>
                                  </div>
                                </Card>
                              </div>
                            )}

                            {n1.children?.map((n2, idx2) => {
                              const pos2 = customPositions[n2.id] || positions[n2.id];
                              const size2 = customSizes[n2.id] || { width: cardWidth, height: cardHeight };
                              const isSel2 = selectedNode?.type === 2 && selectedNode.data.id === n2.id;

                              return (
                                <div key={n2.id}>
                                  {/* Level 2 Node (Subtopic Card) */}
                                  {pos2 && (
                                    <div
                                      onPointerDown={(e) => handleCardPointerDown(e, n2.id)}
                                      onPointerMove={(e) => handleCardPointerMove(e, n2.id)}
                                      onPointerUp={(e) => handleCardPointerUp(e, n2.id)}
                                      onClick={() => setSelectedNode({ type: 2, data: n2 })}
                                      className="absolute cursor-grab active:cursor-grabbing select-none group"
                                      style={{
                                        left: `${pos2.x}px`,
                                        top: `${pos2.y}px`,
                                        width: `${size2.width}px`,
                                        height: `${size2.height}px`,
                                        touchAction: "none",
                                      }}
                                    >
                                      <Card
                                        className={`w-full h-full p-4.5 rounded-2xl flex flex-col justify-center border transition-all hover:shadow-md ${isSel2
                                          ? "bg-cyan-50/30 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.12)]"
                                          : "bg-white border-slate-200/90 hover:border-cyan-500/30"
                                          }`}
                                      >
                                        <div className="flex gap-2.5 items-center">
                                          <div className={`p-1.5 rounded-lg ${isSel2 ? 'bg-cyan-500/10 text-cyan-600' : 'bg-slate-100 text-slate-500'}`}>
                                            <Layers className="w-4 h-4" />
                                          </div>
                                          <div className="space-y-0.5 min-w-0 flex-1">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Subtópico {idx1 + 1}.{idx2 + 1}</span>
                                            <h3 className="font-semibold text-xs text-slate-700 capitalize truncate leading-tight">
                                              {n2.title}
                                            </h3>
                                          </div>
                                        </div>

                                        {/* Resize Handle */}
                                        <div
                                          onPointerDown={(e) => handleResizePointerDown(e, n2.id)}
                                          onPointerMove={(e) => handleResizePointerMove(e, n2.id)}
                                          onPointerUp={(e) => handleResizePointerUp(e, n2.id)}
                                          className="resize-handle absolute bottom-1.5 right-1.5 w-3.5 h-3.5 cursor-se-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
                                        >
                                          <svg width="8" height="8" viewBox="0 0 8 8" className="text-slate-400 fill-current">
                                            <path d="M6 0h2v2H6V0zm-3 3h2v2H3V3zm3 0h2v2H6V3zM0 6h2v2H0V6zm3 0h2v2H3V6zm3 0h2v2H6V6z" />
                                          </svg>
                                        </div>
                                      </Card>
                                    </div>
                                  )}

                                  {n2.children?.map((n3, idx3) => {
                                    const pos3 = customPositions[n3.id] || positions[n3.id];
                                    const size3 = customSizes[n3.id] || { width: cardWidth, height: cardHeight };
                                    const isSel3 = selectedNode?.type === 3 && selectedNode.data.id === n3.id;
                                    const isLocked3 = isNodeLocked(n3.id);

                                    return (
                                      pos3 && (
                                        <div
                                          key={n3.id}
                                          onPointerDown={(e) => handleCardPointerDown(e, n3.id)}
                                          onPointerMove={(e) => handleCardPointerMove(e, n3.id)}
                                          onPointerUp={(e) => handleCardPointerUp(e, n3.id)}
                                          onClick={() => {
                                            if (isLocked3) {
                                              toast.warning("Esta aula está bloqueada! Complete o teste da aula anterior para desbloquear.");
                                              return;
                                            }
                                            setSelectedNode({ type: 3, data: n3 });
                                          }}
                                          className={`absolute cursor-grab active:cursor-grabbing select-none group ${isLocked3 ? "opacity-60 filter grayscale" : ""}`}
                                          style={{
                                            left: `${pos3.x}px`,
                                            top: `${pos3.y}px`,
                                            width: `${size3.width}px`,
                                            height: `${size3.height}px`,
                                            touchAction: "none",
                                          }}
                                        >
                                          {/* Level 3 Node (Lesson Card) */}
                                          <Card
                                            className={`w-full h-full p-4.5 rounded-2xl flex flex-col justify-center border-2 transition-all ${isLocked3 ? 'bg-slate-50 border-slate-200 hover:-translate-y-0 shadow-none' : 'hover:shadow-md'} ${isSel3
                                              ? "bg-cyan-500/[0.04] border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                              : isLocked3 ? "border-slate-200 text-slate-400" : "bg-white border-cyan-500/20 hover:border-cyan-500/40"
                                              }`}
                                          >
                                            <div className="flex gap-2.5 items-center">
                                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${isLocked3 ? 'bg-slate-200 text-slate-400' : isSel3 ? 'bg-cyan-500 text-white' : 'bg-cyan-50 text-cyan-500'
                                                }`}>
                                                {isLocked3 ? <Lock className="w-3.5 h-3.5" /> : "▶"}
                                              </div>
                                              <div className="space-y-0.5 min-w-0 flex-1">
                                                <span className={`text-[10px] uppercase font-bold ${isLocked3 ? 'text-slate-400' : 'text-cyan-400'}`}>Aula {idx1 + 1}.{idx2 + 1}.{idx3 + 1}</span>
                                                <h3 className={`font-semibold text-xs truncate leading-tight ${isSel3 ? 'text-cyan-600 font-bold' : isLocked3 ? 'text-slate-400' : 'text-slate-800'}`}>
                                                  {n3.title}
                                                </h3>
                                              </div>
                                            </div>

                                            {/* Resize Handle (only for unlocked lessons) */}
                                            {!isLocked3 && (
                                              <div
                                                onPointerDown={(e) => handleResizePointerDown(e, n3.id)}
                                                onPointerMove={(e) => handleResizePointerMove(e, n3.id)}
                                                onPointerUp={(e) => handleResizePointerUp(e, n3.id)}
                                                className="resize-handle absolute bottom-1.5 right-1.5 w-3.5 h-3.5 cursor-se-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
                                              >
                                                <svg width="8" height="8" viewBox="0 0 8 8" className="text-slate-400 fill-current">
                                                  <path d="M6 0h2v2H6V0zm-3 3h2v2H3V3zm3 0h2v2H6V3zM0 6h2v2H0V6zm3 0h2v2H3V6zm3 0h2v2H6V6z" />
                                                </svg>
                                              </div>
                                            )}
                                          </Card>
                                        </div>
                                      )
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                // 2. OUTLINE NESTED LIST VIEW (Grouped logically)
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <List className="w-5 h-5 text-cyan-500" />
                    Ementa da Trilha
                  </h2>

                  <div className="space-y-3">
                    {mindMap.nodes?.map((n1, idx1) => (
                      <Card key={n1.id} className="p-6 border border-slate-200 bg-card rounded-2xl ">
                        {/* Level 1 Module */}
                        <div
                          onClick={() => setSelectedNode({ type: 1, data: n1 })}
                          className="flex items-start gap-3 cursor-pointer group"
                        >
                          <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold flex items-center justify-center">
                            {idx1 + 1}
                          </span>
                          <div className="space-y-1">
                            <h3 className="font-extrabold text-base text-gray-900 group-hover:text-cyan-500 transition-colors">
                              {n1.title}
                            </h3>
                            <p className="text-xs text-muted-foreground">{n1.desc}</p>
                          </div>
                        </div>

                        {/* Level 2 Subtopics */}
                        <div className="pl-6 space-y-4 border-l-2 border-slate-100">
                          {n1.children?.map((n2, idx2) => (
                            <div key={n2.id} className="space-y-3">
                              <div
                                onClick={() => setSelectedNode({ type: 2, data: n2 })}
                                className="flex items-start gap-2.5 cursor-pointer group"
                              >
                                <span className="w-6 h-6 rounded-lg bg-cyan-50 text-cyan-600 text-xs font-semibold flex items-center justify-center">
                                  {idx1 + 1}.{idx2 + 1}
                                </span>
                                <div>
                                  <h4 className="font-bold text-sm text-gray-800 group-hover:text-cyan-500 transition-colors">
                                    {n2.title}
                                  </h4>
                                  <p className="text-xs text-gray-500">{n2.desc}</p>
                                </div>
                              </div>

                              {/* Level 3 Lessons */}
                              <div className="pl-6 grid grid-cols-1 gap-2">
                                {n2.children?.map((n3) => {
                                  const isSel3 = selectedNode?.type === 3 && selectedNode.data.id === n3.id;
                                  const isLocked3 = isNodeLocked(n3.id);
                                  return (
                                    <Card
                                      key={n3.id}
                                      onClick={() => {
                                        if (isLocked3) {
                                          // toast.warning("Aula bloqueada! Faça o teste da aula anterior para desbloquear.");
                                          return;
                                        }
                                        setSelectedNode({ type: 3, data: n3 });
                                      }}
                                      className={`flex flex-row p-2 cursor-pointer rounded-2xl border transition-all duration-300 flex items-center gap-2.5 ${isLocked3 ? "opacity-60 cursor-not-allowed filter grayscale bg-slate-50 border-slate-200" : isSel3
                                        ? "bg-cyan-50/50 border-cyan-500 shadow-sm"
                                        : "bg-white border-slate-100 hover:border-cyan-500/20 hover:bg-slate-50/30"
                                        }`}
                                    >
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${isLocked3 ? 'bg-slate-200 text-slate-400' : isSel3 ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {isLocked3 ? <Lock className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                      </div>
                                      <div className="flex-1">
                                        <p className={`text-xs truncate font-medium ${isSel3 ? 'text-cyan-600 font-bold' : isLocked3 ? 'text-slate-400' : 'text-slate-800'}`}>
                                          {n3.title}
                                        </p>
                                      </div>
                                    </Card>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Draggable splitter handle (only when roadmap is visible on desktop) ── */}
          {showRoadmap && (
            <div
              onPointerDown={handleSplitterPointerDown}
              className="hidden lg:flex flex-col items-center justify-center flex-shrink-0 w-5 self-stretch cursor-col-resize group select-none z-20 relative mx-0.5"
              title="Arrastar para redimensionar os painéis"
            >
              {/* Full-height thin line */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-200 group-hover:bg-cyan-400 group-active:bg-cyan-500 transition-colors duration-150" />
              {/* Centered pill grip indicator */}
              <div className="relative z-10 flex flex-col items-center gap-[3px] bg-white border border-slate-200 group-hover:border-cyan-300 group-active:border-cyan-500 rounded-full py-2 px-[3px] shadow-sm transition-all duration-150 group-hover:shadow-cyan-100">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="w-[3px] h-[3px] rounded-full bg-slate-300 group-hover:bg-cyan-400 group-active:bg-cyan-500 transition-colors" />
                ))}
              </div>
            </div>
          )}

          {/* RIGHT — Details / Video panel */}
          <div
            className="w-full min-w-0 lg:sticky lg:top-24"
            style={showRoadmap ? { flex: 1 } : { maxWidth: '56rem', margin: '0 auto', width: '100%' }}
          >
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <motion.div
                  key={`${selectedNode.type}-${selectedNode.data.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <Card className="space-y-0 py-0 bg-card border border-slate-200/90 rounded-3xl overflow-hidden shadow-xl shadow-slate-100/40">

                    {/* Level 3 Node -> Renders persistent Iframe Player */}
                    {selectedNode.type === 3 && (
                      <div className="aspect-video relative bg-slate-900 border-b border-slate-100">
                        {selectedNode.data.youtube_embed ? (
                          <iframe
                            width="100%"
                            height="100%"
                            src={selectedNode.data.youtube_embed}
                            title={selectedNode.data.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="w-full h-full"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400 gap-4">
                            <HelpCircle className="w-16 h-16 text-cyan-500/20" />
                            <div className="space-y-1">
                              <p className="font-semibold text-white">Não foi possível embutir a aula</p>
                              <p className="text-xs text-gray-500 max-w-sm">Você ainda pode pesquisar e assistir ao conteúdo diretamente no YouTube.</p>
                            </div>
                            {selectedNode.data.youtube_url ? (
                              <Button asChild className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full">
                                <a href={selectedNode.data.youtube_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                                  Assistir no YouTube <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                            ) : (
                              <Button asChild className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full">
                                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(selectedNode.data.youtube_query)}`} target="_blank" rel="noopener noreferrer" className="gap-2">
                                  Pesquisar no YouTube <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        )}

                        <div className="flex border-b border-slate-100 bg-slate-50/50 p-1.5 gap-1 shadow-inner">
                          <button
                            onClick={() => setActiveSideTab("video")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${activeSideTab === "video"
                              ? "bg-white text-cyan-600 shadow-sm border border-slate-200/40"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/40"
                              }`}
                          >
                            <Tv className="w-3.5 h-3.5" />
                            Vídeo
                          </button>
                          <button
                            onClick={() => setActiveSideTab("reading")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${activeSideTab === "reading"
                              ? "bg-white text-cyan-600 shadow-sm border border-slate-200/40"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/40"
                              }`}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Leitura
                          </button>
                          <button
                            onClick={() => setActiveSideTab("quiz")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${activeSideTab === "quiz"
                              ? "bg-white text-cyan-600 shadow-sm border border-slate-200/40"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/40"
                              }`}
                          >
                            <Award className="w-3.5 h-3.5" />
                            Teste
                          </button>
                          <button
                            type="button"
                            onClick={handleAnotar}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl transition-all text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-100/80 shrink-0"
                            title="Abrir caderno de notas deste nó"
                          >
                            <StickyNote className="w-3.5 h-3.5" />
                            Anotar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="pt-8 pb-3 px-6 space-y-4">
                      <div>
                        {
                          (selectedNode.type === 2 || selectedNode.type === 1) && (
                            <span className={`text-xs font-bold px-1 py-0.5 rounded ${selectedNode.type === 1
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-cyan-50 text-cyan-600 border border-cyan-100'
                              }`}>
                              {selectedNode.type === 1 ? `Módulo ${selectedNode.data.id}` : `Subtópico ${selectedNode.data.id}`}
                            </span>
                          )
                        }

                        {
                          (selectedNode.type !== 3 || activeSideTab === "video") && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                              <div className="space-y-1">
                                <h2 className="text-xl md:text-2xl font-bold text-gray-900 capitalize leading-snug">
                                  {selectedNode.data.title}
                                </h2>
                                <p className="text-sm md:text-base text-gray-600">
                                  {selectedNode.data.desc}
                                </p>
                              </div>
                              {selectedNode.type === 3 && mindMap.completed_nodes?.includes(selectedNode.data.id) && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-bold self-start sm:self-center">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Concluído
                                </div>
                              )}
                            </div>
                          )
                        }

                      </div>

                      {/* --- TAB CONTENT SWITCHING --- */}

                      {/* 1. VIDEO / GENERAL INFO TAB */}
                      {(selectedNode.type !== 3 || activeSideTab === "video") && (
                        <div className="space-y-4">
                          {/* Level 1 specific children view */}
                          {selectedNode.type === 1 && (
                            <div className="pt-2 space-y-2.5 border-t border-dashed">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subtópicos inclusos:</p>
                              <div className="space-y-2">
                                {selectedNode.data.children?.map((subNode, sIdx) => (
                                  <div
                                    key={subNode.id}
                                    onClick={() => setSelectedNode({ type: 2, data: subNode })}
                                    className="p-3 bg-slate-50 hover:bg-cyan-50/30 border border-slate-100 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs"
                                  >
                                    <span className="font-bold text-slate-700 capitalize">{sIdx + 1}. {subNode.title}</span>
                                    <span className="text-[10px] text-cyan-500 font-bold">{subNode.children?.length || 0} aulas</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Level 2 specific children view */}
                          {selectedNode.type === 2 && (
                            <div className="pt-2 space-y-2.5 border-t border-dashed">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aulas inclusas:</p>
                              <div className="space-y-2">
                                {selectedNode.data.children?.map((lessonNode, lIdx) => {
                                  const isLockedL = isNodeLocked(lessonNode.id);
                                  return (
                                    <div
                                      key={lessonNode.id}
                                      onClick={() => {
                                        if (isLockedL) {
                                          toast.warning("Esta aula está bloqueada! Complete o teste da aula anterior primeiro.");
                                          return;
                                        }
                                        setSelectedNode({ type: 3, data: lessonNode });
                                      }}
                                      className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center gap-2 text-xs ${isLockedL ? 'bg-slate-100/50 border-slate-200 text-slate-400 opacity-60' : 'bg-slate-50 hover:bg-cyan-50/30 border-slate-100 text-slate-700'
                                        }`}
                                    >
                                      <span className={`w-5 h-5 rounded font-bold flex items-center justify-center text-[10px] ${isLockedL ? 'bg-slate-200 text-slate-400' : 'bg-cyan-100/50 text-cyan-600'
                                        }`}>{isLockedL ? <Lock className="w-3 h-3" /> : lIdx + 1}</span>
                                      <span className="font-bold capitalize truncate flex-1">{lessonNode.title}</span>
                                      <span className="text-[10px] text-slate-400">{isLockedL ? 'Bloqueada' : 'Assistir aula'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. DYNAMIC LEITURA (TEXT READING MATERIAL) TAB */}
                      {selectedNode.type === 3 && activeSideTab === "reading" && (
                        <div className="">
                          {loadingContent ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-700">Elaborando material didático...</p>
                                <p className="text-xs text-muted-foreground max-w-xs">Nossa IA está organizando um texto aprofundado com exemplos práticos sobre este assunto.</p>
                              </div>
                            </div>
                          ) : nodeContent ? (
                            <div className="space-y-4">

                              {/* Speech Synthesis Voice Player */}
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3.5 rounded-2xl bg-cyan-500/[0.03] border border-cyan-500/10 gap-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                                    <Volume2 className={`w-4 h-4 text-cyan-500 ${isPlayingTTS && !isPausedTTS ? 'animate-bounce' : ''}`} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-800">Ler em Voz Alta</p>
                                    <p className="text-[9px] text-slate-400">Conversão automática de texto para fala</p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {!isPlayingTTS ? (
                                    <Button onClick={startTTS} size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full gap-1.5 text-xs px-3 shadow-md shadow-cyan-500/15 h-8">
                                      <Play className="w-3 h-3 fill-current" /> Ouvir
                                    </Button>
                                  ) : (
                                    <>
                                      {isPausedTTS ? (
                                        <Button onClick={resumeTTS} size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full gap-1.5 text-xs px-3 h-8">
                                          <Play className="w-3 h-3 fill-current" /> Retomar
                                        </Button>
                                      ) : (
                                        <Button onClick={pauseTTS} size="sm" className="bg-amber-500 hover:bg-amber-600 text-white rounded-full gap-1.5 text-xs px-3 h-8">
                                          <Pause className="w-3 h-3" /> Pausar
                                        </Button>
                                      )}
                                      <Button onClick={stopTTS} size="sm" variant="destructive" className="rounded-full gap-1.5 text-xs px-3 h-8">
                                        <Square className="w-3 h-3 fill-current" /> Parar
                                      </Button>
                                    </>
                                  )}

                                  <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

                                  <select
                                    value={ttsSpeed}
                                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                                    className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none h-8 text-slate-600"
                                  >
                                    <option value="0.75">0.75x</option>
                                    <option value="1">1.0x</option>
                                    <option value="1.25">1.25x</option>
                                    <option value="1.5">1.5x</option>
                                    <option value="2">2.0x</option>
                                  </select>
                                </div>
                              </div>

                              {/* Markdown Article Content */}
                              <div className="prose prose-cyan max-w-none text-slate-700 text-xs sm:text-sm leading-relaxed border-t pt-4 border-slate-100">
                                <ReactMarkdown>{nodeContent.text_content}</ReactMarkdown>
                              </div>

                              {/* Additional External Open Resources */}
                              {nodeContent.additional_resources && nodeContent.additional_resources.length > 0 && (
                                <div className="mt-6 p-4.5 rounded-2xl bg-slate-50 border border-slate-200/50 space-y-2.5">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conteúdos extras e documentações recomendadas:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {nodeContent.additional_resources.map((res: any, idx: number) => (
                                      <a
                                        key={idx}
                                        href={res.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700 bg-white border border-cyan-100 hover:border-cyan-300 px-3.5 py-1.5 rounded-full transition-all"
                                      >
                                        {res.title} <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                            </div>
                          ) : (
                            <div className="text-center py-10 bg-slate-50 border border-dashed rounded-2xl p-6">
                              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                              <p className="font-bold text-xs text-slate-700">Material não gerado</p>
                              <Button onClick={() => fetchNodeContent(selectedNode.data.id)} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full text-xs mt-3">
                                Gerar Material de Leitura
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3. INTERACTIVE QUIZ TAB */}
                      {selectedNode.type === 3 && activeSideTab === "quiz" && (
                        <div className="">
                          {!isOwner ? (
                            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/50 flex flex-col items-center justify-center text-center gap-3">
                              <Award className="w-10 h-10 text-cyan-500/30" />
                              <h3 className="font-bold text-slate-800 text-xs sm:text-sm">Teste Bloqueado 🔒</h3>
                              <p className="text-xs text-slate-550 max-w-xs leading-relaxed">
                                Para responder a questionários, obter notas de avaliação e acompanhar o seu progresso neste mapa mental, importe-o primeiro para a sua conta.
                              </p>
                              <Button onClick={importMindMap} disabled={isImporting} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full text-xs font-bold px-6 h-9 transition-transform active:scale-95 shadow-sm shadow-cyan-500/10">
                                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                                Importar Mapa Mental
                              </Button>
                            </div>
                          ) : (
                            loadingQuiz ? (
                              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-slate-700">Construindo questionário sob demanda...</p>
                                  <p className="text-xs text-muted-foreground max-w-xs">Nossa IA está preparando um teste prático com questões adaptadas para o seu nível.</p>
                                </div>
                              </div>
                            ) : quizData ? (
                              <div className="space-y-4">
                                <h1 className="text-md text-center font-bold text-slate-700">Questionário da Trilha</h1>
                                <div className="border-t border-dashed my-3" />

                                {/* Case 1: Already passed previously */}
                                {mindMap?.completed_nodes?.includes(selectedNode.data.id) ? (
                                  <div className="p-6 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex flex-col items-center justify-center text-center gap-3">
                                    <div className="w-12 h-12 bg-emerald-500/15 rounded-full flex items-center justify-center text-emerald-600">
                                      <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                      <h3 className="font-bold text-emerald-800">Aprovado no Teste!</h3>
                                      <p className="text-xs text-emerald-600 max-w-xs">Você demonstrou domínio nesta matéria e a próxima fase foi desbloqueada com sucesso!</p>
                                    </div>
                                    <Button onClick={() => fetchQuiz(selectedNode.data.id)} variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-full text-xs h-9 px-5 mt-1">
                                      Refazer Avaliação
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    {/* Case 2: Feedback banner from recent grading */}
                                    {quizFeedback && (
                                      <div className={`p-5 rounded-2xl border flex flex-col items-center justify-center text-center gap-2.5 ${quizFeedback.passed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                                        }`}>
                                        {quizFeedback.passed ? (
                                          <>
                                            <Award className="w-12 h-12 text-emerald-500 animate-bounce" />
                                            <h3 className="font-bold text-emerald-800">Aprovado com {quizFeedback.score.toFixed(0)}%!</h3>
                                            <p className="text-xs text-emerald-600">Acertou {quizFeedback.correct_count} de {quizFeedback.total_questions} questões. Ótimo trabalho!</p>
                                          </>
                                        ) : (
                                          <>
                                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold">✗</div>
                                            <h3 className="font-bold text-red-800">Tente Novamente ({quizFeedback.score.toFixed(0)}%)</h3>
                                            <p className="text-xs text-red-600">Acertou {quizFeedback.correct_count} de {quizFeedback.total_questions} questões. Estude um pouco mais o texto.</p>
                                            <Button onClick={() => setQuizFeedback(null)} className="bg-red-500 hover:bg-red-600 text-white rounded-full text-xs px-4 h-8 mt-1.5">
                                              Refazer Questões
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    )}

                                    {/* Case 3: Quiz questions form */}
                                    {!quizFeedback && (
                                      <form onSubmit={handleQuizSubmit} className="space-y-6 pt-2">
                                        {quizData.questions.map((q: any, qIdx: number) => (
                                          <div key={q.id} className="space-y-2.5 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
                                            <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                                              <span className="text-cyan-500 mr-1.5">{qIdx + 1}.</span> {q.question}
                                            </p>

                                            {/* Multiple choice type */}
                                            {q.type === "multiple_choice" && (
                                              <div className="space-y-2 pl-2">
                                                {q.options?.map((opt: string) => (
                                                  <label key={opt} className="flex items-start gap-2.5 text-xs text-slate-600 font-medium cursor-pointer hover:text-slate-800 select-none">
                                                    <input
                                                      type="radio"
                                                      name={`q-${q.id}`}
                                                      value={opt}
                                                      checked={quizAnswers[q.id] === opt}
                                                      onChange={(e) => setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })}
                                                      className="mt-0.5 text-cyan-500 focus:ring-cyan-400"
                                                      required
                                                    />
                                                    <span>{opt}</span>
                                                  </label>
                                                ))}
                                              </div>
                                            )}

                                            {/* True / False type */}
                                            {q.type === "true_false" && (
                                              <div className="flex gap-6 pl-2">
                                                {q.options?.map((opt: string) => (
                                                  <label key={opt} className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer hover:text-slate-800 select-none">
                                                    <input
                                                      type="radio"
                                                      name={`q-${q.id}`}
                                                      value={opt}
                                                      checked={quizAnswers[q.id] === opt}
                                                      onChange={(e) => setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })}
                                                      className="text-cyan-500 focus:ring-cyan-400"
                                                      required
                                                    />
                                                    <span>{opt}</span>
                                                  </label>
                                                ))}
                                              </div>
                                            )}

                                            {/* Direct Short Answer type */}
                                            {q.type === "short_answer" && (
                                              <div className="pl-2">
                                                <Input
                                                  type="text"
                                                  placeholder="Digite sua resposta curta (ex: uma palavra)"
                                                  value={quizAnswers[q.id] || ""}
                                                  onChange={(e) => setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })}
                                                  className="h-10 text-xs border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 rounded-lg max-w-sm bg-white"
                                                  required
                                                />
                                              </div>
                                            )}
                                          </div>
                                        ))}

                                        <Button type="submit" disabled={submittingQuiz} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full w-full font-bold h-11 shadow-md shadow-cyan-500/20 animate-none">
                                          {submittingQuiz ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Enviar Teste de Progresso
                                        </Button>
                                      </form>
                                    )}
                                  </>
                                )}

                              </div>
                            ) : (
                              <div className="text-center py-10 bg-slate-50 border border-dashed rounded-2xl p-6">
                                <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                <p className="font-bold text-xs text-slate-700">Quiz ainda não inicializado</p>
                                <Button onClick={() => fetchQuiz(selectedNode.data.id)} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full text-xs mt-3">
                                  Carregar Questões do Teste
                                </Button>
                              </div>
                            )
                          )}
                        </div>
                      )}

                    </div>
                  </Card>
                </motion.div>
              ) : (
                <div className="text-center py-20 bg-muted/20 border border-dashed rounded-3xl p-6">
                  <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">Nenhum nó selecionado</p>
                  <p className="text-xs text-muted-foreground">Clique em um elemento do mapa ou lista para visualizar os detalhes do conteúdo.</p>
                </div>
              )}
            </AnimatePresence>
          </div>

        </div>
        {/* ── end resizable split layout ─────────────────────────────────── */}
      </div>
    </div>
  );
}
