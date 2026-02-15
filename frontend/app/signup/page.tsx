"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { User, Mail, Lock, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ValidationErrors {
  [key: string]: string[];
}

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.errors) {
          // Handle structured validation errors
          const newErrors: ValidationErrors = {};
          if (Array.isArray(data.errors)) {
            data.errors.forEach((err: any) => {
              // err.loc is ["body", "username"] e.g.
              const field = err.loc[err.loc.length - 1];
              if (!newErrors[field]) newErrors[field] = [];
              newErrors[field].push(err.msg);
            });
          } else {
            // Fallback
            toast.error(data.detail || "Erro na validação");
          }
          setErrors(newErrors);
          if (Object.keys(newErrors).length > 0) {
            toast.error("Por favor corrija os erros no formulário.");
          }
        } else {
          toast.error(data.detail || "Erro ao criar conta.");
        }
        return;
      }

      toast.success("Conta criada com sucesso! Faça login.");
      router.push("/login");
    } catch (error) {
      toast.error("Erro ao conectar com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-row-reverse">
      {/* Right Side - Image/Branding */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex w-1/2 bg-black items-center justify-center relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/20 to-black/40 z-10" />
        <Image
          src="/signup.jpg"
          alt="Signup Background"
          fill
          className="object-cover opacity-50"
          priority
        />
        <div className="relative z-20 text-white p-12 max-w-lg text-right">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h1 className="text-5xl font-bold mb-6">Junte-se à Comunidade.</h1>
            <p className="text-xl text-gray-300">
              Crie sua conta e tenha acesso ilimitado a conteúdos exclusivos para impulsionar sua carreira.
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center lg:text-left">
            <Link href="/" className="lg:hidden inline-flex items-center gap-2 mb-8">
              <Image src="/logo.png" width={40} height={40} alt="Bookar Logo" />
              <span className="text-2xl font-bold">Bookar</span>
            </Link>
            <h2 className="text-3xl font-bold tracking-tight">Criar Conta</h2>
            <p className="text-muted-foreground mt-2">
              Preencha os dados abaixo para começar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Nome de usuário</Label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Seu nome de usuário"
                  className={`pl-10 h-12 bg-muted/30 border-muted-foreground/20 focus:border-primary transition-all ${errors.username ? "border-red-500 focus:border-red-500" : ""}`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                // Removing native validation to show custom errors nicely, or keep it as backup
                />
              </div>
              {errors.username && (
                <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-4 h-4" /> {errors.username[0]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Endereço eletrónico</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className={`pl-10 h-12 bg-muted/30 border-muted-foreground/20 focus:border-primary transition-all ${errors.email ? "border-red-500 focus:border-red-500" : ""}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-4 h-4" /> {errors.email[0]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Palavra-passe</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Pelo menos 12 caracteres"
                  className={`pl-10 h-12 bg-muted/30 border-muted-foreground/20 focus:border-primary transition-all ${errors.password ? "border-red-500 focus:border-red-500" : ""}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-4 h-4" /> {errors.password[0]}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium group"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  Criar conta
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Ou</span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline underline-offset-4">
              Entrar agora
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
