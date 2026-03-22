"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center text-foreground">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="max-w-md space-y-8"
            >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                </div>

                <div className="space-y-3">
                    <h1 className="text-4xl font-black tracking-tight">Ops! Algo correu mal.</h1>
                    <p className="text-muted-foreground">
                        Encontramos um erro inesperado. Já fomos notificados e estamos a trabalhar para o resolver.
                    </p>
                    {process.env.NODE_ENV === "development" && (
                        <div className="mt-4 rounded-lg bg-muted p-4 text-left font-mono text-xs overflow-auto max-h-32 border border-border">
                            {error.message}
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <Button
                        onClick={() => reset()}
                        variant="default"
                        size="lg"
                        className="rounded-full px-8 gap-2 w-full sm:w-auto"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Tentar Novamente
                    </Button>
                    <Button asChild variant="outline" size="lg" className="rounded-full px-8 w-full sm:w-auto">
                        <Link href="/">Voltar ao Início</Link>
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
