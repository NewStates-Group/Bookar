"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Plus, Loader2, PlayCircle, ArrowRight, ArrowLeft, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea2 } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Course {
  id: string;
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
  const [level, setLevel] = useState<"B" | "IT" | "A" >("B");

  const levelLabel = {
    B: "Iniciante",
    IT: "Intermediário",
    A: "Avançado",
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

  const waitForCourseReady = async (courseID: string, title: string) => {
    const toastId = toast.loading(`Criando seu curso de ${title}`);

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

        if (course.status === "READY") {
          clearInterval(interval);
          toast.success(`Curso de "${title}" criado.`, {
            id: toastId,
          });
          fetchCourses();
        }

        if (course.status === "ERROR") {
          clearInterval(interval);
          toast.error(`Erro ao criar o curso "${title}"`, {
            id: toastId,
          });
        }
      } catch (err) {
        console.error(err);
      }
    }, 5000);
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
        setLevel("NONE");
        setStep(1);
        waitForCourseReady(course.id, course.title);
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
      setLevel("NONE");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (step === 1) {
        handleNext();
      } else {
        handleCreateCourse();
      }
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Olá, {session.user?.name}
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus cursos e aprendizado
            </p>
          </div>
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Curso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white border shadow-2xl backdrop-blur-lg">
              <div className="p-8 pb-6 text-center">
                <DialogTitle className="text-center text-3xl font-bold flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Criar Novo Curso
                </DialogTitle>
                <DialogDescription className="mt-3 text-base">
                  {step === 1 ? "Comece dando um nome ao seu curso" : "Conte-nos mais sobre o que deseja aprender"}
                </DialogDescription>
              </div>

              <div className="px-8 pb-8 space-y-6">
                {step === 1 && (
                  <div className="animate-in fade-in slide-in-from-right-5 duration-300">
                    <div className="relative group">
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Digite o título do curso..."
                        className="h-16 text-lg pr-16 bg-white dark:bg-zinc-800 border-2 focus:border-primary transition-all shadow-sm"
                        autoFocus
                      />
                      <Button
                        type="button"
                        onClick={handleNext}
                        disabled={!title.trim()}
                        size="icon"
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg hover:scale-110 transition-transform"
                      >
                        <ArrowRight className="h-5 w-5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 ml-1">
                      Pressione Enter ou clique na seta para continuar
                    </p>
                  </div>
                )}

                {step === 2 && (
                  <div className="animate-in fade-in slide-in-from-right-5 duration-300 space-y-4">
                    <div className="rounded-2xl border-2 bg-white dark:bg-zinc-800 p-5 focus-within:ring-1/4 focus-within:ring-gray focus-within:border-gray-400 transition-all relative shadow-sm">
                      <Textarea2
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        placeholder="Descreva o que você quer aprender..."
                        className="min-h-[100px] resize-none border-none bg-transparent p-0 focus-visible:ring-0 text-base leading-relaxed"
                      />
                      <div className="flex justify-between items-center mt-4 pt-4 border-t">
                        <div className="flex items-center justify-start gap-3">
                          <Button
                            type="button"
                            onClick={handleBack}
                            variant="outline"
                            size="sm"
                            className="gap-2 -ml-2 hover:bg-muted/50"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Voltar
                          </Button>
                          <div className="flex items-center gap-0">

                            <Select value={level} onValueChange={setLevel} required>
                              <SelectTrigger className="border-none text-base">
                                <SelectValue />
                              </SelectTrigger>

                              <SelectContent>
                                <SelectItem value="B">Iniciante</SelectItem>
                                <SelectItem value="IT">Intermediário</SelectItem>
                                <SelectItem value="A">Avançado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                        </div>

                        <div className="flex items-center justify-end gap-3">
                          <span className="text-xs text-muted-foreground">
                            {details.length}/200 caracteres
                          </span>
                          <Button
                            type="button"
                            onClick={handleCreateCourse}
                            disabled={isCreating || !details.trim()}
                            className="h-8 w-8 rounded-full transition-all"
                          >
                            {isCreating ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <ArrowUp className="h-5 w-5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full text-center py-10 text-muted-foreground">
              Carregando cursos...
            </div>
          ) : courses.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed rounded-lg text-muted-foreground">
              <BookOpen className="w-12 h-12 mb-4 opacity-50" />
              <p>Você ainda não criou nenhum curso.</p>
            </div>
          ) : (
            courses.map((course) => (
              <Card key={course.id} className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
                <div className="relative aspect-video bg-muted">
                  {course.thumb ? (
                    <img
                      src={course.thumb.replace("/app", "http://localhost:8000")}
                      alt={course.title}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-primary/5">
                      <BookOpen className="w-10 h-10 text-primary/20" />
                    </div>
                  )}
                  {course.status === "PROCESSING" && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                      <Loader2 className="w-8 h-8 animate-spin mb-2" />
                      <span className="font-medium text-sm">
                        Gerando Curso...
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {course.level === "B"
                        ? "Iniciante"
                        : course.level === "IT"
                          ? "Intermediário"
                          : "Avançado"}
                    </span>
                    {course.status === "ERROR" && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                        Erro
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg line-clamp-2 mb-2">
                    {course.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-3 mb-4 flex-1">
                    {course.desc}
                  </p>

                  {course.status === "READY" ? (
                    <Link href={`/courses/${course.id}/`}>
                      <Button className="w-full gap-2">
                        <PlayCircle className="w-4 h-4" />
                        Acessar Curso
                      </Button>
                    </Link>
                  ) : (
                    <Button disabled className="w-full">
                      {course.status === "PROCESSING"
                        ? "Processando..."
                        : "Indisponível"}
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}