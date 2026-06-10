"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
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
              <Link href="/login">
                <Button variant="outline" className="h-9 rounded-full border-neutral-300 text-neutral-800 text-sm font-semibold px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-cyan-50 hover:border-cyan-300">
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
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-neutral-50 -z-10" />

          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#d4d4d4_0.5px,transparent_0.5px)] [background-size:32px_32px] opacity-30" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-200/15 blur-[160px] rounded-full animate-pulse-slow" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-200/15 blur-[160px] rounded-full animate-pulse-slower" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-cyan-100/20 blur-[160px] rounded-full" />
          </div>

          <div className="relative flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-5 mb-6"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Image
                  src="/logo.png"
                  alt="Bookar"
                  width={80}
                  height={80}
                  className="shrink-0"
                  priority
                />
              </motion.div>
              <motion.span
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                className="text-7xl md:text-8xl font-black tracking-tight"
              >
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-900">
                  Bookar
                </span>
              </motion.span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="h-px w-72 bg-gradient-to-r from-transparent via-cyan-300 to-transparent overflow-hidden relative"
            >
              <motion.div
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white to-transparent"
              />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-lg md:text-xl text-neutral-500 font-medium tracking-wide mt-6"
            >
              Plataforma de aprendizado com IA
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="pt-6"
            >
              <Link href="/signup">
                <Button className="h-14 px-10 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-lg shadow-xl transition-all hover:-translate-y-1 hover:shadow-neutral-900/20">
                  Começar Agora
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        <section id="about" className="py-32 px-6">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 md:gap-24 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-600 tracking-wide uppercase">
                Sobre Nós
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-balance leading-[1.1]">
                O futuro da educação<br />
                <span className="text-cyan-500">ao teu alcance</span>
              </h2>
              <div className="w-12 h-1 bg-cyan-300 rounded-full" />
              <p className="text-base md:text-lg text-neutral-500 leading-relaxed max-w-lg">
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
                  className="bg-neutral-50 rounded-2xl p-6 border border-neutral-100 space-y-1"
                >
                  <p className="text-3xl md:text-4xl font-black text-neutral-900">{stat.value}</p>
                  <p className="text-sm text-neutral-500 font-medium">{stat.label}</p>
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
                className="group relative bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-lg transition-all duration-300"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-cyan-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="p-3 bg-neutral-50 w-fit rounded-xl mb-5 text-cyan-500 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-neutral-900">{feature.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{feature.desc}</p>
                </div>
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
