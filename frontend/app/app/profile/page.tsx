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
import { Loader2, Upload, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ConfirmUpgradeModal } from "@/components/ConfirmUpgradeModal";
import { useRouter } from "next/navigation";

interface Profile {
    email: string;
    first_name: string;
    last_name: string;
    avatar: string | null;
}

export default function ProfilePage() {
    const router = useRouter();
    const { data: session, update } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState<Boolean>(true);
    const [isUploading, setIsUploading] = useState(false);
    const [cancelUploading, setCancelUploading] = useState<Boolean>(false);
    const hasFetched = useRef(false);

    const [formData, setFormData] = useState({
        email: "",
        first_name: "",
        last_name: "",
    });
    const [uploadedAvatar, setUploadedAvatar] = useState<File | null>(null);
    const [originalAvatar, setOriginalAvatar] = useState<string | null>(null)
    const [freshUser, setFreshUser] = useState<Profile | null>(null);
    const [confirmStatus, setConfirmStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
    const [confirmError, setConfirmError] = useState<string>("");

    useEffect(() => {
        if (!session?.accessToken || hasFetched.current) return;
        const hasSessionId = new URLSearchParams(window.location.search).has("session_id");
        if (hasSessionId && (confirmStatus === "idle" || confirmStatus === "pending" || confirmStatus === "success")) return;
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
    }, [session?.accessToken, confirmStatus]); // eslint-disable-line react-hooks/exhaustive-deps

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

        const newFormData = new FormData();
        newFormData.append("first_name", formData.first_name);
        newFormData.append("last_name", formData.last_name);

        if (uploadedAvatar) {
            newFormData.append("avatar", uploadedAvatar);
        }

        try {
            const updatedUser = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/auth/profile`, {
                method: "POST",
                body: newFormData,
            });

            setFreshUser((prev: any) => ({ ...(prev || session?.user), ...updatedUser }));
            update({ user: updatedUser }).catch(() => { });
            setIsUploading(false)
            setOriginalAvatar(null)
            setCancelUploading(false)
        } catch (error: any) {
            toast.error(error.message || "Erro ao atualizar perfil");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelUploading = async (e: any) => {
        setIsUploading(true);
        setFreshUser((prev: any) => ({
            ...prev,
            avatar: originalAvatar,
        }))
        setUploadedAvatar(null)
        setCancelUploading(false)
        setIsUploading(false);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsUploading(true);
        const file = e.target.files?.[0];
        if (file) {
            setUploadedAvatar(file)
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => {
                if (!originalAvatar) {
                    setOriginalAvatar(freshUser?.avatar)
                }
                setFreshUser((prev: any) => ({
                    ...prev,
                    avatar: reader.result,
                }))
            }
            reader.onerror = () => {
                setFreshUser((prev: any) => ({
                    ...prev,
                    avatar: originalAvatar,
                }))
                toast.error("Erro ao ler arquivo")
            };
        };
        setCancelUploading(true)
        setIsUploading(false);
    };



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
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-neutral-100">O Meu Perfil</h1>
                    <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">Gere as tuas informações pessoais.</p>
                </div>

                {/* Informações de Perfil */}
                <Card className="shadow-sm border-slate-200 dark:border-neutral-700">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-bold text-slate-900 dark:text-neutral-100">Resumo do Perfil</CardTitle>
                        <CardDescription>Visualiza e edita as suas informações pessoais.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6 pb-6 border-b border-slate-100 dark:border-neutral-800">
                            <div className="relative">
                                <Avatar className="h-28 w-28 sm:h-32 sm:w-32 border-2 border-cyan-500/20 shadow-sm">
                                    <AvatarImage src={freshUser?.avatar} />
                                    <AvatarFallback className="text-2xl font-semibold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
                                        {(freshUser?.first_name || freshUser?.email || "U").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <label
                                    htmlFor="avatar-upload"
                                    className="absolute bottom-0 right-0 p-2 bg-cyan-500 rounded-full text-white cursor-pointer hover:bg-cyan-600 transition-colors shadow-lg"
                                >
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    <input id="avatar-upload" type="file" className="hidden" onChange={handleAvatarChange} accept="image/*" disabled={isUploading} />
                                </label>
                            </div>
                            <div className="text-center sm:text-left space-y-1">
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-neutral-100">
                                    {freshUser?.first_name
                                        ? `${freshUser.first_name} ${freshUser.last_name}`
                                        : freshUser?.email}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-neutral-400">{freshUser?.email}</p>
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
                            <div className="flex gap-2 flex-row">

                                <Button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white w-full sm:w-auto px-6" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar Alterações
                                </Button>
                                <Button type="submit" className={`bg-red-500 hover:bg-red-600 text-white w-full sm:w-auto px-6 ${!cancelUploading ? 'hidden' : ''}`} disabled={!cancelUploading} onClick={handleCancelUploading}>
                                    <X className="mr-1/2 h-4 w-4" />
                                    Cancelar
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
