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
    <div className="flex flex-col items-center min-w-[60px] md:min-w-[80px]">
      <div className="text-4xl md:text-6xl font-medium tracking-tight tabular-nums text-white">
        {value.toString().padStart(2, '0')}
      </div>
      <div className="text-[10px] md:text-xs font-bold text-cyan-400 uppercase tracking-widest mt-1 opacity-80">
        {label}
      </div>
    </div>
  );

  return (
    <div className="flex gap-4 md:gap-6 justify-center items-center py-8">
      <TimeUnit value={timeLeft.days} label="Dias" />
      <div className="text-3xl md:text-5xl font-extralight text-white/20">:</div>
      <TimeUnit value={timeLeft.hours} label="Horas" />
      <div className="text-3xl md:text-5xl font-extralight text-white/20">:</div>
      <TimeUnit value={timeLeft.minutes} label="Min" />
      <div className="text-3xl md:text-5xl font-extralight text-white/20">:</div>
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
        toast.success("Boas-vindas à lista de espera! Avisaremos em breve.");
        setEmail("");
        setWaitingCount(prev => prev + 1);
      } else {
        const data = await response.json();
        toast.error(data.message || "Erro ao se inscrever. Tente novamente.");
      }
    } catch (error) {
      toast.error("Ocorreu um erro de ligação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black text-white selection:bg-cyan-500/30">
      {/* Discreet Logo */}
      <div className="absolute top-8 left-8">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Logo" width={28} height={28} className="brightness-110" />
          <span className="text-lg font-bold tracking-tighter uppercase">Bookar</span>
        </div>
      </div>

      <div className="absolute top-8 right-8 flex items-center gap-4">
        <Link href="/login">
          <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/5 font-medium">
            Entrar
          </Button>
        </Link>
        <Link href="/signup">
          <Button className="bg-white text-black hover:bg-white/90 rounded-sm font-bold px-6">
            Aceder
          </Button>
        </Link>
      </div>

      <main className="z-10 text-center max-w-4xl w-full space-y-12">
        <div className="space-y-4">
          <div className="inline-block px-3 py-1 rounded-sm bg-cyan-500/10 border border-cyan-500/20 mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-cyan-400">Em Breve</span>
          </div>

          <h1 className="text-5xl md:text-8xl font-bold tracking-tight leading-none text-balance">
            Domina o conhecimento com IA
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-xl mx-auto font-light">
            Cria cursos imersivos e ultra-personalizados em segundos.
          </p>
        </div>

        <div className="py-4 border-y border-white/5">
          <CountdownTimer />
        </div>

        <div className="flex flex-col items-center gap-8">
          <div className="w-full max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-0 group border border-white/10 focus-within:border-cyan-500/50 transition-colors">
              <Input
                type="email"
                placeholder="Introduz o teu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-14 md:h-16 rounded-none border-none bg-white/[0.02] px-6 text-lg focus-visible:ring-0 placeholder:text-white/20"
              />
              <Button
                type="submit"
                disabled={loading}
                className="h-14 md:h-16 rounded-none px-8 bg-cyan-500 hover:bg-cyan-400 text-black font-black transition-all"
              >
                {loading ? "..." : "Entrar na Lista"}
              </Button>
            </form>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2 overflow-hidden py-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="inline-block h-6 w-6 rounded-full border border-black bg-neutral-900 overflow-hidden grayscale opacity-70">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + waitingCount}`} alt="" />
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-white/40">
                <span className="text-white"><AnimatedCounter value={waitingCount} /></span> pioneiros à espera
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-8 z-10 w-full px-12 flex justify-between items-center opacity-20 text-[9px] font-bold uppercase tracking-widest leading-none">
        <p>Bookar &copy; 2026</p>
        <p>Built with IA</p>
      </footer>
    </div>
  );
}
