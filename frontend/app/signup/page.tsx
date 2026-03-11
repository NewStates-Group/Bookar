"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { User, Mail, Lock, Loader2, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "verification" | "details">("email");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validateEmail = () => {
    const newErrors: Record<string, string[]> = {};
    if (!email.trim()) {
      newErrors.email = ["O e-mail é obrigatório"];
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = ["O e-mail informado é inválido"];
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateEmail()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.exists) {
        // Send verification code
        await handleSendVerification();
      } else {
        setErrors({ email: ["Este e-mail já está em uso."] });
      }
    } catch (error) {
      toast.error("Erro ao verificar e-mail.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendVerification = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/send-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        toast.info("Código de verificação enviado!");
        setStep("verification");
      } else {
        toast.error("Erro ao enviar código de verificação.");
      }
    } catch (error) {
      toast.error("Erro ao conectar com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      setStep("details");
    } else {
      toast.error("O código deve ter 6 dígitos.");
    }
  };

  const validateDetails = () => {
    const newErrors: Record<string, string[]> = {};
    if (!firstName.trim()) newErrors.first_name = ["O primeiro nome é obrigatório"];
    if (!lastName.trim()) newErrors.last_name = ["O último nome é obrigatório"];
    if (!password.trim()) newErrors.password = ["A senha é obrigatória"];
    else if (password.length < 12) newErrors.password = ["A senha deve ter pelo menos 12 caracteres"];

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateDetails()) return;

    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          code
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.errors) {
          const newErrors: ValidationErrors = {};
          if (Array.isArray(data.errors)) {
            data.errors.forEach((err: any) => {
              const field = err.loc[err.loc.length - 1];
              if (!newErrors[field]) newErrors[field] = [];
              const message = ERROR_MESSAGES[err.msg] || err.msg;
              newErrors[field].push(message);
            });
          } else {
            const message = ERROR_MESSAGES[data.detail] || data.detail || "Erro ao criar conta.";
            toast.error(message);
          }
          setErrors(newErrors);
        } else if (res.status === 400) {
          toast.error(data.detail || "Código de verificação inválido.");
          setStep("verification");
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
              {step === "email" && "Preencha o seu e-mail para começar."}
              {step === "verification" && "Você realmente é humano? Então insira o código enviado para o seu e-mail."}
              {step === "details" && "Agora, complete os seus dados pessoais."}
            </p>
          </div>

          <form onSubmit={step === "email" ? handleNextStep : step === "verification" ? handleVerifyCode : handleSubmit} className="space-y-6">
            {step === "email" && (
              <motion.div
                key="email-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
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
              </motion.div>
            )}

            {step === "verification" && (
              <motion.div
                key="verification-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-cyan-500"
                    onClick={() => setStep("email")}
                  >
                    Alterar e-mail
                  </Button>
                  <span className="text-xs text-muted-foreground truncate">{email}</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Código de Verificação</Label>
                  <div className="relative group">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
                    <Input
                      id="code"
                      placeholder="000000"
                      maxLength={6}
                      className="pl-10 h-12 bg-muted/30 border-muted-foreground/20 focus:border-cyan-500 transition-all text-center text-xl tracking-[0.5em] font-mono"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-cyan-500 hover:text-cyan-600"
                      onClick={handleSendVerification}
                      disabled={isLoading}
                    >
                      Reenviar código
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "details" && (
              <motion.div
                key="details-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground truncate">{email}</span>
                    <span className="text-[10px] text-green-500 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> E-mail verificado
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-cyan-500"
                    onClick={() => setStep("verification")}
                  >
                    Voltar
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Primeiro Nome</Label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
                      <Input
                        id="first_name"
                        placeholder="João"
                        className={`pl-10 h-12 bg-muted/30 border-muted-foreground/20 focus:border-cyan-500 transition-all ${errors.first_name ? "border-red-500 focus:border-red-500" : ""}`}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {errors.first_name && (
                      <p className="text-sm text-red-500 mt-1">{errors.first_name[0]}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Último Nome</Label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
                      <Input
                        id="last_name"
                        placeholder="Silva"
                        className={`pl-10 h-12 bg-muted/30 border-muted-foreground/20 focus:border-cyan-500 transition-all ${errors.last_name ? "border-red-500 focus:border-red-500" : ""}`}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                    {errors.last_name && (
                      <p className="text-sm text-red-500 mt-1">{errors.last_name[0]}</p>
                    )}
                  </div>
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
              </motion.div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium group bg-cyan-500 hover:bg-cyan-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {step === "email" ? "Verificando..." : step === "verification" ? "Aguarde..." : "Criando conta..."}
                </>
              ) : (
                <>
                  {step === "email" ? "Continuar" : step === "verification" ? "Verificar Código" : "Criar conta"}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          {step === "email" && (
            <>
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
                Já tem uma conta?{" "}
                <Link href="/login" className="font-medium text-cyan-500 hover:text-cyan-600 hover:underline underline-offset-4">
                  Entrar agora
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
