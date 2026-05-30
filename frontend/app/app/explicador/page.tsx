"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Trash2, ArrowRight, Sparkles, MessageSquare, History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { authenticatedFetcher, apiRequest } from "@/lib/api";

interface ExplicadorRoom {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string;
}

const SUGGESTIONS = [
  "O que são pronomes em Inglês?",
  "Explica o Teorema de Pitágoras de forma visual",
  "Prova-me que 1+1 = 2",
  "O que é o amor?"
];

export default function ExplicadorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { data: rooms, mutate: mutateRooms, isLoading } = useSWR<ExplicadorRoom[]>(
    session?.accessToken
      ? [`${process.env.NEXT_PUBLIC_API_URL}/explicador`, session.accessToken]
      : null,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

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
      toast.success("Sala de explicação criada!");
      setPrompt("");
      mutateRooms();
      router.push(`/app/explicador/${res.id}?prompt=${encodeURIComponent(finalPrompt)}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar sala de explicação.");
      setIsCreating(false);
    }
  };

  const handleDeleteRoom = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Tem certeza que deseja remover esta sala de explicação?")) return;

    setIsDeleting(id);
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/explicador/${id}`, {
        method: "DELETE",
      });
      toast.success("Sala de explicação removida.");
      mutateRooms();
    } catch (err: any) {
      toast.error(err.message || "Erro ao deletar sala de explicação.");
    } finally {
      setIsDeleting(null);
    }
  };

  if (status === "loading" || (session?.accessToken && isLoading && !rooms)) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mx-auto" />
          <p className="text-muted-foreground font-medium">
            Carregando o explicador...
          </p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-20 bg-background">
      {/* Central Section */}
      <div className="text-center space-y-6 max-w-2xl mx-auto mb-12">
        <div className="w-16 h-16 bg-cyan-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Sparkles className="w-8 h-8 text-cyan-600" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-800">
          O que vamos aprender hoje?
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          Escreva um assunto ou pergunta abaixo. O Explicador AI criará uma explicação didática detalhada e organizará os conceitos num quadro branco visual síncrono.
        </p>
      </div>

      {/* Main Prompt Box */}
      <form onSubmit={(e) => handleSubmitPrompt(e)} className="mb-12">
        <div className="relative bg-white border border-slate-200 focus-within:border-cyan-500 rounded-3xl p-2.5 shadow-lg shadow-slate-100 flex items-center gap-3 transition-all duration-300">
          <input
            placeholder="Digite o assunto que deseja dominar (ex: Como funcionam os buracos negros?)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isCreating}
            className="flex-1 h-12 bg-transparent text-slate-800 placeholder:text-slate-400 text-base md:text-md px-4 outline-none border-0 focus:ring-0"
          />
          <Button
            type="submit"
            disabled={isCreating || !prompt.trim()}
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-2xl h-12 px-6 flex items-center gap-1.5 shadow-md shadow-cyan-500/25 shrink-0"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Explicar
                <ArrowRight className="w-4.5 h-4.5" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Suggestions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
        {SUGGESTIONS.map((suggestion, index) => (
          <button
            key={index}
            type="button"
            onClick={() => handleSubmitPrompt(undefined, suggestion)}
            disabled={isCreating}
            className="text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-cyan-500 hover:bg-cyan-500/[0.01] hover:shadow-[0_4px_12px_rgba(6,182,212,0.05)] transition-all duration-300 group flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700 leading-snug group-hover:text-cyan-600 transition-colors">
                {suggestion}
              </p>
              <span className="text-[10px] text-slate-400">Clique para testar instantaneamente</span>
            </div>
          </button>
        ))}
      </div>

      {/* Previous Rooms History */}
      {rooms && rooms.length > 0 && (
        <div className="border-t border-slate-100 pt-10">
          <div className="flex items-center gap-2 mb-6">
            <History className="w-4.5 h-4.5 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
              Suas salas anteriores
            </h2>
          </div>

          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => router.push(`/app/explicador/${room.id}`)}
                className="group flex items-center justify-between p-4 rounded-xl border border-slate-150 bg-white cursor-pointer hover:border-cyan-500/35 hover:shadow-[0_2px_8px_rgba(6,182,212,0.02)] transition-all duration-300"
              >
                <div className="flex items-center gap-3 truncate pr-4">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div className="truncate">
                    <h3 className="text-sm font-bold text-slate-700 truncate group-hover:text-cyan-600 transition-colors">
                      {room.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Criada em {new Date(room.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDeleteRoom(room.id, e)}
                  disabled={isDeleting === room.id}
                  className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-500/5 shrink-0 transition-all duration-300"
                >
                  {isDeleting === room.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
