"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface ExplicadorInvitePopoverProps {
  shareUrl: string;
}

export function ExplicadorInvitePopover({ shareUrl }: ExplicadorInvitePopoverProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link.");
    }
  };

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="hover:bg-transparent! h-8 shadow-none border-none rounded-full text-xs flex items-center"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Convidar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-72 p-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Convidar para a sala</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Partilha o link ou lê o código QR.
            </p>
          </div>

          <div className="flex justify-center rounded-lg border border-slate-100 bg-white p-3">
            <img
              src={qrSrc}
              alt="Código QR da sala"
              width={160}
              height={160}
              className="rounded-md"
            />
          </div>

          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={shareUrl}
              className="h-8 text-xs font-mono select-all"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2.5 shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
