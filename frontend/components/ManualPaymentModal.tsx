"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, CheckCircle2, X, Copy, Check } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

interface ManualPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  planSlug: string;
  price: number;
  iban?: string;
  accountName?: string;
  phone?: string;
  onSuccess?: () => void;
}

export function ManualPaymentModal({
  open,
  onOpenChange,
  planName,
  planSlug,
  price,
  iban,
  accountName,
  phone,
  onSuccess,
}: ManualPaymentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 10 * 1024 * 1024) {
        setError("O ficheiro não pode ter mais de 10MB.");
        return;
      }
      setFile(selected);
      setError("");
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Seleciona o comprovativo de pagamento.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("plan_slug", planSlug);
      formData.append("receipt", file);

      await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/manual/submit`,
        {
          method: "POST",
          body: formData,
        }
      );

      setIsSubmitted(true);
      toast.success("Comprovativo enviado com sucesso!");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const msg = err?.data?.detail || err?.data?.message || "Erro ao enviar comprovativo.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }, []);

  const formatPrice = (value: number) =>
    value.toLocaleString("pt-AO", {
      style: "currency",
      currency: "AOA",
      minimumFractionDigits: 0,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg gap-0 p-0">
        <div className="px-6 pt-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <DialogTitle className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
            Transferência Bancária
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Ativar <span className="font-medium text-neutral-700 dark:text-neutral-300">{planName}</span>
          </DialogDescription>
        </div>

        {isSubmitted ? (
          <div className="flex flex-col items-center gap-4 py-12 px-6">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-green-700 dark:text-green-300">Comprovativo enviado!</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                Vamos verificar o pagamento. Assim que estiver tudo certo, ativamos o teu plano.
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => {
                onOpenChange(false);
                setIsSubmitted(false);
                setFile(null);
              }}
            >
              Fechar
            </Button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Valor</span>
              <span className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
                {formatPrice(price)}
                <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500 ml-1">/mês</span>
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Dados para transferência</p>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">IBAN</p>
                    <p className="text-sm font-mono text-neutral-800 dark:text-neutral-200 mt-0.5">
                      {iban}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(iban || "AO004000009862862210162", "iban")}
                    className="p-1.5 -mr-1.5 -mt-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                    title="Copiar IBAN"
                  >
                    {copiedField === "iban" ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                    )}
                  </button>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">Telefone / Referência</p>
                    <p className="text-sm font-mono text-neutral-800 dark:text-neutral-200 mt-0.5">
                      {phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(phone || "", "phone")}
                    className="p-1.5 -mr-1.5 -mt-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                    title="Copiar telefone"
                  >
                    {copiedField === "phone" ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                    )}
                  </button>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">Titular</p>
                  <p className="text-sm text-neutral-800 dark:text-neutral-200 mt-0.5">
                    {accountName}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                Comprovativo
              </p>
              <div
                className={`border border-dashed rounded-lg py-5 px-4 text-center cursor-pointer transition-colors ${file
                    ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30"
                    : "border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500 bg-white dark:bg-neutral-900"
                  }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-300 truncate max-w-[240px]">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setError("");
                      }}
                      className="p-0.5 hover:bg-green-100 dark:hover:bg-green-900/40 rounded"
                    >
                      <X className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Carrega o comprovativo (imagem ou PDF)
                  </p>
                )}
              </div>
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-black"
                onClick={handleSubmit}
                disabled={!file || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    A enviar...
                  </>
                ) : (
                  "Enviar Comprovativo"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
