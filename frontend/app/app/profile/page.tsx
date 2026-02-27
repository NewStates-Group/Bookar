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

export default function ProfilePage() {
    const { data: session, update } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const hasFetched = useRef(false);

    const [formData, setFormData] = useState({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        bio: "",
    });

    useEffect(() => {
        if (session?.user && !formData.username) {
            setFormData({
                username: session.user.username || "",
                email: session.user.email || "",
                first_name: (session.user as any).first_name || "",
                last_name: (session.user as any).last_name || "",
                bio: session.user.bio || "",
            });
        }
    }, [session?.user]);

    // Fresh stats fetching
    useEffect(() => {
        if (session?.accessToken && !hasFetched.current) {
            hasFetched.current = true;
            update();
        }
    }, [session?.accessToken, update]);

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
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.accessToken}`,
                },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error("Erro ao atualizar perfil");

            const updatedUser = await res.json();
            await update({
                ...session,
                user: {
                    ...session?.user,
                    ...updatedUser,
                },
            });

            toast.success("Perfil atualizado com sucesso!");
        } catch (error) {
            toast.error("Erro ao atualizar perfil");
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
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/avatar`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`,
                },
                body: uploadData,
            });

            if (!res.ok) throw new Error("Erro ao carregar imagem");

            const updatedUser = await res.json();
            await update({
                ...session,
                user: {
                    ...session?.user,
                    avatar: updatedUser.avatar,
                },
            });

            toast.success("Foto de perfil atualizada!");
        } catch (error) {
            toast.error("Erro ao carregar imagem");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="container mx-auto py-10 space-y-8 max-w-5xl">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Profile Information */}
                <Card className="flex-1">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Resumo do Perfil</CardTitle>
                        <CardDescription>Visualize e edite as suas informações pessoais.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6 pb-6 border-b border-muted">
                            <div className="relative">
                                <Avatar className="h-32 w-32 border-2 border-cyan-500/20">
                                    <AvatarImage src={session?.user?.avatar ? `http://localhost:8000${session.user.avatar}` : ""} />
                                    <AvatarFallback className="text-2xl">{session?.user?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
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
                                <h3 className="text-2xl font-bold">{(session?.user as any).first_name ? `${(session?.user as any).first_name} ${(session?.user as any).last_name}` : session?.user?.username}</h3>
                                <p className="text-muted-foreground">{session?.user?.email}</p>
                                {(!(session?.user as any).first_name || !(session?.user as any).last_name || !session?.user?.avatar) && (
                                    <p className="text-xs text-orange-500 font-medium animate-pulse">
                                        Por favor, complete o seu perfil (nome e foto) para continuar.
                                    </p>
                                )}
                            </div>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="space-y-2">
                                    <Label htmlFor="username">Nome de utilizador</Label>
                                    <Input
                                        id="username"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="bg-muted/30 focus:border-cyan-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">E-mail</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="bg-muted/30 focus:border-cyan-500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bio">Biografia</Label>
                                <Textarea
                                    id="bio"
                                    placeholder="Conte um pouco sobre você..."
                                    value={formData.bio}
                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                    className="min-h-[100px] bg-muted/30 focus:border-cyan-500"
                                />
                            </div>
                            <Button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white w-full sm:w-auto" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Alterações
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Statistics Dashboard */}
                <div className="w-full md:w-80 space-y-6">
                    <Card className="bg-card border-cyan-500/20 overflow-hidden relative shadow-xl shadow-cyan-500/5">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl -mr-16 -mt-16" />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">As Suas Estatísticas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-cyan-500/10 rounded-md">
                                        <BookOpen className="h-5 w-5 text-cyan-500" />
                                    </div>
                                    <span className="text-sm font-medium">Em Curso</span>
                                </div>
                                <span className="text-xl font-bold">{session?.user?.stats?.ongoing_courses || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 rounded-md">
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                    </div>
                                    <span className="text-sm font-medium">Concluídos</span>
                                </div>
                                <span className="text-xl font-bold">{session?.user?.stats?.finished_courses || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-500/10 rounded-md">
                                        <GraduationCap className="h-5 w-5 text-yellow-500" />
                                    </div>
                                    <span className="text-sm font-medium">Certificados</span>
                                </div>
                                <span className="text-xl font-bold">{session?.user?.stats?.certificates_issued || 0}</span>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}
