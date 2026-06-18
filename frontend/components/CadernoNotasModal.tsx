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
import {
  platformDialog,
  platformDialogHeaderIcon,
  platformListItem,
  platformListItemIcon,
  platformPrimaryButton,
} from "@/lib/platform-ui";

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
      <DialogContent
        className={`sm:max-w-lg ${platformDialog} max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-lg`}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200/60 bg-white/80 gap-1/2">
          <DialogTitle className="text-lg font-bold text-slate-800">
            Caderno de Notas
          </DialogTitle>
          <p className="text-base text-slate-500">
            Crie e salve as suas notas de estudo.
          </p>
        </DialogHeader>

        <div className="px-6 py-4 shrink-0 bg-slate-50/80">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className={`w-full ${platformPrimaryButton}`}
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Nova folha
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-6 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : !folhas?.length ? null : (
            folhas.map((folha) => (
              <div
                key={folha.id}
                className={platformListItem}
              >
                
                <div className="flex-1 min-w-0">
                  <h4 onClick={() => onOpenFolha(folha.id)} className="hover:underline hover:cursor-pointer font-semibold text-sm text-slate-800 truncate">{folha.title}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] text-black font-light border px-1.5 py-0.5 rounded-md">
                      {formatDate(folha.updated_at)}
                    </span>
                    {folha.mind_map_title && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-700 bg-cyan-50 border border-cyan-100/80 px-1.5 py-0.5 rounded-md">
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Apagar folha"
                >
                  {deletingId === folha.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
