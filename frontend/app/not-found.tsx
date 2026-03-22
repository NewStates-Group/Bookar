"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-md space-y-8"
            >
                <div className="space-y-2">
                    <h1 className="text-7xl font-bold tracking-tighter text-cyan-300">404</h1>
                    <h2 className="text-2xl font-semibold tracking-tight">Página não encontrada</h2>
                    <p className="text-muted-foreground">
                        Desculpe, não conseguimos encontrar a página que você está procurando.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <Button asChild variant="default" size="lg" className="rounded-full px-8">
                        <Link href="/">Voltar ao Início</Link>
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
