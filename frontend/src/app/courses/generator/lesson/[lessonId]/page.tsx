"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

type LessonOutline = {
  id: string;
  title: string;
  duration_minutes: number;
  resources: string[];
};

type ModuleOutline = {
  id: string;
  title: string;
  estimated_hours: number;
  lessons: LessonOutline[];
};

type CourseOutline = {
  id: string;
  title: string;
  audience?: string;
  level: string;
  duration_hours: number;
  modules: ModuleOutline[];
};

export default function LessonPage() {
  const { id, lessonId } = useParams(); // id = course id, lessonId = 'm1l1' etc
  const [course, setCourse] = useState<CourseOutline | null>(null);
  const [lesson, setLesson] = useState<LessonOutline | null>(null);

  useEffect(() => {
    if (!id || !lessonId) return;
    const raw = localStorage.getItem("boukar_courses");
    if (!raw) return;
    try {
      const arr: CourseOutline[] = JSON.parse(raw);
      const found = arr.find(c => c.id === id);
      setCourse(found || null);
      if (found) {
        for (const m of found.modules) {
          const ls = m.lessons.find(l => l.id === lessonId);
          if (ls) {
            setLesson(ls);
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [id, lessonId]);

  if (!course || !lesson) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Aula não encontrada</h2>
        <p>Verifica se o curso e a aula existem. Volta para a página do curso.</p>
        <div style={{ marginTop: 12 }}>
          <Link href={`/course/${id}`}><button style={{ padding: "8px 12px" }}>Voltar ao curso</button></Link>
        </div>
      </div>
    );
  }

  // compute position (next lesson) to navigate
  function findNext() {
    const flat: LessonOutline[] = [];
    for (const m of course.modules) flat.push(...m.lessons);
    const idx = flat.findIndex(l => l.id === lesson.id);
    if (idx === -1 || idx === flat.length - 1) return null;
    return flat[idx + 1].id;
  }

  const nextLessonId = findNext();

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{course.title}</h2>
        <p style={{ color: "#666" }}>{course.level} • {course.duration_hours} horas</p>
      </header>

      <main style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        <section style={{ background: "#fff", padding: 16, borderRadius: 8 }}>
          {/* Placeholder player */}
          <div style={{ background: "#000", height: 360, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{lesson.title}</div>
              <div style={{ color: "#ddd" }}>Player placeholder — substitua por vídeo real (YouTube/HLS)</div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <h3>Descrição</h3>
            <p>Conteúdo da aula — explique os objetivos, exercícios e anexos aqui.</p>

            <div style={{ marginTop: 12 }}>
              <button style={{ background: "#198754", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }} onClick={() => {
                // marcar concluída (simples)
                const key = `boukar_progress_${course.id}`;
                const raw = localStorage.getItem(key);
                const done: string[] = raw ? JSON.parse(raw) : [];
                if (!done.includes(lesson.id)) {
                  done.push(lesson.id);
                  localStorage.setItem(key, JSON.stringify(done));
                  alert("Aula marcada como concluída");
                } else {
                  alert("Aula já marcada como concluída");
                }
              }}>Marcar como concluída</button>

              {nextLessonId && (
                <Link href={`/course/${course.id}/lesson/${nextLessonId}`}>
                  <button style={{ marginLeft: 8, padding: "8px 12px" }}>Próxima aula ▶</button>
                </Link>
              )}

              {!nextLessonId && (
                <button style={{ marginLeft: 8, padding: "8px 12px" }} onClick={() => {
                  // gerar certificado placeholder
                  alert("Parabéns! Você completou o curso. (Aqui podes gerar o certificado em PDF)");
                }}>Gerar Certificado 🎓</button>
              )}
            </div>
          </div>
        </section>

        <aside style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
          <h4 style={{ marginTop: 0 }}>Aulas do curso</h4>
          <div style={{ display: "grid", gap: 6 }}>
            {course.modules.map(mod => (
              <div key={mod.id}>
                <div style={{ fontWeight: 700 }}>{mod.title}</div>
                <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>{mod.lessons.length} aulas</div>
                {mod.lessons.map(ls => (
                  <Link key={ls.id} href={`/course/${course.id}/lesson/${ls.id}`}>
                    <div style={{ padding: "8px 6px", borderRadius: 6, cursor: "pointer", background: ls.id === lesson.id ? "rgba(90,62,245,0.08)" : "transparent", marginBottom: 6 }}>
                      <div style={{ fontWeight: 600 }}>{ls.title}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{ls.duration_minutes} min</div>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
