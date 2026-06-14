"use client";
import React from "react";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ConfirmUpgradeModal } from "@/components/ConfirmUpgradeModal";

interface Profile {
    email: string;
    first_name: string;
    last_name: string;
    avatar: string | null;
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
    const [confirmStatus, setConfirmStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
    const [confirmError, setConfirmError] = useState<string>("");

    // Confirm pending Stripe checkout after redirect — runs before data fetch
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
    const hasSessionId = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("session_id");
    useEffect(() => {
        if (!session?.accessToken || hasFetched.current) return;
        if (hasSessionId && confirmStatus !== "error") return;
        hasFetched.current = true;

        apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`)
            .then((profile: any) => {
                setFreshUser(profile as Profile);
                setFormData({
                    email: profile.email,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                });
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
        <div className="min-h-screen flex items-center justify-center py-20">
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
                <p className="text-sm text-slate-500 mt-1">Gere as tuas informações pessoais.</p>
            </div>

            {/* Informações de Perfil */}
            <Card className="shadow-sm border-slate-200">
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
            </div>
        </>
    );
}
