"use client";
import "./page.css";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function CourseViewPage() {
  const { id } = useParams();
  const [lessons, setLessons] = useState<any[]>([]);

  useEffect(() => {
    // TEMP: Simula aulas (depois vamos conectar com o BD)
    setLessons([
      { id: 1, title: "Introdução à Programação", duration: "12:34" },
      { id: 2, title: "Variáveis e Tipos de Dados", duration: "15:12" },
      { id: 3, title: "Estruturas Condicionais", duration: "18:50" },
      { id: 4, title: "Laços de Repetição", duration: "20:10" },
      { id: 5, title: "Funções em JavaScript", duration: "22:00" },
      { id: 6, title: "Aula Final - Tirar Certificado", duration: "05:00", isCertificate: true }
    ]);
  }, []);

  return (
    <div>
      <header className="course-header">
        <h1>Curso {id} — Fundamentos de Programação</h1>
        <p>Aprenda a programar do zero com exemplos práticos</p>
      </header>

      <main className="course-container">
        {lessons.map(lesson => (
          <div
            key={lesson.id}
            className={`lesson-card ${lesson.isCertificate ? "certificate-card" : ""}`}
          >
            <div className="lesson-info">
              <h3>{lesson.isCertificate ? "🎓 " : `Aula ${lesson.id}: `}{lesson.title}</h3>
              <p>Duração: {lesson.duration}</p>
            </div>

            <button>
              {lesson.isCertificate ? "Gerar Certificado" : "Assistir"}
            </button>
          </div>
        ))}
      </main>

      <footer className="course-footer">
        <p>Boukar © 2025 — Plataforma de Cursos Inteligentes</p>
      </footer>
    </div>
  );
}
