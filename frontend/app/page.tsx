"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, Smartphone, MessageSquare } from "lucide-react";
import { FeedbackForm } from "@/components/FeedbackForm";


export default function DefinitiveHomePage() {
  return (
    <AnimatePresence mode="wait">
      <div className="min-h-screen bg-white text-[#111] overflow-x-hidden">
        <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-5xl">
          <div className="flex items-center justify-between px-6 h-16 rounded-2xl bg-white/80 backdrop-blur-xl border border-black/[0.06] shadow-sm">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Bookar" width={32} height={32} className="shrink-0" />
              <span className="text-xl font-bold tracking-tight">Bookar</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">Funcionalidades</a>
              <a href="#about" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">Sobre</a>
              <a href="#pricing" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">Preços</a>
              <a href="#feedback" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">Feedback</a>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
              >
                Entrar
              </Link>
              <Link href="/signup">
                <Button className="h-9 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold px-5 shadow-sm transition-all hover:-translate-y-0.5">
                  Cadastrar-se
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-neutral-50 -z-10" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-cyan-200/20 blur-[140px] -z-10 rounded-full" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center text-center space-y-8"
          >
            <div className="flex items-center gap-5">
              <Image
                src="/logo.png"
                alt="Bookar"
                width={72}
                height={72}
                className="shrink-0 drop-shadow-sm"
                priority
              />
              <span className="text-7xl md:text-8xl font-black tracking-tight text-neutral-900">
                Bookar
              </span>
            </div>

            <div className="h-px w-64 bg-gradient-to-r from-transparent via-neutral-300 to-transparent overflow-hidden relative">
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
            </div>

            <p className="text-lg md:text-xl text-neutral-500 font-medium tracking-wide">
              Plataforma de aprendizado com IA
            </p>

            <div className="pt-4">
              <Link href="/signup">
                <Button className="h-14 px-10 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-lg shadow-xl transition-all hover:-translate-y-1 hover:shadow-neutral-900/20">
                  Começar Agora
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>

        <section id="about" className="py-24 px-6 bg-neutral-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">
              Sobre a Bookar
            </h2>

            <p className="text-lg text-muted-foreground leading-relaxed">
              A Bookar é uma plataforma educacional online que utiliza
              inteligência artificial para ajudar estudantes e profissionais
              a aprender de forma mais eficiente através de cursos,
              explicações personalizadas, materiais educativos e
              acompanhamento do progresso de aprendizagem.
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 px-6 max-w-7xl mx-auto space-y-20">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">O que nos torna diferentes</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Tecnologia de ponta ao serviço do teu crescimento profissional.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Tutor IA", desc: "Dúvidas resolvidas instantaneamente com contexto direto das tuas aulas.", icon: <Zap className="w-6 h-6" /> },
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

        {/* Feedback Section */}
        <section id="feedback" className="py-24 px-6 bg-neutral-50">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <div className="p-3 bg-cyan-100 w-fit rounded-2xl mx-auto text-cyan-600">
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
                  <Link href="https://bookar.study/policies/privacy" className="hover:text-black cursor-pointer">Privacidade</Link>
                  <Link href="https://bookar.study/policies/terms" className="hover:text-black cursor-pointer">Termos</Link>
                </ul>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-black/[0.05] flex justify-between items-center text-xs text-neutral-400 font-medium">
            <p>&copy; 2026 Bookar. Todos os direitos reservados.</p>
            <div className="flex gap-6">
              <span className="hover:text-black cursor-pointer">Twitter</span>
              <span className="hover:text-black cursor-pointer">LinkedIn</span>
              <span className="hover:text-black cursor-pointer">Instagram</span>
            </div>
          </div>
        </footer>
      </div>
    </AnimatePresence>
  );
}
