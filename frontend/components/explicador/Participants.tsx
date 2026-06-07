import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Users, Volume2 } from "lucide-react";

export default function Participants({
    showParticipantsModal,
    setShowParticipantsModal,
    combinedRoster,
}: {
    showParticipantsModal: boolean;
    setShowParticipantsModal: (open: boolean) => void;
    combinedRoster: any;
}) {
    return (
        <Dialog open={showParticipantsModal} onOpenChange={setShowParticipantsModal}>
            <DialogContent className="sm:max-w-md border-slate-200 bg-white text-slate-800 shadow-2xl rounded-2xl p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
                        <Users className="w-5 h-5 text-cyan-600" />
                        Pessoas na Sala
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3.5 mt-4">
                    {combinedRoster.map((member: any) => (
                        <div key={member.connectionId} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center relative shadow-sm">
                                    {member.avatar ? (
                                        <img
                                            src={member.avatar.startsWith("http") ? member.avatar : `${process.env.NEXT_PUBLIC_API_URL}${member.avatar}`}
                                            alt={member.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-slate-500 uppercase">
                                            {member.name[0]}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm text-slate-750 flex items-center gap-1.5">
                                        {member.name}
                                        {member.isSelf && (
                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200/60 font-medium">
                                                Tu
                                            </span>
                                        )}
                                        {member.isOwner && (
                                            <span className="text-[9px] bg-cyan-50 text-cyan-600 px-1.5 py-0.5 rounded-md border border-cyan-100 font-bold">
                                                Anfitrião
                                            </span>
                                        )}
                                    </h4>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <div className="flex items-center gap-1">
                                    {member.isMicOn ? (
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Microfone ativo" />
                                    ) : (
                                        <span className="w-2 h-2 rounded-full bg-slate-350" title="Microfone desligado" />
                                    )}
                                    <span className="text-[10px] text-slate-400 font-semibold select-none">
                                        {member.isMicOn ? "A falar" : "Mudo"}
                                    </span>
                                </div>

                                {/* Listening status */}
                                <div className="flex items-center gap-1 border-l border-slate-200 pl-2.5">
                                    {member.isListening ? (
                                        <span title="A ouvir"><Volume2 className="w-3.5 h-3.5 text-cyan-600 animate-pulse" /></span>
                                    ) : (
                                        <span title="Sem áudio"><Volume2 className="w-3.5 h-3.5 text-slate-350" /></span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-semibold select-none">
                                        {member.isListening ? "A ouvir" : "Sem áudio"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}