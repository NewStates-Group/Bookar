"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";
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
    // Target date: 2 weeks from now (relative to a fixed reference for better UX)
    // For demo/launch purposes, we fix it to a specific date if possible, 
    // but here we follow "2 weeks from now" as requested.
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
    <div className="flex flex-col items-center">
      <div className="text-4xl md:text-6xl font-bold tracking-tighter tabular-nums text-primary">
        {value.toString().padStart(2, '0')}
      </div>
      <div className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">
        {label}
      </div>
    </div>
  );

  return (
    <div className="flex gap-4 md:gap-8 justify-center py-6">
      <TimeUnit value={timeLeft.days} label="Dias" />
      <div className="text-4xl md:text-6xl font-light text-muted-foreground/30 self-start mt-1">:</div>
      <TimeUnit value={timeLeft.hours} label="Horas" />
      <div className="text-4xl md:text-6xl font-light text-muted-foreground/30 self-start mt-1">:</div>
      <TimeUnit value={timeLeft.minutes} label="Min" />
      <div className="text-4xl md:text-6xl font-light text-muted-foreground/30 self-start mt-1">:</div>
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
          // We add a base social proof offset but make it feel dynamic
          setWaitingCount(data.count + 1200);
        }
      } catch (error) {
        console.error("Failed to fetch count", error);
        setWaitingCount(1243); // Fallback
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
        toast.success("Inscrito na lista de espera com sucesso! Avisaremos em breve.");
        setEmail("");
        setWaitingCount(prev => prev + 1);
      } else {
        const data = await response.json();
        toast.error(data.message || "Erro ao se inscrever. Tente novamente.");
      }
    } catch (error) {
      toast.error("Ocorreu um erro. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 text-primary/5 select-none pointer-events-none flex items-center justify-center opacity-[0.03]">
        <span className="text-[20vw] font-black uppercase tracking-tighter">Bookar</span>
      </div>

      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="absolute top-6 right-6 z-20 flex gap-4">
        <Link href="/login">
          <Button variant="ghost" size="sm" className="hover:bg-primary/10">
            Entrar
          </Button>
        </Link>
        <div className="w-[1px] h-8 bg-border"></div>
        <Link href="/signup">
          <Button size="sm" variant={"outline"} className="border-primary/20 hover:border-primary/50">Registar-se</Button>
        </Link>
      </div>

      <div className="z-10 text-center max-w-4xl w-full space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center items-center gap-3 mb-2"
          >
            <Image
              src={"/logo.png"}
              alt="Logo"
              width={50}
              height={50}
              className="drop-shadow-2xl"
            />
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-balance bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
              Bookar
            </h1>
          </motion.div>

          <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-balance">
            O futuro do aprendizado chega em:
          </h2>

          <CountdownTimer />
        </div>

        <div className="flex flex-col items-center gap-8 py-4">
          <div className="w-full max-w-md space-y-4">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="teu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-full border-primary/20 bg-background/50 backdrop-blur-sm px-6 text-lg focus-visible:ring-primary/50"
              />
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="rounded-full px-8 text-lg h-12 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 whitespace-nowrap"
              >
                {loading ? "Entrando..." : "Garantir Acesso"}
              </Button>
            </form>

            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-muted-foreground/60">
                <div className="flex -space-x-2 overflow-hidden py-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-muted overflow-hidden opacity-80">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + waitingCount}`} alt="" />
                    </div>
                  ))}
                </div>
                <p className="text-xs font-medium">
                  <AnimatedCounter value={waitingCount} /> pessoas já estão na lista
                </p>
              </div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground opacity-40">
                Acesso gratuito para os primeiros inscritos
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Link href="/signup">
            <Button size="sm" variant={"ghost"} className="text-muted-foreground hover:text-foreground transition-colors group">
              Ainda queres explorar? <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
            </Button>
          </Link>
        </div>
      </div>

      <footer className="absolute bottom-6 z-10 text-muted-foreground text-[10px] uppercase tracking-widest font-medium opacity-40">
        <p>&copy; Bookar 2026 • Made with IA</p>
      </footer>
    </div>
  );
}
