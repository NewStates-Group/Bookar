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
    <div className="flex flex-col items-center min-w-[50px] md:min-w-[70px]">
      <div className="text-3xl md:text-5xl font-bold tracking-tight tabular-nums text-foreground">
        {value.toString().padStart(2, '0')}
      </div>
      <div className="text-[9px] md:text-[10px] font-bold text-cyan-600/80 uppercase tracking-widest mt-1">
        {label}
      </div>
    </div>
  );

  return (
    <div className="flex gap-3 md:gap-5 justify-center items-center py-4">
      <TimeUnit value={timeLeft.days} label="Dias" />
      <div className="text-2xl md:text-4xl font-extralight text-muted-foreground/30 self-start mt-1">:</div>
      <TimeUnit value={timeLeft.hours} label="Horas" />
      <div className="text-2xl md:text-4xl font-extralight text-muted-foreground/30 self-start mt-1">:</div>
      <TimeUnit value={timeLeft.minutes} label="Min" />
      <div className="text-2xl md:text-4xl font-extralight text-muted-foreground/30 self-start mt-1">:</div>
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
        toast.success("Inscrito na lista de espera! Avisaremos em breve.");
        setEmail("");
        setWaitingCount(prev => prev + 1);
      } else {
        const data = await response.json();
        toast.error(data.message || "Algo correu mal. Tenta de novo.");
      }
    } catch (error) {
      toast.error("Erro de ligação. Verifica a tua internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111] font-sans">
      {/* Header mapped from bookar.study */}
      <header className="p-6 md:p-10 flex justify-end gap-6 items-center">
        <Link href="/login" className="text-sm font-medium hover:text-black/60 transition-colors">
          Entrar
        </Link>
        <Link href="/signup">
          <Button variant="outline" className="rounded-full border-[#111] text-[#111] hover:bg-[#111] hover:text-white px-6">
            Registar-se
          </Button>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-12 pb-24">
        {/* Hero Section */}
        <div className="z-10 text-center max-w-3xl space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-1000 relative">
          {/* Subtle Cyan Glow behind logo */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-cyan-400/10 blur-[60px] -z-10 rounded-full"></div>

          <div className="flex justify-center items-center gap-1">
            <Image
              src={"/logo.png"}
              alt="Logo"
              width={80}
              height={80}
            />
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-balance bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
              Bookar
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto text-balance font-light">
            A melhor plataforma de aprendizado baseado em IA.
          </p>
        </div>

        {/* Dynamic Features Integration */}
        <div className="w-full max-w-xl space-y-10">
          <div className="py-4 border-y border-black/[0.05]">
            <CountdownTimer />
          </div>

          <div className="flex flex-col items-center gap-6 mt-4">
            {/* Waitlist Count */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="inline-block h-8 w-8 rounded-full border-2 border-white bg-neutral-100 overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + waitingCount}`} alt="" />
                  </div>
                ))}
              </div>
              <p className="text-sm font-semibold text-black/40">
                <span className="text-black font-bold"><AnimatedCounter value={waitingCount} /></span> pessoas já estão na lista
              </p>
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col sm:flex-row gap-2 max-w-md">
              <Input
                type="email"
                placeholder="teu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 border-black/10 bg-neutral-50 rounded-xl px-4 text-base focus-visible:ring-black/5 focus-visible:border-black/20"
              />
              <Button
                type="submit"
                disabled={loading}
                className="h-12 bg-cyan-500 hover:bg-cyan-600 text-black font-bold px-8 rounded-xl shadow-sm transition-all"
              >
                {loading ? "..." : "Reservar Lugar"}
              </Button>
            </form>
          </div>
        </div>
      </main>

      <footer className="p-10 flex justify-center text-sm font-medium text-black/30">
        <p>© Bookar 2026</p>
      </footer>
    </div>
  );
}
