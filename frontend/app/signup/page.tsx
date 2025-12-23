"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { User, Mail, Lock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.detail);
        return;
      }

      router.push("/login");
    } catch (error) {
      toast.error("Erro ao logar, tente mais tarde.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <Image src={"/logo.png"} width={40} height={40} alt="Bookar Logo"/>
          <span className="text-3xl font-bold">Bookar</span>
        </Link>

        <Card className="p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Criar Conta</h1>
            <p className="text-muted-foreground">Registre-se e comece a aprender</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nome de usuário</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Nome de usuário"
                  className="pl-10"
                  pattern={"^[a-zA-Z0-9._-]{3,}$"}
                  title="Deve conter pelo menos 3 caracteres. Apenas letras, números e os símbolos (-, _ e .)."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Endereço eletrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Palavra-passa</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Deve conter pelo menos 12 caracteres"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? "Criando a sua conta..." : "Avançar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
