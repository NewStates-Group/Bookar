"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Image from "next/image";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const formatCooldown = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!token) {
            setError("Token de recuperação ausente. Por favor, solicite um novo link.");
            return;
        }

        if (password.length < 12) {
            setError("A palavra-passe deve ter pelo menos 12 caracteres.");
            return;
        }

        if (password !== confirmPassword) {
            setError("As palavras-passe não coincidem.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/password-reset/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, new_password: password }),
            });

            if (!response.ok) {
                if (response.status === 429) {
                    const retryAfter = response.headers.get("retry-after") || "60";
                    setCooldown(parseInt(retryAfter));
                    throw new Error(`Muitas tentativas. Tente novamente em ${formatCooldown(parseInt(retryAfter))}`);
                }
                const data = await response.json();
                throw new Error(data.message || "Ocorreu um erro ao redefinir sua senha.");
            }

            setIsSuccess(true);
            toast.success("Palavra-passe redefinida com sucesso!");

            // Auto-redirect to login after 3 seconds
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="w-full max-w-md space-y-8 text-center p-8 bg-background">
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight text-red-500">Link Inválido</h2>
                    <p className="text-muted-foreground">
                        O link de recuperação está incompleto ou expirado. Por favor, solicite um novo link.
                    </p>
                </div>
                <div className="pt-4">
                    <Link href="/forgot-password">
                        <Button className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white">
                            Solicitar Novo Link
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="w-full max-w-md space-y-8 text-center p-8 bg-background">
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-10 h-10 text-cyan-500" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Sucesso!</h2>
                    <p className="text-muted-foreground">
                        Sua palavra-passe foi redefinida com sucesso. Você será redirecionado para o login em instantes.
                    </p>
                </div>
                <div className="pt-4">
                    <Link href="/login">
                        <Button className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white">
                            Fazer Login Agora
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold tracking-tight">Nova palavra-passe</h2>
                <p className="text-muted-foreground mt-2">
                    Escolha uma palavra-passe forte para proteger sua conta.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="password" className={error ? "text-red-500" : ""}>Nova Palavra-passe</Label>
                    <div className="relative group">
                        <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${error ? "text-red-500" : "text-muted-foreground group-focus-within:text-cyan-500"}`} />
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Pelo menos 12 caracteres"
                            className={`pl-10 pr-10 h-12 bg-muted/30 transition-all ${error ? "border-red-500 focus:border-red-500" : "border-muted-foreground/20 focus:border-cyan-500"}`}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-cyan-500 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className={error ? "text-red-500" : ""}>Confirmar Palavra-passe</Label>
                    <div className="relative group">
                        <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${error ? "text-red-500" : "text-muted-foreground group-focus-within:text-cyan-500"}`} />
                        <Input
                            id="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="Repita a palavra-passe"
                            className={`pl-10 h-12 bg-muted/30 transition-all ${error ? "border-red-500 focus:border-red-500" : "border-muted-foreground/20 focus:border-cyan-500"}`}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </p>
                    )}
                </div>

                {cooldown > 0 && (
                    <p className="text-sm text-red-500 mt-2 font-medium text-center">
                        Muitas tentativas. Tente novamente em {formatCooldown(cooldown)}
                    </p>
                )}

                <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium group bg-cyan-500 hover:bg-cyan-600 text-white"
                    disabled={isLoading || cooldown > 0}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Redefinindo...
                        </>
                    ) : (
                        <>
                            Redefinir Palavra-passe
                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </Button>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen w-full flex">
            {/* Left Side - Image/Branding (Same as Login) */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="hidden lg:flex w-1/2 bg-black items-center justify-center relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-bl from-cyan-500/20 to-black/40 z-10" />
                <div className="relative z-20 text-white p-12 max-w-lg">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                    >
                        <Link
                            href="/"
                            className="flex flex-row items-center gap-2 mb-8"
                        >
                            <Image alt="Bookar Logo" src="/logo-white.png" className="text-white" width={55} height={55} />
                            <p className={`font-bold text-5xl text-white text-left`}>Bookar</p>
                        </Link>
                        <h1 className="text-5xl font-bold mb-6">Segurança em primeiro lugar.</h1>
                        <p className="text-xl text-gray-300">
                            Escolha uma senha que você não usou antes para garantir que sua conta permaneça protegida.
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
                    className="w-full max-w-md"
                >
                    <Suspense fallback={<div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </motion.div>
            </div>
        </div>
    );
}
