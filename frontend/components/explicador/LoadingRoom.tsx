import { Bot, Loader2 } from "lucide-react";

export default function LoadingRoom({ lobbyStatus }: { lobbyStatus: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] md:h-screen w-full bg-white">
            <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
                <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
                        <Bot className="w-8 h-8 text-cyan-600" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 border-2 border-white flex items-center justify-center">
                        <Loader2 className="w-3 h-3 animate-spin text-white" />
                    </span>
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-lg font-bold text-slate-800">Explicador</h2>
                    <p className="text-sm text-slate-500 font-medium">{lobbyStatus}</p>
                </div>
                <div className="flex gap-1.5 mt-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
            </div>
        </div>
    );
}