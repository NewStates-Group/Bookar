import { Pencil } from "lucide-react";
import { Card } from "../ui/card";

export default function PencilRequests({ activePencilRequests }: { activePencilRequests: any[] }) {
    return (
        <div className="absolute top-4 right-8 z-50 flex flex-col gap-2 max-w-sm w-full">
            {activePencilRequests.map((req) => (
                <Card
                    key={req.connectionId}
                    className="p-4 border border-amber-100 bg-white shadow-2xl animate-in slide-in-from-top duration-300 text-slate-800"
                >
                    <div className="flex gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 mt-0.5">
                            <Pencil className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-850 text-sm">Pedido de lápis</h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                                <strong>{req.name}</strong> pediu o lápis.
                            </p>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}