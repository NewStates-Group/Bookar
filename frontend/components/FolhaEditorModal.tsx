"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { BookMarked, Eye, Loader2, Network, PenLine } from "lucide-react";
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
import {
  platformDialog,
  platformDialogHeaderIcon,
  platformSegmentTab,
} from "@/lib/platform-ui";
import Link from "next/link";

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
      <DialogContent
        className={`sm:max-w-2xl ${platformDialog} max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-lg`}
      >
        {isLoading || !folha ? (
          <div className="flex items-center justify-center py-20 bg-slate-50">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200/60 bg-white ">
              <DialogTitle className="sr-only">Editor de folha</DialogTitle>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <Input
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="md:text-xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent text-slate-800"
                    placeholder="Título da folha"
                  />
                </div>
              </div>
            </DialogHeader>

            <div className="px-4 flex items-center justify-between!">
              <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Estado: {saveStatus === "saving" ? "Salvando..." : "Salvo"}
                  </span>
              </div>
              <div className="flex bg-slate-200/50 rounded-xl gap-0.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                    isEditing
                      ? "bg-white text-cyan-600 shadow-sm border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <PenLine className="w-3 h-3" />
                  Escrever
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                    !isEditing
                      ? "bg-white text-cyan-600 shadow-sm border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Visualizar
                </button>
                {folha.mind_map_id && (
                  <Link href={`/app/mind-maps/${folha.mind_map_id}`} onClick={() => {
                    handleOpenChange(false)
                  }} className="cursor-pointer text-cyan-700 flex items-center gap-1.5 font-semibold  px-2 py-1 border-l brder-gray-700">
                    <Network className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 bg-white min-h-[320px]">
              {isEditing ? (
                <textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Escreve as tuas anotações em Markdown..."
                  className="w-full min-h-[280px] resize-none border-none focus:ring-0 focus:outline-none bg-transparent text-slate-700 text-sm leading-relaxed placeholder:text-slate-400"
                />
              ) : (
                <div
                  onClick={() => setIsEditing(true)}
                  className="min-h-[280px] cursor-text prose prose-slate prose-sm max-w-none text-slate-700"
                >
                  {content.trim() ? (
                    <ReactMarkdown>{content}</ReactMarkdown>
                  ) : (
                    <p className="text-slate-400 text-sm italic">
                      Folha em branco — clica para escrever.
                    </p>
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
