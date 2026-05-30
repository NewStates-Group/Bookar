"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Send,
  Mic,
  MicOff,
  Users,
  Check,
  Volume2,
  ArrowLeft,
  Pencil,
  Sparkles,
  PenTool,
  Share2
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface LockObject {
  connection_id: string;
  name: string;
}

interface WhiteboardData {
  summary?: string;
  lock?: LockObject | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Participant {
  connectionId: string;
  name: string;
  isOwner: boolean;
  hasAudio: boolean;
}

export default function ExplicadorRoomPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;

  // Connection & Room states
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [whiteboardData, setWhiteboardData] = useState<WhiteboardData>({ summary: "", lock: null });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Splitter Resizing states
  const [splitPct, setSplitPct] = useState<number>(35); // Left chat starts at 35%
  const isSplitting = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Real-time Handwriting Streaming state
  const [displayedBoardText, setDisplayedBoardText] = useState("");

  // Input fields
  const [message, setMessage] = useState("");

  // WebRTC Audio States
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [audioApproved, setAudioApproved] = useState(false);
  const [audioRequestPending, setAudioRequestPending] = useState(false);
  const [activeVoiceRequests, setActiveVoiceRequests] = useState<{ connectionId: string; name: string }[]>([]);

  // WebSocket Ref
  const socketRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load Handwriting Font
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Caveat:wght@400;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  // 1. Establish WebSocket Connection
  useEffect(() => {
    if (status === "loading") return;

    const token = session?.accessToken || "";
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const wsUrl = `${apiUrl.replace(/^http/, "ws")}/ws/explicador/${roomId}/?token=${token}`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        console.error("Error parsing websocket message", err);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      toast.error("Ligação perdida. Tentando reconectar...");
      closeAllPeerConnections();
    };

    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      closeAllPeerConnections();
    };
  }, [roomId, session?.accessToken, status]);

  const closeAllPeerConnections = () => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isGenerating]);

  // Character-by-character marker writing effect
  useEffect(() => {
    if (!whiteboardData.summary) {
      setDisplayedBoardText("");
      return;
    }

    const targetText = whiteboardData.summary;
    let currentText = "";
    let index = 0;

    setDisplayedBoardText("");

    const interval = setInterval(() => {
      if (index < targetText.length) {
        currentText += targetText[index];
        setDisplayedBoardText(currentText);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 6); // Snappy, visually organic handwriting stream

    return () => clearInterval(interval);
  }, [whiteboardData.summary]);

  const sendWSMessage = (payload: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  };

  // 2. Handle Incoming WebSocket events
  const handleWebSocketMessage = async (data: any) => {
    switch (data.type) {
      case "welcome":
        setConnectionId(data.connection_id);
        setIsOwner(data.is_owner);
        setWhiteboardData(data.whiteboard_data || { summary: "", lock: null });
        setChatHistory(data.chat_history || []);

        // Auto-submit initial prompt if present in URL query params (ChatGPT onboarding)
        if (typeof window !== "undefined") {
          const searchParams = new URLSearchParams(window.location.search);
          const promptParam = searchParams.get("prompt");
          if (promptParam && (!data.chat_history || data.chat_history.length <= 1)) {
            // Send grab_lock first to hold the chalk
            socketRef.current?.send(JSON.stringify({ type: "grab_lock" }));
            // Send the prompt message
            socketRef.current?.send(
              JSON.stringify({
                type: "chat_message",
                message: promptParam,
              })
            );
            // Clean the query parameter from browser address bar
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, "", cleanUrl);
          }
        }
        break;

      case "user_joined":
        setParticipants((prev) => {
          if (prev.some((p) => p.connectionId === data.connection_id)) return prev;
          return [
            ...prev,
            {
              connectionId: data.connection_id,
              name: data.name,
              isOwner: data.is_owner,
              hasAudio: false,
            },
          ];
        });
        break;

      case "user_left":
        setParticipants((prev) => prev.filter((p) => p.connectionId !== data.connection_id));
        if (peerConnectionsRef.current.has(data.connection_id)) {
          peerConnectionsRef.current.get(data.connection_id)?.close();
          peerConnectionsRef.current.delete(data.connection_id);
          const el = document.getElementById(`audio-${data.connection_id}`);
          el?.remove();
        }
        setActiveVoiceRequests((prev) => prev.filter((r) => r.connectionId !== data.connection_id));
        break;

      case "chat_update":
        if (data.chat_history) setChatHistory(data.chat_history);
        if (data.whiteboard_data) setWhiteboardData(data.whiteboard_data);
        setIsGenerating(data.is_generating || false);
        break;

      case "voice_request":
        if (isOwner) {
          toast.info(`${data.name} solicitou entrar na chamada de voz.`);
          setActiveVoiceRequests((prev) => {
            if (prev.some((r) => r.connectionId === data.sender_connection_id)) return prev;
            return [...prev, { connectionId: data.sender_connection_id, name: data.name }];
          });
        }
        break;

      case "voice_response":
        if (data.target_connection_id === connectionId) {
          setAudioRequestPending(false);
          if (data.allowed) {
            setAudioApproved(true);
            toast.success("O anfitrião permitiu o seu áudio! Iniciando chamada...");
            await startLocalAudio();
          } else {
            toast.error("O anfitrião recusou a sua solicitação de voz.");
          }
        }
        break;

      case "webrtc_signal":
        if (data.target_connection_id === connectionId) {
          await handleWebRTCSignal(data.sender_connection_id, data.signal);
        }
        break;

      case "error":
        toast.error(data.message);
        break;
    }
  };

  // WebRTC
  const handleWebRTCSignal = async (senderId: string, signal: any) => {
    let pc = peerConnectionsRef.current.get(senderId);

    if (!pc) {
      pc = createPeerConnection(senderId);
    }

    if (signal.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      
      let stream = localStream;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setLocalStream(stream);
        } catch (err) {
          console.warn("Failed to capture microphone on offer", err);
        }
      }

      if (stream) {
        const senders = pc.getSenders();
        stream.getTracks().forEach((track) => {
          if (!senders.some((s) => s.track === track)) {
            pc.addTrack(track, stream);
          }
        });
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWSMessage({
        type: "webrtc_signal",
        target_connection_id: senderId,
        signal: { type: "answer", sdp: answer.sdp },
      });

    } else if (signal.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (signal.type === "candidate") {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch (e) {
        console.error("Error adding received ice candidate", e);
      }
    }
  };

  const createPeerConnection = (targetId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWSMessage({
          type: "webrtc_signal",
          target_connection_id: targetId,
          signal: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      let audioEl = document.getElementById(`audio-${targetId}`) as HTMLAudioElement;
      
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.id = `audio-${targetId}`;
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
      }
      
      audioEl.srcObject = remoteStream;
    };

    peerConnectionsRef.current.set(targetId, pc);
    return pc;
  };

  const startLocalAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      const host = participants.find((p) => p.isOwner) || { connectionId: "host" };
      const pc = createPeerConnection(host.connectionId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      sendWSMessage({
        type: "webrtc_signal",
        target_connection_id: host.connectionId,
        signal: { type: "offer", sdp: offer.sdp },
      });
      
      toast.success("Microfone ativado!");
    } catch (err) {
      console.error("Error accessing microphone", err);
      toast.error("Não foi possível aceder ao microfone.");
    }
  };

  const startHostAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      setAudioApproved(true);
      toast.success("Canal de voz ativado!");
    } catch (err) {
      console.error("Error accessing microphone", err);
      toast.error("Não foi possível aceder ao microfone.");
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(!isMicMuted);
    }
  };

  // 3. Message sending (restricted to lock holder)
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isGenerating) return;

    sendWSMessage({
      type: "chat_message",
      message: message,
    });

    setMessage("");
  };

  // Draggable Splitter Pointer Events
  const handleSplitterPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isSplitting.current = true;
    e.preventDefault();
  };

  const handleSplitterPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSplitting.current) return;
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
    // Clamp left panel between 20% and 60%
    setSplitPct(Math.min(60, Math.max(20, rawPct)));
  };

  const handleSplitterPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    isSplitting.current = false;
  };

  // Voice permission helpers
  const requestVoice = () => {
    if (audioRequestPending) return;
    setAudioRequestPending(true);
    sendWSMessage({
      type: "voice_request",
      name: session?.user?.name || "Visitante",
    });
    toast.info("Solicitação de voz enviada para o anfitrião.");
  };

  const handleVoiceDecision = (reqId: string, allowed: boolean) => {
    sendWSMessage({
      type: "voice_response",
      target_connection_id: reqId,
      allowed: allowed,
    });
    setActiveVoiceRequests((prev) => prev.filter((r) => r.connectionId !== reqId));

    if (allowed && !localStream) {
      startHostAudio();
    }
  };

  // Chalk Lock action triggers
  const grabLock = () => {
    sendWSMessage({ type: "grab_lock" });
  };

  const releaseLock = () => {
    sendWSMessage({ type: "release_lock" });
  };

  const handleShareRoom = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link da sala copiado! Envie aos seus colegas para assistirem em tempo real.");
    }
  };

  // Derived lock state values
  const currentLock = whiteboardData.lock;
  const isLockHolder = currentLock && currentLock.connection_id === connectionId;

  return (
    <div
      ref={splitContainerRef}
      onPointerMove={handleSplitterPointerMove}
      className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50 text-slate-800 relative select-none"
    >
      <style>{`
        .font-handwriting {
          font-family: 'Architects Daughter', 'Caveat', cursive, sans-serif;
        }
        .blackboard-grid {
          background-image: radial-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>

      {/* Pop-up Voice Request Notification for Host */}
      {isOwner && activeVoiceRequests.length > 0 && (
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
      )}

      {/* LEFT SIDEBAR: Chat History */}
      <div
        style={{ width: `${splitPct}%` }}
        className="border-r border-slate-200 bg-white flex flex-col shrink-0 h-full select-text"
      >
        {/* Header section with back button & connection status */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/app/explicador")}
              className="rounded-full w-8 h-8 text-slate-500 hover:text-slate-850 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Sala Ativa</span>
              <span className="text-sm font-bold text-slate-855 flex items-center gap-1.5">
                Explicador AI
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                <span className="text-xs font-normal text-slate-400">({participants.length + 1} online)</span>
              </span>
            </div>
          </div>
          
          {/* Voice status controls */}
          <div className="flex items-center gap-1.5">
            {isOwner ? (
              <Button
                size="sm"
                variant={audioApproved ? "secondary" : "ghost"}
                onClick={audioApproved ? toggleMute : startHostAudio}
                className={`rounded-full h-8 px-3 gap-1.5 text-xs ${
                  audioApproved 
                    ? isMicMuted 
                      ? "bg-red-500/10 text-red-650 border border-red-200 hover:bg-red-500/20" 
                      : "bg-emerald-500/10 text-emerald-655 border border-emerald-200 hover:bg-emerald-500/20"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {audioApproved ? (
                  isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 animate-pulse" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
                {audioApproved ? (isMicMuted ? "Silenciado" : "Voz Ativa") : "Ativar Voz"}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={requestVoice}
                disabled={audioApproved || audioRequestPending}
                className={`rounded-full h-8 px-3 gap-1.5 text-xs ${
                  audioApproved
                    ? isMicMuted 
                      ? "bg-red-500/10 text-red-650 border border-red-200"
                      : "bg-emerald-500/10 text-emerald-650 border border-emerald-200"
                    : audioRequestPending
                      ? "bg-slate-100 text-slate-400 border border-slate-200"
                      : "bg-cyan-500 hover:bg-cyan-600 text-white shadow-sm"
                }`}
              >
                {audioApproved ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
                {audioApproved ? "Voz Conectada" : audioRequestPending ? "Pendente..." : "Pedir Voz"}
              </Button>
            )}
            
            {audioApproved && !isOwner && (
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleMute}
                className="rounded-full w-8 h-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-500" />}
              </Button>
            )}
          </div>
        </div>

        {/* Chalk/Lock status banner */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/30">
          {!currentLock ? (
            <div className="flex items-center justify-between text-xs px-1 text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <Pencil className="w-3.5 h-3.5 text-slate-400" />
                Giz livre
              </span>
              <Button
                size="sm"
                onClick={grabLock}
                className="h-7 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-3 text-[10px] font-bold shadow-sm shadow-cyan-500/10"
              >
                Escrever
              </Button>
            </div>
          ) : isLockHolder ? (
            <div className="flex items-center justify-between text-xs px-1 text-cyan-600">
              <span className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
                Tens o Giz!
              </span>
              <Button
                size="sm"
                onClick={releaseLock}
                className="h-7 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full px-3 text-[10px] font-bold"
              >
                Largar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs px-1 text-slate-400">
              <span className="flex items-center gap-1.5 font-medium truncate pr-2">
                <Pencil className="w-3.5 h-3.5 text-slate-350" />
                Giz com: <strong>{currentLock.name}</strong>
              </span>
              <Button
                size="sm"
                disabled
                className="h-7 bg-slate-50 text-slate-300 border border-slate-100 rounded-full px-3 text-[10px] font-bold cursor-not-allowed"
              >
                Ocupado
              </Button>
            </div>
          )}
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-slate-50/30 scrollbar-thin">
          {chatHistory.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col max-w-[85%] ${
                msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1 px-1">
                {msg.role === "user" ? "Remetente" : "Explicador AI"}
              </span>
              <div
                className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-cyan-500 text-white rounded-tr-none shadow-sm shadow-cyan-500/10"
                    : "bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm"
                }`}
              >
                <div className="prose prose-slate max-w-none text-xs leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex flex-col items-start max-w-[85%] mr-auto">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1 px-1">
                Explicador AI
              </span>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 rounded-tl-none flex items-center gap-3 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                <span className="text-xs text-slate-500 font-medium">Escrevendo e atualizando o quadro...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Message Input (lock holder only) */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              placeholder={
                isLockHolder 
                  ? "Pergunte ao explicador..." 
                  : currentLock 
                    ? `${currentLock.name} está a escrever...` 
                    : "Pegue o Giz acima para escrever..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!isLockHolder || isGenerating}
              className="h-11 bg-white border-slate-200 text-sm focus-visible:border-cyan-500 text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-450"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!isLockHolder || !message.trim() || isGenerating}
              className="h-11 w-11 bg-cyan-500 hover:bg-cyan-600 text-white shrink-0 rounded-lg shadow-sm shadow-cyan-500/10"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Draggable Vertical Splitter */}
      <div
        onPointerDown={handleSplitterPointerDown}
        onPointerUp={handleSplitterPointerUp}
        className="w-1.5 hover:w-2 bg-slate-200 hover:bg-cyan-500 cursor-col-resize transition-all shrink-0 z-40 relative h-full flex items-center justify-center group"
      >
        <div className="w-0.5 h-8 rounded-full bg-slate-400 group-hover:bg-white" />
      </div>

      {/* RIGHT WORKSPACE: Dotted Whiteboard Summary Panel */}
      <div className="flex-1 h-full bg-[#fafafa] flex flex-col justify-start relative overflow-hidden p-6 md:p-10 select-text">
        
        {/* Header of the Board */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200/60 shrink-0">
          <div className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-cyan-600" />
            <h2 className="text-sm font-bold text-slate-700 tracking-wide">
              Quadro de Resumo & Fórmulas
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Partilhar button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleShareRoom}
              className="h-8 rounded-full border-cyan-100 text-cyan-600 hover:bg-cyan-50/50 hover:text-cyan-700 text-xs font-semibold gap-1.5 flex items-center shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              Partilhar Aula
            </Button>

            {/* Active Streaming Indicator */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 px-3 py-1 rounded-full text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              {isGenerating ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
                  <span className="text-cyan-600">Escrevendo...</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Quadro Atualizado</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dotted blackboard writing sheet */}
        <div className="flex-1 blackboard-grid overflow-y-auto font-handwriting text-slate-700 relative leading-relaxed scrollbar-thin">
          {displayedBoardText ? (
            <article className="prose max-w-none prose-slate font-handwriting prose-headings:font-handwriting prose-strong:font-handwriting text-slate-700 text-2xl md:text-3xl leading-loose">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }: any) => <h1 className="text-cyan-600 font-bold text-4xl md:text-5xl border-b-2 border-cyan-100/50 pb-3 mb-8" {...props} />,
                  h2: ({ node, ...props }: any) => <h2 className="text-slate-850 font-bold text-3xl md:text-4xl mt-8 mb-4" {...props} />,
                  h3: ({ node, ...props }: any) => <h3 className="text-slate-750 font-semibold text-2xl md:text-3xl mt-6 mb-3" {...props} />,
                  li: ({ node, ...props }: any) => <li className="text-slate-650 my-2 md:my-3 list-disc pl-1 text-xl md:text-2xl" {...props} />,
                  p: ({ node, ...props }: any) => <p className="text-slate-650 mb-6 text-xl md:text-2xl" {...props} />,
                  strong: ({ node, ...props }: any) => <strong className="text-slate-900 font-bold text-xl md:text-2xl" {...props} />,
                }}
              >
                {displayedBoardText}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <Pencil className="w-10 h-10 text-slate-350 stroke-[1.5] animate-bounce" />
              <div>
                <h3 className="text-slate-400 font-bold text-lg">Quadro em Branco</h3>
                <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                  O resumo das ideias e cálculos será escrito aqui dinamicamente sempre que fizer uma pergunta ao explicador no chat lateral.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Local voice stream indicators */}
        {localStream && (
          <div className="absolute top-12 left-12 z-20 bg-white border border-emerald-300 px-3.5 py-2 rounded-full shadow-md flex items-center gap-2 text-slate-700 font-medium text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {isMicMuted ? "Modo Ouvinte (Silenciado)" : "Chamada Ativa (Fala)"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
