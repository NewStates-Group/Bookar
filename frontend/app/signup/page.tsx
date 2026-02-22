"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
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

const ERROR_MESSAGES: Record<string, string> = {
  USERNAME_TOO_SHORT: "O nome de usuário deve ter pelo menos 3 caracteres",
  USERNAME_TAKEN: "Este nome de usuário já está em uso",
  EMAIL_TAKEN: "Este e-mail já está cadastrado",
  PASSWORD_TOO_SHORT: "A senha deve ter pelo menos 12 caracteres",
  INVALID_EMAIL: "O endereço de e-mail informado é inválido",
};

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validateForm = () => {
    const newErrors: Record<string, string[]> = {};
    if (!username.trim()) newErrors.username = ["O nome de usuário é obrigatório"];
    if (!email.trim()) {
      newErrors.email = ["O e-mail é obrigatório"];
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = ["O e-mail informado é inválido"];
    }
    if (!password.trim()) newErrors.password = ["A senha é obrigatória"];
    else if (password.length < 12) newErrors.password = ["A senha deve ter pelo menos 12 caracteres"];

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) return;

    setIsLoading(true);

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
              const message = ERROR_MESSAGES[err.msg] || err.msg;
              newErrors[field].push(message);
            });
          } else {
            // Fallback
            const message = ERROR_MESSAGES[data.detail] || data.detail || "Erro ao criar conta.";
            toast.error(message);
          }
          setErrors(newErrors);
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
        <div className="absolute inset-0 bg-gradient-to-bl from-cyan-500/20 to-black/40 z-10" />
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
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Seu nome de usuário"
                  className={`pl-10 h-12 bg-muted/30 border-muted-foreground/20 focus:border-cyan-500 transition-all ${errors.username ? "border-red-500 focus:border-red-500" : ""}`}
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
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className={`pl-10 h-12 bg-muted/30 border-muted-foreground/20 focus:border-cyan-500 transition-all ${errors.email ? "border-red-500 focus:border-red-500" : ""}`}
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Pelo menos 12 caracteres"
                  className={`pl-10 h-12 bg-muted/30 border-muted-foreground/20 focus:border-cyan-500 transition-all ${errors.password ? "border-red-500 focus:border-red-500" : ""}`}
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
              className="w-full h-12 text-base font-medium group bg-cyan-500 hover:bg-cyan-600 text-white"
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

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base font-medium bg-background hover:bg-muted/50 transition-colors flex items-center justify-center gap-3 border-muted-foreground/20"
            onClick={() => signIn("google", { callbackUrl: "/app" })}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuar com Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link href="/login" className="font-medium text-cyan-500 hover:text-cyan-600 hover:underline underline-offset-4">
              Entrar agora
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
