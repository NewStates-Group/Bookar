"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("boukar_courses");
    if(saved){
      setCourses(JSON.parse(saved));
    } else {
      setCourses([
        { id: 1, title: "Programação em Python do Zero", language: "Português", level: "Iniciante", duration: "12h", thumbnail: "https://source.unsplash.com/featured/?python,code" },
        { id: 2, title: "Introdução à Cibersegurança", language: "Inglês", level: "Intermédio", duration: "8h", thumbnail: "https://source.unsplash.com/featured/?cybersecurity" }
      ]);
    }
  }, []);

  return (
    <div style={{ display: "flex" }}>
      <Sidebar />

      <div style={{ flex: 1 }}>
        <Topbar />
        <main style={{ marginTop: "80px", padding: "1rem" }}>
          <button className="generate-btn">+ Gerar Novo Curso</button>

          <div className="courses">
            {courses.map(course => (
              <div key={course.id} className="course-card">
                <img src={course.thumbnail} />
                <div className="course-info">
                  <h3>{course.title}</h3>
                  <div className="course-meta">
                    {course.language} · {course.level} · {course.duration}
                  </div>
                </div>
                <div className="course-actions">
                  <button className="edit-btn">✏️ Editar</button>
                  <button className="delete-btn">❌ Eliminar</button>
                  <button className="enter-btn">▶️ Entrar</button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
