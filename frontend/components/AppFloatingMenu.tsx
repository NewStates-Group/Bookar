"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  BookMarked,
  Bot,
  Loader2,
  Mic,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { mutate } from "swr";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useNotebook } from "@/context/NotebookContext";
import {
  platformDialog,
  platformDialogHeaderIcon,
  platformFab,
  platformFabOpen,
  platformQuickAction,
} from "@/lib/platform-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AppFloatingMenu() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { openCaderno } = useNotebook();

  const [menuOpen, setMenuOpen] = useState(false);
  const [explicadorOpen, setExplicadorOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const isExplicadorRoom =
    pathname.startsWith("/app/explicador/") && pathname !== "/app/explicador";

  if (status !== "authenticated" || isExplicadorRoom) {
    return null;
  }

  const handleExplicadorOpenChange = (next: boolean) => {
    setExplicadorOpen(next);
    if (!next) {
      setPrompt("");
      setIsCreating(false);
    }
  };

  const handleSubmitExplicador = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const finalPrompt = prompt.trim();
    if (!finalPrompt || isCreating) return;

    setIsCreating(true);
    try {
      const res = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/explicador`, {
        method: "POST",
        body: JSON.stringify({ title: finalPrompt }),
      });

      if (session?.accessToken) {
        mutate([`${process.env.NEXT_PUBLIC_API_URL}/explicador`, session.accessToken]);
      }

      setExplicadorOpen(false);
      setMenuOpen(false);
      setPrompt("");
      router.push(`/app/explicador/${res.id}?prompt=${encodeURIComponent(finalPrompt)}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar sala de explicação.");
      setIsCreating(false);
    }
  };

  const handleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("O seu navegador não suporta reconhecimento de voz.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-PT";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(transcript);
      inputRef.current?.focus();
    };
    recognition.onerror = () => toast.error("Erro ao capturar voz.");
    recognition.start();
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5">
        {menuOpen && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openCaderno();
              }}
              className={platformQuickAction}
            >
              <span className={platformDialogHeaderIcon}>
                <BookMarked className="w-4 h-4 text-cyan-600" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Caderno de Notas
                </span>
                <span className="block text-[11px] text-slate-500 font-medium">
                  Folhas de estudo
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setExplicadorOpen(true);
              }}
              className={platformQuickAction}
            >
              <span className={platformDialogHeaderIcon}>
                <Bot className="w-4 h-4 text-cyan-600" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-800">Explicador</span>
                <span className="block text-[11px] text-slate-500 font-medium">
                  Tira dúvidas com IA
                </span>
              </span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title="Ferramentas de IA"
          aria-label="Ferramentas de IA"
          aria-expanded={menuOpen}
          className={menuOpen ? platformFabOpen : platformFab}
        >
          {menuOpen ? (
            <Plus className="w-6 h-6 rotate-45" />
          ) : (
            <span className="relative flex items-center justify-center">
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-500/10 blur-sm" />
              <Sparkles className="w-6 h-6 relative text-cyan-600" />
            </span>
          )}
        </button>
      </div>

      <Dialog open={explicadorOpen} onOpenChange={handleExplicadorOpenChange}>
        <DialogContent
          className={`sm:max-w-lg ${platformDialog} p-6`}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogHeader className="flex items-center justify-center">
            <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-slate-800">
              Explicador
            </DialogTitle>
            <DialogDescription className="text-sm text-center text-slate-500">
              Escreve a tua dúvida e abrimos uma sala para te explicar o assunto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitExplicador} className="mt-4">
            <div className="flex items-center gap-2 bg-white border border-slate-200/80 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-500/10 rounded-full px-4 py-2 shadow-sm transition-all">
              <input
                ref={inputRef}
                placeholder="Qual é a tua dúvida?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isCreating}
                className="flex-1 h-11 bg-transparent text-slate-800 placeholder:text-slate-400 text-sm px-2 outline-none border-0 focus:ring-0"
              />

              <button
                type="button"
                onClick={handleMic}
                disabled={isCreating}
                title="Falar"
                className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all flex-shrink-0 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
              </button>

              <Button
                type="submit"
                disabled={isCreating || !prompt.trim()}
                className="w-9 h-9 p-0 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full flex items-center justify-center shadow-sm shadow-cyan-500/20 flex-shrink-0"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
