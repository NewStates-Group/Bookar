"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Plus, Loader2, ArrowRight, ArrowUp, ImageOff, Sparkles, GraduationCap, Award, FileDown, X, Trash2, Share2, Heart, Compass, Layers, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { motion } from "framer-motion";
import { useWebSocket } from "@/context/WebSocketContext";
import { DeleteCourseDialog } from "@/components/DeleteCourseDialog";
import useSWR from 'swr';
import { authenticatedFetcher, apiRequest } from "@/lib/api";

interface Course {
  id: Number;
  prompt: string;
  title?: string;
  desc: string;
  level: string;
  thumb: string;
  status: "PROCESSING" | "READY" | "FAILED" | "ERROR" | "CANCELLED";
  created_at: string;
  max_modules?: number;
  is_fully_completed: boolean;
}

interface FeaturedCourse {
  id: string;
  title: string;
  desc: string;
  level: string;
  thumb: string | null;
  module_count: number;
  owner_name: string | null;
}

interface FeaturedCoursesPage {
  items: FeaturedCourse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const COMMUNITY_PAGE_SIZE = 12;

interface PreviewLesson {
  title: string;
  desc: string;
}

interface PreviewModule {
  id: string;
  name: string;
  desc: string;
  lesson_count: number;
  lessons: PreviewLesson[];
}

interface CoursePreviewDetail {
  id: string;
  title: string;
  desc: string;
  level: string;
  thumb: string | null;
  owner_name: string | null;
  module_count: number;
  modules: PreviewModule[];
}

export default function CoursesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingShareInfo, setPendingShareInfo] = useState<any>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [open, setOpen] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState<number | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<{
    id: number;
    title?: string | null;
  } | null>(null);

  // Community discovery states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<CoursePreviewDetail | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [communityPage, setCommunityPage] = useState(1);
  const [communitySearchInput, setCommunitySearchInput] = useState("");
  const [communitySearch, setCommunitySearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setCommunitySearch(communitySearchInput.trim());
      setCommunityPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [communitySearchInput]);

  const communityFeaturedUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: String(communityPage),
      page_size: String(COMMUNITY_PAGE_SIZE),
    });
    if (communitySearch) {
      params.set("q", communitySearch);
    }
    return `${process.env.NEXT_PUBLIC_API_URL}/courses/featured?${params.toString()}`;
  }, [communityPage, communitySearch]);

  const {
    data: featuredPage,
    isLoading: isLoadingCommunity,
  } = useSWR<FeaturedCoursesPage>(
    communityFeaturedUrl,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch featured courses");
      return res.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true,
    }
  );

  const featuredCourses = featuredPage?.items ?? [];

  const handleOpenPreview = async (courseId: string) => {
    setShowPreviewModal(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/preview`);
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      } else {
        toast.error("Erro ao obter pré-visualização do curso.");
        setShowPreviewModal(false);
      }
    } catch {
      toast.error("Erro de conexão.");
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCloneCourse = async (courseId: string) => {
    // @ts-ignore
    if (!session?.accessToken) {
      toast.error("Por favor, faça login para importar este curso.");
      return;
    }
    setIsCloning(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/clone`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // @ts-ignore
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
      if (res.ok) {
        toast.success("Curso importado com sucesso! 🎓");
        mutateCourses();
        setShowPreviewModal(false);
      } else {
        const err = await res.json();
        toast.error(err.message || "Erro ao importar curso.");
      }
    } catch {
      toast.error("Erro ao importar curso.");
    } finally {
      setIsCloning(false);
    }
  };

  const { data: swrCourses, mutate: mutateCourses } = useSWR(
    // @ts-ignore
    session?.accessToken ? [`${process.env.NEXT_PUBLIC_API_URL}/courses`, session.accessToken] : null,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  useEffect(() => {
    if (swrCourses) {
      setCourses(swrCourses);
      setIsLoading(false);
    }
  }, [swrCourses]);

  const confirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    const courseId = courseToDelete.id;
    setIsDeletingCourse(courseId);
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}`, {
        method: "DELETE",
      });
      mutateCourses();
      setCourseToDelete(null);
    } catch {
      toast.error("Erro ao eliminar curso.");
    } finally {
      setIsDeletingCourse(null);
    }
  };

  const [step, setStep] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [numModules, setNumModules] = useState<number>(5);
  const [level, setLevel] = useState<"B" | "IT" | "A">("B");

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileNames, setProfileNames] = useState({ firstName: "", lastName: "" });

  const { addListener } = useWebSocket();

  useEffect(() => {
    const removeListener = addListener((data) => {
      if (data.type === "course_update") {
        mutateCourses();

        if (data.status === "READY" && data.title) {
          toast.success(`Curso "${data.title}" está pronto!`);
        }
      }
    });

    return () => removeListener();
  }, [addListener, mutateCourses]);

  const levelConfig = {
    B: { label: "Iniciante", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    IT: { label: "Intermediário", color: "bg-blue-100 text-blue-700 border-blue-200" },
    A: { label: "Avançado", color: "bg-purple-100 text-purple-700 border-purple-200" },
  };

  useEffect(() => {
    if (session?.accessToken) {
      checkPendingShare();

      // Check if profile needs completion
      const user = session.user as any;
      if (user && (!user.first_name || !user.last_name)) {
        setShowNameModal(true);
      }
    }
  }, [session]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("create") === "true") {
        setOpen(true);
        const newUrl = window.location.pathname;
        window.history.replaceState({ path: newUrl }, "", newUrl);
      }
    }
  }, []);


  const checkPendingShare = async () => {
    const token = localStorage.getItem("pending_share_token");
    if (!token || !session?.accessToken) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/share/${token}`);
      if (res.ok) {
        const data = await res.json();

        // Check if course is already in the list
        if (courses.some(c => String(c.id) === String(data.course_id))) {
          localStorage.removeItem("pending_share_token");
          return;
        }

        setPendingShareInfo(data);
        setShowImportModal(true);
      } else {
        localStorage.removeItem("pending_share_token");
      }
    } catch (error) {
      // console.error("Error fetching share info:", error);
    }
  };

  const confirmClaim = async () => {
    const token = localStorage.getItem("pending_share_token");
    if (!token || !session?.accessToken) return;

    setIsClaiming(true);
    try {
      const data = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/courses/share/${token}/claim`, {
        method: "POST",
      });

      toast.success(data.message || "Curso importado com sucesso!");
      mutateCourses();
    } catch (error: any) {
      toast.error(error.message || "Erro ao importar curso.");
    } finally {
      setIsClaiming(false);
      setShowImportModal(false);
      localStorage.removeItem("pending_share_token");
    }
  };


  const handleNext = () => {
    if (step === 1 && prompt.trim()) {
      setStep(2);
    } else if (step === 2 && numModules >= 1 && numModules <= 20) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    }
  };

  const handleProfileUpdate = async () => {
    if (!profileNames.firstName || !profileNames.lastName) {
      toast.error("Por favor, preencha o nome e sobrenome.");
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          first_name: profileNames.firstName,
          last_name: profileNames.lastName,
        }),
      });

      if (res.ok) {
        toast.success("Perfil atualizado com sucesso!");
        setShowNameModal(false);
        // Refresh session to update UI
        // @ts-ignore
        const { update } = (await import("next-auth/react"));
        update();
      } else {
        toast.error("Erro ao atualizar perfil.");
      }
    } catch (err) {
      toast.error("Erro de conexão.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };


  const downloadCertificate = async (course: Course, name?: string) => {
    setIsDownloading(true);
    try {
      const queryParams = name ? `?full_name=${encodeURIComponent(name)}` : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course.id}/certificate${queryParams}`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificado_${course.title || 'Curso'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Certificado baixado com sucesso!");
        setShowNameModal(false);
      } else {
        const error = await res.json();
        toast.error(error.message || "Erro ao baixar certificado");
      }
    } catch (e) {
      toast.error("Erro ao baixar certificado");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCreateCourse = async () => {
    setIsCreating(true);

    try {
      const course = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/courses`, {
        method: "POST",
        body: JSON.stringify({
          prompt,
          level,
          num_modules: numModules,
        }),
      });

      setOpen(false);
      setPrompt("");
      setNumModules(5);
      setLevel("B");
      setStep(1);

      mutateCourses();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar curso");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setStep(1);
      setPrompt("");
      setNumModules(5);
      setLevel("B");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (step === 1 || step === 2) {
        handleNext();
      } else {
        handleCreateCourse();
      }
    }
  };

  if (status === "loading") {
    return null
  }

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const steps = [
    {
      title: "Sobre o que você quer aprender?",
      desc: "Descreva o tema do curso que você quer gerar ex: 'História da Roma Antiga' ou 'Introdução ao Python'.",
      content: (
        <div className="space-y-4">
          <Label htmlFor="prompt" className="text-lg">
            Tópico do Curso
          </Label>
          <Textarea
            id="prompt"
            placeholder="Ex: Marketing Digital para Iniciantes, Física Quântica Básica..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="h-32 text-lg resize-none"
            onKeyDown={handleKeyPress}
          />
        </div>
      ),
    },
    {
      title: "Qual o seu nível de conhecimento?",
      desc: "Isso ajuda a IA a adaptar a complexidade do conteúdo.",
      content: (
        <div className="space-y-4">
          <Label className="text-lg">Nível de Dificuldade</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { value: "B", label: "Iniciante", icon: Sparkles, desc: "Para quem está começando do zero." },
              { value: "IT", label: "Intermediário", icon: BookOpen, desc: "Para quem já tem noção do assunto." },
              { value: "A", label: "Avançado", icon: GraduationCap, desc: "Para quem busca aprofundamento técnico." },
            ].map((option) => (
              <div
                key={option.value}
                onClick={() => setLevel(option.value as "B" | "IT" | "A")}
                className={`
                                    cursor-pointer rounded-xl border-2 p-4 transition-all hover:border-primary/50 hover:bg-muted/50
                                    ${level === option.value ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card"}
                                `}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${level === option.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <option.icon className="w-5 h-5" />
                  </div>
                  <span className="font-semibold">{option.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">{option.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="sm:max-w-[450px]">
          <div className="text-center space-y-4 pt-4">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto">
              <Share2 className="w-8 h-8 text-cyan-500" />
            </div>
            <DialogTitle className="text-2xl font-bold text-balance">Novo Curso Disponível!</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              <span className="font-bold text-foreground">{pendingShareInfo?.sharer_name}</span> partilhou um curso consigo.
            </DialogDescription>
          </div>

          <div className="bg-muted/50 p-6 rounded-2xl border-2 border-dashed border-cyan-500/20 my-4 text-center">
            <h3 className="text-xl font-black capitalize text-cyan-600 mb-2">
              {pendingShareInfo?.course_title}
            </h3>
            <p className="text-sm text-balance">
              Este curso será adicionado à sua biblioteca pessoal.
            </p>
          </div>

          <div className="flex flex-col gap-3 pb-2">
            <Button
              className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-lg font-bold rounded-full"
              onClick={confirmClaim}
              disabled={isClaiming}
            >
              {isClaiming ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Importando...
                </>
              ) : (
                "Importar Agora"
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full h-12 rounded-full text-muted-foreground hover:text-red-500"
              onClick={() => {
                setShowImportModal(false);
                localStorage.removeItem("pending_share_token");
              }}
              disabled={isClaiming}
            >
              Ignorar Convite
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Os Meus Cursos</h1>
          <span className="text-sm text-gray-700">Crie cursos com IA e aprenda com eles!</span>
        </div>
        <div>
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 gap-2 shadow-lg hover:shadow-xl transition-all" title="Novo curso">
                <Plus className="h-5 w-5" />
                <span className="hidden md:block">
                  Criar Curso
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] p-6 overflow-hidden border border-slate-100 rounded-3xl shadow-2xl bg-white">
              <div className="text-center space-y-5 pt-4">
                <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/10 animate-pulse">
                  <Heart className="w-8 h-8 text-rose-500 fill-rose-500/20" />
                </div>

                <DialogTitle className="text-xl font-extrabold text-slate-800 leading-tight">
                  Serviço Indisponível
                </DialogTitle>

                <DialogDescription className="text-base text-slate-500 leading-relaxed max-w-sm mx-auto text-center">
                  Devido aos custos operacionais das APIs de IAs a funcionalidade de criação de novos cursos está temporariamente suspensa.
                </DialogDescription>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50/50 via-slate-50 to-slate-50 border border-slate-100 my-5 text-left space-y-2">
                <h4 className="text-base font-bold text-slate-700">Como posso ajudar?</h4>
                <p className="text-base text-slate-500 leading-relaxed">
                  Se valoriza o Bookar, considere contribuir para ajudar na retomada da funcionalidade!
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pb-2">
                <Button
                  asChild
                  className="w-full h-11 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-full shadow-md shadow-rose-500/15 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <a href="https://patreon.com/bookar" target="_blank" rel="noopener noreferrer">
                    <Heart className="w-4 h-4 fill-white" />
                    Apoiar o Projeto (Patreon / Stripe)
                  </a>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Carregando seus dados...</p>
          </div>
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4">
          <div className="mb-4">
            <BookOpen className="w-10 h-10 text-primary/60" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nenhum curso</h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Comece sua jornada, crie um curso personalizado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Card
              key={`${course.id}`}
              className="group md:max-w-sm p-4 bg-white border border-slate-200/70 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col gap-0 overflow-hidden"
            >
              {course.status === "PROCESSING" && !course.title && !course.thumb ? (
                <div className="flex flex-col items-center justify-center h-full rounded-lg py-8 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    onClick={() =>
                      setCourseToDelete({ id: course.id, title: course.title })
                    }
                    disabled={isDeletingCourse === course.id}
                  >
                    {isDeletingCourse === course.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </Button>
                  <Loader2 className="w-12 h-12 text-slate-600 animate-spin" />
                  <span className="text-gray-500 mt-2">Gerando curso...</span>
                </div>
              ) : course.status === "FAILED" || course.status === "ERROR" ? (
                <div className="flex flex-col items-center justify-center h-full rounded-lg py-8 gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <X className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-red-600">Geração Falhou</p>
                    <p className="text-sm text-gray-400 mt-1">{course.title || "Curso sem título"}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-500 hover:bg-red-50 gap-2"
                    onClick={() =>
                      setCourseToDelete({ id: course.id, title: course.title })
                    }
                    disabled={isDeletingCourse === course.id}
                  >
                    {isDeletingCourse === course.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Eliminar Curso
                  </Button>
                </div>
              ) : (
                <>
                  <div
                    className="aspect-video mb-3 cursor-pointer"
                    onClick={() => router.push('/app/courses/' + course.id)}
                  >
                    {course.thumb ? (
                      <img
                        src={course.thumb.startsWith('http') ? course.thumb : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/media/${course.thumb}`}
                        alt={course.title}
                        className="rounded-xl object-cover w-full h-full"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full border rounded-lg">
                        <ImageOff className="w-12 h-12 text-slate-400" />
                        <span className="text-gray-500">
                          Capa Indisponível
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <h1 className="text-lg">{course.title}</h1>
                  </div>
                  <p className="line-clamp-2 text-gray-600 text-base">{course.desc}</p>
                  <Link href={'/app/courses/' + course.id} className="text-blue-600 mt-2 mb-4">Veja mais</Link>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-cyan-300/10 px-2 py-1 text-xs font-medium text-blue-400 inset-ring inset-ring-blue-300/30">
                        {course.level === 'B' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
                      </span>
                    </div>
                    {course.is_fully_completed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-cyan-500 hover:text-cyan-600 hover:bg-cyan-50 gap-1 h-8"
                        disabled={isDownloading && selectedCourse?.id === course.id}
                      >
                        {isDownloading && selectedCourse?.id === course.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Award className="w-3 h-3" />
                        )}
                        Certificado
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="pt-10 border-t border-slate-200/80 mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Explore Cursos da Comunidade
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Aprenda com cursos criados por outros estudantes e adicione-os à sua conta
            </p>
            {featuredPage && featuredPage.total > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {featuredPage.total}{" "}
                {featuredPage.total === 1
                  ? "curso disponível"
                  : "cursos disponíveis"}
              </p>
            )}
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              type="search"
              placeholder="Pesquisar por título, descrição ou autor…"
              value={communitySearchInput}
              onChange={(e) => setCommunitySearchInput(e.target.value)}
              className="pl-9 h-10 rounded-xl border-slate-200/80 bg-white"
            />
          </div>
        </div>

        {isLoadingCommunity && !featuredPage ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : featuredCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
            <Compass className="w-10 h-10 text-slate-300 mb-3" />
            <p className="font-medium text-slate-600">
              {communitySearch
                ? "Nenhum curso encontrado para esta pesquisa."
                : "Ainda não há cursos da comunidade."}
            </p>
            {communitySearch && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-cyan-600"
                onClick={() => setCommunitySearchInput("")}
              >
                Limpar pesquisa
              </Button>
            )}
          </div>
        ) : (
          <>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity ${isLoadingCommunity ? "opacity-60 pointer-events-none" : ""}`}
            >
              {featuredCourses.map((fc) => (
                <div
                  key={fc.id}
                  onClick={() => handleOpenPreview(fc.id)}
                  className="bg-white border border-slate-200/70 rounded-xl p-3 group cursor-pointer flex flex-col hover:border-cyan-200/80 hover:shadow-md transition-all duration-300"
                >
                  <div className="aspect-[16/9] w-full rounded-lg overflow-hidden mb-3 relative bg-slate-50 border border-slate-200/60">
                    {fc.thumb ? (
                      <img
                        src={
                          fc.thumb.startsWith("http")
                            ? fc.thumb
                            : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/media/${fc.thumb}`
                        }
                        alt={fc.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50">
                        <ImageOff className="w-7 h-7 text-slate-300" />
                        <span className="text-[9px] mt-1 text-slate-400">Sem capa</span>
                      </div>
                    )}
                  </div>

                  <h3 className="font-semibold text-base text-slate-800 line-clamp-2 group-hover:text-cyan-600 transition-colors leading-tight mb-1 capitalize">
                    {fc.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-1">{fc.owner_name}</p>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="text-xs text-cyan-700 font-bold bg-cyan-100 px-2 py-0.5 rounded-sm">
                      {fc.level === "B"
                        ? "Iniciante"
                        : fc.level === "IT"
                          ? "Intermediário"
                          : "Avançado"}
                    </span>
                    <span className="text-xs font-light border border-slate-300 px-2 py-0.5 rounded-sm">
                      {fc.module_count} módulo{fc.module_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {featuredPage && featuredPage.total_pages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-500 order-2 sm:order-1">
                  Página {featuredPage.page} de {featuredPage.total_pages}
                </p>
                <div className="flex items-center gap-2 order-1 sm:order-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1"
                    disabled={communityPage <= 1 || isLoadingCommunity}
                    onClick={() => setCommunityPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1"
                    disabled={
                      communityPage >= featuredPage.total_pages || isLoadingCommunity
                    }
                    onClick={() =>
                      setCommunityPage((p) =>
                        Math.min(featuredPage.total_pages, p + 1)
                      )
                    }
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL: PREVIEW DO CURSO DA COMUNIDADE ── */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-[520px] p-6 max-h-[85vh] overflow-y-auto border border-slate-100 rounded-md shadow-2xl bg-white scrollbar-thin">
          {previewLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
              <p className="text-xs font-bold text-slate-500 animate-pulse">Obtendo detalhes do curso...</p>
            </div>
          ) : previewData ? (
            <div className="space-y-6">
              <div className="aspect-video w-full rounded-2xl overflow-hidden relative bg-slate-50 border border-slate-100">
                {previewData.thumb ? (
                  <img
                    src={previewData.thumb.startsWith('http') ? previewData.thumb : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/media/${previewData.thumb}`}
                    alt={previewData.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <ImageOff className="w-12 h-12 text-slate-350" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <DialogTitle className="text-xl md:text-2xl font-black text-slate-800 leading-snug capitalize">
                  {previewData.title}
                </DialogTitle>
                {previewData.owner_name && (
                  <div className="flex gap-3">
                  <p className="text-xs text-slate-400 font-medium">
                    Criado por <span className="text-slate-600 font-bold">{previewData.owner_name}</span>
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    Nível <span className="text-slate-600 font-bold">
                     {previewData.level === 'B' ? 'Iniciante' : previewData.level === 'IT' ? 'Intermediário' : 'Avançado'}
                    </span>
                  </p>
                  </div>
                )}
                <DialogDescription className="text-sm md:text-sm text-slate-500 leading-relaxed">
                  {previewData.desc || "Sem descrição disponível para este curso."}
                </DialogDescription>
              </div>

              {/* Modules list preview */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-500" />
                  Grade Curricular ({previewData.module_count} {previewData.module_count > 1 ? 'Módulos' : 'Módulo'})
                </h4>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1.5 scrollbar-thin">
                  {previewData.modules.map((mod, idx) => (
                    <div key={mod.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-slate-700 capitalize">
                          Módulo {idx + 1}: {mod.name} ({mod.lesson_count} Aulas)
                        </span>
                      </div>
                      {mod.desc && <p className="text-sm text-slate-400 line-clamp-1">{mod.desc}</p>}

                      {/* Lesson title listing */}
                      {mod.lessons && mod.lessons.length > 0 && (
                        <div className="pl-3 border-l-2 border-slate-200 pt-1 space-y-1">
                          {mod.lessons.map((lesson, lIdx) => (
                            <div key={lIdx} className="text-xs text-slate-500 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-cyan-400 flex-shrink-0" />
                              <span className="font-semibold line-clamp-1">{lesson.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <Button
                  onClick={() => handleCloneCourse(previewData.id)}
                  disabled={isCloning}
                  className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold rounded-lg gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-cyan-500/10 cursor-pointer"
                >
                  {isCloning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Importar Curso
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowPreviewModal(false)}
                  className="py-2 border rounded-lg text-xs font-bold text-slate-450 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                >
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              Erro ao carregar pré-visualização.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteCourseDialog
        open={!!courseToDelete}
        onOpenChange={(open) => !open && !isDeletingCourse && setCourseToDelete(null)}
        courseTitle={courseToDelete?.title}
        isDeleting={!!courseToDelete && isDeletingCourse === courseToDelete.id}
        onConfirm={confirmDeleteCourse}
      />
    </div>
  );
}