"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, useSpring, useTransform, animate } from "framer-motion";
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

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingCount, setWaitingCount] = useState(1240); // Initial placeholder count

  useEffect(() => {
    // Simulate some activity/growth
    const interval = setInterval(() => {
      setWaitingCount(prev => prev + Math.floor(Math.random() * 3));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/waitlist`, {
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

      <div className="z-10 text-center max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center items-center gap-3"
          >
            <Image
              src={"/logo.png"}
              alt="Logo"
              width={60}
              height={60}
              className="drop-shadow-2xl"
            />
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-balance bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
              Bookar
            </h1>
          </motion.div>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto text-balance font-light leading-relaxed">
            A melhor plataforma de aprendizado baseado em IA.
            Crie cursos personalizados em segundos.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="flex flex-col items-center gap-2">
            <div className="text-4xl md:text-5xl font-mono font-bold text-primary flex items-center gap-2">
              <AnimatedCounter value={waitingCount} />
              <div className="flex -space-x-3 overflow-hidden p-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-muted overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + waitingCount}`} alt="" />
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Pessoas na lista de espera</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col sm:flex-row gap-2">
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
              {loading ? "Entrando..." : "Entrar na Lista"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground opacity-50">
            Faremos o anúncio assim que a plataforma for totalmente liberada.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link href="/signup">
            <Button size="lg" variant={"outline"} className="rounded-full px-8 text-lg h-12 hover:bg-muted/50 transition-colors">
              Explorar demonstração
            </Button>
          </Link>
        </div>
      </div>

      <footer className="absolute bottom-6 z-10 text-muted-foreground text-sm font-medium opacity-60">
        <p>&copy; Bookar 2026</p>
      </footer>
    </div>
  );
}
