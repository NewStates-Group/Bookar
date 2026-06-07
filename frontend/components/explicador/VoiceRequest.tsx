import { Check, Volume2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export default function VoiceRequest({ activeVoiceRequests, handleVoiceDecision }: { activeVoiceRequests: any[]; handleVoiceDecision: (connectionId: string, decision: boolean) => void }) {
    return (
        <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
            {activeVoiceRequests.map((req) => (
                <Card key={req.connectionId} className="p-4 border border-cyan-100 bg-white shadow-2xl animate-in slide-in-from-top duration-300 text-slate-800">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-600 mt-0.5">
                                <Volume2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-850 text-sm">Acesso por Voz</h4>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    <strong>{req.name}</strong> quer entrar na chamada de voz.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVoiceDecision(req.connectionId, false)}
                            className="h-8 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        >
                            Recusar
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => handleVoiceDecision(req.connectionId, true)}
                            className="h-8 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white flex items-center gap-1 shadow-sm"
                        >
                            <Check className="w-3.5 h-3.5" />
                            Permitir
                        </Button>
                    </div>
                </Card>
            ))}
        </div>
    );
}