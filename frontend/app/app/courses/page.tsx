"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Plus, Loader2, ArrowRight, ArrowUp, ImageOff, Sparkles, GraduationCap, Award, FileDown, X, Trash2, Share2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
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

  const handleDeleteCourse = async (courseId: Number) => {
    if (!window.confirm("Tem certeza que deseja eliminar este curso?")) return;
    setIsDeletingCourse(courseId as number);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (res.ok) {
        setCourses(prev => prev.filter(c => c.id !== courseId));
        toast.success("Curso eliminado.");
      } else {
        toast.error("Erro ao eliminar curso.");
      }
    } catch {
      toast.error("Erro de conexão.");
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
        setCourses((prev) =>
          prev.map((c) =>
            String(c.id) === String(data.id)
              ? {
                ...c,
                status: data.status,
                title: data.title || c.title,
                desc: data.desc || c.desc,
                thumb: data.thumb || c.thumb,
              }
              : c
          )
        );

        if (data.status === "READY" && data.title) {
          toast.success(`Curso "${data.title}" está pronto!`);
        }
      }
    });

    return () => removeListener();
  }, [addListener]);

  const levelConfig = {
    B: { label: "Iniciante", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    IT: { label: "Intermediário", color: "bg-blue-100 text-blue-700 border-blue-200" },
    A: { label: "Avançado", color: "bg-purple-100 text-purple-700 border-purple-200" },
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchCourses();
      checkPendingShare();

      // Check if profile needs completion
      const user = session.user as any;
      if (user && (!user.first_name || !user.last_name)) {
        setShowNameModal(true);
      }
    }
  }, [session]);


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
      console.error("Error fetching share info:", error);
    }
  };

  const confirmClaim = async () => {
    const token = localStorage.getItem("pending_share_token");
    if (!token || !session?.accessToken) return;

    setIsClaiming(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/share/${token}/claim`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Curso importado com sucesso!");
        fetchCourses();
      } else {
        const err = await res.json();
        toast.error(err.message || "Erro ao importar curso.");
      }
    } catch (error) {
      toast.error("Erro ao importar curso.");
    } finally {
      setIsClaiming(false);
      setShowImportModal(false);
      localStorage.removeItem("pending_share_token");
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch (error) {
      console.error("Failed to fetch courses", error);
    } finally {
      setIsLoading(false);
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

  const handleCertificateClick = (course: Course) => {
    setSelectedCourse(course);
    // @ts-ignore
    const sessionName = session?.user?.name || (session as any)?.user?.full_name;

    if (sessionName) {
      downloadCertificate(course, sessionName);
    } else {
      setShowNameModal(true);
    }
  };

  const handleCreateCourse = async () => {

    setIsCreating(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          prompt,
          level,
          num_modules: numModules,
        }),
      });

      if (res.ok) {
        const course = await res.json();

        setOpen(false);
        setPrompt("");
        setNumModules(5);
        setLevel("B");
        setStep(1);

        // Add the new course to the list immediately with PROCESSING status
        const newCourse: Course = {
          id: course.id,
          prompt: prompt,
          desc: "Gerando descrição...", // Placeholder
          level: level,
          thumb: "",
          status: "PROCESSING",
          created_at: new Date().toISOString(),
          max_modules: numModules,
          is_fully_completed: false
        };

        setCourses(prev => [newCourse, ...prev]);
      } else {
        const err = await res.json();
        toast.error(err.message || "Erro ao criar curso");
      }
    } catch (error) {
      toast.error("Erro de conexão");
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
      {/* Profile Completion Modal */}
      <Dialog open={showNameModal} onOpenChange={(val) => {
        // Prevent closing if names are missing
        const user = session?.user as any;
        if (user && user.first_name && user.last_name) {
          setShowNameModal(val);
        }
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <div className="text-center space-y-4 pt-4">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-cyan-500" />
            </div>
            <DialogTitle className="text-2xl font-bold">Complete seu Perfil</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Para uma melhor experiência (e para que o seu certificado seja válido), precisamos do seu nome completo.
            </DialogDescription>
          </div>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Primeiro Nome</Label>
              <Input
                id="firstName"
                placeholder="Ex: João"
                value={profileNames.firstName}
                onChange={(e) => setProfileNames({ ...profileNames, firstName: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apelido (Sobrenome)</Label>
              <Input
                id="lastName"
                placeholder="Ex: Silva"
                value={profileNames.lastName}
                onChange={(e) => setProfileNames({ ...profileNames, lastName: e.target.value })}
                className="h-11"
              />
            </div>
          </div>

          <div className="pb-4">
            <Button
              className="w-full h-11 bg-cyan-500 hover:bg-cyan-600 font-semibold"
              onClick={handleProfileUpdate}
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Atualizando...
                </>
              ) : (
                "Finalizar Registo"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Confirmation Modal */}
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
          <h1 className="text-3xl font-bold">Cursos</h1>
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
            <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden border-0 shadow-2xl">
              <div className="relative overflow-hidden">
                <div className="p-8 pb-3">
                  <DialogTitle className="text-center text-3xl font-bold">
                    Criar Novo Curso
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-center  text-base">
                    {steps[step - 1]?.desc}
                  </DialogDescription>
                </div>

                <div className="px-8 pb-8">
                  {steps[step - 1].content}
                  <div className="w-full flex gap-2 justify-end mt-6">
                    {step > 1 && (
                      <Button
                        type="button"
                        onClick={prevStep}
                        variant="outline"
                      >
                        Voltar
                      </Button>
                    )}
                    {step < steps.length ? (
                      <Button
                        type="button"
                        onClick={nextStep}
                        disabled={step === 1 && !prompt.trim()}
                      >
                        Avançar
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleCreateCourse}
                        disabled={isCreating}
                      >
                        {isCreating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowUp className="h-4 w-4" />
                        )}
                        {isCreating ? "Criando..." : "Criar Curso"}
                      </Button>
                    )}
                  </div>
                </div>
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
        <div className="flex flex-col items-center justify-center py-20 px-4">
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
              className="group md:max-w-sm p-4 border overflow-hidden shadow-none bg-transparent hover:bg-gray-50 transition-all duration-300 gap-0"
            >
              {/* Early PROCESSING: no title or thumb yet — show spinner */}
              {course.status === "PROCESSING" && !course.title && !course.thumb ? (
                <div className="flex flex-col items-center justify-center h-full rounded-lg py-8 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    onClick={() => handleDeleteCourse(course.id)}
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
                    onClick={() => handleDeleteCourse(course.id)}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCertificateClick(course);
                        }}
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
    </div>
  );
}