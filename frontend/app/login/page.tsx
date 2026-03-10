"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { User, Lock, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import Image from "next/image";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validateForm = () => {
    const newErrors: Record<string, string[]> = {};
    if (!username.trim()) newErrors.username = ["O nome de usuário é obrigatório"];
    if (!password.trim()) newErrors.password = ["A palavra-passe é obrigatória"];

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        const isCredentialError =
          result.error === "CredentialsSignin" ||
          result.error.toLowerCase().includes("credentials") ||
          result.error.toLowerCase().includes("active account");

        if (isCredentialError) {
          const message = result.error === "CredentialsSignin"
            ? "Nome de usuário ou senha incorretos"
            : "Credenciais inválidas ou conta não encontrada";

          setErrors({
            username: [message],
            password: [message]
          });
        } else {
          toast.error(result.error);
        }
      } else {
        toast.success("Login efetuado com sucesso!");
        router.push("/app/courses");
      }
    } catch (error) {
      toast.error("Ocorreu um erro ao tentar fazer login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Image/Branding */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex w-1/2 bg-black items-center justify-center relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-bl from-cyan-500/20 to-black/40 z-10" />
        <Image
          src="/login.jpg"
          alt="Login Background"
          fill
          className="object-cover opacity-50"
          priority
        />
        <div className="relative z-20 text-white p-12 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Image src="/logo-white.png" width={60} height={60} alt="Bookar Logo" className="mb-8" />
            <h1 className="text-5xl font-bold mb-6">Bem-vindo de volta.</h1>
            <p className="text-xl text-gray-300">
              Continue sua jornada de aprendizado. Sua próxima conquista está a apenas um login de distância.
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center lg:text-left">
            <Link href="/" className="lg:hidden inline-flex items-center gap-2 mb-8">
              <Image src="/logo.png" width={40} height={40} alt="Bookar Logo" />
              <span className="text-2xl font-bold">Bookar</span>
            </Link>
            <h2 className="text-3xl font-bold tracking-tight">Login</h2>
            <p className="text-muted-foreground mt-2">
              Entre com seus dados para acessar sua conta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className={errors.username ? "text-red-500" : ""}>Nome de usuário</Label>
              <div className="relative group">
                <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${errors.username ? "text-red-500" : "text-muted-foreground group-focus-within:text-cyan-500"}`} />
                <Input
                  id="username"
                  type="text"
                  placeholder="Seu nome de usuário"
                  className={`pl-10 h-12 bg-muted/30 transition-all ${errors.username ? "border-red-500 focus:border-red-500" : "border-muted-foreground/20 focus:border-cyan-500"}`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              {errors.username?.map((err, i) => (
                <p key={i} className="text-sm text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-4 h-4" /> {err}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className={errors.password ? "text-red-500" : ""}>Palavra-passe</Label>
                <Link
                  href="/forgot-password"
                  className={`text-sm transition-colors ${errors.password ? "text-red-500/70 hover:text-red-500" : "text-cyan-500 hover:text-cyan-600"}`}
                >
                  Esqueceu?
                </Link>
              </div>
              <div className="relative group">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${errors.password ? "text-red-500" : "text-muted-foreground group-focus-within:text-cyan-500"}`} />
                <Input
                  id="password"
                  type="password"
                  placeholder="Sua palavra-passe"
                  className={`pl-10 h-12 bg-muted/30 transition-all ${errors.password ? "border-red-500 focus:border-red-500" : "border-muted-foreground/20 focus:border-cyan-500"}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {errors.password?.map((err, i) => (
                <p key={i} className="text-sm text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-4 h-4" /> {err}
                </p>
              ))}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium group bg-cyan-500 hover:bg-cyan-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
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
            onClick={() => window.location.href = "/auth/login/google"}
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
            Ainda não tem uma conta?{" "}
            <Link href="/signup" className="font-medium text-cyan-500 hover:text-cyan-600 hover:underline underline-offset-4">
              Criar conta agora
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
