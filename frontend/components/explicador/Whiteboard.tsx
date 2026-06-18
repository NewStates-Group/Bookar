import { Pencil, PenTool, X } from "lucide-react";
import { Button } from "../ui/button";
import ReactMarkdown from "react-markdown";

export default function Whiteboard({
    showWhiteboard,
    setWhiteboardData,
    displayedBoardText,
    isGenerating,
    isMobile
}: {
    showWhiteboard: boolean;
    setWhiteboardData: (data: any) => void;
    displayedBoardText: string;
    isGenerating: boolean;
    isMobile: boolean;
}) {
    return (
        <div className={`flex-1 h-full bg-[#fafafa] dark:bg-neutral-950 flex flex-col justify-start relative select-text animate-in fade-in slide-in-from-right duration-500 ${isMobile ? "p-4 w-full absolute inset-0 z-50 overflow-y-auto" : "p-6 md:p-10 overflow-hidden"
            }`}>

            {/* Header of the Board */}
            <div className={`flex justify-between items-center mb-6 pb-4 border-b border-slate-200/60 dark:border-neutral-700 shrink-0 ${isMobile ? "sticky top-0 z-10 bg-[#fafafa] dark:bg-neutral-950 pt-1" : ""}`}>
                <div className="flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-cyan-600" />
                    <h2 className="text-sm font-bold text-slate-700 dark:text-neutral-300 tracking-wide">
                        Quadro
                    </h2>
                </div>

                <div className="flex items-center gap-3">

                    {/* Active Streaming Indicator */}
                    {isGenerating && (
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 px-3 py-1 rounded-full text-[10px] text-slate-500 dark:text-neutral-400 font-bold uppercase tracking-wider">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
                            <span className="text-cyan-600">A pensar...</span>
                        </div>
                    )}

                    {/* Close whiteboard panel */}
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setWhiteboardData((prev: any) => ({ ...prev, show_whiteboard: false }))}
                        className="w-8 h-8 rounded-full text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"
                        title="Fechar Quadro"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Dotted blackboard writing sheet */}
            <div className="flex-1 blackboard-grid overflow-y-auto font-handwriting text-slate-700 dark:text-neutral-300 relative leading-relaxed scrollbar-thin message-list-scroll">
                {displayedBoardText ? (
                    <article className="prose max-w-none prose-slate dark:prose-invert font-handwriting prose-headings:font-handwriting prose-strong:font-handwriting text-slate-700 dark:text-neutral-300 text-lg md:text-2xl leading-loose">
                        <ReactMarkdown
                            components={{
                                h1: ({ node, ...props }: any) => <h1 className="text-cyan-600 font-bold text-2xl md:text-4xl border-b-2 border-cyan-100/50 pb-2 mb-6" {...props} />,
                                h2: ({ node, ...props }: any) => <h2 className="text-slate-850 dark:text-neutral-200 font-bold text-xl md:text-3xl mt-6 mb-3" {...props} />,
                                h3: ({ node, ...props }: any) => <h3 className="text-slate-750 dark:text-neutral-300 font-semibold text-lg md:text-2xl mt-4 mb-2" {...props} />,
                                li: ({ node, ...props }: any) => <li className="text-slate-650 dark:text-neutral-400 my-1 md:my-2 list-disc pl-1 text-base md:text-xl" {...props} />,
                                p: ({ node, ...props }: any) => <p className="text-slate-650 dark:text-neutral-400 mb-4 text-base md:text-xl" {...props} />,
                                strong: ({ node, ...props }: any) => <strong className="text-slate-900 dark:text-neutral-100 font-bold text-base md:text-xl" {...props} />,
                            }}
                        >
                            {displayedBoardText}
                        </ReactMarkdown>
                    </article>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
                        <Pencil className="w-10 h-10 text-slate-400 dark:text-neutral-600 stroke-[1.5] animate-bounce" />
                        <div>
                            <h3 className="text-slate-400 dark:text-neutral-500 font-bold text-lg">Quadro em Branco</h3>
                            <p className="text-slate-400 dark:text-neutral-500 text-xs mt-1 max-w-xs mx-auto">
                                O resumo das ideias e cálculos será escrito aqui dinamicamente sempre que fizer uma pergunta ao explicador no chat lateral.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}   