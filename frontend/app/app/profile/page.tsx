"use client";
import React from "react";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Upload, BookOpen, CheckCircle, GraduationCap } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function ProfilePage() {
    const { data: session, update } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const hasFetched = useRef(false);

    const [formData, setFormData] = useState({
        email: "",
        first_name: "",
        last_name: "",
        bio: "",
    });
    const [freshUser, setFreshUser] = useState<any>(null);

    // Populate form from session when first available
    useEffect(() => {
        const user = freshUser || session?.user;
        if (user && !formData.email) {
            setFormData({
                email: (user as any).email || "",
                first_name: (user as any).first_name || "",
                last_name: (user as any).last_name || "",
                bio: (user as any).bio || "",
            });
        }
    }, [freshUser, session?.user]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch fresh profile data directly from API — do NOT call update() here
    // as it would cause session churn and remount the page component in a loop.
    useEffect(() => {
        if (!session?.accessToken || hasFetched.current) return;
        hasFetched.current = true;

        apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`)
            .then((profile: any) => setFreshUser(profile))
            .catch(() => {/* non-critical, session data still shows */ });
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

            toast.success("Perfil atualizado com sucesso!");
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

    // Use freshUser data when available (fetched directly from /auth/me),
    // falling back to session data while loading.
    const displayUser = (freshUser || session?.user) as any;
    const displayStats = freshUser?.stats ?? session?.user?.stats;
    const avatarSrc = displayUser?.avatar
        ? (displayUser.avatar.startsWith('http') ? displayUser.avatar : `${process.env.NEXT_PUBLIC_API_URL}${displayUser.avatar}`)
        : "";

    return (
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
                                        {(displayUser?.first_name || displayUser?.email || "U").slice(0, 2).toUpperCase()}
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
                                    {displayUser?.first_name
                                        ? `${displayUser.first_name} ${displayUser.last_name}`
                                        : displayUser?.email}
                                </h3>
                                <p className="text-sm text-slate-500">{displayUser?.email}</p>
                                {(!displayUser?.first_name || !displayUser?.last_name || !displayUser?.avatar) && (
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
                            <div className="space-y-2">
                                <Label htmlFor="bio">Biografia</Label>
                                <Textarea
                                    id="bio"
                                    placeholder="Conte um pouco sobre você..."
                                    value={formData.bio}
                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                    className="min-h-[100px] bg-muted/30 focus:border-cyan-500 resize-none"
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
                                <span className="text-xl font-bold text-slate-900">{displayStats?.ongoing_courses ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 rounded-md">
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">Concluídos</span>
                                </div>
                                <span className="text-xl font-bold text-slate-900">{displayStats?.finished_courses ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-500/10 rounded-md">
                                        <GraduationCap className="h-5 w-5 text-yellow-500" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">Certificados</span>
                                </div>
                                <span className="text-xl font-bold text-slate-900">{displayStats?.certificates_issued ?? 0}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
