import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Bot,
  Clipboard,
  FileText,
  LayoutTemplate,
  Loader2,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Square,
  Link,
  X,
} from "lucide-react";
import PencilModal from "./PencilModal";
import { useRef, useState } from "react";
import { toast } from "sonner";

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

const TEMPLATES = [
  { id: "explain", label: "Explica este conceito", text: "@explicador explica-me este conceito:" },
  { id: "summarize", label: "Resume o texto", text: "@explicador faz um resumo disto:" },
  { id: "exercises", label: "Gera exercícios", text: "@explicador gera exercícios sobre:" },
  { id: "mindmap", label: "Cria um mapa mental", text: "@explicador cria um mapa mental sobre:" },
];

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
    pencilCooldownTimeLeft,
  }: MessageInputProps) {

  const [pencilModalOpen, setPencilModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setMessage(e.target.value);
    e.target.style.height = "auto";
    const maxHeight = 24 * 4;
    e.target.style.height =
      Math.min(e.target.scrollHeight, maxHeight) + "px";
  };

  const handleImportUrl = () => {
    const url = window.prompt("Insere o URL que queres analisar:");
    if (url?.trim()) {
      const texto = `@explicador analisa este URL: ${url.trim()}`;
      setMessage(message ? `${message}\n\n${texto}` : texto);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const ext = type.split("/")[1] || "png";
            const file = new File([blob], `clipboard-image.${ext}`, { type });
            const reader = new FileReader();
            reader.onload = () => {
              setSelectedFile({
                name: file.name,
                mime_type: file.type,
                base64: reader.result as string,
                size: file.size,
              });
            };
            reader.onerror = () => toast.error("Erro ao ler a imagem da área de transferência.");
            reader.readAsDataURL(file);
            return;
          }
        }
      }
      const text = await navigator.clipboard.readText();
      if (text) {
        setMessage(message ? `${message}\n${text}` : text);
      }
    } catch {
      toast.error("Não foi possível aceder à área de transferência.");
    }
  };

  const handleTemplateSelect = (templateText: string) => {
    setMessage(message ? `${message}\n\n${templateText} ` : `${templateText} `);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("O ficheiro deve ter no máximo 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        mime_type: file.type,
        base64: reader.result as string,
        size: file.size,
      });
    };
    reader.onerror = () => toast.error("Erro ao ler o ficheiro.");
    reader.readAsDataURL(file);
  };

  const filePreview = selectedFile?.base64 && selectedFile.mime_type?.startsWith("image/")
    ? selectedFile.base64
    : null;

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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="px-3 pb-2 pt-2 w-full chat-input-safe-area !pb-2 relative"
      >
        {/* ── File badges ── */}
        {selectedFile && (
          <div className="flex gap-1 mb-2 max-w-3xl mx-auto">
            <Badge
              variant="outline"
              className="group relative h-6 max-w-40 cursor-pointer overflow-hidden text-xs px-0"
            >
              <span className="flex h-full items-center gap-1.5 overflow-hidden pl-1 font-normal">
                <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                  {filePreview ? (
                    <img
                      alt={selectedFile.name}
                      src={filePreview}
                      className="h-4 w-4 rounded border object-cover"
                    />
                  ) : (
                    <FileText className="opacity-60" size={12} />
                  )}
                </span>
                <span className="truncate pr-1.5">{selectedFile.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="absolute right-1 z-10 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
              >
                <X size={12} />
              </button>
            </Badge>
          </div>
        )}

        {/* ── Container principal ── */}
        <div className="relative rounded-xl border border-slate-200/60 bg-white shadow-sm transition-all duration-200 focus-within:border-ring focus-within:ring-4 focus-within:ring-cyan-500/10 max-w-3xl mx-auto w-full p-3">
          <Textarea
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
            className="max-h-50 min-h-12 resize-none border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 leading-6"
          />

          {/* ── Toolbar inferior ── */}
          <div className="flex items-center gap-1 mt-2">
            {/* ESQUERDA: + (dropdown) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={isGenerating}
                  className="rounded-md text-slate-400 hover:text-cyan-600"
                  aria-label="Mais opções"
                >
                  <Plus size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5">
                <DropdownMenuGroup className="space-y-0.5">
                  <DropdownMenuItem
                    className="rounded-md text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={16} className="mr-2 text-muted-foreground" />
                    <span>Anexar ficheiro</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="rounded-md text-xs"
                    onClick={handleImportUrl}
                  >
                    <Link size={16} className="mr-2 text-muted-foreground" />
                    <span>Importar URL</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="rounded-md text-xs"
                    onClick={handlePasteFromClipboard}
                  >
                    <Clipboard size={16} className="mr-2 text-muted-foreground" />
                    <span>Colar área</span>
                  </DropdownMenuItem>

                  {/* Template submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="rounded-md text-xs">
                      <LayoutTemplate size={16} className="mr-2 text-muted-foreground" />
                      <span>Usar Template</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52 rounded-xl p-1.5">
                      <DropdownMenuGroup className="space-y-0.5">
                        {TEMPLATES.map((t) => (
                          <DropdownMenuItem
                            key={t.id}
                            className="rounded-md text-xs"
                            onClick={() => handleTemplateSelect(t.text)}
                          >
                            {t.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ESPAÇADOR */}
            <div className="flex-1" />

            {/* DIREITA: [✏️][🎤][🤖][🚀] */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {/* ✏️ Lápis (multi-user only) */}
              {isMultiUserRoom && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setPencilModalOpen(true)}
                  disabled={isGenerating || isRecordingAudio}
                  className={cn(
                    "rounded-md",
                    isLockHolder && "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  )}
                  title={
                    isLockHolder
                      ? "Tens o lápis"
                      : currentLock
                        ? `Lápis com ${currentLock.name}`
                        : "Pegar o lápis"
                  }
                >
                  <Pencil size={16} />
                </Button>
              )}

              {/* 🎤 Microfone */}
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleChatMic}
                disabled={isGenerating}
                className={cn(
                  "rounded-md",
                  isRecordingAudio && "text-red-500 bg-red-50 animate-pulse ring-2 ring-red-500/25"
                )}
                title={isRecordingAudio ? "Enviar gravação de voz" : "Falar com o explicador"}
              >
                {isRecordingAudio ? <Square size={16} /> : <Mic size={16} />}
              </Button>

              {/* 🤖 @Explicador (multi-user only) */}
              {isMultiUserRoom && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={handleMentionExplicador}
                  disabled={isGenerating || isRecordingAudio}
                  className="rounded-md"
                  title="Enviar ao explicador"
                >
                  <Bot size={16} />
                </Button>
              )}

              {/* 🚀 Enviar / Parar */}
              <Button
                size="icon-sm"
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
                className={cn(
                  "rounded-md",
                  isGenerating
                    ? (isMultiUserRoom && !isLockHolder
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-red-500 hover:bg-red-600 text-white")
                    : "bg-cyan-500 hover:bg-cyan-600 text-white disabled:bg-slate-200 disabled:text-slate-400"
                )}
                aria-label={isGenerating ? "Parar" : "Enviar"}
              >
                {isGenerating ? (
                  isMultiUserRoom && !isLockHolder ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <X size={16} />
                  )
                ) : (
                  <ArrowUp size={16} />
                )}
              </Button>
            </div>
          </div>

          {/* ── Drop zone overlay ── */}
          <div
            className={cn(
              "absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/90 text-slate-600 text-sm font-medium transition-opacity duration-200 pointer-events-none",
              isDragOver ? "opacity-100" : "opacity-0"
            )}
          >
            <span className="flex items-center gap-2">
              <Plus size={18} className="text-cyan-500" />
              Solte ficheiros aqui para anexar
            </span>
          </div>
        </div>

        {/* ── Hidden file input ── */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,application/pdf,text/*"
          disabled={isGenerating}
        />
      </form>
    </>
  );
}
