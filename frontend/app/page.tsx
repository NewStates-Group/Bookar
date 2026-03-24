"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, ArrowRight, Zap, Shield, Smartphone, PlayCircle } from "lucide-react";

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

function CountdownTimer({ onComplete }: { onComplete: () => void }) {
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
        onComplete();
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
  }, [onComplete]);

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
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isTimerComplete, setIsTimerComplete] = useState(false);

  useEffect(() => {
    const subscribed = localStorage.getItem("bookar_waitlist_subscribed");
    if (subscribed === "true") {
      setIsSubscribed(true);
    }

    const fetchCount = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await fetch(`${apiUrl}/auth/waitlist/count`);
        if (response.ok) {
          const data = await response.json();
          setWaitingCount(data.count);
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/auth/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setEmail("");
        setWaitingCount(prev => prev + 1);
        setIsSubscribed(true);
        localStorage.setItem("bookar_waitlist_subscribed", "true");
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
    <AnimatePresence mode="wait">
      {!isTimerComplete ? (
        <motion.div
          key="waitlist"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.8 }}
          className="min-h-screen flex flex-col bg-white text-[#111] font-sans overflow-hidden"
        >
          <main className="flex-1 flex flex-col items-center justify-between p-4 md:p-6 text-center py-8 md:py-12">
            <header className="w-full flex justify-center items-center">
              <div className="flex items-center gap-2">
                <Image src="/logo.png" alt="Logo" width={32} height={32} />
                <span className="text-3xl font-bold tracking-tighter">Bookar</span>
              </div>
            </header>

            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-3xl mx-auto space-y-6 md:space-y-8">
              <div className="z-10 text-center space-y-2 md:space-y-3 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-cyan-400/10 blur-[60px] -z-10 rounded-full"></div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8 }}
                  className="flex justify-center flex-col items-center gap-2 md:gap-4"
                >
                  <h1 className="text-6xl md:text-7xl font-bold tracking-tighter text-balance bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                    Algo Incrível Está a Chegar
                  </h1>
                  <p className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto text-balance font-light">
                    Prepara-te para a melhor plataforma de aprendizado baseado em IA.
                  </p>
                </motion.div>
              </div>

              <div className="w-full max-w-xl space-y-4 md:space-y-6">
                <div className="py-2 border-y border-black/[0.05]">
                  <CountdownTimer onComplete={() => setIsTimerComplete(true)} />
                </div>

                <div className="flex flex-col items-center gap-4 md:gap-6 mt-2">
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

                  {!isSubscribed ? (
                    <form onSubmit={handleSubmit} className="w-full flex flex-col sm:flex-row gap-2 max-w-md">
                      <Input
                        type="email"
                        placeholder="teu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11 md:h-12 border-black/10 bg-neutral-50 rounded-xl px-4 text-base focus-visible:ring-black/5 focus-visible:border-black/20"
                      />
                      <Button
                        type="submit"
                        disabled={loading}
                        className="h-11 md:h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-bold px-8 rounded-xl shadow-sm transition-all"
                      >
                        {loading ? "..." : "Reservar Lugar"}
                      </Button>
                    </form>
                  ) : (
                    <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-4 md:p-6 max-w-md w-full">
                      <p className="text-cyan-700 font-semibold text-base md:text-lg">Já estás na lista de espera!</p>
                      <p className="text-cyan-600/70 text-xs md:text-sm mt-1">Avisaremos assim que abrirmos as portas.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-6 pt-2">
                  <Link
                    target='_blank'
                    href="https://vm.tiktok.com/ZS9RHKRCc2754-kii29"
                    className="hover:scale-110 transition-transform"
                  >
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.09-1.47-.88-.64-1.61-1.47-2.12-2.44v7.37c.02 1.43-.39 2.89-1.2 4.02-1.15 1.7-3.23 2.65-5.23 2.51-1.64-.09-3.24-.92-4.14-2.29-.98-1.42-1.15-3.32-.48-4.88.66-1.57 2.15-2.73 3.84-2.92 1.04-.15 2.13.04 3.06.57.02-.45-.01-4.78.01-6.11-.01-5.1-.01-5.11-.01-5.15z" />
                    </svg>
                  </Link>
                  <Link
                    target='_blank'
                    href="https://www.instagram.com/bookar_study"
                    className="hover:scale-110 transition-transform"
                  >
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                  </Link>
                  <Link
                    target='_blank'
                    href="https://www.facebook.com/profile.php?id=61578517742438"
                    className="hover:scale-110 transition-transform"
                  >
                    <div className="w-10 h-10 flex items-center justify-center border rounded-full">

                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                    </svg>
                    </div>
                  </Link>
                </div>
              </div>
            </div>

          </main>
          <footer className="dotted w-full text-sm text-gray-400 flex md:translate-y-[-10] justify-center items-center">
            Bookar &copy; 2026. Todos os direitos reservados
          </footer>
        </motion.div>
      ) : (
        <motion.div
          key="home"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <DefinitiveHomePage />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DefinitiveHomePage() {
  return (
    <div className="min-h-screen bg-white text-[#111] overflow-x-hidden pt-20">
      {/* Header / Navbar */}
      <nav className="fixed top-0 left-0 w-full z-[100] backdrop-blur-md bg-white/70 border-b border-black/[0.05]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={35} height={35} />
            <span className="text-xl font-bold tracking-tight">Bookar</span>
          </div>

          <div className="hidden md:flex items-center gap-10">
            <a href="#features" className="text-sm font-medium hover:text-cyan-600 transition-colors">Funcionalidades</a>
            <a href="#about" className="text-sm font-medium hover:text-cyan-600 transition-colors">Sobre</a>
            <a href="#pricing" className="text-sm font-medium hover:text-cyan-600 transition-colors">Preços</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-black/60 transition-colors">Entrar</Link>
            <Link href="/signup">
              <Button className="rounded-full bg-[#111] text-white hover:bg-black/90 px-8 transition-transform hover:scale-105">
                Começar Grátis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 px-6 flex flex-col items-center text-center max-w-5xl mx-auto overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-cyan-100/30 blur-[120px] -z-10 rounded-full opacity-50"></div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="space-y-6"
        >
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] text-balance">
            Aprende <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-blue-600 italic">Mais Rápido</span> <br /> com IA.
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance font-light leading-relaxed">
            A Bookar transforma a forma como consomes conteúdo educacional. Criamos cursos personalizados, tutorias 2.0 e certificações inteligentes para acelerar o teu futuro.
          </p>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button className="h-14 px-10 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-lg shadow-xl shadow-cyan-200 transition-all hover:-translate-y-1">
                Experimentar Agora
              </Button>
            </Link>
            <Link href="/app/courses">
              <Button variant="outline" className="h-14 px-10 rounded-2xl border-black/10 font-bold text-lg transition-all hover:bg-neutral-50">
                Ver Catálogo
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto space-y-20">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">O que nos torna diferentes</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Tecnologia de ponta ao serviço do teu crescimento profissional.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { title: "Tutor IA 24/7", desc: "Dúvidas resolvidas instantaneamente com contexto direto das tuas aulas.", icon: <Zap className="w-6 h-6" /> },
            { title: "Cursos Personalizados", desc: "Avança ao teu ritmo com percursos adaptativos baseados no teu progresso.", icon: <Smartphone className="w-6 h-6" /> },
            { title: "Certificados com IA", desc: "Certificados profissionais gerados dinamicamente com validação Gemini.", icon: <Sparkles className="w-6 h-6" /> }
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -10 }}
              className="bg-white p-10 rounded-[32px] border border-black/[0.05] shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <div className="p-3 bg-neutral-50 w-fit rounded-xl mb-6 text-cyan-600">{feature.icon}</div>
              <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Showcase Section */}
      <section className="py-24 bg-neutral-50 border-y border-black/[0.05]">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Vê a Bookar em <span className="text-cyan-500">Ação</span>.</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Uma plataforma fluida, rápida e inteligente. Desenvolvida para que não percas tempo com burocracias e te foques no que realmente importa: **Aprender.**
            </p>
            <ul className="space-y-4">
              {["Interface Limpa", "Dashboard Intuitivo", "Modo Escuro Integrado"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 font-medium text-neutral-700">
                  <div className="w-5 h-5 rounded-full bg-cyan-100 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-[40px] opacity-20 blur-2xl group-hover:opacity-30 transition-opacity"></div>
            <div className="relative aspect-video bg-neutral-900 rounded-[32px] border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center">
              <PlayCircle className="w-16 h-16 text-white/40 cursor-pointer hover:text-white hover:scale-110 transition-all" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-black/[0.05]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-4 max-w-xs">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={30} height={30} />
              <span className="text-xl font-bold tracking-tight">Bookar</span>
            </div>
            <p className="text-sm text-muted-foreground">O futuro da educação é agora. Aprende com a ajuda da inteligência artificial.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-16">
            <div className="space-y-4">
              <h4 className="font-bold">Plataforma</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="hover:text-black cursor-pointer">Cursos</li>
                <li className="hover:text-black cursor-pointer">AI Tutor</li>
                <li className="hover:text-black cursor-pointer">Certificados</li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold">Empresa</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="hover:text-black cursor-pointer">Sobre nós</li>
                <li className="hover:text-black cursor-pointer">Blog</li>
                <li className="hover:text-black cursor-pointer">Carreiras</li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold">Legal</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="hover:text-black cursor-pointer">Privacidade</li>
                <li className="hover:text-black cursor-pointer">Termos</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-black/[0.05] flex justify-between items-center text-xs text-neutral-400 font-medium">
          <p>© 2026 Bookar. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <span className="hover:text-black cursor-pointer">Twitter</span>
            <span className="hover:text-black cursor-pointer">LinkedIn</span>
            <span className="hover:text-black cursor-pointer">Instagram</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
