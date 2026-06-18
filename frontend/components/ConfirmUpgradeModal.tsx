"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface ConfirmUpgradeModalProps {
  open: boolean;
  status: "idle" | "pending" | "success" | "error";
  errorMessage?: string;
}

export function ConfirmUpgradeModal({
  open,
  status,
  errorMessage,
}: ConfirmUpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-sm"
      >
        <DialogTitle className="sr-only">
          {status === "pending"
            ? "A processar pagamento"
            : status === "success"
              ? "Pagamento confirmado"
              : "Erro no pagamento"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {status === "pending"
            ? "A aguardar confirmação do pagamento..."
            : status === "success"
              ? "O teu plano foi atualizado com sucesso."
              : errorMessage || "Ocorreu um erro ao confirmar o pagamento."}
        </DialogDescription>
        <div className="flex flex-col items-center gap-4 py-8">
          {status === "pending" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
              <p className="text-base font-medium text-slate-700">
                A processar o teu upgrade...
              </p>
              <p className="text-sm text-slate-400">
                Por favor, aguarda. Não feches esta página.
              </p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-base font-medium text-green-700">
                Plano atualizado com sucesso!
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <p className="text-base font-medium text-red-700">
                {errorMessage || "Erro ao confirmar pagamento"}
              </p>
              <p className="text-sm text-slate-400">
                Tenta novamente ou contacta o suporte.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
