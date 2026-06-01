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
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {menuOpen && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openCaderno();
              }}
              className="flex items-center gap-3 pl-4 pr-5 py-3 rounded-2xl bg-white border border-slate-200/80 shadow-lg shadow-slate-200/50 hover:border-amber-200 hover:bg-amber-50/50 transition-all text-left min-w-[200px] cursor-pointer"
            >
              <span className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <BookMarked className="w-4 h-4 text-amber-700" />
              </span>
              <span>
                <span className="block text-sm font-bold text-slate-800">Caderno de Notas</span>
                <span className="block text-[11px] text-slate-500">Folhas de estudo</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setExplicadorOpen(true);
              }}
              className="flex items-center gap-3 pl-4 pr-5 py-3 rounded-2xl bg-white border border-slate-200/80 shadow-lg shadow-slate-200/50 hover:border-cyan-200 hover:bg-cyan-50/50 transition-all text-left min-w-[200px] cursor-pointer"
            >
              <span className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-cyan-700" />
              </span>
              <span>
                <span className="block text-sm font-bold text-slate-800">Explicador</span>
                <span className="block text-[11px] text-slate-500">Tira dúvidas com IA</span>
              </span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title="Ferramentas rápidas"
          aria-label="Ferramentas rápidas"
          aria-expanded={menuOpen}
          className={`w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ${
            menuOpen
              ? "bg-slate-700 hover:bg-slate-800 shadow-slate-400/30 rotate-0"
              : "bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 shadow-cyan-500/30"
          }`}
        >
          {menuOpen ? <Plus className="w-7 h-7 rotate-45" /> : <Sparkles className="w-7 h-7" />}
        </button>
      </div>

      <Dialog open={explicadorOpen} onOpenChange={handleExplicadorOpenChange}>
        <DialogContent
          className="sm:max-w-lg border-slate-200 bg-white text-slate-800 shadow-2xl rounded-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <Bot className="w-5 h-5 text-cyan-600" />
              Explicador
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Escreve a tua dúvida e abrimos uma sala para te explicar o assunto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitExplicador} className="mt-2">
            <div className="flex items-center gap-2 bg-white border border-slate-200 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-500/10 rounded-full px-4 py-2 shadow-sm transition-all duration-300">
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
                className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all duration-200 flex-shrink-0 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
              </button>

              <Button
                type="submit"
                disabled={isCreating || !prompt.trim()}
                className="w-9 h-9 p-0 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full flex items-center justify-center shadow-sm shadow-cyan-500/20 transition-all duration-200 flex-shrink-0"
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
