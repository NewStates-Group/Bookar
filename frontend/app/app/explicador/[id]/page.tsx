"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Share2,
  Bot,
  Lock,
  X,
  UserPlus
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ensureFreshSession } from "@/lib/auth-session";
import {
  mapServerMembersToParticipants,
  type ExplicadorParticipant,
} from "@/lib/explicador-presence";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LockObject {
  connection_id: string;
  name: string;
}

interface WhiteboardData {
  summary?: string;
  lock?: LockObject | null;
  show_whiteboard?: boolean;
  /** Sinal do backend: abrir o quadro nesta resposta (não força fechar). */
  open_whiteboard?: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type Participant = ExplicadorParticipant;

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

        // Dispatch event so parent layout can auto-scroll
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("chat-stream-tick"));
        }
      } else {
        clearInterval(interval);
      }
    }, 45); // Snappy, readable word streaming speed

    return () => clearInterval(interval);
  }, [content, active]);

  return <ReactMarkdown>{displayedText}</ReactMarkdown>;
}

const EXPLICADOR_MENTION = "@explicador";

function messageMentionsExplicador(text: string): boolean {
  return text.toLowerCase().includes(EXPLICADOR_MENTION);
}

function ensureExplicadorMention(text: string): string {
  if (messageMentionsExplicador(text)) return text;
  const trimmed = text.trim();
  return trimmed ? `${EXPLICADOR_MENTION} ${trimmed}` : `${EXPLICADOR_MENTION} `;
}

function formatUserChatContent(displayName: string, text: string): string {
  return `**[${displayName}]**: ${text}`;
}

function mergeWhiteboardFromServer(
  prev: WhiteboardData,
  incoming?: WhiteboardData | null
): WhiteboardData {
  if (!incoming) return prev;
  const next: WhiteboardData = {
    ...prev,
    summary: incoming.summary ?? prev.summary,
    lock: incoming.lock !== undefined ? incoming.lock : prev.lock,
  };
  if (incoming.open_whiteboard) {
    next.show_whiteboard = true;
  }
  return next;
}

export default function ExplicadorRoomPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const isMobile = useIsMobile();

  // Loading / lobby states
  const [roomReady, setRoomReady] = useState(false);
  const [lobbyStatus, setLobbyStatus] = useState("Solicitando permissão do microfone...");

  // Connection & Room states
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [whiteboardData, setWhiteboardData] = useState<WhiteboardData>({ summary: "", lock: null });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activeStreamingMessageIndex, setActiveStreamingMessageIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

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

  // WebSocket & WebRTC Refs (refs avoid stale closures in the WS handler)
  const socketRef = useRef<WebSocket | null>(null);
  const connectionIdRef = useRef<string | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const isMicMutedRef = useRef(true);
  const isOwnerRef = useRef(false);
  const participantsRef = useRef<Participant[]>([]);
  const wsMessageHandlerRef = useRef<(data: any) => void>(() => {});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const MAX_WS_RECONNECT_ATTEMPTS = 3;
  const wsReconnectAttemptsRef = useRef(0);
  const wsIntentionalCloseRef = useRef(false);
  const wsConnectGenerationRef = useRef(0);
  const wsActiveTokenRef = useRef<string | null>(null);
  const wsMountedRef = useRef(true);
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsPingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsTokenRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsTokenRefreshReconnectRef = useRef(false);
  const refreshExplicadorSocketTokenRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { isMicMutedRef.current = isMicMuted; }, [isMicMuted]);
  useEffect(() => { isOwnerRef.current = isOwner; }, [isOwner]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  const clearWsTimers = useCallback(() => {
    if (wsReconnectTimerRef.current) {
      clearTimeout(wsReconnectTimerRef.current);
      wsReconnectTimerRef.current = null;
    }
    if (wsPingTimerRef.current) {
      clearInterval(wsPingTimerRef.current);
      wsPingTimerRef.current = null;
    }
  }, []);

  const startWsPingLoop = useCallback(() => {
    if (wsPingTimerRef.current) clearInterval(wsPingTimerRef.current);
    wsPingTimerRef.current = setInterval(() => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) return;
      socketRef.current.send(
        JSON.stringify({
          type: "ping",
          token: wsActiveTokenRef.current,
        })
      );
    }, 30_000);
  }, []);

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

  const connectExplicadorSocketRef = useRef<
    (opts?: { isReconnect?: boolean }) => Promise<void>
  >(async () => {});

  const connectExplicadorSocket = useCallback(
    async (opts?: { isReconnect?: boolean }) => {
      const generation = ++wsConnectGenerationRef.current;

      const freshSession = await ensureFreshSession();
      const token =
        freshSession?.accessToken ||
        (session as { accessToken?: string } | null)?.accessToken ||
        "";
      if (!token) {
        if (!opts?.isReconnect) {
          setLobbyStatus("Sessão inválida. Inicie sessão novamente.");
        }
        return;
      }

      wsActiveTokenRef.current = token;
      clearWsTimers();

      if (socketRef.current) {
        wsIntentionalCloseRef.current = true;
        socketRef.current.close();
        socketRef.current = null;
      }

      if (!opts?.isReconnect) {
        setLobbyStatus("Conectando à sala...");
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const wsUrl = `${apiUrl.replace(/^http/, "ws")}/ws/explicador/${roomId}/?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      wsIntentionalCloseRef.current = false;

      socket.onopen = () => {
        if (!wsMountedRef.current || generation !== wsConnectGenerationRef.current) return;
        wsReconnectAttemptsRef.current = 0;
        setIsConnected(true);
        startWsPingLoop();
        socket.send(JSON.stringify({ type: "request_presence" }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          wsMessageHandlerRef.current(data);
        } catch (err) {
          console.error("Error parsing websocket message", err);
        }
      };

      socket.onclose = () => {
        if (generation !== wsConnectGenerationRef.current) return;
        clearWsTimers();
        setIsConnected(false);
        socketRef.current = null;
        closeAllPeerConnections();

        if (!wsMountedRef.current || wsIntentionalCloseRef.current) return;

        if (wsTokenRefreshReconnectRef.current) {
          wsTokenRefreshReconnectRef.current = false;
          wsReconnectAttemptsRef.current = 0;
          void connectExplicadorSocketRef.current({ isReconnect: true });
          return;
        }

        if (wsReconnectAttemptsRef.current >= MAX_WS_RECONNECT_ATTEMPTS) {
          setRoomReady(false);
          setLobbyStatus("Não foi possível reconectar. Recarregue a página.");
          toast.error("Ligação perdida após 3 tentativas.");
          return;
        }

        wsReconnectAttemptsRef.current += 1;
        const delayMs =
          [1000, 2000, 4000][wsReconnectAttemptsRef.current - 1] ?? 4000;
        setLobbyStatus(
          `Reconectando (${wsReconnectAttemptsRef.current}/${MAX_WS_RECONNECT_ATTEMPTS})...`
        );
        wsReconnectTimerRef.current = setTimeout(() => {
          if (wsMountedRef.current && generation === wsConnectGenerationRef.current) {
            void connectExplicadorSocketRef.current({ isReconnect: true });
          }
        }, delayMs);
      };

      socket.onerror = () => {
        socket.close();
      };
    },
    [roomId, session, clearWsTimers, startWsPingLoop]
  );

  connectExplicadorSocketRef.current = connectExplicadorSocket;

  const refreshExplicadorSocketToken = useCallback(async () => {
    const fresh = await ensureFreshSession();
    const newToken = fresh?.accessToken;
    if (!newToken || newToken === wsActiveTokenRef.current) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: "refresh_token", token: newToken })
      );
      wsActiveTokenRef.current = newToken;
      return;
    }
    wsTokenRefreshReconnectRef.current = true;
    wsReconnectAttemptsRef.current = 0;
    wsIntentionalCloseRef.current = false;
    socketRef.current?.close();
  }, []);

  refreshExplicadorSocketTokenRef.current = refreshExplicadorSocketToken;

  // 1. Request mic permission first, then establish WebSocket
  useEffect(() => {
    if (status === "loading") return;
    wsMountedRef.current = true;
    wsReconnectAttemptsRef.current = 0;
    wsIntentionalCloseRef.current = false;

    const init = async () => {
      setLobbyStatus("Solicitando permissão do microfone...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
        if (wsMountedRef.current) {
          localStreamRef.current = stream;
          setLocalStream(stream);
          isMicMutedRef.current = true;
          setIsMicMuted(true);
          setAudioApproved(true);
        }
      } catch (err) {
        console.warn("Mic permission denied or unavailable", err);
      }

      if (!wsMountedRef.current) return;
      await connectExplicadorSocket();
    };

    init();

    wsTokenRefreshTimerRef.current = setInterval(() => {
      void refreshExplicadorSocketToken();
    }, 10 * 60 * 1000);

    return () => {
      wsMountedRef.current = false;
      wsIntentionalCloseRef.current = true;
      wsConnectGenerationRef.current += 1;
      clearWsTimers();
      if (wsTokenRefreshTimerRef.current) {
        clearInterval(wsTokenRefreshTimerRef.current);
        wsTokenRefreshTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      closeAllPeerConnections();
    };
  }, [roomId, status, connectExplicadorSocket, refreshExplicadorSocketToken, clearWsTimers]);

  const closeAllPeerConnections = () => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  };

  // Deterministic offerer to avoid WebRTC glare when both peers unmute at once
  const shouldInitiateOffer = (myId: string, peerId: string) => myId > peerId;

  const flushPendingIceCandidates = async (peerId: string, pc: RTCPeerConnection) => {
    const pending = pendingIceCandidatesRef.current.get(peerId) || [];
    pendingIceCandidatesRef.current.delete(peerId);
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error flushing ICE candidate", e);
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
      audioEl.play().catch(() => {});
    };

    peerConnectionsRef.current.set(targetId, pc);
    return pc;
  };

  const connectToPeer = async (peerId: string) => {
    const myId = connectionIdRef.current;
    if (!myId || peerId === myId) return;

    const stream = localStreamRef.current;
    if (!stream || isMicMutedRef.current) return;
    if (!shouldInitiateOffer(myId, peerId)) return;

    const existing = peerConnectionsRef.current.get(peerId);
    if (existing && (existing.connectionState === "connected" || existing.connectionState === "connecting")) {
      return;
    }
    if (existing && existing.signalingState !== "stable") {
      existing.close();
      peerConnectionsRef.current.delete(peerId);
    }

    try {
      const pc = createPeerConnection(peerId);
      stream.getTracks().forEach((track) => {
        if (!pc.getSenders().some((s) => s.track === track)) {
          pc.addTrack(track, stream);
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendWSMessage({
        type: "webrtc_signal",
        target_connection_id: peerId,
        signal: { type: "offer", sdp: offer.sdp },
      });
    } catch (err) {
      console.error(`Failed to connect to peer ${peerId}`, err);
    }
  };

  const connectToAllPeers = () => {
    participantsRef.current.forEach((p) => {
      connectToPeer(p.connectionId);
    });
  };

  const cleanupPeerConnection = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    pendingIceCandidatesRef.current.delete(peerId);
    document.getElementById(`audio-${peerId}`)?.remove();
    setActiveVoiceRequests((prev) => prev.filter((r) => r.connectionId !== peerId));
  }, []);

  /** Fonte única de verdade para quem está na sala (evita duplicados de join/leave). */
  const syncPresenceFromServer = useCallback(
    (members: unknown, selfId?: string | null) => {
      const previousIds = new Set(participantsRef.current.map((p) => p.connectionId));
      const list = mapServerMembersToParticipants(
        members as Parameters<typeof mapServerMembersToParticipants>[0],
        selfId ?? connectionIdRef.current
      );
      setParticipants(list);
      participantsRef.current = list;
      const nextIds = new Set(list.map((p) => p.connectionId));

      previousIds.forEach((id) => {
        if (!nextIds.has(id)) cleanupPeerConnection(id);
      });

      if (!isMicMutedRef.current && localStreamRef.current) {
        list.forEach((m) => void connectToPeer(m.connectionId));
      }
      return list;
    },
    [cleanupPeerConnection]
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isGenerating, activeStreamingMessageIndex]);

  useEffect(() => {
    const handleStreamTick = () => {
      chatEndRef.current?.scrollIntoView({ behavior: "auto" });
    };
    window.addEventListener("chat-stream-tick", handleStreamTick);
    return () => window.removeEventListener("chat-stream-tick", handleStreamTick);
  }, []);

  // Word-by-word marker writing effect
  useEffect(() => {
    if (!whiteboardData.summary) {
      setDisplayedBoardText("");
      return;
    }

    const targetText = whiteboardData.summary;
    const words = targetText.split(/(\s+)/); // Keep spaces and newlines
    let currentText = "";
    let index = 0;

    setDisplayedBoardText("");

    const interval = setInterval(() => {
      if (index < words.length) {
        currentText += words[index];
        setDisplayedBoardText(currentText);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 20); // Fast word/whitespace streaming

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
        connectionIdRef.current = data.connection_id;
        setIsOwner(data.is_owner);
        isOwnerRef.current = data.is_owner;
        if (data.whiteboard_data) {
          setWhiteboardData({
            ...data.whiteboard_data,
            show_whiteboard: false // Keep whiteboard closed on load to optimize responsiveness
          });
        } else {
          setWhiteboardData({ summary: "", lock: null, show_whiteboard: false });
        }
        setChatHistory(data.chat_history || []);

        // Broadcast initial audio state (mic already acquired in lobby)
        sendWSMessage({
          type: "audio_state",
          is_mic_on: false,
          is_listening: true,
        });

        // Room is now fully ready
        setRoomReady(true);

        syncPresenceFromServer(data.members, data.connection_id);

        // Auto-submit initial prompt if present in URL query params (ChatGPT onboarding)
        if (typeof window !== "undefined") {
          const searchParams = new URLSearchParams(window.location.search);
          const promptParam = searchParams.get("prompt");
          if (promptParam && (!data.chat_history || data.chat_history.length <= 1)) {
            socketRef.current?.send(JSON.stringify({ type: "grab_lock" }));
            const promptMessage = ensureExplicadorMention(promptParam);
            const displayName =
              (session?.user as { first_name?: string; last_name?: string })?.first_name
                ? `${(session?.user as { first_name?: string; last_name?: string }).first_name} ${(session?.user as { last_name?: string }).last_name || ""}`.trim()
                : session?.user?.name || "Eu";
            setChatHistory((prev) => [
              ...prev,
              { role: "user", content: formatUserChatContent(displayName, promptMessage) },
            ]);
            setIsGenerating(true);
            socketRef.current?.send(
              JSON.stringify({
                type: "chat_message",
                message: promptMessage,
              })
            );
            // Clean the query parameter from browser address bar
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, "", cleanUrl);
          }
        }
        break;

      case "presence_sync":
        syncPresenceFromServer(data.members);
        break;

      case "user_joined":
      case "user_left":
        // Ignorado: roster vem só de presence_sync (evita duplicar contagem)
        break;

      case "auth_error":
        toast.error(data.message || "Sessão expirada.");
        void refreshExplicadorSocketTokenRef.current();
        break;

      case "token_refreshed":
        sendWSMessage({ type: "request_presence" });
        break;

      case "pong":
        break;

      case "audio_state":
        setParticipants((prev) =>
          prev.map((p) =>
            p.connectionId === data.connection_id
              ? { ...p, isMicOn: data.is_mic_on, isListening: data.is_listening }
              : p
          )
        );
        break;

      case "chat_update":
        if (data.chat_history) {
          setChatHistory(data.chat_history);
          const last = data.chat_history[data.chat_history.length - 1];
          if (last?.role === "assistant" && !data.is_generating) {
            setActiveStreamingMessageIndex(null);
          }
        }
        setIsGenerating(Boolean(data.is_generating));

        if (data.whiteboard_data) {
          setWhiteboardData((prev) => mergeWhiteboardFromServer(prev, data.whiteboard_data));
        }
        break;

      case "voice_request":
        if (isOwnerRef.current) {
          toast.info(`${data.name} solicitou entrar na chamada de voz.`);
          setActiveVoiceRequests((prev) => {
            if (prev.some((r) => r.connectionId === data.sender_connection_id)) return prev;
            return [...prev, { connectionId: data.sender_connection_id, name: data.name }];
          });
        }
        break;

      case "voice_response":
        if (data.target_connection_id === connectionIdRef.current) {
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
        if (data.target_connection_id === connectionIdRef.current) {
          await handleWebRTCSignal(data.sender_connection_id, data.signal);
        }
        break;

      case "error":
        toast.error(data.message);
        break;
    }
  };

  // WebRTC signal handling
  const handleWebRTCSignal = async (senderId: string, signal: any) => {
    let pc = peerConnectionsRef.current.get(senderId);

    if (signal.type === "offer") {
      const myId = connectionIdRef.current;
      if (myId && shouldInitiateOffer(myId, senderId) && pc?.signalingState === "have-local-offer") {
        return;
      }

      if (!pc) {
        pc = createPeerConnection(senderId);
      } else if (pc.signalingState === "have-local-offer") {
        await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(signal));

      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getAudioTracks().forEach((track) => {
            track.enabled = !isMicMutedRef.current;
          });
          localStreamRef.current = stream;
          setLocalStream(stream);
        } catch (err) {
          console.warn("Failed to capture microphone on offer", err);
        }
      }

      if (stream) {
        stream.getTracks().forEach((track) => {
          if (!pc!.getSenders().some((s) => s.track === track)) {
            pc!.addTrack(track, stream!);
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

      await flushPendingIceCandidates(senderId, pc);
    } else if (signal.type === "answer") {
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      await flushPendingIceCandidates(senderId, pc);
    } else if (signal.type === "candidate") {
      if (!pc) {
        pc = createPeerConnection(senderId);
      }
      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      } else {
        const pending = pendingIceCandidatesRef.current.get(senderId) || [];
        pending.push(signal.candidate);
        pendingIceCandidatesRef.current.set(senderId, pending);
      }
    }
  };

  const startLocalAudio = async () => {
    try {
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
      stream.getAudioTracks().forEach((track) => { track.enabled = true; });
      isMicMutedRef.current = false;
      setIsMicMuted(false);

      sendWSMessage({
        type: "audio_state",
        is_mic_on: true,
        is_listening: true,
      });

      connectToAllPeers();
      toast.success("Microfone ativado!");
    } catch (err) {
      console.error("Error accessing microphone", err);
      toast.error("Não foi possível aceder ao microfone.");
    }
  };

  const startHostAudio = async () => {
    try {
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
      stream.getAudioTracks().forEach((track) => { track.enabled = true; });
      isMicMutedRef.current = false;
      setIsMicMuted(false);
      setAudioApproved(true);

      sendWSMessage({
        type: "audio_state",
        is_mic_on: true,
        is_listening: true,
      });

      connectToAllPeers();
      toast.success("Canal de voz ativado!");
    } catch (err) {
      console.error("Error accessing microphone", err);
      toast.error("Não foi possível aceder ao microfone.");
    }
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const nextMuted = !isMicMutedRef.current;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    isMicMutedRef.current = nextMuted;
    setIsMicMuted(nextMuted);

    sendWSMessage({
      type: "audio_state",
      is_mic_on: !nextMuted,
      is_listening: true,
    });

    if (!nextMuted) {
      connectToAllPeers();
    }
  };

  // Keep WS handler ref fresh so socket.onmessage never uses a stale closure
  wsMessageHandlerRef.current = handleWebSocketMessage;

  const getDisplayName = () => {
    const u = session?.user as { first_name?: string; last_name?: string; name?: string } | undefined;
    if (u?.first_name) {
      return `${u.first_name} ${u.last_name || ""}`.trim();
    }
    return u?.name || "Eu";
  };

  // 3. Message sending (restricted to lock holder) — UI otimista
  const submitChatMessage = (rawMessage: string) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || isGenerating) return;

    const mentionsTutor = messageMentionsExplicador(trimmed);

    setChatHistory((prev) => [
      ...prev,
      { role: "user", content: formatUserChatContent(getDisplayName(), trimmed) },
    ]);
    if (mentionsTutor) {
      setIsGenerating(true);
      setActiveStreamingMessageIndex(null);
    }

    sendWSMessage({
      type: "chat_message",
      message: trimmed,
    });

    setMessage("");
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    submitChatMessage(message);
  };

  const handleMentionExplicador = () => {
    if (!isLockHolder || isGenerating) return;

    const withMention = ensureExplicadorMention(message);
    setMessage(withMention);
    submitChatMessage(withMention);
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

  // Speech-to-text for the chat input (matching landing page)
  const handleChatMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("O seu navegador não suporta reconhecimento de voz.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-PT";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMessage(transcript);
      chatInputRef.current?.focus();
    };
    recognition.onerror = () => toast.error("Erro ao capturar voz.");
    recognition.start();
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
      toast.success("Link copiado!");
    }
  };

  // Derived lock state values
  const currentLock = whiteboardData.lock;
  const isLockHolder = currentLock && currentLock.connection_id === connectionId;
  const showWhiteboard = whiteboardData.show_whiteboard === true;
  const mentionsExplicadorInInput = messageMentionsExplicador(message);

  const combinedRoster = [
    {
      connectionId: connectionId || "self",
      name: (session?.user as any)?.first_name
        ? `${(session?.user as any)?.first_name} ${(session?.user as any)?.last_name || ""}`.trim()
        : (session?.user?.name || "Eu"),
      isOwner: isOwner,
      avatar: (session?.user as any)?.avatar || null,
      isMicOn: !isMicMuted && localStream !== null,
      isListening: true,
      isSelf: true,
    },
    ...participants
      .filter((p) => p.connectionId !== connectionId && p.connectionId !== connectionIdRef.current)
      .map((p) => ({
        connectionId: p.connectionId,
        name: p.name,
        isOwner: p.isOwner,
        avatar: p.avatar || null,
        isMicOn: p.isMicOn || false,
        isListening: p.isListening !== false,
        isSelf: false,
      })),
  ];

  // ── Loading / Lobby Screen ──
  if (!roomReady) {
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

  return (
    <div
      ref={splitContainerRef}
      onPointerMove={handleSplitterPointerMove}
      className="flex h-[calc(100vh-56px)] md:h-screen w-full overflow-hidden bg-slate-50 text-slate-800 relative select-none"
    >
      <style>{`
        .font-handwriting {
          font-family: 'Architects Daughter', 'Caveat', cursive, sans-serif;
        }
        .blackboard-grid {
          background-image: radial-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .message-bubble-animate {
          animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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
        style={{ width: isMobile ? (showWhiteboard ? "0%" : "100%") : (showWhiteboard ? `${splitPct}%` : "100%") }}
        className={`bg-white flex flex-col shrink-0 h-full select-text transition-[width] duration-500 ease-in-out ${showWhiteboard ? (isMobile ? "hidden" : "border-r border-slate-200") : ""
          }`}
      >
        {/* Header section with connection status */}
        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-white select-none">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-600" />
              Explicador
            </span>
            {combinedRoster.length >= 1 ? (
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
            <div>
              {!currentLock ? (
                <div onClick={grabLock} className="cursor-pointer gap-1 flex items-center justify-between text-xs px-1 text-slate-800">
                  <Pencil className="w-3.5 h-3.5 text-slate-800" />
                  <span className="hidden sm:block flex items-center gap-1.5 font-medium">
                    Lápis livre
                  </span>
                </div>
              ) : isLockHolder ? (
                <div onClick={releaseLock} className="flex items-center gap-1 justify-between text-xs px-1 text-cyan-600">
                  <Lock className="w-3.5 h-3.5 text-cyan-600" />
                  <span className="hidden sm:block flex items-center gap-1.5 font-semibold">
                    Tens o lápis!
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-1 text-xs px-1 text-slate-800">
                  <Lock className="w-3.5 h-3.5 text-slate-350" />
                  <span className="hidden sm:block flex items-center gap-1.5 font-medium truncate pr-2">
                    Lápiz com: <strong>{currentLock.name}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Share room link */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleShareRoom}
              className="hover:bg-transparent! h-8 shadow-none border-none rounded-full text-xs flex items-center"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Convidar</span>
            </Button>

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
          </div>

        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-slate-50/30 scrollbar-thin">
          <div className="max-w-3xl mx-auto w-full space-y-4">
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col message-bubble-animate ${msg.role === "user"
                  ? "max-w-[85%] ml-auto items-end"
                  : "w-full"
                  }`}
              >
                {/* <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1 px-1">
                  {msg.role !== "user" && (
                    <div className="flex items-center justify-start gap-1.5">
                      <Bot className="w-4 h-4 text-slate-600" />
                      Explicador
                    </div>
                  )}
                </span> */}
                <div
                  className={`p-3.5 rounded-2xl text-base leading-relaxed ${msg.role === "user"
                    ? "bg-cyan-500 text-white rounded-tr-none shadow-sm shadow-cyan-500/10"
                    : "text-slate-700"
                    }`}
                >
                  <div className="prose prose-slate max-w-none text-xs leading-relaxed">
                    {msg.role === "assistant" ? (
                      <StreamingMessage
                        content={msg.content}
                        active={activeStreamingMessageIndex === i}
                      />
                    ) : (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    )}
                  </div>

                  {msg.role === "assistant" &&
                    whiteboardData.summary &&
                    !showWhiteboard &&
                    !isGenerating &&
                    i === chatHistory.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setWhiteboardData((prev) => ({ ...prev, show_whiteboard: true }))}
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
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Explicador
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 rounded-tl-sm flex items-center gap-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: "240ms" }} />
                  </div>
                  <span className="text-sm text-slate-600 font-medium">A pensar...</span>
                </div>
              </div>
            )}
          </div>
          <div ref={chatEndRef} />
        </div>

        {/* Message Input — pill style matching the landing page */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 max-w-3xl mx-auto w-full"
        >
          <div className="flex items-center gap-2 bg-white border border-slate-200 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-500/10 rounded-full px-4 py-1.5 shadow-sm transition-all duration-300">
            <input
              ref={chatInputRef}
              placeholder={
                isLockHolder
                  ? "Escreve no chat... usa @explicador para o tutor responder"
                  : currentLock
                    ? `${currentLock.name} está a escrever...`
                    : "Pegue o Lápis acima para escrever..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!isLockHolder || isGenerating}
              className="flex-1 h-10 bg-transparent text-slate-800 placeholder:text-slate-400 text-sm px-1 outline-none border-0 focus:ring-0 disabled:text-slate-400"
            />

            {/* Mic button */}
            <button
              type="button"
              onClick={handleChatMic}
              disabled={!isLockHolder || isGenerating}
              title="Falar"
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 disabled:opacity-40 transition-all duration-200 flex-shrink-0 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleMentionExplicador}
              disabled={!isLockHolder || isGenerating}
              title="Mencionar @explicador e pedir resposta"
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 flex-shrink-0 cursor-pointer disabled:opacity-40 ${
                mentionsExplicadorInInput
                  ? "bg-cyan-100 text-cyan-700 ring-2 ring-cyan-300/60"
                  : "text-slate-400 hover:text-cyan-600 hover:bg-cyan-50"
              }`}
            >
              <Bot className="w-4 h-4" />
            </button>

            {/* Send button */}
            <Button
              type="submit"
              disabled={!isLockHolder || !message.trim() || isGenerating}
              className="w-8 h-8 p-0 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full flex items-center justify-center shadow-sm shadow-cyan-500/20 transition-all duration-200 flex-shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Draggable Vertical Splitter */}
      {showWhiteboard && !isMobile && (
        <div
          onPointerDown={handleSplitterPointerDown}
          onPointerUp={handleSplitterPointerUp}
          className="w-1.5 hover:w-2 bg-slate-200 hover:bg-cyan-500 cursor-col-resize transition-all shrink-0 z-40 relative h-full flex items-center justify-center group"
        >
          <div className="w-0.5 h-8 rounded-full bg-slate-400 group-hover:bg-white" />
        </div>
      )}

      {/* RIGHT WORKSPACE: Dotted Whiteboard Summary Panel */}
      {showWhiteboard && (
        <div className={`flex-1 h-full bg-[#fafafa] flex flex-col justify-start relative overflow-hidden select-text animate-in fade-in slide-in-from-right duration-500 ${isMobile ? "p-4 w-full absolute inset-0 z-50" : "p-6 md:p-10"
          }`}>

          {/* Header of the Board */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200/60 shrink-0">
            <div className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-cyan-600" />
              <h2 className="text-sm font-bold text-slate-700 tracking-wide">
                Quadro
              </h2>
            </div>

            <div className="flex items-center gap-3">

              {/* Active Streaming Indicator */}
              {isGenerating && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 px-3 py-1 rounded-full text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
                  <span className="text-cyan-600">A pensar...</span>
                </div>
              )}

              {/* Close whiteboard panel */}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setWhiteboardData((prev) => ({ ...prev, show_whiteboard: false }))}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Fechar Quadro"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Dotted blackboard writing sheet */}
          <div className="flex-1 blackboard-grid overflow-y-auto font-handwriting text-slate-700 relative leading-relaxed scrollbar-thin">
            {displayedBoardText ? (
              <article className="prose max-w-none prose-slate font-handwriting prose-headings:font-handwriting prose-strong:font-handwriting text-slate-700 text-lg md:text-2xl leading-loose">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }: any) => <h1 className="text-cyan-600 font-bold text-2xl md:text-4xl border-b-2 border-cyan-100/50 pb-2 mb-6" {...props} />,
                    h2: ({ node, ...props }: any) => <h2 className="text-slate-850 font-bold text-xl md:text-3xl mt-6 mb-3" {...props} />,
                    h3: ({ node, ...props }: any) => <h3 className="text-slate-750 font-semibold text-lg md:text-2xl mt-4 mb-2" {...props} />,
                    li: ({ node, ...props }: any) => <li className="text-slate-650 my-1 md:my-2 list-disc pl-1 text-base md:text-xl" {...props} />,
                    p: ({ node, ...props }: any) => <p className="text-slate-650 mb-4 text-base md:text-xl" {...props} />,
                    strong: ({ node, ...props }: any) => <strong className="text-slate-900 font-bold text-base md:text-xl" {...props} />,
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

          {/* Local voice stream indicators
          {localStream && (
            <div className="absolute top-12 left-12 z-20 bg-white border border-emerald-300 px-3.5 py-2 rounded-full shadow-md flex items-center gap-2 text-slate-700 font-medium text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {isMicMuted ? "Modo Ouvinte (Silenciado)" : "Chamada Ativa (Fala)"}
              </span>
            </div>
          )} */}
        </div>
      )}
      {/* Roster / Participants Modal */}
      <Dialog open={showParticipantsModal} onOpenChange={setShowParticipantsModal}>
        <DialogContent className="sm:max-w-md border-slate-200 bg-white text-slate-800 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <Users className="w-5 h-5 text-cyan-600" />
              Pessoas na Sala
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 mt-4">
            {combinedRoster.map((member) => (
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
                  {/* Mic status */}
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
                      <Volume2 className="w-3.5 h-3.5 text-cyan-600 animate-pulse" title="A ouvir" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-slate-350" title="Sem áudio" />
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
    </div>
  );
}
