"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareCourseModalProps {
    isOpen: boolean;
    onClose: () => void;
    shareUrl: string;
}

export function ShareCourseModal({ isOpen, onClose, shareUrl }: ShareCourseModalProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success("Link copiado com sucesso!");
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Erro ao copiar link.");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-cyan-500" />
                        Partilhar Curso
                    </DialogTitle>
                    <DialogDescription>
                        Qualquer pessoa com este link poderá importar este curso para a sua conta.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center space-x-2">
                    <div className="grid flex-1 gap-2">
                        <Input
                            id="link"
                            defaultValue={shareUrl}
                            readOnly
                            className="h-9"
                        />
                    </div>
                    <Button type="button" size="sm" className="px-3" onClick={handleCopy}>
                        <span className="sr-only">Copy</span>
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
                <DialogFooter className="sm:justify-start">
                    <Button type="button" variant="secondary" onClick={onClose} className="rounded-full">
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
