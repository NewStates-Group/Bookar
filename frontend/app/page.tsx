"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Sun, Moon } from "lucide-react";
import { FeedbackForm } from "@/components/FeedbackForm";

const screens = [
  { src: "/screens/s1.png", label: "Cursos com IA", desc: "Gera cursos completos sobre qualquer tema" },
  { src: "/screens/s2.png", label: "Mapas Mentais", desc: "Visualiza conexões entre conceitos" },
  { src: "/screens/s3.png", label: "Explicador IA", desc: "Tutor virtual por voz em tempo real" },
  { src: "/screens/s4.png", label: "Progresso", desc: "Acompanha o teu desempenho" },
];

export default function DefinitiveHomePage() {
  const [dark, setDark] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % screens.length), 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <div className={`min-h-screen overflow-x-hidden ${dark ? "dark" : ""}`}>
        <div className="bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
          <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-5xl">
            <div className="flex items-center justify-between px-6 h-16 rounded-2xl bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-sm dark:shadow-neutral-900/50">
              <Link href="/" className="flex items-center gap-2.5">
                <Image src={dark ? "/logo-white.png" : "/logo.png"} alt="Bookar" width={32} height={32} className="shrink-0" />
                <span className="text-xl font-bold tracking-tight">Bookar</span>
              </Link>

              <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Funcionalidades</a>
                <a href="#about" className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Sobre</a>
                <a href="#pricing" className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Preços</a>
                <a href="#feedback" className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Feedback</a>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDark(!dark)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Alternar tema"
                >
                  {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <Link href="/login">
                  <Button variant="outline" className="h-9 rounded-full border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-sm font-semibold px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-cyan-50 dark:hover:bg-cyan-950 hover:border-cyan-300">
                    Entrar
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="h-9 rounded-full bg-cyan-300 hover:bg-cyan-400 text-black text-sm font-semibold px-5 shadow-sm transition-all hover:-translate-y-0.5">
                    Cadastrar-se
                  </Button>
                </Link>
              </div>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-neutral-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 -z-10" />

            <div className="absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#d4d4d4_0.5px,transparent_0.5px)] dark:bg-[radial-gradient(#333_0.5px,transparent_0.5px)] [background-size:32px_32px] opacity-30" />
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-200/15 dark:bg-cyan-500/10 blur-[160px] rounded-full animate-pulse-slow" />
              <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-200/15 dark:bg-blue-500/10 blur-[160px] rounded-full animate-pulse-slower" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-cyan-100/20 dark:bg-cyan-500/10 blur-[160px] rounded-full" />
            </div>

            <div className="relative w-full max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center md:items-start text-center md:text-left"
              >
                <div className="flex items-center gap-5 mb-5">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="p-3 rounded-2xl bg-neutral-900 dark:bg-neutral-100"
                  >
                    <Image src="/logo-white.png" alt="Bookar" width={44} height={44} className="shrink-0 md:w-[52px] md:h-[52px]" priority />
                  </motion.div>
                  <motion.span
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                    className="text-5xl md:text-7xl font-black tracking-tight"
                  >
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-900 dark:from-white dark:via-neutral-300 dark:to-white">
                      Bookar
                    </span>
                  </motion.span>
                </div>

                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="h-px w-48 md:w-64 bg-gradient-to-r from-transparent via-cyan-300 to-transparent overflow-hidden relative mb-5"
                >
                  <motion.div
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white dark:via-cyan-200 to-transparent"
                  />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="text-base md:text-lg text-neutral-500 dark:text-neutral-400 font-medium tracking-wide mb-8"
                >
                  Plataforma de aprendizado com IA
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link href="/signup">
                    <Button className="h-12 md:h-14 px-8 md:px-10 rounded-2xl bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black font-bold text-base md:text-lg shadow-xl transition-all hover:-translate-y-1 hover:shadow-neutral-900/20 dark:hover:shadow-white/10">
                      Começar Agora
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>

              {/* Phone Mockup */}
              <motion.div
                initial={{ opacity: 0, x: 30, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="relative w-[240px] md:w-[280px]"
                >
                  {/* Phone Frame */}
                  <div className="relative aspect-[9/19] rounded-[36px] bg-neutral-200 dark:bg-neutral-800 p-2 shadow-2xl dark:shadow-neutral-900/50">
                    <div className="relative w-full h-full rounded-[28px] overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeIdx}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.05 }}
                          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute inset-0"
                        >
                          <Image
                            src={screens[activeIdx].src}
                            alt={screens[activeIdx].label}
                            fill
                            className="object-cover"
                            sizes="240px"
                          />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    {/* Notch */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-neutral-900 dark:bg-neutral-950 rounded-b-xl" />
                  </div>
                </motion.div>

                <div className="mt-6 text-center space-y-1">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={activeIdx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.35 }}
                      className="text-lg font-bold text-neutral-900 dark:text-neutral-100"
                    >
                      {screens[activeIdx].label}
                    </motion.p>
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`desc-${activeIdx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className="text-sm text-neutral-500 dark:text-neutral-400"
                    >
                      {screens[activeIdx].desc}
                    </motion.p>
                  </AnimatePresence>

                  <div className="flex justify-center gap-2 pt-3">
                    {screens.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveIdx(i)}
                        className={`rounded-full transition-all duration-300 ${
                          i === activeIdx ? "w-6 h-2 bg-cyan-300" : "w-2 h-2 bg-neutral-300 dark:bg-neutral-700"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          <section id="about" className="py-32 px-6">
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 md:gap-24 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-600 dark:text-neutral-400 tracking-wide uppercase">
                  Sobre Nós
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-balance leading-[1.1]">
                  O futuro da educação<br />
                  <span className="text-cyan-500">ao teu alcance</span>
                </h2>
                <div className="w-12 h-1 bg-cyan-300 rounded-full" />
                <p className="text-base md:text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-lg">
                  A Bookar combina inteligência artificial com educação para criar
                  uma experiência de aprendizagem personalizada, eficiente e
                  acessível para todos.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "3+", label: "Áreas de Ensino" },
                  { value: "100+", label: "Aulas Geradas" },
                  { value: "IA", label: "Modelos Próprios" },
                  { value: "24/7", label: "Disponível" },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="bg-neutral-50 dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-100 dark:border-neutral-800 space-y-1"
                  >
                    <p className="text-3xl md:text-4xl font-black text-neutral-900 dark:text-neutral-100">{stat.value}</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Features Grid */}
          <section id="features" className="py-24 px-6 max-w-7xl mx-auto space-y-20">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">O que nos torna diferentes</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">Tecnologia de ponta ao serviço do teu crescimento profissional.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: "Cursos com IA",
                  desc: "Gera cursos completos com inteligência artificial sobre qualquer tema. Conteúdo estruturado em módulos com vídeo, áudio e materiais de apoio.",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                    </svg>
                  ),
                },
                {
                  title: "Mapas Mentais",
                  desc: "Transforma qualquer conteúdo em mapas mentais interativos. Visualiza conexões entre conceitos e acelera a tua compreensão.",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                  ),
                },
                {
                  title: "Explicador IA",
                  desc: "Tutor virtual por voz que responde às tuas dúvidas em tempo real. Explicações claras e contextuais baseadas no teu progresso.",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  ),
                },
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.15, duration: 0.5 }}
                  whileHover={{ y: -8 }}
                  className="group relative bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-lg transition-all duration-300"
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-cyan-50/50 dark:from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative z-10">
                    <div className="p-3 bg-neutral-50 dark:bg-neutral-800 w-fit rounded-xl mb-5 text-cyan-500 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-950 group-hover:text-cyan-600 transition-colors duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-neutral-900 dark:text-neutral-100">{feature.title}</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Feedback Section */}
          <section id="feedback" className="py-24 px-6 bg-neutral-50 dark:bg-neutral-900/50">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <div className="space-y-4">
                <div className="p-3 bg-cyan-100 dark:bg-cyan-950 w-fit rounded-2xl mx-auto text-cyan-600 dark:text-cyan-400">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Dá o teu Feedback</h2>
                <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                  A tua opinião ajuda-nos a melhorar. Partilha connosco a tua experiência.
                </p>
              </div>
              <FeedbackForm />
            </div>
          </section>

          {/* Footer */}
          <footer className="py-16 px-6 border-t border-black/[0.05] dark:border-white/[0.08]">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
              <div className="space-y-4 max-w-xs">
                <div className="flex items-center gap-2">
                  <Image src={dark ? "/logo-white.png" : "/logo.png"} alt="Logo" width={28} height={28} />
                  <span className="text-lg font-bold tracking-tight">Bookar</span>
                </div>
                <p className="text-sm text-neutral-400">O futuro da educação é agora.</p>
              </div>

              <div className="flex items-start gap-16">
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Legal</h4>
                  <ul className="text-sm text-neutral-500 dark:text-neutral-400 space-y-2.5">
                    <li>
                      <Link href="https://bookar.study/policies/privacy" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Privacidade</Link>
                    </li>
                    <li>
                      <Link href="https://bookar.study/policies/terms" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Termos</Link>
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Redes</h4>
                  <ul className="text-sm text-neutral-500 dark:text-neutral-400 space-y-2.5">
                    <li className="hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer transition-colors">Instagram</li>
                    <li className="hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer transition-colors">Facebook</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="max-w-5xl mx-auto mt-12 pt-6 border-t border-black/[0.05] dark:border-white/[0.08] flex justify-between items-center text-xs text-neutral-400">
              <p>&copy; {new Date().getFullYear()} Bookar. Todos os direitos reservados.</p>
            </div>
          </footer>
        </div>
      </div>
    </AnimatePresence>
  );
}
