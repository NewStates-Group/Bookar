"use client";

import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

type DeleteMindMapDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapTitle?: string | null;
  isDeleting?: boolean;
  onConfirm: () => void;
};

export function DeleteMindMapDialog({
  open,
  onOpenChange,
  mapTitle,
  isDeleting = false,
  onConfirm,
}: DeleteMindMapDialogProps) {
  const displayTitle = mapTitle?.trim() || "este mapa mental";

  return (
    <DeleteConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tem certeza que deseja eliminar?"
      isDeleting={isDeleting}
      onConfirm={onConfirm}
      confirmLabel="Eliminar mapa"
      description={
        <>
          Vais eliminar permanentemente{" "}
          <span className="font-semibold text-slate-700">&quot;{displayTitle}&quot;</span>.
          O mapa, nós e ligações associados serão removidos. Esta ação não pode ser
          desfeita.
        </>
      }
    />
  );
}
