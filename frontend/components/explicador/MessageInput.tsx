import { Bot, FileText, Loader2, Mic, Paperclip, Pencil, Send, Square, X } from "lucide-react";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Plus } from "lucide-react";
import PencilModal from "./PencilModal";
import { useState } from "react";

interface MessageInputProps {
    message: string;
    setMessage: (message: string) => void;
    isGenerating: boolean;
    isRecordingAudio: boolean;
    isSoloRoom: boolean;
    mentionsExplicadorInInput: boolean;
    isLockHolder: boolean;
    handleSendMessage: (e: React.FormEvent) => void;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleChatMic: () => void;
    handleMentionExplicador: () => void;
    handleInterrupt: () => void;
    grabLock: () => void;
    requestPencil: () => void;
    releaseLock: () => void;
    currentLock: any;
    isMultiUserRoom: boolean;
    chatInputRef: any;
    selectedFile: any;
    setSelectedFile: (file: any) => void;
    pencilCooldownActive: boolean;
    pencilCooldownTimeLeft: number;
}

export default function MessageInput(
    {
        requestPencil,
        grabLock,
        releaseLock,
        currentLock,
        isMultiUserRoom,
        chatInputRef,
        selectedFile,
        setSelectedFile,
        message,
        setMessage,
        isGenerating,
        isRecordingAudio,
        isSoloRoom,
        mentionsExplicadorInInput,
        isLockHolder,
        handleSendMessage,
        handleFileChange,
        handleChatMic,
        handleMentionExplicador,
        handleInterrupt,
        pencilCooldownActive,
        pencilCooldownTimeLeft
    }: MessageInputProps) {

    const [pencilModalOpen, setPencilModalOpen] = useState(false);

    const handleTextareaChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>
    ) => {
        setMessage(e.target.value);
        e.target.style.height = "auto";
        const maxHeight = 24 * 4;
        e.target.style.height =
            Math.min(e.target.scrollHeight, maxHeight) + "px";
    };

    return (
        <>
            <PencilModal
                open={pencilModalOpen}
                onOpenChange={setPencilModalOpen}
                currentLock={currentLock}
                isLockHolder={isLockHolder}
                pencilCooldownActive={pencilCooldownActive}
                pencilCooldownTimeLeft={pencilCooldownTimeLeft}
                grabLock={grabLock}
                releaseLock={releaseLock}
                requestPencil={requestPencil}
            />

            <form
                onSubmit={handleSendMessage}
                className="px-3 pb-3 pt-2 w-full chat-input-safe-area"
            >
                {selectedFile && (
                    <div className="flex gap-1 mb-2 max-w-3xl mx-auto">
                        <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full pl-3 pr-1 py-1 text-xs text-slate-700 animate-in fade-in zoom-in duration-200 shrink-0">
                            <FileText className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            <span className="max-w-[120px] truncate font-medium">{selectedFile.name}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedFile(null)}
                                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2 border border-slate-200/60 rounded-full px-4 py-1.5 shadow-lg shadow-slate-200/40 transition-all duration-300 max-w-3xl mx-auto w-full">
                    {/* + button on the left */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                disabled={isGenerating}
                                className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 cursor-pointer transition-all duration-200 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 disabled:opacity-40"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            align="start"
                            className="w-56"
                        >
                            {/* File attachment */}
                            <DropdownMenuItem
                                disabled={isGenerating || isRecordingAudio}
                                onClick={() =>
                                    document
                                        .getElementById("explicador-file-upload")
                                        ?.click()
                                }
                            >
                                <Paperclip className="w-4 h-4 mr-2" />
                                Anexar ficheiro
                            </DropdownMenuItem>

                            {/* Pencil/Lápis - opens modal */}
                            {isMultiUserRoom && (
                                <DropdownMenuItem
                                    disabled={isGenerating || isRecordingAudio}
                                    onClick={() => setPencilModalOpen(true)}
                                >
                                    <Pencil className="w-4 h-4 mr-2 text-amber-600" />
                                    <span className="flex-1">Lápis</span>
                                    {currentLock && !isLockHolder && (
                                        <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
                                            com {currentLock.name}
                                        </span>
                                    )}
                                    {isLockHolder && (
                                        <span className="text-[10px] text-amber-600 font-semibold">Tens</span>
                                    )}
                                </DropdownMenuItem>
                            )}

                            {/* Send to explicador */}
                            {isMultiUserRoom && (
                                <DropdownMenuItem
                                    disabled={isGenerating || isRecordingAudio}
                                    onClick={handleMentionExplicador}
                                >
                                    <Bot className="w-4 h-4 mr-2" />
                                    Explicador
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Textarea in the middle */}
                    <textarea
                        ref={chatInputRef}
                        placeholder={
                            isGenerating
                                ? "A aguardar resposta do explicador..."
                                : isRecordingAudio
                                    ? "A gravar áudio... Clique no botão vermelho para enviar."
                                    : isSoloRoom
                                        ? "Escreve a tua dúvida para o explicador..."
                                        : mentionsExplicadorInInput && !isLockHolder
                                            ? "Pega o lápis para falar com o explicador"
                                            : "Escreve no chat com os outros..."
                        }
                        value={message}
                        rows={1}
                        onChange={handleTextareaChange}
                        disabled={isGenerating || isRecordingAudio}
                        className="
                            flex-1
                            min-h-[40px]
                            max-h-[96px]
                            resize-none
                            overflow-y-auto
                            bg-transparent
                            text-slate-800
                            placeholder:text-slate-400
                            text-sm
                            px-1
                            py-2
                            outline-none
                            border-0
                            focus:ring-0
                            disabled:text-slate-400
                            leading-6
                        "
                    />

                    <input
                        type="file"
                        id="explicador-file-upload"
                        className="hidden"
                        onChange={handleFileChange}
                        accept="image/*,application/pdf,text/*"
                        disabled={isGenerating}
                    />

                    {/* Mic button on the right side */}
                    <button
                        type="button"
                        onClick={handleChatMic}
                        disabled={isGenerating}
                        title={isRecordingAudio ? "Enviar gravação de voz" : "Falar com o explicador"}
                        className={`w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 cursor-pointer transition-all duration-200 disabled:opacity-40 ${isRecordingAudio
                            ? "text-red-500 bg-red-50 hover:bg-red-105 animate-pulse ring-2 ring-red-500/25"
                            : "text-slate-400 hover:text-cyan-600 hover:bg-cyan-50"
                            }`}
                    >
                        {isRecordingAudio ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    {/* Send button on the far right */}
                    <Button
                        type={isGenerating ? "button" : "submit"}
                        onClick={isGenerating ? handleInterrupt : undefined}
                        disabled={
                            isGenerating
                                ? (isMultiUserRoom && !isLockHolder)
                                : (
                                    (!message.trim() && !selectedFile) ||
                                    (isMultiUserRoom && mentionsExplicadorInInput && !isLockHolder)
                                )
                        }
                        className={`w-8 h-8 p-0 text-white rounded-full flex items-center justify-center shadow-sm transition-all duration-200 flex-shrink-0 cursor-pointer ${isGenerating
                            ? (isMultiUserRoom && !isLockHolder
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                : "bg-red-500 hover:bg-red-650 shadow-red-500/20")
                            : "bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-200 disabled:text-slate-400 shadow-cyan-500/20"
                            }`}
                    >
                        {isGenerating ? (
                            isMultiUserRoom && !isLockHolder ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <X className="w-3.5 h-3.5" />
                            )
                        ) : (
                            <Send className="w-3.5 h-3.5" />
                        )}
                    </Button>
                </div>
            </form>
        </>
    )
}