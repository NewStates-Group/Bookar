"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { User, Lock, Loader2, ArrowRight, AlertCircle, ChevronLeft, MailCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import Image from "next/image";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password" | "reset-success">("email");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
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

      if (data.exists) {
        setStep("password");
      } else {
        setErrors({ email: ["Este e-mail não está cadastrado."] });
      }
    } catch (error) {
      toast.error("Erro ao verificar e-mail.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!password.trim()) {
      setErrors({ password: ["A palavra-passe é obrigatória"] });
      return;
    }

    setIsLoading(true);
    try {
      // if (typeof window !== "undefined") console.log("[Login] Attempting credentials login for:", email);
      const result = await signIn("credentials", {
        email: email,
        password,
        redirect: false,
      });

      // if (typeof window !== "undefined") console.log("[Login] signIn result:", result);

      if (result?.error) {
        // if (typeof window !== "undefined") console.error("[Login] signIn error:", result.error);
        setErrors({ password: ["Palavra-passe incorreta"] });
      } else {
        // if (typeof window !== "undefined") console.log("[Login] Login successful, redirecting to /app/courses");
        router.push("/app/courses");
      }
    } catch (error) {
      toast.error("Ocorreu um erro ao tentar fazer login.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStep("reset-success");
        toast.success("Link de recuperação enviado!");
      } else {
        toast.error("Erro ao solicitar recuperação de senha.");
      }
    } catch (err) {
      toast.error("Erro ao conectar com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      "/auth/login/google",
      "google-login",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      toast.error("Por favor, permita popups para este site.");
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "AUTH_SUCCESS") {
        // if (typeof window !== "undefined") console.log("[Login] Google AUTH_SUCCESS received:", event.data);
        setIsLoading(true);
        try {
          const result = await signIn("credentials", {
            accessToken: event.data.access,
            refreshToken: event.data.refresh,
            redirect: false,
          });

          // if (typeof window !== "undefined") console.log("[Login] Google signIn result:", result);

          if (result?.error) {
            // if (typeof window !== "undefined") console.error("[Login] Google signIn error:", result.error);
            toast.error(result.error);
          } else {
            // if (typeof window !== "undefined") console.log("[Login] Google login successful, redirecting to /app/courses");
            router.replace("/app/courses");
          }
        } catch (err) {
          toast.error("Erro ao finalizar autenticação.");
        } finally {
          setIsLoading(false);
          window.removeEventListener("message", handleMessage);
        }
      } else if (event.data?.type === "AUTH_ERROR") {
        toast.error(event.data.message || "Erro na autenticação com Google");
        window.removeEventListener("message", handleMessage);
      }
    };

    window.addEventListener("message", handleMessage);
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
        <Link
          href="/"
          className="absolute p-12 top-0 left-0 cursor-pointer z-50"
        >
          <ChevronLeft className="text-white" size={30}/>
        </Link>
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
              {step === "email" && "Entre com seu e-mail para acessar sua conta."}
              {step === "password" && "Agora, introduza a sua palavra-passe."}
              {step === "reset-success" && "Verifique a sua caixa de entrada."}
            </p>
          </div>

          {step === "reset-success" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-muted/30 p-8 rounded-2xl border border-muted-foreground/10 text-center space-y-4"
            >
              <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MailCheck className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className="text-xl font-semibold">Tudo pronto!</h3>
              <p className="text-muted-foreground">
                Enviamos um link de recuperação para <strong>{email}</strong>.
                Por favor, verifique o seu e-mail (e a pasta de spam).
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep("email")}
              >
                Voltar ao login
              </Button>
            </motion.div>
          ) : (
            <>
              <form onSubmit={step === "email" ? handleNextStep : handleSubmit} className="space-y-6">
                {step === "email" ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="email" className={errors.email ? "text-red-500" : ""}>E-mail</Label>
                    <div className="relative group">
                      <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${errors.email ? "text-red-500" : "text-muted-foreground group-focus-within:text-cyan-500"}`} />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Seu e-mail"
                        className={`pl-10 h-12 bg-muted/30 transition-all ${errors.email ? "border-red-500 focus:border-red-500" : "border-muted-foreground/20 focus:border-cyan-500"}`}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    {errors.email?.map((err, i) => (
                      <p key={i} className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-4 h-4" /> {err}
                      </p>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className={errors.password ? "text-red-500" : ""}>Palavra-passe</Label>
                      <div className="flex items-center gap-4">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-xs text-muted-foreground hover:text-cyan-500 flex items-center gap-1"
                          onClick={() => setStep("email")}
                        >
                          <ChevronLeft className="w-3 h-3" /> Alterar e-mail
                        </Button>
                      </div>
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
                        autoFocus
                      />
                    </div>
                    {errors.password?.map((err, i) => (
                      <p key={i} className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-4 h-4" /> {err}
                      </p>
                    ))}
                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs text-cyan-500 hover:text-cyan-600 font-medium"
                        onClick={handleForgotPassword}
                      >
                        Esqueceu a palavra-passe?
                      </Button>
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
                      {step === "email" ? "Verificando..." : "Entrando..."}
                    </>
                  ) : (
                    <>
                      {step === "email" ? "Continuar" : "Entrar"}
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
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
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
                </>
              )}
            </>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Ainda não tem uma conta?{" "}
            <Link href="/signup" className="font-medium text-cyan-500 hover:text-cyan-600 hover:underline underline-offset-4">
              Criar conta agora
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
