"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Plus, Loader2, ArrowRight, ArrowUp, ImageOff } from "lucide-react";
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
import Link from "next/link";

interface Course {
  id: Number;
  prompt: string;
  title?: string;
  desc: string;
  level: string;
  thumb: string;
  status: "PROCESSING" | "READY" | "ERROR";
  created_at: string;
}

export default function CoursesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [open, setOpen] = useState(false);

  const [step, setStep] = useState(1);
  const [prompt, setPrompt] = useState("");
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
    if (step === 1 && prompt.trim()) {
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
        }),
      });

      if (res.ok) {
        const course = await res.json();

        setOpen(false);
        setPrompt("");
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
      setPrompt("");
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

  if (status === "loading") {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
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
                    {step === 1
                      ? "Dê um nome ao seu curso"
                      : "Descreva o que você quer aprender"}
                  </DialogDescription>
                </div>

                <div className="px-8 pb-8">
                  {step === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-300">
                      <div className="space-y-2">
                        <label className="text-base font-medium text-muted-foreground mb-1">
                          O que você quer aprender?
                        </label>
                        <div className="relative group">
                          <Input
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Exemplo: Inglês, Docker, Eletrónica, etc."
                            className="h-14 text-lg pr-14 border-2 focus:ring-0 transition-all"
                            autoFocus
                          />
                          <Button
                            type="button"
                            onClick={handleNext}
                            disabled={!prompt.trim()}
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                          >
                            <ArrowRight className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-300">
                      <div className="space-y-2">
                        <label className="text-base font-medium text-muted-foreground mb-2 ml-1">
                          Escolha o nível do curso
                        </label>
                        <Select
                          value={level}
                          onValueChange={(v) => setLevel(v as any)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="B">Iniciante</SelectItem>
                            <SelectItem value="IT">Intermediário</SelectItem>
                            <SelectItem value="A">Avançado</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="w-full flex gap-2 justify-end">
                          <Button
                            type="button"
                            onClick={handleBack}
                            variant="outline"
                          >
                            Voltar
                          </Button>
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
                            {isCreating ? "Criando..." : "Avançar"}
                          </Button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card
              key={`${course.id}`}
              className="group md:max-w-sm p-4 border overflow-hidden shadow-none bg-transparent hover:bg-gray-50 transition-all duration-300 gap-0"
            >
              {course.status === "PROCESSING" ? (
                <div className="flex flex-col items-center justify-center h-full rounded-lg">
                  <Loader2 className="w-12 h-12 text-slate-600 animate-spin" />
                  <span className="text-gray-500">
                    Gerando curso...
                  </span>
                </div>
              ) : (
                <>
                  <div className={`aspect-video mb-3 ${course.status === "READY" ? 'cursor-pointer' : "coursor-default"}`} onClick={() => {
                    if (course.status === "READY") {
                      router.push('/app/courses/' + course.id)
                    }
                  }}>
                    {course.thumb ? (
                      <img src={"http://localhost:8000/media/" + course.thumb} alt={course.title} className="rounded-xl object-cover w-full h-full" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full border rounded-lg">
                        <ImageOff className="w-12 h-12 text-slate-400" />
                        <span className="text-gray-500">
                          Capa Indisponível
                        </span>
                      </div>
                    )}
                  </div>
                  <h1 className="text-lg mb-1">{course.title}</h1>
                  <p className="line-clamp-2 text-gray-600 text-base">{course.desc}</p>
                  {course.status === "READY" && (
                    <Link href={'/app/courses/' + course.id} className="text-blue-600 mt-2 mb-4">Veja mais</Link>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center rounded-md bg-cyan-300/10 px-2 py-1 text-xs font-medium text-blue-400 inset-ring inset-ring-blue-300/30">
                      {course.level === 'B' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
                    </span>
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