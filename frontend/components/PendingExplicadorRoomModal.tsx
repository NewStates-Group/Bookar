"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { Bot, DoorOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  clearPendingExplicadorRoom,
  getExplicadorRoomIdFromPath,
  getPendingExplicadorRoom,
  type PendingExplicadorRoom,
} from "@/lib/pending-explicador-room";

export function PendingExplicadorRoomModal() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState<PendingExplicadorRoom | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setOpen(false);
      return;
    }

    const saved = getPendingExplicadorRoom();
    if (!saved) {
      setPending(null);
      setOpen(false);
      return;
    }

    const targetPathname = saved.path.split("?")[0];
    if (pathname === targetPathname || pathname.startsWith(`${targetPathname}/`)) {
      clearPendingExplicadorRoom();
      setPending(null);
      setOpen(false);
      return;
    }

    setPending(saved);
    setOpen(true);
  }, [status, pathname]);

  const handleDismiss = () => {
    clearPendingExplicadorRoom();
    setPending(null);
    setOpen(false);
  };

  const handleContinue = () => {
    if (!pending) return;
    const target = pending.path;
    clearPendingExplicadorRoom();
    setPending(null);
    setOpen(false);
    router.push(target);
  };

  const roomId = pending ? getExplicadorRoomIdFromPath(pending.path) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismiss();
      }}
    >
      <DialogContent className="sm:max-w-md border-slate-200 bg-white text-slate-800 shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <Bot className="w-5 h-5 text-cyan-600" />
            Sala do Explicador
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 leading-relaxed pt-1">
            Antes de iniciar sessão, tentaste aceder a uma sala do Explicador.
            Queres continuar e entrar nessa sala agora?
          </DialogDescription>
        </DialogHeader>

        {roomId && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 font-mono break-all">
            {roomId}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDismiss}
            className="rounded-full text-slate-600 hover:text-slate-800"
          >
            Agora não
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white gap-1.5"
          >
            <DoorOpen className="w-4 h-4" />
            Entrar na sala
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
