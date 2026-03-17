"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { toast } from "sonner";

function AnimatedCounter({ value }: { value: number }) {
  const count = useSpring(0, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    count.set(value);
  }, [value, count]);

  const display = useTransform(count, (latest) => Math.floor(latest).toLocaleString());

  return <motion.span>{display}</motion.span>;
}

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 14);

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance < 0) {
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const TimeUnit = ({ value, label }: { value: number, label: string }) => (
    <div className="flex flex-col items-center min-w-[60px] md:min-w-[90px]">
      <div className="text-4xl md:text-6xl font-bold tracking-tight tabular-nums text-foreground">
        {value.toString().padStart(2, '0')}
      </div>
      <div className="text-[10px] md:text-xs font-semibold text-cyan-600 uppercase tracking-widest mt-1">
        {label}
      </div>
    </div>
  );

  return (
    <div className="flex gap-4 md:gap-8 justify-center items-center py-6">
      <TimeUnit value={timeLeft.days} label="Dias" />
      <div className="text-3xl md:text-5xl font-extralight text-muted-foreground/30 self-start mt-1">:</div>
      <TimeUnit value={timeLeft.hours} label="Horas" />
      <div className="text-3xl md:text-5xl font-extralight text-muted-foreground/30 self-start mt-1">:</div>
      <TimeUnit value={timeLeft.minutes} label="Min" />
      <div className="text-3xl md:text-5xl font-extralight text-muted-foreground/30 self-start mt-1">:</div>
      <TimeUnit value={timeLeft.seconds} label="Seg" />
    </div>
  );
}

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/auth/waitlist/count`);
        if (response.ok) {
          const data = await response.json();
          setWaitingCount(data.count + 1200);
        }
      } catch (error) {
        setWaitingCount(1243);
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/auth/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        toast.success("Inscrito com sucesso! Avisaremos assim que estivermos prontos.");
        setEmail("");
        setWaitingCount(prev => prev + 1);
      } else {
        const data = await response.json();
        toast.error(data.message || "Erro ao inscrever. Tenta novo.");
      }
    } catch (error) {
      toast.error("Ocorreu um erro. Verifica a tua ligação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white text-foreground selection:bg-cyan-100 selection:text-cyan-900">
      <div className="absolute top-8 right-8 flex items-center gap-4">
        <Link href="/login">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            Entrar
          </Button>
        </Link>
        <Link href="/signup">
          <Button size="sm" variant="outline" className="border-border hover:bg-muted font-medium">
            Criar conta
          </Button>
        </Link>
      </div>

      <main className="z-10 text-center max-w-4xl w-full space-y-12">
        <div className="space-y-8 flex flex-col items-center">
          {/* Enlarged Logo and Name */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 mb-2"
          >
            <Image src="/logo.png" alt="Logo" width={64} height={64} className="md:w-20 md:h-20" />
            <span className="text-3xl md:text-5xl font-bold tracking-tighter uppercase">Bookar</span>
          </motion.div>

          <h1 className="text-4xl md:text-7xl font-bold tracking-tight text-balance leading-tight">
            Aprende tudo o que <br className="hidden md:block" /> quiseres, com IA.
          </h1>

          {/* Secondary description removed for a more minimalist look */}
        </div>

        <div className="py-6 border-y border-border/50">
          <CountdownTimer />
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="inline-block h-8 w-8 rounded-full border-2 border-white bg-muted overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + waitingCount}`} alt="" />
                  </div>
                ))}
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                <span className="text-foreground font-bold"><AnimatedCounter value={waitingCount} /></span> pessoas já estão na lista
              </p>
            </div>
          </div>

          <div className="w-full max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="Introduz o teu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 border-border bg-white rounded-lg px-4 text-base focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500"
              />
              <Button
                type="submit"
                disabled={loading}
                className="h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-bold px-8 shadow-sm transition-all rounded-lg"
              >
                {loading ? "..." : "Reservar Acesso"}
              </Button>
            </form>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-8 w-full flex justify-center opacity-40 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <p>Bookar &copy; 2026</p>
      </footer>
    </div>
  );
}
