"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Plus, Loader2, ArrowRight, ArrowLeft, ArrowUp, ImageOff, LogOut, Trash } from "lucide-react";
import { useEffect, useState } from "react";
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

interface Course {
  id: Number;
  title: string;
  desc: string;
  level: string;
  thumb: string;
  status: "PROCESSING" | "READY" | "ERROR";
  created_at: string;
}

export default function OverviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [open, setOpen] = useState(false);

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [level, setLevel] = useState<"B" | "IT" | "A">("B");

  const levelConfig = {
    B: { label: "Iniciante", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    IT: { label: "Intermediário", color: "bg-blue-100 text-blue-700 border-blue-200" },
    A: { label: "Avançado", color: "bg-purple-100 text-purple-700 border-purple-200" },
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchCourses();
    }
  }, [session]);

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
    if (step === 1 && title.trim()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const waitForCourseReady = async (courseID: Number) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/courses/${courseID}`,
          {
            headers: {
              Authorization: `Bearer ${session?.accessToken}`,
            },
          }
        );

        if (!res.ok) return;
        const course = await res.json();
        if (course.status === "READY" || course.status === "FAILED") {
          clearInterval(interval);
          fetchCourses();
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);
  };

  const handleCreateCourse = async () => {
    if (!details.trim()) return;

    setIsCreating(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          title,
          details,
          level,
        }),
      });

      if (res.ok) {
        const course = await res.json();

        setOpen(false);
        setTitle("");
        setDetails("");
        setLevel("B");
        setStep(1);

        fetchCourses();
        waitForCourseReady(course.id);
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
      setTitle("");
      setDetails("");
      setLevel("B");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (step === 1) {
        handleNext();
      } else {
        handleCreateCourse();
      }
    }
  };

  const handleDeleteCourse = async (courseId: Number) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        }
      );
      if (res.ok) {
        fetchCourses();
      } else {
        toast.error("Erro ao excluir curso");
      }
    } catch (e) {
      toast.error("Erro de conexão");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Olá, {session.user?.name}!
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Comece sua jornada de aprendizado.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center justify-center">

              <Button onClick={() => {
                signOut({ callbackUrl: '/login' })
              }} size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-all" variant={"outline"}>
                <LogOut className="h-5 w-5 text-red-500" />
                <span className="text-black">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Cursos</h1>
            <span className="text-sm text-gray-700">Crie cursos e aprenda com eles</span>
          </div>
          <div>
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-all" title="Novo curso">
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
                      {step === 1
                        ? "Dê um nome ao seu curso"
                        : "Descreva o que você quer aprender"}
                    </DialogDescription>
                  </div>

                  <div className="px-8 pb-8">
                    {step === 1 && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-300">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">
                            Título do curso
                          </label>
                          <div className="relative group">
                            <Input
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              onKeyPress={handleKeyPress}
                              placeholder="Digite o título do seu curso"
                              className="h-14 text-lg pr-14 border-2 focus:ring-0 transition-all"
                              autoFocus
                            />
                            <Button
                              type="button"
                              onClick={handleNext}
                              disabled={!title.trim()}
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              <ArrowRight className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Pressione Enter para continuar
                        </p>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-300">
                        <div className="space-y-2">
                          <div className="relative rounded-xl border-2 focus-within:border-gray-300 transition-all bg-white shadow-sm">
                            <Textarea
                              value={details}
                              onChange={(e) => setDetails(e.target.value)}
                              placeholder="Descreva os tópicos que você quer aprender..."
                              className="min-h-[100px] resize-none border-0 text-base p-4"
                            />
                            <div className="border-t px-4 py-3 bg-slate-50/50 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  onClick={handleBack}
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 hover:bg-white"
                                >
                                  <ArrowLeft className="h-4 w-4" />
                                  Voltar
                                </Button>
                                <div className="h-4 w-px bg-border" />
                                <Select
                                  value={level}
                                  onValueChange={(v) => setLevel(v as any)}
                                >
                                  <SelectTrigger className="w-[160px] border-0 bg-transparent hover:bg-white transition-colors outline-none focus-visible:border-ring focus-visible:ring-[1px] focus-visible:ring-gray-300">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="B">Iniciante</SelectItem>
                                    <SelectItem value="IT">Intermediário</SelectItem>
                                    <SelectItem value="A">Avançado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">
                                  {details.length}/150
                                </span>
                                <Button
                                  type="button"
                                  onClick={handleCreateCourse}
                                  disabled={isCreating || !details.trim()}
                                  size="icon"
                                  className="h-9 w-9 rounded-full shadow-md hover:shadow-lg transition-all"
                                >
                                  {isCreating ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ArrowUp className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="w-full border mt-2"></div>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Carregando seus cursos...</p>
            </div>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="mb-4">
              <BookOpen className="w-10 h-10 text-primary/60" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum curso ainda</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Comece sua jornada de aprendizado criando seu primeiro curso personalizado
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card
                key={`${course.id}`}
                className="group cursor-pointer overflow-hidden border-0 bg-transparent shadow-none transition-all duration-300"
                onClick={() => router.push('/courses/' + course.id)}
              >
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-lg">
                  {course.thumb ? (
                    <img src={"http://localhost:8000/media/" + course.thumb} alt={course.title} className="object-cover w-full h-full" />
                  ) : course.status === "PROCESSING" ? (
                    <div className="flex flex-col items-center justify-center h-full border rounded-lg">
                      <Loader2 className="w-12 h-12 text-slate-600 animation-spin" />
                      <span className="text-gray-500">
                        Gerando curso...
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full border rounded-lg">
                      <ImageOff className="w-12 h-12 text-slate-400" />
                      <span className="text-gray-500">
                        Capa Indisponível
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 px-6 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-primary px-3 py-1 rounded-full text-xs font-bold text-primary-foreground">
                        {course.level === 'B' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
                      </span>
                    </div>
                    <h1 className="text-xl font-bold capitalize">{course.title}</h1>
                  </div>
                </div>
              </Card>

            ))}
          </div>
        )}
      </div>
    </div>
  );
}