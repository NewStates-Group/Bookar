"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import {
  BookMarked,
  Loader2,
  Network,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetcher, apiRequest } from "@/lib/api";
import { FolhaSummary } from "@/context/NotebookContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CadernoNotasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFolha: (folhaId: string) => void;
  folhasVersion: number;
}

export function CadernoNotasModal({
  open,
  onOpenChange,
  onOpenFolha,
  folhasVersion,
}: CadernoNotasModalProps) {
  const { data: session } = useSession();
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: folhas, isLoading, mutate } = useSWR<FolhaSummary[]>(
    open && session?.accessToken
      ? [`${process.env.NEXT_PUBLIC_API_URL}/folhas`, session.accessToken, folhasVersion]
      : null,
    authenticatedFetcher
  );

  useEffect(() => {
    if (open) mutate();
  }, [open, folhasVersion, mutate]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/folhas`, {
        method: "POST",
        body: JSON.stringify({ title: "Folha em branco" }),
      });
      await mutate();
      onOpenFolha(created.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar folha.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, folhaId: string) => {
    e.stopPropagation();
    setDeletingId(folhaId);
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/folhas/${folhaId}`, {
        method: "DELETE",
      });
      await mutate();
      toast.success("Folha removida.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover folha.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-slate-200 bg-white text-slate-800 shadow-2xl rounded-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <BookMarked className="w-5 h-5 text-amber-600" />
            Caderno de Notas
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            As tuas folhas de estudo. Clica numa para abrir ou cria uma nova.
          </DialogDescription>
        </DialogHeader>

        <Button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white gap-2 shadow-sm"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Nova folha
        </Button>

        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1 space-y-2 mt-1">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : !folhas?.length ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
              <StickyNote className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Ainda não tens folhas</p>
              <p className="text-xs text-slate-400 mt-1">Cria a primeira para começar a anotar.</p>
            </div>
          ) : (
            folhas.map((folha) => (
              <button
                key={folha.id}
                type="button"
                onClick={() => onOpenFolha(folha.id)}
                className="w-full text-left p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-amber-50/40 hover:border-amber-200/80 transition-all group flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100/80 flex items-center justify-center shrink-0">
                  <StickyNote className="w-4 h-4 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-slate-800 truncate">{folha.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                    {folha.content?.trim() || "Sem conteúdo ainda..."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-slate-400">{formatDate(folha.updated_at)}</span>
                    {folha.mind_map_title && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded-md">
                        <Network className="w-3 h-3" />
                        {folha.mind_map_title}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, folha.id)}
                  disabled={deletingId === folha.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Apagar folha"
                >
                  {deletingId === folha.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
