"use client";
import React from "react";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Upload, BookOpen, CheckCircle, GraduationCap, Sparkles, Crown } from "lucide-react";
import { apiRequest } from "@/lib/api";
import Link from "next/link";
import { ConfirmUpgradeModal } from "@/components/ConfirmUpgradeModal";

interface Profile {
    email: string;
    first_name: string;
    last_name: string;
    avatar: string | null;
    stats: {
      ongoing_courses: number;
      finished_courses: number;
      certificates_issued: number;
    } | null;
  }

  interface SubscriptionPlan {
    slug: string;
    name: string;
    monthly_limits: boolean;
    max_explicador_messages: number | null;
    max_explicador_participants: number | null;
    max_courses_generated: number | null;
    max_mindmaps_generated: number | null;
    max_mindmap_modules: number | null;
    max_mindmap_quizzes: number | null;
    max_mindmap_materials: number | null;
  }

  interface UsageMetric {
    metric: string;
    used: number;
    limit: number | null;
    remaining: number | null;
  }

export default function ProfilePage() {
    const { data: session, update } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState<Boolean>(true);
    const [isUploading, setIsUploading] = useState(false);
    const hasFetched = useRef(false);

    const [formData, setFormData] = useState({
        email: "",
        first_name: "",
        last_name: "",
    });
    const [freshUser, setFreshUser] = useState<Profile | null>(null);
    const [subscription, setSubscription] = useState<{ plan: SubscriptionPlan | null; status: string } | null>(null);
    const [usage, setUsage] = useState<UsageMetric[]>([]);
    const [confirmStatus, setConfirmStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
    const [confirmError, setConfirmError] = useState<string>("");

    // Confirm pending Stripe checkout after redirect
    useEffect(() => {
        if (!session?.accessToken) return;
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get("session_id");
        if (!sessionId) return;

        setConfirmStatus("pending");
        apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/confirm`, {
            method: "POST",
            body: JSON.stringify({ session_id: sessionId }),
        })
            .then(() => {
                setConfirmStatus("success");
                window.history.replaceState({}, "", "/app/profile");
                hasFetched.current = false;
                setTimeout(() => {
                    setConfirmStatus("idle");
                }, 1500);
            })
            .catch((err: Error) => {
                setConfirmError(err.message || "Erro ao confirmar pagamento");
                setConfirmStatus("error");
                setTimeout(() => {
                    setConfirmStatus("idle");
                }, 3000);
            });
    }, [session?.accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch fresh profile data directly from API
    useEffect(() => {
        if (!session?.accessToken || hasFetched.current) return;
        hasFetched.current = true;

        Promise.all([
            apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/auth/me?stats=1`),
            apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/my`),
            apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/usage`),
        ])
            .then(([profile, sub, usageData]: any) => {
                setFreshUser(profile as Profile);
                setFormData({
                    email: profile.email,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                });
                setSubscription(sub as { plan: SubscriptionPlan | null; status: string });
                setUsage((usageData?.metrics || []) as UsageMetric[]);
            })
            .catch(() => {
                toast.error("Erro ao carregar perfil");
            })
            .finally(() => {
                setIsPageLoading(false);
            });
    }, [session?.accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const fullName = `${formData.first_name} ${formData.last_name}`.trim();
        const nameParts = fullName.split(/\s+/).filter(p => p.length > 0);
        const hasSymbols = /[!@#$%^&*(),.?":{}|<>0-9]/.test(fullName);

        if (nameParts.length < 2) {
            toast.error("O nome completo deve conter pelo menos duas palavras.");
            setIsLoading(false);
            return;
        }

        if (hasSymbols) {
            toast.error("O nome não pode conter símbolos ou números.");
            setIsLoading(false);
            return;
        }

        try {
            const updatedUser = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile`, {
                method: "PUT",
                body: JSON.stringify(formData),
            });

            // Update local display state immediately
            setFreshUser((prev: any) => ({ ...(prev || session?.user), ...updatedUser }));

            // Sync to NextAuth session (no loop risk: this is an explicit user action)
            update({ user: updatedUser }).catch(() => { /* non-critical */ });
        } catch (error: any) {
            toast.error(error.message || "Erro ao atualizar perfil");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const uploadData = new FormData();
        uploadData.append("avatar", file);

        try {
            const updatedUser = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/auth/avatar`, {
                method: "POST",
                headers: {}, // Do not set Content-Type for FormData
                body: uploadData,
            });

            // Update local display state immediately
            setFreshUser((prev: any) => ({ ...(prev || session?.user), avatar: updatedUser.avatar }));

            // Sync to NextAuth session
            update({ user: { avatar: updatedUser.avatar } }).catch(() => { /* non-critical */ });

            toast.success("Foto de perfil atualizada!");
        } catch (error: any) {
            toast.error(error.message || "Erro ao carregar imagem");
        } finally {
            setIsUploading(false);
        }
    };

    const avatarSrc = freshUser?.avatar
        ? (freshUser.avatar.startsWith('http') ? freshUser.avatar : `${process.env.NEXT_PUBLIC_API_URL}${freshUser.avatar}`)
        : "";

    if (isPageLoading) return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Carregando seus dados...</p>
          </div>
        </div>
    );

    return (
        <>
            <ConfirmUpgradeModal
                open={confirmStatus !== "idle"}
                status={confirmStatus}
                errorMessage={confirmError}
            />
            <div className="px-4 py-6 sm:px-6 md:py-10 max-w-5xl mx-auto w-full space-y-6">
            {/* Cabeçalho */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">O Meu Perfil</h1>
                <p className="text-sm text-slate-500 mt-1">Gere as tuas informações e acompanha o teu progresso de aprendizagem.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Informações de Perfil */}
                <Card className="lg:col-span-2 shadow-sm border-slate-200">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-bold text-slate-900">Resumo do Perfil</CardTitle>
                        <CardDescription>Visualiza e edita as suas informações pessoais.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6 pb-6 border-b border-slate-100">
                            <div className="relative">
                                <Avatar className="h-28 w-28 sm:h-32 sm:w-32 border-2 border-cyan-500/20 shadow-sm">
                                    <AvatarImage src={avatarSrc} />
                                    <AvatarFallback className="text-2xl font-semibold bg-slate-100 text-slate-600">
                                        {(freshUser?.first_name || freshUser?.email || "U").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <label
                                    htmlFor="avatar-upload"
                                    className="absolute bottom-0 right-0 p-2 bg-cyan-500 rounded-full text-white cursor-pointer hover:bg-cyan-600 transition-colors shadow-lg"
                                >
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    <input id="avatar-upload" type="file" className="hidden" onChange={handleAvatarUpload} accept="image/*" disabled={isUploading} />
                                </label>
                            </div>
                            <div className="text-center sm:text-left space-y-1">
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                                    {freshUser?.first_name
                                        ? `${freshUser.first_name} ${freshUser.last_name}`
                                        : freshUser?.email}
                                </h3>
                                <p className="text-sm text-slate-500">{freshUser?.email}</p>
                                {(!freshUser?.first_name || !freshUser?.last_name || !freshUser?.avatar) && (
                                    <p className="text-xs text-orange-500 font-medium animate-pulse">
                                        Por favor, complete o seu perfil (nome e foto) para continuar.
                                    </p>
                                )}
                            </div>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="first_name">Nome</Label>
                                    <Input
                                        id="first_name"
                                        placeholder="Seu primeiro nome"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        className="bg-muted/30 focus:border-cyan-500"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="last_name">Apelido (Sobrenome)</Label>
                                    <Input
                                        id="last_name"
                                        placeholder="Seu sobrenome"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        className="bg-muted/30 focus:border-cyan-500"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    className="bg-muted/10 opacity-70 cursor-not-allowed"
                                    disabled
                                />
                            </div>
                            <Button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white w-full sm:w-auto px-6" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Alterações
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Estatísticas */}
                <div className="w-full space-y-6">
                    <Card className="bg-card border-slate-200 overflow-hidden relative shadow-sm">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-slate-900">As Suas Estatísticas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-cyan-500/10 rounded-md">
                                        <BookOpen className="h-5 w-5 text-cyan-500" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">Em Curso</span>
                                </div>
                                <span className="text-xl font-bold text-slate-900">{freshUser?.stats?.ongoing_courses ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 rounded-md">
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">Concluídos</span>
                                </div>
                                <span className="text-xl font-bold text-slate-900">{freshUser?.stats?.finished_courses ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-500/10 rounded-md">
                                        <GraduationCap className="h-5 w-5 text-yellow-500" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">Certificados</span>
                                </div>
                                <span className="text-xl font-bold text-slate-900">{freshUser?.stats?.certificates_issued ?? 0}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Plano Atual */}
                    <Card className="bg-card border-slate-200 overflow-hidden relative shadow-sm">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Crown className="h-5 w-5 text-amber-500" />
                                Plano Atual
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-600">Plano</span>
                                <Badge
                                    variant={subscription?.plan?.slug === "free" ? "outline" : "default"}
                                    className={
                                        subscription?.plan?.slug === "pro_plus"
                                            ? "bg-purple-500 hover:bg-purple-600"
                                            : subscription?.plan?.slug === "pro"
                                            ? "bg-cyan-500 hover:bg-cyan-600"
                                            : ""
                                    }
                                >
                                    {subscription?.plan?.name ?? "Free"}
                                </Badge>
                            </div>

                            {usage.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    {usage.map((m) => {
                                        const pct = m.limit && m.limit > 0
                                            ? Math.round((m.used / m.limit) * 100)
                                            : 0;
                                        const labels: Record<string, string> = {
                                            explicador_message: "Mensagens",
                                            course_generated: "Cursos",
                                            mindmap_generated: "Mapas Mentais",
                                        };
                                        return (
                                            <div key={m.metric} className="space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">{labels[m.metric] || m.metric}</span>
                                                    <span className="font-medium text-slate-700">
                                                        {m.limit === null ? `${m.used}` : `${m.used}/${m.limit}`}
                                                    </span>
                                                </div>
                                                {m.limit !== null && (
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${
                                                                pct >= 80 ? "bg-red-400" : pct >= 50 ? "bg-amber-400" : "bg-cyan-400"
                                                            }`}
                                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {subscription?.plan?.slug === "free" && (
                                <Link href="/pricing">
                                    <Button className="w-full mt-2 bg-cyan-400 hover:bg-cyan-500 text-black font-semibold text-sm">
                                        <Sparkles className="w-4 h-4 mr-1" />
                                        Fazer Upgrade
                                    </Button>
                                </Link>
                            )}
                            {subscription?.plan?.slug && subscription.plan.slug !== "free" && (
                                <Link href="/pricing">
                                    <Button variant="outline" className="w-full mt-2 text-sm">
                                        Gerir Subscrição
                                    </Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            </div>
        </>
    );
}
