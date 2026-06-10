"use client";

import { useState } from "react";
import { Turnstile } from "next-turnstile";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function FeedbackForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, message, token: turnstileToken }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao enviar feedback.");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Erro ao enviar feedback.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center space-y-4 max-w-lg mx-auto py-8">
        <div className="w-14 h-14 rounded-full bg-cyan-100 dark:bg-cyan-950 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-xl font-bold">Obrigado pelo teu feedback!</h3>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed max-w-sm mx-auto">
          A tua opinião é muito importante para nós. Cada sugestão ajuda-nos a tornar a Bookar numa plataforma ainda melhor para ti.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setName("");
            setEmail("");
            setMessage("");
            setTurnstileToken("");
          }}
          className="text-sm text-cyan-500 hover:text-cyan-600 font-medium transition-colors"
        >
          Enviar outro feedback
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg mx-auto">
      <div>
        <input
          type="text"
          placeholder="O teu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-5 py-4 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-neutral-900 text-base placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-shadow"
        />
      </div>
      <div>
        <input
          type="email"
          placeholder="O teu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-5 py-4 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-neutral-900 text-base placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-shadow"
        />
      </div>
      <div>
        <textarea
          placeholder="Partilha a tua opinião sobre a Bookar..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          className="w-full px-5 py-4 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-neutral-900 text-base placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-shadow resize-none"
        />
      </div>
      <div className="flex justify-center">
        <Turnstile
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onVerify={(token) => setTurnstileToken(token)}
          theme="auto"
        />
      </div>
      <Button
        type="submit"
        disabled={loading || !turnstileToken}
        className="w-full h-14 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-lg shadow-xl shadow-cyan-200 dark:shadow-cyan-950 transition-all hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          "Enviar Feedback"
        )}
      </Button>
    </form>
  );
}
