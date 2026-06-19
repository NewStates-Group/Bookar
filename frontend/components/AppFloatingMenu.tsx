"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { X, Send, Loader2, Plus, Bot, BookMarked, Sparkles, StickyNote, Trash2, Network, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import { apiRequest, authenticatedFetcher } from "@/lib/api";
import { type FolhaSummary } from "@/context/NotebookContext";

export type ExplicadorContext = {
  course_id?: string;
  course_title?: string;
  module_name?: string;
  lesson_id?: string;
  lesson_title?: string;
  lesson_description?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function AppFloatingMenu() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [explicadorOpen, setExplicadorOpen] = useState(false);
  const [cadernoOpen, setCadernoOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [creatingFolha, setCreatingFolha] = useState(false);
  const [deletingFolhaId, setDeletingFolhaId] = useState<string | null>(null);
  const [selectedFolhaId, setSelectedFolhaId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [explicadorContext, setExplicadorContext] = useState<ExplicadorContext | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isExplicadorRoom =
    pathname.startsWith("/app/explicador/") && pathname !== "/app/explicador";

  const { data: folhas, isLoading: folhasLoading, mutate: mutateFolhas } = useSWR<FolhaSummary[]>(
    cadernoOpen && session?.accessToken && !selectedFolhaId
      ? [`${process.env.NEXT_PUBLIC_API_URL}/folhas`, session.accessToken]
      : null,
    authenticatedFetcher
  );

  const { data: folhaData, isLoading: folhaLoading } = useSWR<FolhaSummary>(
    selectedFolhaId && session?.accessToken
      ? [`${process.env.NEXT_PUBLIC_API_URL}/folhas/${selectedFolhaId}`, session.accessToken]
      : null,
    authenticatedFetcher
  );

  useEffect(() => {
    if (folhaData) {
      setEditorTitle(folhaData.title);
      setEditorContent(folhaData.content || "");
      setSaveStatus("idle");
    }
  }, [folhaData?.id]);

  useEffect(() => {
    if (explicadorOpen) {
      setTimeout(() => chatInputRef.current?.focus(), 150);
    }
  }, [explicadorOpen]);

  useEffect(() => {
    const handler = (e: CustomEvent<{
      context?: ExplicadorContext;
      prompt?: string;
    }>) => {
      if (e.detail.context) setExplicadorContext(e.detail.context);
      setExplicadorOpen(true);
      setMenuOpen(false);
      if (e.detail.prompt) {
        setPendingPrompt(e.detail.prompt);
      }
    };
    window.addEventListener("opencode-explicador" as any, handler as any);
    return () => window.removeEventListener("opencode-explicador" as any, handler as any);
  }, []);

  useEffect(() => {
    const handler = (e: CustomEvent<{ folhaId: string }>) => {
      setCadernoOpen(true);
      setMenuOpen(false);
      setExplicadorOpen(false);
      setSelectedFolhaId(e.detail.folhaId);
    };
    window.addEventListener("opencode-caderno" as any, handler as any);
    return () => window.removeEventListener("opencode-caderno" as any, handler as any);
  }, []);

  useEffect(() => {
    if (explicadorOpen && pendingPrompt) {
      setPendingPrompt(null);
      handleStreamAnswer(pendingPrompt);
    }
  }, [explicadorOpen, pendingPrompt]);

  const handleStreamAnswer = useCallback(async (text: string) => {
    setIsStreaming(true);
    setStreamingContent("");

    const userMsg: ChatMessage = { role: "user", content: text };
    setChatMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);

    abortRef.current = new AbortController();

    try {
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/explicador/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ message: text, history, context: explicadorContext }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("Erro na resposta do servidor");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Sem stream disponível");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.token) {
              setStreamingContent((prev) => prev + parsed.token);
            }
            if (parsed.error) toast.error(parsed.error);
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("Erro ao obter resposta do Explicador.");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [chatMessages, session?.accessToken, explicadorContext]);

  // Flush streamingContent into chatMessages when stream ends
  useEffect(() => {
    if (!isStreaming && streamingContent) {
      setChatMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = { ...last, content: (last.content || "") + streamingContent };
        }
        return copy;
      });
      setStreamingContent("");
    }
  }, [isStreaming, streamingContent]);

  // Auto-scroll when new tokens arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, streamingContent]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text || isStreaming) return;
    setPrompt("");
    handleStreamAnswer(text);
  };

  const persistFolha = async (id: string, title: string, content: string) => {
    setSaveStatus("saving");
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/folhas/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, content }),
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  };

  const scheduleSave = (id: string, title: string, content: string) => {
    setSaveStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistFolha(id, title, content);
    }, 800);
  };

  const handleTitleChange = (value: string) => {
    setEditorTitle(value);
    if (selectedFolhaId) scheduleSave(selectedFolhaId, value, editorContent);
  };

  const handleContentChange = (value: string) => {
    setEditorContent(value);
    if (selectedFolhaId) scheduleSave(selectedFolhaId, editorTitle, value);
  };

  const handleCreateFolha = async () => {
    setCreatingFolha(true);
    try {
      const created = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/folhas`, {
        method: "POST",
        body: JSON.stringify({ title: "Folha em branco" }),
      });
      await mutateFolhas();
      setSelectedFolhaId(created.id);
    } catch {
      toast.error("Erro ao criar folha.");
    } finally {
      setCreatingFolha(false);
    }
  };

  const handleDeleteFolha = async (e: React.MouseEvent, folhaId: string) => {
    e.stopPropagation();
    setDeletingFolhaId(folhaId);
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/folhas/${folhaId}`, {
        method: "DELETE",
      });
      await mutateFolhas();
      setSelectedFolhaId(null);
      setEditorTitle("");
      setEditorContent("");
      setSaveStatus("idle");
    } catch {
      toast.error("Erro ao remover folha.");
    } finally {
      setDeletingFolhaId(null);
    }
  };

  const handleBackToList = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selectedFolhaId && (saveStatus === "saving" || saveStatus === "saved")) {
      persistFolha(selectedFolhaId, editorTitle, editorContent);
    }
    setSelectedFolhaId(null);
    setEditorTitle("");
    setEditorContent("");
    setSaveStatus("idle");
    mutateFolhas();
  };

  const handleCloseCaderno = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selectedFolhaId && (saveStatus === "saving" || saveStatus === "saved")) {
      persistFolha(selectedFolhaId, editorTitle, editorContent);
    }
    setCadernoOpen(false);
    setSelectedFolhaId(null);
    setEditorTitle("");
    setEditorContent("");
    setSaveStatus("idle");
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleOpenExplicador = () => {
    setMenuOpen(false);
    setExplicadorOpen(true);
  };

  const handleOpenCaderno = () => {
    setMenuOpen(false);
    setCadernoOpen(true);
  };

  const isAnyOpen = menuOpen || explicadorOpen || cadernoOpen;

  const handleToggleButton = () => {
    if (explicadorOpen) {
      setExplicadorOpen(false);
    } else if (cadernoOpen) {
      handleCloseCaderno();
    } else if (menuOpen) {
      setMenuOpen(false);
    } else {
      setMenuOpen(true);
    }
  };

  if (status === "loading") return null;
  if (status !== "authenticated" || isExplicadorRoom) return null;

  return (
    <>
      {/* Floating trigger button */}
      <div className="fixed bottom-6 right-6 z-50">
        {menuOpen && (
          <div className="absolute bottom-16 right-0 flex flex-col items-end gap-2 mb-1 animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* Explicador */}
            <div
              onClick={handleOpenExplicador}
              className="flex items-center group cursor-pointer"
            >
              <span className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-neutral-300 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border border-slate-200/60 dark:border-neutral-700/60 shadow-sm rounded-lg mr-2 transition-all duration-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-hover:border-cyan-200/50 dark:group-hover:border-cyan-700/50 group-hover:bg-cyan-50/20 dark:group-hover:bg-cyan-950/20 select-none">
                Explicador
              </span>
              <button
                type="button"
                className="w-11 h-11 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-700/80 text-slate-500 dark:text-neutral-400 shadow-sm group-hover:shadow-md group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-hover:border-cyan-200 dark:group-hover:border-cyan-700 group-hover:bg-cyan-50/30 dark:group-hover:bg-cyan-950/30 transition-all duration-200 flex items-center justify-center cursor-pointer"
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>

            {/* Caderno de Notas */}
            <div
              onClick={handleOpenCaderno}
              className="flex items-center group cursor-pointer"
            >
              <span className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-neutral-300 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border border-slate-200/60 dark:border-neutral-700/60 shadow-sm rounded-lg mr-2 transition-all duration-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-hover:border-cyan-200/50 dark:group-hover:border-cyan-700/50 group-hover:bg-cyan-50/20 dark:group-hover:bg-cyan-950/20 select-none">
                Anotações
              </span>
              <button
                type="button"
                className="w-11 h-11 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-700/80 text-slate-500 dark:text-neutral-400 shadow-sm group-hover:shadow-md group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-hover:border-cyan-200 dark:group-hover:border-cyan-700 group-hover:bg-cyan-50/30 dark:group-hover:bg-cyan-950/30 transition-all duration-200 flex items-center justify-center cursor-pointer"
              >
                <BookMarked className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleToggleButton}
          aria-expanded={isAnyOpen}
          className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 cursor-pointer border
            ${isAnyOpen
              ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-900"
              : "bg-cyan-500 border-cyan-400 text-white hover:bg-cyan-600 shadow-cyan-500/20"}
          `}
        >
          {isAnyOpen ? (
            <X className="w-5 h-5 transition-transform duration-200" />
          ) : (
            <Plus className="w-5 h-5 transition-transform duration-200" />
          )}
        </button>

        {explicadorOpen && (
          <div className="absolute bottom-full right-0 mb-2 z-50 w-80 sm:w-96 bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-neutral-800 bg-cyan-50 dark:bg-cyan-950/30 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Explicador</p>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400">Tire as suas dúvidas</p>
                </div>
              </div>
              <button
                onClick={() => setExplicadorOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-white/60 dark:hover:bg-neutral-800 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3 bg-white dark:bg-neutral-950">
              {chatMessages.length === 0 && !isStreaming ? (
                <div className="flex flex-col items-center justify-center py-8 text-center min-h-[160px]">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700 flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5 text-slate-300 dark:text-neutral-500" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 leading-relaxed">
                    Faça pergunta ao Explicador IA.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg, i) => {
                  const isLastAssistant = i === chatMessages.length - 1 && msg.role === "assistant";
                  const showStreamed = isLastAssistant && streamingContent;
                  const displayContent = showStreamed ? streamingContent : msg.content;
                  return (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user"
                          ? "bg-cyan-500 text-white rounded-tr-md"
                          : "bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200"
                        }`}
                      >
                        {isLastAssistant && !streamingContent && !msg.content ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </span>
                        ) : (
                          <>
                            {displayContent}
                            {isLastAssistant && isStreaming && (
                              <span className="inline-flex ml-0.5">
                                <span className="w-1.5 h-4 bg-cyan-500 rounded-sm animate-pulse" />
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-slate-100 dark:border-neutral-800">
              <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-1 focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-500/10 transition-all">
                <input
                  ref={chatInputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Qual é a tua dúvida?"
                  disabled={isStreaming}
                  className="flex-1 h-10 bg-transparent text-sm text-slate-800 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 outline-none border-0"
                />
                <button
                  type="submit"
                  disabled={isStreaming || !prompt.trim()}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-500 text-white disabled:bg-slate-200 dark:disabled:bg-neutral-700 disabled:text-slate-400 dark:disabled:text-neutral-500 hover:bg-cyan-600 transition-all cursor-pointer flex-shrink-0"
                >
                  {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Caderno de Notas Bubble */}
        {cadernoOpen && !selectedFolhaId && (
          <div className="absolute bottom-full right-0 mb-2 w-80 sm:w-96 bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                  <BookMarked className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Anotações</p>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400">{folhas?.length || 0} folhas</p>
                </div>
              </div>
              <button
                onClick={handleCreateFolha}
                disabled={creatingFolha}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 disabled:bg-slate-200 dark:disabled:bg-neutral-700 disabled:text-slate-400 dark:disabled:text-neutral-500 transition-all cursor-pointer"
              >
                {creatingFolha ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Nova folha
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-2 bg-white dark:bg-neutral-950">
              {folhasLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-500 dark:text-neutral-400" />
                </div>
              ) : !folhas?.length ? (
                <div className="flex flex-row items-center justify-center py-4 gap-2 text-center">
                  <StickyNote className="w-4 h-4 text-slate-300 dark:text-neutral-600" />
                  <p className="text-sm text-slate-500 dark:text-neutral-400">Nenhuma folha ainda.</p>
                </div>
              ) : (
                folhas.map((folha) => (
                  <div
                    key={folha.id}
                    className="group flex items-center gap-3 p-3 rounded-xl"

                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-neutral-200 truncate hover:underline cursor-pointer" onClick={() => setSelectedFolhaId(folha.id)}>{folha.title}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500">{formatDate(folha.updated_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Editor inline no bubble */}
        {cadernoOpen && selectedFolhaId && (
          <div className="absolute bottom-full right-0 mb-2 w-80 sm:w-96 bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900">
              <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={handleBackToList}
                disabled={saveStatus === "saving"}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-white/60 dark:hover:bg-neutral-800 transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {saveStatus === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4" />}
              </button>
                <input
                  value={editorTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Título da folha"
                  className="text-sm font-bold text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 bg-transparent border-none outline-none focus:ring-0 min-w-0 flex-1"
                />
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {folhaData?.mind_map_id && (
                  <button
                    onClick={() => {
                      handleCloseCaderno();
                      router.push(`/app/mind-maps/${folhaData.mind_map_id}`);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 transition-all cursor-pointer"
                  >
                    <Network className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => selectedFolhaId && handleDeleteFolha(e, selectedFolhaId)}
                  disabled={deletingFolhaId === selectedFolhaId}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all cursor-pointer"
                >
                  {deletingFolhaId === selectedFolhaId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {folhaLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500 dark:text-neutral-400" />
              </div>
            ) : (
              <>
                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 py-3 bg-white dark:bg-neutral-950 min-h-[200px]">
                  <textarea
                    value={editorContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Escreve as tuas anotações..."
                    className="w-full min-h-[180px] resize-none border-none focus:ring-0 focus:outline-none bg-transparent text-sm text-slate-700 dark:text-neutral-300 leading-relaxed placeholder:text-slate-400 dark:placeholder:text-neutral-500"
                  />
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* Overlays */}
      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
      {explicadorOpen && <div className="fixed inset-0 z-40" onClick={() => setExplicadorOpen(false)} />}
      {cadernoOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={selectedFolhaId && saveStatus === "saving" ? undefined : handleCloseCaderno}
        />
      )}
    </>
  );
}
