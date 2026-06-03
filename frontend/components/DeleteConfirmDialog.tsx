"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { platformDialog, platformDialogHeaderIcon } from "@/lib/platform-ui";
import { cn } from "@/lib/utils";

export type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  deletingLabel?: string;
  isDeleting?: boolean;
  onConfirm: () => void;
};

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  deletingLabel = "A eliminar…",
  isDeleting = false,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
      <AlertDialogContent
        className={cn(
          platformDialog,
          "sm:max-w-md border-red-100/80 p-0 gap-0 overflow-hidden"
        )}
      >
        <div className="h-1 w-full bg-gradient-to-r from-red-400 via-red-500 to-rose-500" />

        <div className="p-6">
          <AlertDialogHeader className="space-y-4">
            <div className="flex flex-col items-center text-center sm:items-center sm:text-center">
              <span
                className={cn(
                  platformDialogHeaderIcon,
                  "w-14 h-14 rounded-2xl bg-red-50 border-red-100 mb-1"
                )}
              >
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </span>
              <AlertDialogTitle className="text-xl font-bold text-slate-800">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-slate-500 text-sm leading-relaxed max-w-sm">
                  {typeof description === "string" ? (
                    <p>{description}</p>
                  ) : (
                    description
                  )}
                </div>
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-6 flex-col-reverse sm:flex-row sm:justify-center gap-2">
            <AlertDialogCancel
              disabled={isDeleting}
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 sm:min-w-[120px]"
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/25 sm:min-w-[140px] gap-2"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isDeleting ? deletingLabel : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
