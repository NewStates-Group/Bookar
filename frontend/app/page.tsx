"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { MessageSquare, Sun, Moon, Menu, X, Bot, Brain, BookOpen, GraduationCap, Sparkles, Globe, Lightbulb, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { FeedbackForm } from "@/components/FeedbackForm";

const screens = [
  { src: "/screens/s1.png", label: "Cursos com IA", desc: "Gera cursos completos sobre qualquer tema" },
  { src: "/screens/s2.png", label: "Mapas Mentais", desc: "Visualiza conexões entre conceitos" },
  { src: "/screens/s3.png", label: "Explicador IA", desc: "Tutor virtual por voz em tempo real" },
  { src: "/screens/s4.png", label: "Progresso", desc: "Acompanha o teu desempenho" },
];

export default function DefinitiveHomePage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const [activeIdx, setActiveIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % screens.length), 4500);
    return () => clearInterval(t);
  }, []);

  const scrollToNext = useCallback(() => {
    const sections = document.querySelectorAll("section[id]");
    const scrollPos = window.scrollY + 100;
    for (const s of sections) {
      if (s instanceof HTMLElement && s.offsetTop > scrollPos) {
        s.scrollIntoView({ behavior: "smooth" });
        break;
      }
    }
  }, []);

  return (
    <AnimatePresence mode="wait">
      <style>{`
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #22d3ee; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #06b6d4; }
      `}</style>
      <div className={`min-h-screen overflow-x-hidden scroll-smooth ${dark ? "dark" : ""}`}>
        <motion.div
          className="fixed top-0 left-0 right-0 z-[110] h-[3px] bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-300 origin-left"
          style={{ scaleX: scaleY }}
        />
        <div className="bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
          <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-5xl">
            <div className="flex items-center justify-between px-6 h-16 rounded-2xl bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-sm dark:shadow-neutral-900/50">
              <Link href="/" className="flex items-center gap-2.5">
                <Image src={dark ? "/logo-white.png" : "/logo.png"} alt="Bookar" width={32} height={32} className="shrink-0" />
                <span className="text-xl font-bold tracking-tight">Bookar</span>
              </Link>

              <div className="hidden md:flex items-center gap-8">
                <a href="#home" className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Início</a>
                <a href="#about" className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Sobre Nós</a>
                <a href="#features" className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Funcionalidades</a>
                <a href="#feedback" className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Feedback</a>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTheme(dark ? "light" : "dark")}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Alternar tema"
                >
                  {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <div className="hidden md:flex items-center gap-3">
                  <Link href="/login">
                    <Button variant="outline" className="h-9 rounded-full border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-sm font-semibold px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-cyan-50 dark:hover:bg-cyan-950 hover:border-cyan-300">
                      Entrar
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button className="h-9 rounded-full bg-cyan-300 hover:bg-cyan-400 text-black dark:text-white text-sm font-semibold px-5 shadow-sm transition-all hover:-translate-y-0.5">
                      Cadastrar-se
                    </Button>
                  </Link>
                </div>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Menu"
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="md:hidden mt-2 p-4 rounded-2xl bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-lg"
                >
                  <div className="flex flex-col gap-1">
                    {[
                      { href: "#home", label: "Início" },
                      { href: "#about", label: "Sobre Nós" },
                      { href: "#features", label: "Funcionalidades" },
                      { href: "#feedback", label: "Feedback" },
                    ].map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className="px-4 py-3 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        {link.label}
                      </a>
                    ))}
                    <hr className="my-2 border-neutral-200 dark:border-neutral-800" />
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="px-4 py-3 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Entrar
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setMenuOpen(false)}
                      className="mt-1 px-4 py-3 rounded-xl text-sm font-semibold text-center bg-cyan-300 text-black dark:text-white hover:bg-cyan-400 transition-colors"
                    >
                      Cadastrar-se
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>

          {/* Hero Section */}
          <section id="home" className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 md:pt-0 overflow-hidden">
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
                <div className="flex items-center gap-4 mb-6">
                  <Image src={dark ? "/logo-white.png" : "/logo.png"} alt="Bookar" width={48} height={48} className="shrink-0 md:w-[56px] md:h-[56px]" priority />
                  <span className="text-4xl md:text-6xl font-black tracking-tight">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-900 dark:from-white dark:via-neutral-300 dark:to-white">
                      Bookar
                    </span>
                  </span>
                </div>

                <h2 className="text-3xl md:text-5xl font-bold text-cyan-500 mb-4 leading-tight">
                  Aprende mais rápido com IA
                </h2>

                <p className="text-base md:text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-lg mb-8">
                  O Bookar é o teu parceiro de aprendizagem inteligente. Cria mapas mentais dinâmicos, gera cursos personalizados com IA e tira todas as tuas dúvidas em tempo real.
                </p>

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

              {/* Card Spread */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center"
              >
                <div className="relative h-[380px] md:h-[460px] w-full max-w-[360px] mx-auto">
                  {screens.map((s, i) => {
                    const diff = (i - activeIdx + screens.length) % screens.length;
                    let pos: number | null;
                    if (diff === 0) pos = 0;
                    else if (diff === 1 || diff === -(screens.length - 1)) pos = 1;
                    else if (diff === screens.length - 1 || diff === -1) pos = -1;
                    else pos = null;

                    const isLeft = pos === -1;
                    const isRight = pos === 1;

                    return (
                      <motion.div
                        key={i}
                        animate={{
                          x: pos === null ? 0 : pos * (isLeft ? -60 : isRight ? 60 : 0),
                          scale: pos === 0 ? 1 : pos === null ? 0 : 0.82,
                          rotate: isLeft ? -10 : isRight ? 10 : 0,
                          zIndex: pos === 0 ? 10 : pos === null ? 0 : 5,
                          opacity: pos === null ? 0 : 1,
                        }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ pointerEvents: pos === 0 ? "auto" : "none" }}
                      >
                        <div className={`relative w-[200px] md:w-[230px] aspect-[9/19] rounded-[28px] overflow-hidden shadow-2xl dark:shadow-neutral-900/60 ${isLeft || isRight ? "shadow-lg" : ""}`}>
                          <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800">
                            <Image
                              src={s.src}
                              alt={s.label}
                              fill
                              className="object-contain"
                              sizes="230px"
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="mt-4 text-center space-y-1">
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

            <motion.button
              onClick={scrollToNext}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.6 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-neutral-400 hover:text-cyan-500 transition-colors cursor-pointer"
            >
              <span className="text-xs font-medium tracking-wider uppercase">Scroll</span>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </motion.button>
          </section>

          <motion.section
            id="about"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.7 }}
            className="min-h-screen flex items-center px-6 bg-fixed bg-gradient-to-b from-white via-white to-cyan-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 md:gap-24 items-center">
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-600 dark:text-neutral-400 tracking-wide uppercase"
                >
                  Sobre Nós
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="text-4xl md:text-5xl font-bold tracking-tight text-balance leading-[1.1]"
                >
                  O futuro da educação<br />
                  <span className="text-cyan-500">ao teu alcance</span>
                </motion.h2>
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  whileInView={{ opacity: 1, width: 48 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                  className="h-1 bg-cyan-300 rounded-full"
                />
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="text-base md:text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-lg"
                >
                  A Bookar combina inteligência artificial com educação para criar
                  uma experiência de aprendizagem personalizada, eficiente e
                  acessível para todos.
                </motion.p>
              </motion.div>
              <div className="relative h-[320px] md:h-[400px] w-full flex items-center justify-center">
                {/* Orbital rings + electrons */}
                <style>{`
                  @keyframes orbit-cw  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                  @keyframes orbit-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
                  @keyframes counter-cw  { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
                  @keyframes counter-ccw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>

                {/* Ring 1 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  whileInView={{ opacity: 1, scale: 1, transition: { duration: 0.6 } }}
                  viewport={{ once: true }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute w-40 h-40 md:w-56 md:h-56"
                >
                  <div className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-cyan-200 dark:border-cyan-800" />
                  <div className="absolute inset-0" style={{ animation: "orbit-cw 6s linear infinite" }}>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-lg dark:shadow-neutral-900/50 flex items-center justify-center" style={{ animation: "counter-cw 6s linear infinite" }}>
                      <Lightbulb className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
                    </div>
                  </div>
                  <div className="absolute inset-0" style={{ animation: "orbit-ccw 6s linear infinite", animationDelay: "3s" }}>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-lg dark:shadow-neutral-900/50 flex items-center justify-center" style={{ animation: "counter-ccw 6s linear infinite", animationDelay: "3s" }}>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
                    </div>
                  </div>
                </motion.div>

                {/* Ring 2 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  whileInView={{ opacity: 1, scale: 1, transition: { duration: 0.6, delay: 0.15 } }}
                  viewport={{ once: true }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute w-56 h-56 md:w-72 md:h-72"
                >
                  <div className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-sky-200 dark:border-sky-800" />
                  <div className="absolute inset-0" style={{ animation: "orbit-ccw 10s linear infinite" }}>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-lg dark:shadow-neutral-900/50 flex items-center justify-center" style={{ animation: "counter-ccw 10s linear infinite" }}>
                      <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                    </div>
                  </div>
                  <div className="absolute inset-0" style={{ animation: "orbit-ccw 10s linear infinite", animationDelay: "-3.3s" }}>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-lg dark:shadow-neutral-900/50 flex items-center justify-center" style={{ animation: "counter-ccw 10s linear infinite", animationDelay: "-3.3s" }}>
                      <Brain className="w-4 h-4 md:w-5 md:h-5 text-sky-500" />
                    </div>
                  </div>
                  <div className="absolute inset-0" style={{ animation: "orbit-ccw 10s linear infinite", animationDelay: "-6.6s" }}>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-lg dark:shadow-neutral-900/50 flex items-center justify-center" style={{ animation: "counter-ccw 10s linear infinite", animationDelay: "-6.6s" }}>
                      <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-teal-400" />
                    </div>
                  </div>
                </motion.div>

                {/* Ring 3 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  whileInView={{ opacity: 1, scale: 1, transition: { duration: 0.6, delay: 0.3 } }}
                  viewport={{ once: true }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute w-72 h-72 md:w-96 md:h-96"
                >
                  <div className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-cyan-300/40 dark:border-cyan-700/40" />
                  <div className="absolute inset-0" style={{ animation: "orbit-cw 16s linear infinite" }}>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-lg dark:shadow-neutral-900/50 flex items-center justify-center" style={{ animation: "counter-cw 16s linear infinite" }}>
                      <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />
                    </div>
                  </div>
                  <div className="absolute inset-0" style={{ animation: "orbit-cw 16s linear infinite", animationDelay: "-5.3s" }}>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-lg dark:shadow-neutral-900/50 flex items-center justify-center" style={{ animation: "counter-cw 16s linear infinite", animationDelay: "-5.3s" }}>
                      <Globe className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                    </div>
                  </div>
                  <div className="absolute inset-0" style={{ animation: "orbit-cw 16s linear infinite", animationDelay: "-10.6s" }}>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-lg dark:shadow-neutral-900/50 flex items-center justify-center" style={{ animation: "counter-cw 16s linear infinite", animationDelay: "-10.6s" }}>
                      <Bot className="w-4 h-4 md:w-5 md:h-5 text-cyan-500" />
                    </div>
                  </div>
                </motion.div>

                {/* Nucleus */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, type: "spring" }}
                  className="relative z-10 w-14 h-14 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-cyan-300 to-sky-400 shadow-lg shadow-cyan-300/30 flex items-center justify-center"
                >
                  <div className="absolute inset-1 rounded-full bg-white/20 blur-sm" />
                  <BookOpen className="w-6 h-6 md:w-9 md:h-9 text-white" />
                </motion.div>
              </div>
            </div>
          </motion.section>

          {/* Features Grid */}
          <motion.section
            id="features"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.7 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 bg-fixed bg-gradient-to-b from-cyan-50/50 via-white to-white dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-950">
            <div className="max-w-7xl mx-auto w-full space-y-20">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="text-center space-y-4"
            >
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">O que nos torna diferentes</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">Tecnologia de ponta ao serviço do teu crescimento profissional.</p>
            </motion.div>

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
            </div>
          </motion.section>

          {/* Feedback Section */}
          <motion.section
            id="feedback"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.7 }}
            className="min-h-screen flex items-center justify-center px-6 bg-fixed bg-neutral-50 dark:bg-neutral-900/50">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl mx-auto text-center space-y-8"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="p-3 bg-cyan-100 dark:bg-cyan-950 w-fit rounded-2xl mx-auto text-cyan-600 dark:text-cyan-400"
              >
                <MessageSquare className="w-6 h-6" />
              </motion.div>
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Dá o teu Feedback</h2>
                <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                  A tua opinião ajuda-nos a melhorar. Partilha connosco a tua experiência.
                </p>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                <FeedbackForm />
              </motion.div>
            </motion.div>
          </motion.section>

          {/* Footer */}
          <motion.footer
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="py-16 px-6 border-t border-black/[0.05] dark:border-white/[0.08]"
          >
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
          </motion.footer>
        </div>
      </div>
    </AnimatePresence>
  );
}
