"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Mic, MessageSquare } from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { mutate } from "swr";

export default function ExplicadorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const user = session?.user as any;
  const firstName = user?.first_name || null;

  // Pick a random greeting phrase once on mount
  const greeting = useMemo(() => {
    const phrases = [
      firstName ? `O que lhe posso explicar hoje, ${firstName}?` : "O que lhe posso explicar hoje?",
      firstName ? `Tem alguma dúvida, ${firstName}?` : "Tem alguma dúvida?",
      "O que vamos aprender hoje?",
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  const handleSubmitPrompt = async (e?: React.FormEvent, promptValue?: string) => {
    if (e) e.preventDefault();
    const finalPrompt = (promptValue || prompt).trim();
    if (!finalPrompt || isCreating) return;

    setIsCreating(true);
    try {
      const res = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/explicador`, {
        method: "POST",
        body: JSON.stringify({ title: finalPrompt }),
      });
      
      // Mutate room list so sidebar updates automatically!
      if (session?.accessToken) {
        mutate([`${process.env.NEXT_PUBLIC_API_URL}/explicador`, session.accessToken]);
      }

      // toast.success("Sala de explicação criada!");
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

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mx-auto" />
          <p className="text-muted-foreground font-medium">Carregando o explicador...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    /* ChatGPT-style: vertically centered, content pinned to mid-screen */
    <div className="flex flex-col items-center justify-center min-h-screen px-4 md:px-8">
      <div className="w-full max-w-2xl">

        {/* Rotating Greeting */}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-800 dark:text-neutral-100 text-center mb-8">
          {greeting}
        </h1>

        {/* Pill Input */}
        <form onSubmit={(e) => handleSubmitPrompt(e)} className="mb-6">
          <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-slate-700 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-500/10 rounded-full px-4 py-2 shadow-md shadow-slate-100/80 dark:shadow-none transition-all duration-300">
            <input
              ref={inputRef}
              placeholder="Escreve o assunto que queres dominar..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isCreating}
              className="flex-1 h-11 bg-transparent text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 text-sm px-2 outline-none border-0 focus:ring-0"
            />

            {/* Mic button */}
            <button
              type="button"
              onClick={handleMic}
              disabled={isCreating}
              title="Falar"
              className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 dark:text-neutral-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition-all duration-200 flex-shrink-0 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Send button */}
            <Button
              type="submit"
              disabled={isCreating || !prompt.trim()}
              className="w-9 h-9 p-0 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-200 dark:disabled:bg-neutral-700 disabled:text-slate-400 dark:disabled:text-neutral-500 text-white rounded-full flex items-center justify-center shadow-sm shadow-cyan-500/20 transition-all duration-200 flex-shrink-0"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
