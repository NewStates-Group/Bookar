"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import useSWR from "swr";
import { authenticatedFetcher } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

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
  created_at: string;
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
  const [selectedNode, setSelectedNode] = useState<SelectedNodeType | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // SWR for Mind Map Detail
  const { data: mindMap, isLoading } = useSWR<MindMapDetail>(
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

  // Calculates a cubic Bezier curve link connecting node ports elegantly
  const drawBezierCurve = (x1: number, y1: number, x2: number, y2: number) => {
    const startX = x1 + cardWidth;
    const startY = y1 + cardHeight / 2;
    const endX = x2;
    const endY = y2 + cardHeight / 2;
    const controlPointX = (startX + endX) / 2;
    return `M ${startX} ${startY} C ${controlPointX} ${startY}, ${controlPointX} ${endY}, ${endX} ${endY}`;
  };

  const canvasHeight = Math.max(580, totalRow * verticalGap + 80);

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
              variant={viewMode === "canvas" ? "secondary" : "ghost"}
              onClick={() => setViewMode("canvas")}
              className={`rounded-full gap-1.5 h-8 text-xs font-semibold px-4 transition-all duration-300 ${
                viewMode === "canvas" ? "bg-white text-cyan-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              Mapa Canvas
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              onClick={() => setViewMode("list")}
              className={`rounded-full gap-1.5 h-8 text-xs font-semibold px-4 transition-all duration-300 ${
                viewMode === "list" ? "bg-white text-cyan-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Visualização em Lista
            </Button>
          </div>
        </div>

        {/* General Subject Banner */}
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent border border-cyan-500/10 shadow-sm relative overflow-hidden">
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-5 hidden lg:block">
            <Network className="w-40 h-40 text-cyan-500" />
          </div>
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-1 bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Mapa de 3 Níveis
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold capitalize text-gray-900 leading-tight">
              {mindMap.title}
            </h1>
            <p className="text-sm md:text-base text-gray-500 leading-relaxed">
              {mindMap.desc}
            </p>
          </div>
        </div>

        {/* Dynamic Split Screen Panel Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT Roadmap Workspace (Canvas or List Outline) */}
          <div className="lg:col-span-7 space-y-6">
            
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
                    className="absolute inset-0 select-none"
                    style={{
                      width: "860px",
                      height: `${canvasHeight}px`,
                      backgroundImage: "radial-gradient(#cbd5e1 1.5px, transparent 1.5px)",
                      backgroundSize: "24px 24px",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    {/* SVG Connector Lines Overlay */}
                    <svg
                      className="absolute inset-0 pointer-events-none"
                      style={{ width: "860px", height: `${canvasHeight}px` }}
                    >
                      {connections.map((conn, idx) => {
                        const fromPos = positions[conn.from];
                        const toPos = positions[conn.to];
                        if (!fromPos || !toPos) return null;
                        return (
                          <g key={`conn-${idx}`}>
                            {/* Glow behind connection line */}
                            <path
                              d={drawBezierCurve(fromPos.x, fromPos.y, toPos.x, toPos.y)}
                              fill="none"
                              stroke="rgba(6, 182, 212, 0.12)"
                              strokeWidth="5"
                              className="transition-all duration-300"
                            />
                            {/* Standard connecting spline */}
                            <path
                              d={drawBezierCurve(fromPos.x, fromPos.y, toPos.x, toPos.y)}
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
                    {mindMap.nodes?.map((n1) => {
                      const pos1 = positions[n1.id];
                      const isSel1 = selectedNode?.type === 1 && selectedNode.data.id === n1.id;
                      
                      return (
                        <div key={n1.id}>
                          {/* Level 1 Node (Module Card) */}
                          {pos1 && (
                            <div
                              onClick={() => setSelectedNode({ type: 1, data: n1 })}
                              className="absolute cursor-pointer transition-all duration-300"
                              style={{
                                left: `${pos1.x}px`,
                                top: `${pos1.y}px`,
                                width: `${cardWidth}px`,
                                height: `${cardHeight}px`,
                              }}
                            >
                              <Card
                                className={`w-full h-full p-4.5 rounded-2xl flex flex-col justify-center border-2 border-t-[6px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                                  isSel1
                                    ? "bg-cyan-50/50 border-cyan-500 border-t-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                                    : "bg-slate-50/80 border-slate-200 border-t-slate-700 hover:border-cyan-500/40"
                                }`}
                              >
                                <div className="flex gap-2.5 items-center">
                                  <div className={`p-1.5 rounded-lg ${isSel1 ? 'bg-cyan-500/10 text-cyan-600' : 'bg-slate-200/80 text-slate-600'}`}>
                                    <GraduationCap className="w-4 h-4" />
                                  </div>
                                  <div className="space-y-0.5 min-w-0 flex-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Módulo 1</span>
                                    <h3 className="font-bold text-xs text-slate-800 capitalize truncate leading-tight">
                                      {n1.title}
                                    </h3>
                                  </div>
                                </div>
                              </Card>
                            </div>
                          )}

                          {n1.children?.map((n2) => {
                            const pos2 = positions[n2.id];
                            const isSel2 = selectedNode?.type === 2 && selectedNode.data.id === n2.id;
                            
                            return (
                              <div key={n2.id}>
                                {/* Level 2 Node (Subtopic Card) */}
                                {pos2 && (
                                  <div
                                    onClick={() => setSelectedNode({ type: 2, data: n2 })}
                                    className="absolute cursor-pointer transition-all duration-300"
                                    style={{
                                      left: `${pos2.x}px`,
                                      top: `${pos2.y}px`,
                                      width: `${cardWidth}px`,
                                      height: `${cardHeight}px`,
                                    }}
                                  >
                                    <Card
                                      className={`w-full h-full p-4.5 rounded-2xl flex flex-col justify-center border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                                        isSel2
                                          ? "bg-cyan-50/30 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.12)]"
                                          : "bg-white border-slate-200/90 hover:border-cyan-500/30"
                                      }`}
                                    >
                                      <div className="flex gap-2.5 items-center">
                                        <div className={`p-1.5 rounded-lg ${isSel2 ? 'bg-cyan-500/10 text-cyan-600' : 'bg-slate-100 text-slate-500'}`}>
                                          <Layers className="w-4 h-4" />
                                        </div>
                                        <div className="space-y-0.5 min-w-0 flex-1">
                                          <span className="text-[10px] uppercase font-bold text-slate-400">Subtópico 2</span>
                                          <h3 className="font-semibold text-xs text-slate-700 capitalize truncate leading-tight">
                                            {n2.title}
                                          </h3>
                                        </div>
                                      </div>
                                    </Card>
                                  </div>
                                )}

                                {n2.children?.map((n3) => {
                                  const pos3 = positions[n3.id];
                                  const isSel3 = selectedNode?.type === 3 && selectedNode.data.id === n3.id;
                                  
                                  return (
                                    pos3 && (
                                      <div
                                        key={n3.id}
                                        onClick={() => setSelectedNode({ type: 3, data: n3 })}
                                        className="absolute cursor-pointer transition-all duration-300"
                                        style={{
                                          left: `${pos3.x}px`,
                                          top: `${pos3.y}px`,
                                          width: `${cardWidth}px`,
                                          height: `${cardHeight}px`,
                                        }}
                                      >
                                        {/* Level 3 Node (Lesson Card) */}
                                        <Card
                                          className={`w-full h-full p-4.5 rounded-2xl flex flex-col justify-center border-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                                            isSel3
                                              ? "bg-cyan-500/[0.04] border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                              : "bg-white border-cyan-500/20 hover:border-cyan-500/40"
                                          }`}
                                        >
                                          <div className="flex gap-2.5 items-center">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${
                                              isSel3 ? 'bg-cyan-500 text-white' : 'bg-cyan-50 text-cyan-500'
                                            }`}>
                                              ▶
                                            </div>
                                            <div className="space-y-0.5 min-w-0 flex-1">
                                              <span className="text-[10px] uppercase font-bold text-cyan-400">Aula 3</span>
                                              <h3 className={`font-semibold text-xs truncate leading-tight ${isSel3 ? 'text-cyan-600 font-bold' : 'text-slate-800'}`}>
                                                {n3.title}
                                              </h3>
                                            </div>
                                          </div>
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

                <div className="space-y-6">
                  {mindMap.nodes?.map((n1, idx1) => (
                    <Card key={n1.id} className="p-6 border border-slate-200 bg-card rounded-2xl space-y-4">
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

                      <div className="border-t border-dashed my-3" />

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
                            <div className="pl-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {n2.children?.map((n3) => {
                                const isSel3 = selectedNode?.type === 3 && selectedNode.data.id === n3.id;
                                return (
                                  <Card
                                    key={n3.id}
                                    onClick={() => setSelectedNode({ type: 3, data: n3 })}
                                    className={`p-3 cursor-pointer rounded-xl border transition-all duration-300 flex items-center gap-2.5 ${
                                      isSel3
                                        ? "bg-cyan-50/50 border-cyan-500 shadow-sm"
                                        : "bg-white border-slate-100 hover:border-cyan-500/20 hover:bg-slate-50/30"
                                    }`}
                                  >
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${
                                      isSel3 ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      ▶
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className={`text-xs truncate font-medium ${isSel3 ? 'text-cyan-600 font-bold' : 'text-slate-800'}`}>
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

          {/* RIGHT Syllabus and Video Details Panel */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <motion.div
                  key={`${selectedNode.type}-${selectedNode.data.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <Card className="bg-card border border-slate-200/90 rounded-3xl overflow-hidden shadow-xl shadow-slate-100/40">
                    
                    {/* Level 3 Node -> Renders Iframe Player */}
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
                      </div>
                    )}

                    {/* Meta details text */}
                    <div className="p-6 md:p-8 space-y-4">
                      
                      {/* Node Headers */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            selectedNode.type === 1 
                              ? 'bg-slate-100 text-slate-700' 
                              : selectedNode.type === 2 
                              ? 'bg-cyan-50 text-cyan-600 border border-cyan-100' 
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {selectedNode.type === 1 ? 'Módulo Principal' : selectedNode.type === 2 ? 'Subtópico' : 'Aula Prática'}
                          </span>
                          
                          {selectedNode.type === 3 && selectedNode.data.youtube_url && (
                            <a
                              href={selectedNode.data.youtube_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-500 font-bold hover:underline inline-flex items-center gap-0.5 ml-auto"
                            >
                              Assistir no YouTube
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <h2 className="text-xl md:text-2xl font-bold text-gray-900 capitalize leading-snug">
                          {selectedNode.data.title}
                        </h2>
                      </div>

                      <div className="border-t border-dashed my-3" />

                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 text-xs text-cyan-500 font-bold tracking-wide uppercase">
                          <Info className="w-3.5 h-3.5" /> Descrição do conteúdo:
                        </div>
                        <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                          {selectedNode.data.desc}
                        </p>
                      </div>

                      {/* Sub-elements count listing if module or subtopic is selected */}
                      {selectedNode.type === 1 && (
                        <div className="pt-2 space-y-2.5">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subtópicos inclusos:</p>
                          <div className="space-y-2">
                            {selectedNode.data.children?.map((subNode, sIdx) => (
                              <div
                                key={subNode.id}
                                onClick={() => setSelectedNode({ type: 2, data: subNode })}
                                className="p-3 bg-slate-50 hover:bg-cyan-50/30 border border-slate-100 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs"
                              >
                                <span className="font-bold text-slate-700 capitalize">{sIdx+1}. {subNode.title}</span>
                                <span className="text-[10px] text-cyan-500 font-bold">{subNode.children?.length || 0} aulas</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedNode.type === 2 && (
                        <div className="pt-2 space-y-2.5">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aulas inclusas:</p>
                          <div className="space-y-2">
                            {selectedNode.data.children?.map((lessonNode, lIdx) => (
                              <div
                                key={lessonNode.id}
                                onClick={() => setSelectedNode({ type: 3, data: lessonNode })}
                                className="p-3 bg-slate-50 hover:bg-cyan-50/30 border border-slate-100 rounded-xl cursor-pointer transition-all flex items-center gap-2 text-xs"
                              >
                                <span className="w-5 h-5 rounded bg-cyan-100/50 text-cyan-600 font-bold flex items-center justify-center text-[10px]">{lIdx+1}</span>
                                <span className="font-bold text-slate-700 capitalize truncate flex-1">{lessonNode.title}</span>
                                <span className="text-[10px] text-slate-400">Assistir aula</span>
                              </div>
                            ))}
                          </div>
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
      </div>
    </div>
  );
}
