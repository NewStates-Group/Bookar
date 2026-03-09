"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Image from "next/image";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email.trim()) {
            setError("O e-mail é obrigatório");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/password-reset/request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Ocorreu um erro ao processar sua solicitação.");
            }

            setIsSubmitted(true);
            toast.success("E-mail de recuperação enviado!");
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-8 bg-background">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md space-y-8 text-center"
                >
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-10 h-10 text-cyan-500" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">E-mail enviado!</h2>
                        <p className="text-muted-foreground">
                            Se o e-mail <strong>{email}</strong> estiver cadastrado em nossa plataforma, você receberá um link para redefinir sua senha em instantes.
                        </p>
                    </div>
                    <div className="pt-4">
                        <Link href="/login">
                            <Button variant="outline" className="w-full h-12 gap-2">
                                <ArrowLeft className="w-4 h-4" /> Voltar para o Login
                            </Button>
                        </Link>
                    </div>
                </motion.div>
            </div>
        );
    }

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
                <Image
                    src="/login.jpg"
                    alt="Password Recovery Background"
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
                        <h1 className="text-5xl font-bold mb-6">Não se preocupe.</h1>
                        <p className="text-xl text-gray-300">
                            Acontece com os melhores. Vamos ajudar você a recuperar o acesso à sua conta em poucos passos.
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
                        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-cyan-500 hover:text-cyan-600 mb-6 group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Voltar para o Login
                        </Link>
                        <h2 className="text-3xl font-bold tracking-tight">Recuperar senha</h2>
                        <p className="text-muted-foreground mt-2">
                            Introduza o seu e-mail para receber um link de recuperação.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className={error ? "text-red-500" : ""}>E-mail</Label>
                            <div className="relative group">
                                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${error ? "text-red-500" : "text-muted-foreground group-focus-within:text-cyan-500"}`} />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Seu e-mail de cadastro"
                                    className={`pl-10 h-12 bg-muted/30 transition-all ${error ? "border-red-500 focus:border-red-500" : "border-muted-foreground/20 focus:border-cyan-500"}`}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                            {error && (
                                <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                                    <AlertCircle className="w-4 h-4" /> {error}
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
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    Enviar Link de Recuperação
                                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </Button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
