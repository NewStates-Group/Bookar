"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home } from "lucide-react";
import "./globals.css";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html lang="pt-PT">
            <body className="font-sans antialiased">
                <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center text-foreground">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="max-w-md space-y-8"
                    >
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                            <AlertTriangle className="h-12 w-12 text-primary" />
                        </div>

                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold tracking-tight">Erro Crítico</h1>
                            <p className="text-muted-foreground">
                                Isto não deveria acontecer, mas estamos aqui para ajudar.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={() => reset()}
                                className="rounded-full h-12 text-lg font-semibold"
                            >
                                Tentar Recuperar Aplicação
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => (window.location.href = "/")}
                                className="rounded-full h-12 gap-2"
                            >
                                <Home className="h-4 w-4" />
                                Ir para a Página Inicial
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </body>
        </html>
    );
}
