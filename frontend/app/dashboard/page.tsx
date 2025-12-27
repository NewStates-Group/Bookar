"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, GraduationCap, Plus, Loader2, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Course {
  id: number;
  title: string;
  desc: string;
  level: string;
  thumb: string;
  status: "PROCESSING" | "READY" | "ERROR";
  created_at: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [open, setOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [level, setLevel] = useState("I");

  useEffect(() => {
    if (session?.accessToken) {
      fetchCourses();
    }
  }, [session]);

  const fetchCourses = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/`, {
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

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          title,
          desc,
          level,
        }),
      });

      if (res.ok) {
        toast.success("Curso criado com sucesso! O processamento começou.");
        setOpen(false);
        setTitle("");
        setDesc("");
        setLevel("I");
        fetchCourses(); // Refresh list
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Criar Curso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Criar Novo Curso</DialogTitle>
                <DialogDescription>
                  Preencha os detalhes para gerar um novo curso com IA.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCourse} className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Introdução ao Python"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="desc">Descrição</Label>
                  <Textarea
                    id="desc"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="O que será ensinado neste curso?"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="level">Nível</Label>
                    <Select value={level} onValueChange={setLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="I">Iniciante</SelectItem>
                        <SelectItem value="IT">Intermediário</SelectItem>
                        <SelectItem value="A">Avançado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Criar Curso
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full text-center py-10 text-muted-foreground">
              Carregando cursos...
            </div>
          ) : courses.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed rounded-lg text-muted-foreground">
              <BookOpen className="w-12 h-12 mb-4 opacity-50" />
              <p>Você ainda não criou nenhum curso.</p>
              <Button variant="link" onClick={() => setOpen(true)}>
                Crie seu primeiro curso agora
              </Button>
            </div>
          ) : (
            courses.map((course) => (
              <Card key={course.id} className="overflow-hidden flex flex-col">
                <div className="relative aspect-video bg-muted">
                  {course.thumb ? (
                    <img src={"https://d4uonx-ip-154-71-152-134.tunnelmole.net" + course.thumb.replace("/app", "")} alt={course.title} className="object-cover w-full h-full" />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-primary/5">
                      <BookOpen className="w-10 h-10 text-primary/20" />
                    </div>
                  )}
                  {course.status === "PROCESSING" && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                      <Loader2 className="w-8 h-8 animate-spin mb-2" />
                      <span className="font-medium text-sm">Gerando Curso...</span>
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {course.level === 'I' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
                    </span>
                    {course.status === 'ERROR' && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-destructive/10 text-destructive">Erro</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg line-clamp-2 mb-2">{course.title}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-3 mb-4 flex-1">
                    {course.desc}
                  </p>

                  {course.status === 'READY' ? (
                    <Link href={`/courses/${course.id}`}>
                      <Button className="w-full">
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Acessar Curso
                      </Button>
                    </Link>
                  ) : (
                    <Button disabled className="w-full">
                      {course.status === 'PROCESSING' ? 'Processando...' : 'Indisponível'}
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
