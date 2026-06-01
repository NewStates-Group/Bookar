"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Eye, Loader2, Network, PenTool, StickyNote } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { authenticatedFetcher, apiRequest } from "@/lib/api";
import { FolhaSummary } from "@/context/NotebookContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface FolhaEditorModalProps {
  folhaId: string | null;
  onClose: () => void;
}

export function FolhaEditorModal({ folhaId, onClose }: FolhaEditorModalProps) {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { data: folha, isLoading } = useSWR<FolhaSummary>(
    folhaId && session?.accessToken
      ? [`${process.env.NEXT_PUBLIC_API_URL}/folhas/${folhaId}`, session.accessToken]
      : null,
    authenticatedFetcher
  );

  useEffect(() => {
    if (folha) {
      setTitle(folha.title);
      setContent(folha.content || "");
      setSaveStatus("idle");
      setIsEditing(true);
    }
  }, [folha?.id, folha?.title, folha?.content]);

  const persist = async (nextTitle: string, nextContent: string) => {
    if (!folhaId) return;
    setSaveStatus("saving");
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/folhas/${folhaId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: nextTitle, content: nextContent }),
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  };

  const scheduleSave = (nextTitle: string, nextContent: string) => {
    setSaveStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persist(nextTitle, nextContent);
    }, 800);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    scheduleSave(value, content);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    scheduleSave(title, value);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onClose();
    }
  };

  return (
    <Dialog open={!!folhaId} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl border-slate-200 bg-white text-slate-800 shadow-2xl rounded-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {isLoading || !folha ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100 shrink-0">
              <DialogTitle className="sr-only">Editor de folha</DialogTitle>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <StickyNote className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <Input
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="text-lg font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0"
                    placeholder="Título da folha"
                  />
                  {folha.mind_map_title && (
                    <p className="text-xs text-cyan-600 flex items-center gap-1.5 font-medium">
                      <Network className="w-3.5 h-3.5" />
                      Ligada a: {folha.mind_map_title}
                      {folha.node_id ? ` · nó ${folha.node_id}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-3 flex items-center justify-between border-b border-stone-200/40 bg-[#FAF9F6] shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    saveStatus === "saving" ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                  }`}
                />
                <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">
                  {saveStatus === "saving" ? "A guardar..." : "Guardado"}
                </span>
              </div>
              <div className="flex bg-stone-200/50 p-0.5 rounded-lg gap-0.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                    isEditing ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                  }`}
                >
                  <PenTool className="w-3 h-3" />
                  Escrever
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                    !isEditing ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Visualizar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 bg-[#FAF9F6] min-h-[320px]">
              {isEditing ? (
                <textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Escreve as tuas anotações em Markdown..."
                  className="w-full min-h-[280px] resize-none border-none focus:ring-0 focus:outline-none bg-transparent text-stone-800 text-sm leading-relaxed font-sans placeholder-stone-300"
                />
              ) : (
                <div
                  onClick={() => setIsEditing(true)}
                  className="min-h-[280px] cursor-text prose prose-stone prose-sm max-w-none text-stone-800"
                >
                  {content.trim() ? (
                    <ReactMarkdown>{content}</ReactMarkdown>
                  ) : (
                    <p className="text-stone-400 text-sm italic">Folha em branco — clica para escrever.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
