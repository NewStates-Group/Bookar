"use client";

import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

type DeleteCourseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle?: string | null;
  isDeleting?: boolean;
  onConfirm: () => void;
};

export function DeleteCourseDialog({
  open,
  onOpenChange,
  courseTitle,
  isDeleting = false,
  onConfirm,
}: DeleteCourseDialogProps) {
  const displayTitle = courseTitle?.trim() || "este curso";

  return (
    <DeleteConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tem certeza que deseja eliminar?"
      isDeleting={isDeleting}
      onConfirm={onConfirm}
      confirmLabel="Eliminar curso"
      description={
        <>
          Vais eliminar permanentemente{" "}
          <span className="font-semibold text-slate-700">&quot;{displayTitle}&quot;</span>.
          Módulos, aulas, progresso e certificados associados deixam de estar disponíveis.
          Esta ação não pode ser desfeita.
        </>
      }
    />
  );
}
