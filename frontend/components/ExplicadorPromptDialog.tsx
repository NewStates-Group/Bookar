"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Mic, Send } from "lucide-react";
import { mutate } from "swr";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import type { ExplicadorCourseContext } from "@/lib/explicador-course-context";
import { platformDialog } from "@/lib/platform-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ExplicadorPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseContext?: ExplicadorCourseContext | null;
  title?: string;
  description?: string;
  placeholder?: string;
};

export function ExplicadorPromptDialog({
  open,
  onOpenChange,
  courseContext,
  title = "Explicador",
  description,
  placeholder = "Qual é a tua dúvida?",
}: ExplicadorPromptDialogProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const defaultDescription = courseContext
    ? "A tua dúvida será respondida com contexto desta aula e do curso."
    : "Escreve a tua dúvida e abrimos uma sala para te explicar o assunto.";

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setPrompt("");
      setIsCreating(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const finalPrompt = prompt.trim();
    if (!finalPrompt || isCreating) return;

    setIsCreating(true);
    try {
      const body: { title: string; course_context?: ExplicadorCourseContext } = {
        title: finalPrompt,
      };
      if (courseContext) {
        body.course_context = courseContext;
      }

      const res = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/explicador`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (session?.accessToken) {
        mutate([`${process.env.NEXT_PUBLIC_API_URL}/explicador`, session.accessToken]);
      }

      handleOpenChange(false);
      router.push(`/app/explicador/${res.id}?prompt=${encodeURIComponent(finalPrompt)}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao criar sala de explicação.";
      toast.error(message);
      setIsCreating(false);
    }
  };

  const handleMic = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition })
        .webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("O seu navegador não suporta reconhecimento de voz.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-PT";
    recognition.interimResults = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setPrompt(transcript);
        inputRef.current?.focus();
      }
    };
    recognition.onerror = () => toast.error("Erro ao capturar voz.");
    recognition.start();
  };

  const contextLabel = courseContext
    ? [courseContext.course_title, courseContext.lesson_title || courseContext.module_name]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`sm:max-w-lg ${platformDialog} p-6`}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader className="flex items-center justify-center">
          <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-slate-800">
            <Bot className="w-5 h-5 text-cyan-600" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-center text-slate-500">
            {description ?? defaultDescription}
          </DialogDescription>
        </DialogHeader>

        {contextLabel && (
          <p className="text-xs text-center text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 font-medium">
            {contextLabel}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200/80 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-500/10 rounded-full px-4 py-2 shadow-sm transition-all">
            <input
              ref={inputRef}
              placeholder={placeholder}
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
  );
}
