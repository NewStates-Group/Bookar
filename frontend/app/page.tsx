"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, Smartphone, PlayCircle } from "lucide-react";


export default function DefinitiveHomePage() {
  return (
    <AnimatePresence mode="wait">
      <div className="min-h-screen bg-white text-[#111] overflow-x-hidden pt-20">
        <nav className="fixed top-0 left-0 w-full z-[100] backdrop-blur-md bg-white/70 border-b border-black/[0.05]">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={36} height={36} />
              <span className="text-3xl font-bold tracking-tight">Bookar</span>
            </div>

            <div className="hidden md:flex items-center gap-10">
              <a href="#features" className="text-lg font-medium hover:text-cyan-600 transition-colors">Funcionalidades</a>
              <a href="#about" className="text-lg font-medium hover:text-cyan-600 transition-colors">Sobre</a>
              <a href="#pricing" className="text-lg font-medium hover:text-cyan-600 transition-colors">Preços</a>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/login" className="text-lg font-medium hover:text-cyan-600 transition-colors">Entrar</Link>
              <Link href="/signup">
                <Button className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-lg shadow-xl shadow-cyan-200 transition-all hover:-translate-y-1">
                  Cadastrar-se
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
              Aprende <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-blue-600 italic">Mais Rápido</span> <br /> utilizando IA.
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto text-balance font-light leading-relaxed">
              Transforme a forma como consomes conteúdo educacional. Acelere o seu aprendizado com IA.
            </p>

            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login">
                <Button className="h-14 px-10 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-lg shadow-xl shadow-cyan-200 transition-all hover:-translate-y-1">
                  Experimentar Agora
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
    </AnimatePresence>
  );
}
