"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import styles from "./styles.module.css";

type LessonOutline = {
  id: string;
  title: string;
  duration_minutes?: number;
  youtubeId?: string;
  description?: string;
  resources?: string[];
};

type ModuleOutline = {
  id: string;
  title: string;
  estimated_hours?: number;
  lessons: LessonOutline[];
};

type CourseOutline = {
  id: string;
  title: string;
  audience?: string;
  level?: string;
  duration_hours?: number;
  modules: ModuleOutline[];
};

export default function LessonPage() {
  const params = useParams();
  const courseId = params?.courseId || params?.id || "";
  const lessonId = params?.lessonId || "";
  const [course, setCourse] = useState<CourseOutline | null>(null);
  const [lesson, setLesson] = useState<LessonOutline | null>(null);
  const [chatMessages, setChatMessages] = useState<{ text: string; me?: boolean }[]>([]);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const [listening, setListening] = useState(false);
  let recognitionRef = useRef<any>(null);

  useEffect(() => {
    // try to load from localStorage (boukar_courses), fallback to sample mock
    const raw = typeof window !== "undefined" ? localStorage.getItem("boukar_courses") : null;
    let found: CourseOutline | null = null;

    if (raw) {
      try {
        const arr: CourseOutline[] = JSON.parse(raw);
        found = arr.find(c => c.id === courseId) || null;
      } catch (e) {
        console.error("Invalid localStorage courses", e);
      }
    }

    if (!found) {
      // fallback mock (public)
      found = {
        id: courseId || "course-sample",
        title: "Fundamentos de Programação (demo pública)",
        level: "Iniciante",
        duration_hours: 6,
        modules: [
          {
            id: "m-1",
            title: "Módulo 1: Fundamentos",
            estimated_hours: 2,
            lessons: [
              { id: "l1", title: "Introdução", duration_minutes: 12, youtubeId: "5qap5aO4i9A", description: "Aula introdutória com exemplos.", resources: ["Manual.pdf", "Slides.pdf"] },
              { id: "l2", title: "Variáveis", duration_minutes: 15, youtubeId: "kXYiU_JCYtU", description: "Entenda variáveis e tipos.", resources: ["Exercicio.zip"] }
            ]
          },
          {
            id: "m-2",
            title: "Módulo 2: Controle",
            estimated_hours: 2,
            lessons: [
              { id: "l3", title: "Condicionais", duration_minutes: 18, youtubeId: "3JZ_D3ELwOQ", description: "If, else e switch.", resources: [] },
              { id: "l4", title: "Laços", duration_minutes: 20, youtubeId: "dQw4w9WgXcQ", description: "For / While.", resources: [] }
            ]
          }
        ]
      };
    }

    setCourse(found);
  }, [courseId]);

  useEffect(() => {
    if (!course) return;
    // find lesson in modules
    let found: LessonOutline | undefined;
    for (const m of course.modules) {
      const l = m.lessons.find(x => x.id === lessonId);
      if (l) { found = l; break; }
    }
    // if no explicit lessonId, pick first lesson
    if (!found && course.modules.length) {
      const first = course.modules[0].lessons[0];
      found = first;
    }
    setLesson(found || null);
  }, [course, lessonId]);

  // helper: flatten list of lessons to compute next
  function flatLessons(): LessonOutline[] {
    if (!course) return [];
    return course.modules.flatMap(m => m.lessons);
  }
  function findNextId(): string | null {
    const flat = flatLessons();
    if (!lesson) return flat.length ? flat[0].id : null;
    const idx = flat.findIndex(l => l.id === lesson.id);
    if (idx === -1 || idx === flat.length - 1) return null;
    return flat[idx + 1].id;
  }

  function selectLessonById(id: string) {
    // navigate by replacing the URL using Link is simplest: build link
    // but since we're client component, update location
    const newUrl = `/courses/${course?.id}/lesson/${id}`;
    window.history.pushState({}, "", newUrl);
    // trigger state change: set lesson
    const flat = flatLessons();
    const found = flat.find(l => l.id === id) || null;
    setLesson(found);
  }

  // Chat functions
  function sendChat() {
    const val = chatInputRef.current?.value?.trim();
    if (!val) return;
    setChatMessages(prev => [...prev, { text: val, me: true }]);
    if (chatInputRef.current) chatInputRef.current.value = "";
    setTimeout(() => {
      setChatMessages(prev => [...prev, { text: "Assistente: Recebi sua dúvida — em breve uma resposta." }]);
    }, 700);
  }

  // Simple MCQ / open answer handlers (client-side)
  function submitMCQ(qId: number) {
    // only example for q1
    if (qId === 1) {
      const chosen = (document.querySelector('input[name="q1"]:checked') as HTMLInputElement | null)?.value;
      const fb = document.getElementById("q1feedback");
      if (!chosen) { if (fb) fb.innerHTML = "<small style='color:#6b7280'>Escolha uma opção.</small>"; return; }
      if (chosen === "b") {
        if (fb) fb.innerHTML = "<div style='color:green;font-weight:700'>✔️ Correto — boa!</div>";
      } else {
        if (fb) fb.innerHTML = "<div style='color:#d97706;font-weight:700'>❌ Incorreto — reveja a aula.</div>";
      }
    }
  }

  // Voice input (Web Speech) - optional
  function toggleVoice() {
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      alert("Reconhecimento de voz não suportado neste navegador.");
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRec();
      recognitionRef.current.lang = "pt-PT";
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (evt: any) => {
        const text = evt.results[0][0].transcript;
        setChatMessages(prev => [...prev, { text, me: true }]);
        // simulate bot reply
        setTimeout(() => setChatMessages(prev => [...prev, { text: "Assistente: Mensagem recebida (voz)." }]), 600);
      };
      recognitionRef.current.onend = () => {
        setListening(false);
      };
    }
    if (!listening) {
      recognitionRef.current.start();
      setListening(true);
    } else {
      recognitionRef.current.stop();
      setListening(false);
    }
  }

  if (!course || !lesson) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.notfound}>
          <h2>Aula ou curso não encontrada</h2>
          <p>Verifique se o curso existe. Volte para a lista de cursos.</p>
          <Link href={`/courses/${courseId}`}><button className={styles.btn}>Voltar ao curso</button></Link>
        </div>
      </div>
    );
  }

  const nextId = findNextId();

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar} aria-hidden={false}>
        <div className={styles.logo}>B</div>
        <nav className={styles.navlist} aria-label="Menu principal">
          <div className={styles.navitem} onClick={() => location.href = "/course/generator"} title="Gerar Curso">
            <div className={styles.icon}><i className="fa-solid fa-plus"></i></div><span>Gerar Curso</span>
          </div>
          <div className={styles.navitem} onClick={() => location.href = "/courses"} title="Cursos">
            <div className={styles.icon}><i className="fa-solid fa-book-open"></i></div><span>Cursos</span>
          </div>
        </nav>
      </aside>

      {/* Topbar */}
      <header className={styles.topbar}>
        <div className={styles.title}>{course.title} — {lesson.title}</div>
        <div className={styles.actions}>
          <div className={styles.profile}><img src="https://i.pravatar.cc/40" alt="perfil" /><div style={{ fontWeight: 600 }}>{/* usuário público */}Visitante</div></div>
        </div>
      </header>

      {/* Main */}
      <section className={styles.appBody}>
        <div className={styles.playerRow}>
          <div className={styles.videoCard} role="main" aria-labelledby="videoTitle">
            <div className={styles.videoWrap}>
              {/* YouTube embed */}
              <iframe
                id="ytPlayer"
                src={`https://www.youtube.com/embed/${lesson.youtubeId || "5qap5aO4i9A"}?rel=0&modestbranding=1`}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className={styles.videoTools}>
              <div className={styles.leftTools}>
                <button className={styles.btn} onClick={() => alert("Legenda ativada (YouTube, se disponível).")}>🈂️ Legenda</button>
                <button className={styles.btn} onClick={() => alert("Língua gestual: recurso futuro.")}>🤟 LGP</button>
                <div style={{ fontSize: 14, color: "#6b7280", marginLeft: 8 }}>Idioma: Português</div>
              </div>
              <div>
                <button className={`${styles.btn} ${styles.ghost}`} onClick={() => location.href = `/courses/${course.id}`}>Voltar ao Curso</button>
              </div>
            </div>

            <div className={styles.meta}>
              <div id="videoTitle" style={{ fontWeight: 700, fontSize: 18 }}>{lesson.title}</div>
              <div className={styles.description}>
                <p>{lesson.description || "Sem descrição disponível."}</p>
                <div className={styles.materials}>
                  {(lesson.resources || []).map((r, i) => <a key={i} className={styles.material} href="#">{r}</a>)}
                </div>
              </div>

              <div className={styles.tasks} aria-live="polite">
                <h3 style={{ margin: "0 0 8px 0" }}>📝 Tarefas</h3>

                <div className={styles.task}>
                  <h4 style={{ margin: 0 }}>1) Múltipla escolha — Conceitos básicos</h4>
                  <div className={styles.options}>
                    <label className={styles.option}><input name="q1" type="radio" value="a" /> a) Variável é um tipo de função</label>
                    <label className={styles.option}><input name="q1" type="radio" value="b" /> b) Variável guarda valores na memória</label>
                    <label className={styles.option}><input name="q1" type="radio" value="c" /> c) Variável é excluída do código</label>
                  </div>
                  <div className={styles.submitRow}>
                    <small className={styles.muted}>Escolha a opção correta e envie.</small>
                    <div>
                      <button className={styles.btn} onClick={() => submitMCQ(1)}>Enviar</button>
                    </div>
                  </div>
                  <div id="q1feedback" style={{ marginTop: 8 }}></div>
                </div>

                <div className={styles.task}>
                  <h4 style={{ margin: 0 }}>2) Questão aberta</h4>
                  <p>Explique em 2-3 linhas o que é uma variável.</p>
                  <textarea id="open1" rows={3} style={{ width: "100%", padding: 8, borderRadius: 8 }} />
                  <div className={styles.submitRow}>
                    <small className={styles.muted}>O professor avaliará depois.</small>
                    <div>
                      <button className={styles.btn} onClick={() => {
                        const el = (document.getElementById("open1") as HTMLTextAreaElement);
                        const fb = document.getElementById("a1feedback");
                        if (!el || !fb) return;
                        if (el.value.trim().length < 5) { fb.innerHTML = "<small class='muted'>Resposta muito curta.</small>"; return; }
                        fb.innerHTML = "<div style='color:green;font-weight:700'>Resposta enviada — aguardando avaliação.</div>";
                      }}>Enviar</button>
                    </div>
                  </div>
                  <div id="a1feedback" style={{ marginTop: 8 }}></div>
                </div>

              </div>
            </div>
          </div>

          {/* right column */}
          <aside className={styles.rightCol}>
            <div className={styles.lessons} aria-live="polite">
              <h3 style={{ marginTop: 0 }}>📚 Aulas</h3>
              {course.modules.map(mod => (
                <div key={mod.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>{mod.title}</div>
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>{mod.lessons.length} aulas</div>
                  {mod.lessons.map(ls => (
                    <div key={ls.id} className={`${styles.lessonItem} ${ls.id === lesson.id ? styles.active : ""}`} onClick={() => selectLessonById(ls.id)}>
                      <div>{ls.title}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{ls.duration_minutes || ""} min</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className={styles.chat}>
              <h3 style={{ margin: 0 }}>💬 Chat</h3>
              <div className={styles.chatMessages} role="log" aria-live="polite">
                {chatMessages.map((m, i) => <div key={i} className={`${styles.msg} ${m.me ? styles.me : ""}`}>{m.text}</div>)}
              </div>

              <div className={styles.chatInput}>
                <input ref={chatInputRef} id="chatInput" placeholder="Escreva sua dúvida..." aria-label="Escreva sua dúvida" />
                <button className={styles.micro} onClick={toggleVoice}>{listening ? "⏹" : "🎤"}</button>
                <button className={styles.btn} onClick={sendChat}>Enviar</button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
