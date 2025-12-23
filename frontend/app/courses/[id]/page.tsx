"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Play, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Course {
  id: number;
  title: string;
  desc: string;
  level: string;
  thumb: string;
  status: string;
  created_at: string;
}

interface Lesson {
  id: number;
  title: string;
  desc: string;
  duration: number;
  watched: boolean;
  status: string;
}

interface Module {
  id: number;
  name: string;
  lessons: Lesson[];
}

interface CourseDetail extends Course {
  modules: Module[];
}

export default function CoursePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if ((session as any)?.accessToken && params?.id) {
      fetchCourse();
    }
  }, [session, params]);

  const fetchCourse = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${params?.id}`, {
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCourse(data);
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to fetch course", error);
    } finally {
      setIsLoading(false);
    }
  };


  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Dashboard
          </Button>
        </Link>

        {/* Hero Section */}
        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-lg">
          {course.thumb && (
            <img src={"https://d4uonx-ip-154-71-152-134.tunnelmole.net" + course.thumb.replace("/app", "")} alt={course.title} className="object-cover w-full h-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 text-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-primary px-3 py-1 rounded-full text-xs font-bold text-primary-foreground">
                {course.level === 'I' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
              </span>
            </div>
            <h1 className="text-4xl font-bold mb-2">{course.title}</h1>
            <p className="text-white/80 max-w-2xl">{course.desc}</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between p-6 bg-card rounded-xl border">
          <div>
            <h2 className="text-xl font-semibold mb-1">Começar a Aprender</h2>
            <p className="text-muted-foreground text-sm">Assista as aulas em sequência para completar o curso.</p>
          </div>
          <Link href={`/courses/${course.id}/learn`}>
            <Button size="lg" className="rounded-full px-8">
              <Play className="w-5 h-5 mr-2" /> Assistir Curso
            </Button>
          </Link>
        </div>

        {/* Curriculum List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Conteúdo do Curso</h2>
          <div className="space-y-4">
            {course.modules.length === 0 && (
              <p className="text-muted-foreground">Nenhum módulo encontrado.</p>
            )}
            {course.modules.map((module, i) => (
              <Card key={module.id} className="overflow-hidden">
                <div className="bg-muted/50 p-4 border-b">
                  <h3 className="font-semibold text-lg flex items-center">
                    <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">
                      {i + 1}
                    </span>
                    {module.name}
                  </h3>
                </div>
                <div className="divide-y">
                  {module.lessons.map((lesson, j) => (
                    <div key={lesson.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${lesson.watched ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div>
                          <p className="font-medium text-sm">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">{Math.floor(lesson.duration / 60)} min</p>
                        </div>
                      </div>
                      <div className="text-xs">
                        {lesson.status === 'READY' ? (
                          <span className="text-green-600 bg-green-100 px-2 py-1 rounded-full">Pronta</span>
                        ) : lesson.status === 'PROCESSING' ? (
                          <span className="text-blue-600 bg-blue-100 px-2 py-1 rounded-full flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Mágica IA...
                          </span>
                        ) : (
                          <span className="text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Aguardando</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
