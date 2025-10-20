"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

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

function estimateLessons(modules: number, totalHours: number) {
  const base = Math.max(1, Math.round((totalHours / modules) / 0.75));
  const arr: number[] = [];
  for (let i = 0; i < modules; i++) {
    const delta = (i % 2 === 0) ? 0 : 1;
    arr.push(Math.max(1, Math.min(8, base + delta)));
  }
  return arr;
}
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function presetModuleTitle(i: number) {
  const bases = [
    "Fundamentos e conceitos essenciais",
    "Ferramentas e ambiente de trabalho",
    "Sintaxe e estruturas básicas",
    "Estruturas de dados e padrões",
    "Tópicos avançados e boas práticas",
    "Projeto prático final",
  ];
  return bases[i] || `Tópico ${i + 1}`;
}
function presetLessonTitle(mi: number, li: number) {
  const verbs = ["Entender", "Praticar", "Implementar", "Analisar", "Construir", "Depurar"];
  return `${verbs[(li + mi) % verbs.length]} conceito ${li + 1}`;
}
function generateResources(includeVideos: boolean) {
  const res = ["Leitura complementar", "Quiz rápido"];
  if (includeVideos) res.unshift("Vídeo-aula (10-20 min)");
  if (Math.random() > 0.8) res.push("Exemplo de código");
  return res;
}

export default function CourseGeneratorPage() {
  const router = useRouter();

  // form state
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [level, setLevel] = useState("Iniciante");
  const [duration, setDuration] = useState<number>(10);
  const [modules, setModules] = useState<number>(6);
  const [lang, setLang] = useState("Português");
  const [objectives, setObjectives] = useState("");
  const [style, setStyle] = useState("Prático - com exercícios");
  const [includeVideos, setIncludeVideos] = useState(true);

  // generated outline
  const [outline, setOutline] = useState<CourseOutline | null>(null);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    // reset published flag when outline changes
    setPublished(false);
  }, [outline]);

  function handleGenerate(ev?: React.FormEvent) {
    ev?.preventDefault();
    const t = (title.trim() || "Curso sem título");
    const modCount = Math.max(1, Math.min(24, modules));
    const lessonsPerModule = estimateLessons(modCount, duration);

    const result: CourseOutline = {
      id: `${slugify(t)}-${Date.now()}`,
      title: t,
      audience: audience.trim(),
      level,
      duration_hours: duration,
      modules: [],
    };

    for (let i = 0; i < modCount; i++) {
      const m: ModuleOutline = {
        id: `m-${i + 1}`,
        title: `Módulo ${i + 1}: ${presetModuleTitle(i)}`,
        estimated_hours: +( (duration / modCount).toFixed(1) ),
        lessons: [],
      };
      for (let j = 0; j < lessonsPerModule[i]; j++) {
        m.lessons.push({
          id: `m${i + 1}l${j + 1}`,
          title: `Aula ${j + 1}: ${presetLessonTitle(i, j)}`,
          duration_minutes: Math.max(10, Math.round((duration * 60 / modCount) / lessonsPerModule[i])),
          resources: generateResources(includeVideos),
        });
      }
      result.modules.push(m);
    }

    setOutline(result);
  }

  function saveCourseToLocal(out: CourseOutline) {
    const raw = localStorage.getItem("boukar_courses");
    const arr: CourseOutline[] = raw ? JSON.parse(raw) : [];
    arr.unshift(out);
    localStorage.setItem("boukar_courses", JSON.stringify(arr));
  }

  function handlePublish() {
    if (!outline) return;
    saveCourseToLocal(outline);
    setPublished(true);
    // small delay to show published state
    setTimeout(() => {
      router.push(`/course/${outline.id}`);
    }, 350);
  }

  function handleExportJSON() {
    if (!outline) {
      alert("Gere um curso primeiro.");
      return;
    }
    const data = JSON.stringify(outline, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${outline.id || "course"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setTitle("");
    setAudience("");
    setLevel("Iniciante");
    setDuration(10);
    setModules(6);
    setLang("Português");
    setObjectives("");
    setStyle("Prático - com exercícios");
    setIncludeVideos(true);
    setOutline(null);
    setPublished(false);
  }

  return (
    <div className="generator-root">
      <div className="gen-header">
        <div className="logo">B</div>
        <div>
          <h1>Bookar — Gerar Curso</h1>
          <p className="lead">Preencha as informações abaixo para gerar um curso automaticamente.</p>
        </div>
      </div>

      <div className="gen-grid">
        <aside className="card">
          <form onSubmit={handleGenerate}>
            <div>
              <label>Título do curso</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Programação em C — do básico ao avançado" required />
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Público-alvo</label>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ex: Estudantes do ensino médio, iniciantes" />
            </div>

            <div style={{ marginTop: 12 }} className="row">
              <div className="small">
                <label>Nível</label>
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option>Iniciante</option>
                  <option>Intermediário</option>
                  <option>Avançado</option>
                </select>
              </div>
              <div style={{ width: 120 }}>
                <label>Duração (horas)</label>
                <input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              </div>
            </div>

            <div style={{ marginTop: 12 }} className="row">
              <div className="small">
                <label>Número de módulos</label>
                <input type="number" min={1} max={24} value={modules} onChange={(e) => setModules(Number(e.target.value))} />
              </div>
              <div style={{ width: 140 }}>
                <label>Língua</label>
                <select value={lang} onChange={(e) => setLang(e.target.value)}>
                  <option>Português</option>
                  <option>Inglês</option>
                  <option>Português & Inglês</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Objetivos de aprendizagem (separados por ";")</label>
              <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="Ex: Entender sintaxe; Escrever programas; Depurar" />
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Estilo do curso</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option>Prático - com exercícios</option>
                <option>Teórico - com leituras</option>
                <option>Híbrido (prática + teoria)</option>
              </select>
            </div>

            <div className="muted" style={{ marginTop: 12 }}>Opções avançadas</div>
            <div style={{ marginTop: 8 }} className="row">
              <label style={{ flex: 1 }}><input checked={includeVideos} onChange={(e) => setIncludeVideos(e.target.checked)} type="checkbox" /> Incluir vídeos</label>
            </div>

            <div className="actions">
              <button type="submit">Gerar curso</button>
              <button type="button" className="ghost" onClick={handleExportJSON}>Exportar JSON</button>
              <button type="button" className="ghost" onClick={handleReset}>Limpar</button>
            </div>

            {outline && (
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={handlePublish} style={{ width: "100%" }}>{published ? "Publicado ✓ — A carregar..." : "Publicar Curso"}</button>
              </div>
            )}
          </form>
        </aside>

        <section className="card preview">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h3 id="previewTitle">{outline ? outline.title : "Preview do curso"}</h3>
              <div className="meta" id="previewMeta">{outline ? `${outline.level} • ${outline.duration_hours} horas • ${outline.modules.length} módulos` : 'Preencha o formulário e clique em "Gerar curso"'}</div>
            </div>
            <div className="chips" id="chips">
              {outline ? (
                <>
                  <div className="chip">Língua: {lang}</div>
                  <div className="chip">Estilo: {style}</div>
                </>
              ) : null}
            </div>
          </div>

          <div id="outline" className="outline">
            {!outline && <p className="muted">Ainda não há outline.</p>}
            {outline && (
              <>
                {objectives && (
                  <div className="meta">Objetivos:
                    <ul>
                      {objectives.split(";").map((o) => o.trim()).filter(Boolean).map((o, idx) => <li key={idx}>{o}</li>)}
                    </ul>
                  </div>
                )}

                {outline.modules.map(mod => (
                  <div key={mod.id} className="module">
                    <div style={{ fontWeight: 700 }}>{mod.title}</div>
                    <div className="meta">~{mod.estimated_hours} horas • {mod.lessons.length} aulas</div>
                    {mod.lessons.map(ls => (
                      <div key={ls.id} style={{ padding: "6px 0" }}>
                        <div style={{ fontWeight: 600 }}>{ls.title}</div>
                        <div className="muted">{ls.duration_minutes} min • Recursos: {ls.resources.join(", ")}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>

          <footer>
            <div className="muted">Gerado localmente — integre com IA (OpenAI, Anthropic, etc.) para conteúdo completo.</div>
          </footer>
        </section>
      </div>
    </div>
  );
}
