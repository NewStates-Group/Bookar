"use client";

import { Loader2, Pencil, Lock, Unlock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { useState } from "react";

interface PencilModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLock: { connection_id: string; name: string } | null;
  isLockHolder: boolean;
  pencilCooldownActive: boolean;
  pencilCooldownTimeLeft: number;
  grabLock: () => void;
  releaseLock: () => void;
  requestPencil: () => void;
}

export default function PencilModal({
  open,
  onOpenChange,
  currentLock,
  isLockHolder,
  pencilCooldownActive,
  pencilCooldownTimeLeft,
  grabLock,
  releaseLock,
  requestPencil,
}: PencilModalProps) {
  const [grabbing, setGrabbing] = useState(false);

  const handleGrab = () => {
    setGrabbing(true);
    grabLock();
    setTimeout(() => {
      setGrabbing(false);
      onOpenChange(false);
    }, 800);
  };

  const handleRelease = () => {
    releaseLock();
    onOpenChange(false);
  };

  const handleRequest = () => {
    requestPencil();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] border-slate-200 bg-white shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-100">
            <Pencil className="w-7 h-7 text-amber-600" />
          </div>
          <DialogTitle className="text-center text-lg font-bold text-slate-800">
            Lápis
          </DialogTitle>
          <DialogDescription className="text-center text-slate-500 leading-relaxed text-sm">
            {isLockHolder ? (
              "Tens o lápis! Podes falar diretamente com o explicador."
            ) : currentLock ? (
              <>
                O lápis está com <strong className="text-slate-700">{currentLock.name}</strong>
              </>
            ) : (
              "O lápis está disponível. Pega-o para falar com o explicador."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-2">
          {isLockHolder ? (
            <Button
              onClick={handleRelease}
              variant="outline"
              className="w-full gap-2 h-10 text-sm font-semibold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Unlock className="w-4 h-4" />
              Largar o lápis
            </Button>
          ) : currentLock ? (
            <Button
              onClick={handleRequest}
              disabled={pencilCooldownActive}
              className="w-full gap-2 h-10 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
            >
              {pencilCooldownActive ? (
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Aguarda {pencilCooldownTimeLeft}s
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Pedir o lápis
                </span>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleGrab}
              disabled={grabbing}
              className="w-full gap-2 h-10 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white"
            >
              {grabbing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A pegar...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Pegar o lápis
                </span>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
