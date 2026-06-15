"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, Building2, Loader2 } from "lucide-react";
import Image from "next/image";

interface GatewaySelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  onSelect: (gateway: "stripe" | "kambafy") => void;
  isLoading?: boolean;
}

export function GatewaySelectModal({
  open,
  onOpenChange,
  planName,
  onSelect,
  isLoading,
}: GatewaySelectModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escolher método de pagamento</DialogTitle>
          <DialogDescription>
            Seleciona como queres pagar o plano <strong>{planName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          <button
            type="button"
            className="flex items-center gap-3 w-full p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
            onClick={() => onSelect("stripe")}
            disabled={isLoading}
          >
            <Image src="/stripe.png" alt="stripe" width={32} height={32} className="flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">Cartão de Crédito/Débito</p>
              <p className="text-sm text-slate-500 truncate">Paga com Visa, Mastercard e outros via Stripe</p>
            </div>
          </button>

          <button
            type="button"
            className="flex items-center gap-3 w-full p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-purple-400 hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
            onClick={() => onSelect("kambafy")}
            disabled={isLoading}
          >
            <Image src="/kambafy.png" alt="kambafy" width={32} height={32} className="flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">Referência/Transferência Bancária</p>
              <p className="text-sm text-slate-500 truncate">Paga por referência ou transferência via Kambafy</p>
            </div>
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 pb-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            A redirecionar para o pagamento...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
