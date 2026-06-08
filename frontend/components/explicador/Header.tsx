import { Bot, Menu, Mic, MicOff } from "lucide-react";
import { ExplicadorInvitePopover } from "../ExplicadorInvitePopover";
import { Button } from "../ui/button";

export default function Header({
    isMultiUserRoom,
    isConnected,
    roomReady,
    combinedRoster,
    shareUrl,
    isMicMuted,
    toggleMute,
    setShowParticipantsModal
}: {
    isMultiUserRoom: boolean;
    combinedRoster: any[];
    isConnected: boolean;
    roomReady: boolean;
    shareUrl: string;
    isMicMuted: boolean;
    toggleMute: () => void;
    setShowParticipantsModal: (show: boolean) => void;
}) {
    return (
        <div className="px-4 py-4 border-b border-slate-200 flex justify-between items-center bg-white select-none shrink-0">
            <div className="flex items-center gap-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent("open-mobile-sidebar"));
                    }}
                    className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                    title="Menu principal"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5 ml-1 md:ml-0">
                    <Bot className="w-5 h-5 text-cyan-600" />
                    Explicador
                </span>
                {isMultiUserRoom ? (
                    <button
                        onClick={() => setShowParticipantsModal(true)}
                        className="flex items-center -space-x-1.5 hover:opacity-90 transition-opacity bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-full border border-slate-200/60 cursor-pointer ml-2"
                        title="Ver participantes"
                    >
                        <div className="flex -space-x-2 mr-2">
                            {combinedRoster.slice(0, 3).map((member) => (
                                <div
                                    key={member.connectionId}
                                    className="w-5 h-5 rounded-full border-2 border-white overflow-hidden bg-slate-200 flex-shrink-0 flex items-center justify-center shadow-sm"
                                >
                                    {member.avatar ? (
                                        <img
                                            src={member.avatar.startsWith("http") ? member.avatar : `${process.env.NEXT_PUBLIC_API_URL}${member.avatar}`}
                                            alt={member.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-[8px] font-bold text-slate-500 uppercase select-none">
                                            {member.name[0]}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 select-none">
                            {combinedRoster.length}
                        </span>
                    </button>
                ) : null}
                {!isConnected && roomReady && (
                    <span className="text-xs rounded-full ml-1 text-amber-600 animate-pulse">
                        (A reconectar…)
                    </span>
                )}
                {!isConnected && !roomReady && (
                    <span className="text-xs rounded-full ml-1 text-red-500">
                        (Sem ligação)
                    </span>
                )}
            </div>
            <div className="flex items-center gap-1">
                {shareUrl ? <ExplicadorInvitePopover shareUrl={shareUrl} /> : null}

                {isMultiUserRoom && (
                    <div className="flex items-center gap-1.5">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={toggleMute}
                            className={`hover:bg-transparent! rounded-full h-8 px-3 gap-1.5 text-xs`}
                        >
                            {isMicMuted ?
                                <MicOff className="w-3.5 h-3.5 text-red-650" />
                                : <Mic className="w-3.5 h-3.5 text-slate-800" />}
                            <span className="hidden sm:block">
                                {isMicMuted ? "Silenciado" : "Voz Ativa"}
                            </span>

                        </Button>
                    </div>
                )}
            </div>

        </div>
    )
}