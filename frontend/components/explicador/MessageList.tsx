import ReactMarkdown from "react-markdown";
import { FileText, Bot, PenTool } from "lucide-react";
import { ChatMessage, WhiteboardData } from "./webrtc/types/general";
import { useEffect, useState } from "react";

interface MessageListProps {
    chatHistory: ChatMessage[];
    activeStreamingMessageIndex: number | null;
    isGenerating: boolean;
    whiteboardData: any;
    showWhiteboard: boolean;
    setWhiteboardData: (data: any) => void;
    chatEndRef: any;
}

function StreamingMessage({ content, active }: { content: string; active: boolean }) {
    const [displayedText, setDisplayedText] = useState(active ? "" : content);

    useEffect(() => {
        if (!active) {
            setDisplayedText(content);
            return;
        }

        const words = content.split(" ");
        let currentText = "";
        let wordIndex = 0;

        const interval = setInterval(() => {
            if (wordIndex < words.length) {
                currentText += (wordIndex === 0 ? "" : " ") + words[wordIndex];
                setDisplayedText(currentText);
                wordIndex++;

                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("chat-stream-tick"));
                }
            } else {
                clearInterval(interval);
            }
        }, 45);

        return () => clearInterval(interval);
    }, [content, active]);

    return <div className="break-words"><ReactMarkdown>{displayedText}</ReactMarkdown></div>;
}

export default function MessageList(
    {
        chatHistory,
        activeStreamingMessageIndex,
        isGenerating,
        whiteboardData,
        showWhiteboard,
        setWhiteboardData,
        chatEndRef
    }: MessageListProps) {
    return (
        <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-slate-50/30 dark:bg-neutral-900/30 scrollbar-thin message-list-scroll">
            <div className="max-w-3xl mx-auto w-full space-y-4">
                {chatHistory.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex flex-col message-bubble-animate ${msg.role === "user"
                            ? "max-w-[85%] ml-auto items-end"
                            : "w-full"
                            }`}
                    >
                        <div
                            className={`p-3.5 rounded-2xl text-base leading-relaxed ${msg.role === "user"
                                ? "bg-cyan-500 text-white rounded-tr-none shadow-sm shadow-cyan-500/10 px-4 py-1"
                                : "text-slate-700 dark:text-neutral-300"
                                }`}
                        >
                            <div className="prose prose-slate max-w-none text-sm leading-relaxed break-words">
                                {msg.role === "assistant" ? (
                                    <StreamingMessage
                                        content={msg.content}
                                        active={activeStreamingMessageIndex === i}
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        {msg.attachment && (
                                            <div className="mt-2 pt-2 border-t border-white/20">
                                                {msg.attachment.mime_type.startsWith("image/") ? (
                                                    <div className="relative rounded-lg overflow-hidden border border-white/10 max-w-xs bg-black/5">
                                                        <img
                                                            src={msg.attachment.url}
                                                            alt={msg.attachment.name}
                                                            className="max-h-48 object-contain w-full hover:scale-105 transition-transform duration-300"
                                                        />
                                                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1 text-[10px] text-white/95 break-words leading-tight max-h-10 overflow-y-auto font-medium">
                                                            {msg.attachment.name}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <a
                                                        href={msg.attachment.url}
                                                        download={msg.attachment.name}
                                                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg p-2.5 transition-colors text-white font-medium select-none cursor-pointer"
                                                    >
                                                        <FileText className="w-5 h-5 shrink-0" />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="break-words text-xs font-bold">{msg.attachment.name}</p>
                                                            <p className="text-[9px] text-white/70 uppercase font-semibold">Descarregar documento</p>
                                                        </div>
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {msg.role === "assistant" &&
                                whiteboardData.summary &&
                                !showWhiteboard &&
                                !isGenerating &&
                                i === chatHistory.length - 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setWhiteboardData((prev: any) => ({ ...prev, show_whiteboard: true }))} /*eslint-disable-line*/
                                        className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 text-[10px] font-bold rounded-full transition-all border border-cyan-100/50 cursor-pointer select-none"
                                    >
                                        <PenTool className="w-3.5 h-3.5" />
                                        Ver no quadro
                                    </button>
                                )}
                        </div>
                    </div>
                ))}
                {isGenerating && (
                    <div className="flex flex-col items-start w-full message-bubble-animate">
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                            <Bot className="w-4 h-4 text-cyan-600" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wide">
                                Explicador
                            </span>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-200/80 dark:border-neutral-700 rounded-tl-sm flex items-center gap-3 shadow-sm">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "120ms" }} />
                                <span className="w-2 h-2 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: "240ms" }} />
                            </div>
                            <span className="text-sm text-slate-600 dark:text-neutral-400 font-medium">A pensar...</span>
                        </div>
                    </div>
                )}
            </div>
            <div ref={chatEndRef} />
        </div>
    )
}