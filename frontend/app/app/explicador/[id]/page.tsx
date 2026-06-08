"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ensureFreshSession } from "@/lib/auth-session";
import {
  useWebRTC,
  useParticipants,
  useSignaling,
} from "@/components/explicador/webrtc";
import LoadingRoom from "@/components/explicador/LoadingRoom";
import Header from "@/components/explicador/Header";
import MessageList from "@/components/explicador/MessageList";
import { ChatMessage, Participant, WhiteboardData } from "@/components/explicador/webrtc/types/general";
import MessageInput from "@/components/explicador/MessageInput";
import Participants from "@/components/explicador/Participants";
import Whiteboard from "@/components/explicador/Whiteboard";
import VoiceRequest from "@/components/explicador/VoiceRequest";
import PencilRequests from "@/components/explicador/PencilRequests";

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

/** Atualiza conteúdo do quadro; nunca fecha — só o utilizador fecha. */
function mergeWhiteboardFromServer(
  prev: WhiteboardData,
  incoming?: WhiteboardData | null
): WhiteboardData {
  if (!incoming) return prev;
  return {
    ...prev,
    summary: incoming.summary ?? prev.summary,
    lock: incoming.lock !== undefined ? incoming.lock : prev.lock,
  };
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
  const chatHistoryRef = useRef<ChatMessage[]>([]);
  useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);
  const [activeStreamingMessageIndex, setActiveStreamingMessageIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  // Pencil request limit and cooldown states
  const [pencilRequestsCount, setPencilRequestsCount] = useState(0);
  const [pencilCooldownActive, setPencilCooldownActive] = useState(false);
  const [pencilCooldownTimeLeft, setPencilCooldownTimeLeft] = useState(0);

  useEffect(() => {
    if (!pencilCooldownActive) return;
    const interval = setInterval(() => {
      setPencilCooldownTimeLeft((prev) => {
        if (prev <= 1) {
          setPencilCooldownActive(false);
          setPencilRequestsCount(0);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pencilCooldownActive]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, [roomId]);

  // Splitter Resizing states
  const [splitPct, setSplitPct] = useState<number>(35); // Left chat starts at 35%
  const isSplitting = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic viewport height — only uses visualViewport.height when the keyboard is open
  // (large drop >150px). Prevents layout jumps when the mobile address bar hides/shows.
  const [viewportHeight, setViewportHeight] = useState<string>("100svh");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    let previousHeight = window.innerHeight;

    const updateHeight = () => {
      if (!vv) return;
      const svh = window.innerHeight;
      const diff = svh - vv.height;
      if (diff > 150) {
        // Keyboard is open — use visual viewport height
        setViewportHeight(`${vv.height}px`);
      } else {
        // Keyboard is closed — use stable svh
        setViewportHeight("100svh");
      }
      previousHeight = svh;
    };

    const preventScroll = () => {
      // Reset any Safari offset when the keyboard pushes the viewport
      if (vv && vv.offsetTop > 0) {
        window.scrollTo(0, 0);
      }
    };

    if (vv) {
      vv.addEventListener("resize", updateHeight);
      vv.addEventListener("scroll", preventScroll);
    }
    window.addEventListener("resize", updateHeight);

    updateHeight();

    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateHeight);
        vv.removeEventListener("scroll", preventScroll);
      }
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  // Real-time Handwriting Streaming state
  const [displayedBoardText, setDisplayedBoardText] = useState("");

  // Input fields
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    mime_type: string;
    base64: string;
    size: number;
  } | null>(null);

  // WebRTC Audio States
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isForceMuted, setIsForceMuted] = useState(false);
  const isForceMutedRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioApproved, setAudioApproved] = useState(false);
  const [audioRequestPending, setAudioRequestPending] = useState(false);
  const [activeVoiceRequests, setActiveVoiceRequests] = useState<{ connectionId: string; name: string }[]>([]);
  const [activePencilRequests, setActivePencilRequests] = useState<{ connectionId: string; name: string }[]>([]);
  const [shareUrl, setShareUrl] = useState("");

  // WebSocket & WebRTC Refs (refs avoid stale closures in the WS handler)
  const socketRef = useRef<WebSocket | null>(null);
  const connectionIdRef = useRef<string | null>(null);
  const isOwnerRef = useRef(false);
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
  const refreshExplicadorSocketTokenRef = useRef<() => Promise<void>>(async () => { });
  const hasReceivedWelcomeRef = useRef(false);
  const sessionRef = useRef(session);

  const sendWSMessage = useCallback((payload: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const isMicMutedRef = useRef(true);

  const {
    localStreamRef,
    peerManagerRef,
    acquireLocalStream,
    handleWebRTCSignal,
    connectToAllPeers,
    syncPeersWithParticipants,
    cleanupPeer,
    closeAllPeers,
    debugRoomState,
    onRemoteMicOn,
  } = useWebRTC(localStream, setLocalStream, isMicMuted, setIsMicMuted, {
    sendWSMessage,
    connectionIdRef,
    isMicMutedRef,
    isForceMutedRef,
  });

  const onParticipantsChanged = useCallback(
    async (list: Participant[]) => {
      await syncPeersWithParticipants(list.map((p) => p.connectionId));
    },
    [syncPeersWithParticipants]
  );

  const handleParticipantLeft = useCallback(
    (peerId: string) => {
      cleanupPeer(peerId);
      setActiveVoiceRequests((prev) => prev.filter((r) => r.connectionId !== peerId));
    },
    [cleanupPeer]
  );

  const {
    participants,
    participantsRef,
    roomMemberCount,
    roomMemberCountRef,
    isSoloRoom,
    isMultiUserRoom,
    syncPresenceFromServer,
    setRoomMemberCount,
    updateParticipantAudioState,
  } = useParticipants({
    connectionIdRef,
    onParticipantsChanged,
    onParticipantLeft: handleParticipantLeft,
  });

  const { wsMessageHandlerRef, registerHandler } = useSignaling();

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    hasReceivedWelcomeRef.current = false;
  }, [roomId]);

  useEffect(() => { isForceMutedRef.current = isForceMuted; }, [isForceMuted]);
  useEffect(() => { isOwnerRef.current = isOwner; }, [isOwner]);

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

  // Fetch room details to save in visited history list
  useEffect(() => {
    if (!roomId) return;
    const fetchRoomDetails = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/explicador/${roomId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.title) {
            const historyItem = {
              id: roomId,
              title: data.title,
              created_at: data.created_at || new Date().toISOString(),
              is_active: data.is_active !== false,
            };
            const raw = localStorage.getItem("bookar-explicador-history");
            let list = raw ? JSON.parse(raw) : [];
            list = list.filter((x: any) => x.id !== roomId);
            list.unshift(historyItem);
            list = list.slice(0, 20);
            localStorage.setItem("bookar-explicador-history", JSON.stringify(list));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch room title for history", err);
      }
    };
    fetchRoomDetails();
  }, [roomId]);

  const connectExplicadorSocketRef = useRef<
    (opts?: { isReconnect?: boolean }) => Promise<void>
  >(async () => { });

  const connectExplicadorSocket = useCallback(
    async (opts?: { isReconnect?: boolean }) => {
      const generation = ++wsConnectGenerationRef.current;

      const freshSession = await ensureFreshSession();
      const token =
        freshSession?.accessToken ||
        (sessionRef.current as { accessToken?: string } | null)?.accessToken ||
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
        closeAllPeers();

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
    [roomId, clearWsTimers, startWsPingLoop]
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
      await connectExplicadorSocketRef.current();
    };

    init();

    wsTokenRefreshTimerRef.current = setInterval(() => {
      void refreshExplicadorSocketTokenRef.current();
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
      closeAllPeers();
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
    };
  }, [roomId, status, clearWsTimers, closeAllPeers, setLocalStream]);

  // Renova token na sessão (ex.: voltar ao separador) sem derrubar o socket se o token não mudou
  useEffect(() => {
    if (status !== "authenticated" || !roomReady) return;
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!token || token === wsActiveTokenRef.current) return;
    void refreshExplicadorSocketTokenRef.current();
  }, [status, session, roomReady]);

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

  const handleInterrupt = () => {
    setIsGenerating(false);
    sendWSMessage({ type: "interrupt" });
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null; // prevent sending on interrupt
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
    setIsForceMuted(false);
  };

  // 2. Handle Incoming WebSocket events
  const handleWebSocketMessage = async (data: any) => {
    switch (data.type) {
      case "welcome":
        setConnectionId(data.connection_id);
        connectionIdRef.current = data.connection_id;
        peerManagerRef.current?.setMyId(data.connection_id);
        setIsOwner(data.is_owner);
        isOwnerRef.current = data.is_owner;
        setWhiteboardData((prev) => {
          const isReconnect = hasReceivedWelcomeRef.current;
          hasReceivedWelcomeRef.current = true;

          if (!data.whiteboard_data) {
            return isReconnect
              ? prev
              : { summary: "", lock: null, show_whiteboard: false };
          }

          const merged = mergeWhiteboardFromServer(prev, data.whiteboard_data);
          return {
            ...merged,
            show_whiteboard: isReconnect ? prev.show_whiteboard === true : false,
          };
        });
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
            const welcomeMembers = (data.members as { connection_id?: string }[]) || [];
            setRoomMemberCount(welcomeMembers.length);
            roomMemberCountRef.current = welcomeMembers.length;
            const soloOnWelcome = welcomeMembers.length <= 1;
            const promptText = promptParam.trim();
            const promptMessage = soloOnWelcome
              ? promptText
              : ensureExplicadorMention(promptText);

            if (!soloOnWelcome) {
              socketRef.current?.send(JSON.stringify({ type: "grab_lock" }));
            }

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
              JSON.stringify(
                soloOnWelcome
                  ? {
                    type: "chat_message",
                    message: promptMessage,
                    direct_to_explicador: true,
                  }
                  : { type: "chat_message", message: promptMessage }
              )
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
        updateParticipantAudioState(
          data.connection_id,
          Boolean(data.is_mic_on),
          data.is_listening !== false
        );
        if (data.is_mic_on && data.connection_id !== connectionIdRef.current) {
          onRemoteMicOn(data.connection_id);
        }
        break;

      case "voice_broadcast_started":
        if (data.speaker_connection_id !== connectionIdRef.current) {
          setIsForceMuted(true);
        }
        break;

      case "voice_broadcast_ended":
        setIsForceMuted(false);
        break;

      case "chat_update":
        if (data.chat_history) {
          const isNewMessage = data.chat_history.length > chatHistoryRef.current.length && chatHistoryRef.current.length > 0;
          setChatHistory(data.chat_history);
          const last = data.chat_history[data.chat_history.length - 1];
          if (last?.role === "assistant" && !data.is_generating && isNewMessage) {
            setActiveStreamingMessageIndex(data.chat_history.length - 1);
          } else if (!data.is_generating) {
            setActiveStreamingMessageIndex(null);
          }
        }

        const nextIsGenerating = Boolean(data.is_generating);
        setIsGenerating(nextIsGenerating);

        if (data.audio) {
          // Pause current audio playing
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }

          setIsForceMuted(true);

          const audio = new Audio(data.audio);
          currentAudioRef.current = audio;

          const endAudio = () => {
            setIsForceMuted(false);
            currentAudioRef.current = null;
            sendWSMessage({ type: "voice_broadcast_end" });
          };

          audio.onended = endAudio;
          audio.onerror = (err) => {
            console.error("Audio playback error", err);
            endAudio();
          };

          audio.play().catch((err) => {
            console.warn("Failed to play audio", err);
            endAudio();
          });
        } else if (!nextIsGenerating && data.is_voice) {
          // If generation finished and this was a voice flow but no audio was generated (or failed), release mute
          setIsForceMuted(false);
          sendWSMessage({ type: "voice_broadcast_end" });
        }

        if (data.whiteboard_data) {
          setWhiteboardData((prev) => {
            const merged = mergeWhiteboardFromServer(prev, data.whiteboard_data);
            const incomingSummary = (data.whiteboard_data.summary ?? "").trim();
            const prevSummary = (prev.summary ?? "").trim();
            const shouldOpen =
              data.open_whiteboard === true &&
              incomingSummary.length > 0 &&
              incomingSummary !== prevSummary;

            if (shouldOpen) {
              return { ...merged, show_whiteboard: true };
            }
            return merged;
          });
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

      case "pencil_request":
        if (data.target_connection_id === connectionIdRef.current) {
          const requesterName = data.requester_name || "Alguém";
          // toast.info(`${requesterName} pediu o lápis`);
          setActivePencilRequests((prev) => {
            if (prev.some((r) => r.connectionId === data.requester_connection_id)) return prev;
            return [...prev, { connectionId: data.requester_connection_id, name: requesterName }];
          });
          window.setTimeout(() => {
            setActivePencilRequests((prev) =>
              prev.filter((r) => r.connectionId !== data.requester_connection_id)
            );
          }, 6000);
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

  // WebRTC signal handling lives in PeerManager via useWebRTC hook

  const startLocalAudio = async () => {
    try {
      const stream = await acquireLocalStream({ enabled: true });
      if (!stream) {
        toast.error("Não foi possível aceder ao microfone.");
        return;
      }
      isMicMutedRef.current = false;
      setIsMicMuted(false);

      sendWSMessage({
        type: "audio_state",
        is_mic_on: true,
        is_listening: true,
      });

      await connectToAllPeers(participantsRef.current.map((p) => p.connectionId));
      toast.success("Microfone ativado!");
    } catch (err) {
      console.error("Error accessing microphone", err);
      toast.error("Não foi possível aceder ao microfone.");
    }
  };

  const startHostAudio = async () => {
    try {
      const stream = await acquireLocalStream({ enabled: true });
      if (!stream) {
        toast.error("Não foi possível aceder ao microfone.");
        return;
      }
      isMicMutedRef.current = false;
      setIsMicMuted(false);
      setAudioApproved(true);

      sendWSMessage({
        type: "audio_state",
        is_mic_on: true,
        is_listening: true,
      });

      await connectToAllPeers(participantsRef.current.map((p) => p.connectionId));
      toast.success("Canal de voz ativado!");
    } catch (err) {
      console.error("Error accessing microphone", err);
      toast.error("Não foi possível aceder ao microfone.");
    }
  };

  const toggleMute = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const nextMuted = !isMicMutedRef.current;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted && !isForceMutedRef.current;
    });
    isMicMutedRef.current = nextMuted;
    setIsMicMuted(nextMuted);

    sendWSMessage({
      type: "audio_state",
      is_mic_on: !nextMuted && !isForceMutedRef.current,
      is_listening: true,
    });

    if (!nextMuted && !isForceMutedRef.current) {
      await connectToAllPeers(participantsRef.current.map((p) => p.connectionId));
    }
  };

  // Keep WS handler ref fresh so socket.onmessage never uses a stale closure
  registerHandler(handleWebSocketMessage);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    (window as unknown as { debugRoomState?: () => void }).debugRoomState = () => {
      debugRoomState(participantsRef.current.map((p) => p.connectionId));
    };
    return () => {
      delete (window as unknown as { debugRoomState?: () => void }).debugRoomState;
    };
  }, [debugRoomState]);

  const getDisplayName = () => {
    const u = session?.user as { first_name?: string; last_name?: string; name?: string } | undefined;
    if (u?.first_name) {
      return `${u.first_name} ${u.last_name || ""}`.trim();
    }
    return u?.name || "Eu";
  };

  const currentLock = isSoloRoom ? null : whiteboardData.lock;
  const isLockHolder =
    isMultiUserRoom &&
    Boolean(currentLock && currentLock.connection_id === connectionId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
    reader.onerror = () => {
      toast.error("Erro ao ler o ficheiro.");
    };
    reader.readAsDataURL(file);
  };

  /** Solo: mensagem vai direto ao explicador. Multi: chat ou @explicador + lápis. */
  const submitChatMessage = (rawMessage: string) => {
    const trimmed = rawMessage.trim();
    if ((!trimmed && !selectedFile) || isGenerating) return;

    const solo = roomMemberCountRef.current <= 1;
    const mentionsTutor = solo || messageMentionsExplicador(trimmed) || selectedFile !== null;

    if (!solo) {
      if (mentionsTutor && !isLockHolder) {
        toast.error("Pega o lápis primeiro para falar com o explicador.");
        return;
      }
    }

    const fileToUpload = selectedFile;

    setChatHistory((prev) => [
      ...prev,
      {
        role: "user",
        content: formatUserChatContent(getDisplayName(), trimmed || `Enviou um anexo: ${fileToUpload?.name}`),
        attachment: fileToUpload
          ? {
            name: fileToUpload.name,
            mime_type: fileToUpload.mime_type,
            url: fileToUpload.base64,
          }
          : undefined,
      },
    ]);

    if (mentionsTutor) {
      setIsGenerating(true);
      setActiveStreamingMessageIndex(null);
    }

    sendWSMessage(
      solo
        ? {
          type: "chat_message",
          message: trimmed,
          direct_to_explicador: true,
          attachment: fileToUpload
            ? {
              base64: fileToUpload.base64,
              name: fileToUpload.name,
              mime_type: fileToUpload.mime_type,
              size: fileToUpload.size,
            }
            : undefined,
        }
        : {
          type: "chat_message",
          message: trimmed,
          attachment: fileToUpload
            ? {
              base64: fileToUpload.base64,
              name: fileToUpload.name,
              mime_type: fileToUpload.mime_type,
              size: fileToUpload.size,
            }
            : undefined,
        }
    );

    setMessage("");
    setSelectedFile(null);
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    submitChatMessage(message);
  };

  const handleMentionExplicador = () => {
    if (isGenerating || isSoloRoom) return;
    if (!isLockHolder) {
      toast.error("Pega o lápis primeiro para falar com o explicador.");
      return;
    }

    const withMention = ensureExplicadorMention(message);
    setMessage(withMention);
    submitChatMessage(withMention);
  };

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

  const handleChatMic = async () => {
    if (!isLockHolder && !isSoloRoom) {
      toast.error("Precisas de pegar o lápis primeiro para falar com o explicador por voz.");
      return;
    }

    if (isRecordingAudio) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingAudio(false);
      return;
    }

    // Usa um stream DEDICADO para gravação — não mexe no stream do WebRTC
    let recordStream: MediaStream;
    try {
      recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Falha ao capturar microfone para gravação", err);
      toast.error("Não foi possível aceder ao microfone. Garanta permissão.");
      return;
    }

    // Garante que o microfone do WebRTC fica OFF durante a gravação
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    isMicMutedRef.current = true;
    setIsMicMuted(true);
    sendWSMessage({
      type: "audio_state",
      is_mic_on: false,
      is_listening: true,
    });

    // Notifica outros membros da sala para se silenciarem
    sendWSMessage({ type: "voice_broadcast_start" });

    // Inicia gravação de áudio com stream DEDICADO
    audioChunksRef.current = [];
    let mediaRecorder: MediaRecorder;
    const options = { mimeType: "audio/webm" };
    try {
      mediaRecorder = new MediaRecorder(recordStream, options);
    } catch (e) {
      mediaRecorder = new MediaRecorder(recordStream);
    }

    const recordingRecorder = mediaRecorder;
    mediaRecorderRef.current = recordingRecorder;
    recordingRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recordingRecorder.onstop = async () => {
      // Liberta o stream de gravação dedicado
      recordStream.getTracks().forEach((t) => t.stop());

      const audioBlob = new Blob(audioChunksRef.current, { type: recordingRecorder.mimeType });
      if (audioBlob.size < 1000) {
        sendWSMessage({ type: "voice_broadcast_end" });
        setIsForceMuted(false);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        const base64Data = reader.result as string;

        setIsGenerating(true);
        setActiveStreamingMessageIndex(null);
        setIsForceMuted(true);

        sendWSMessage({
          type: "chat_message_audio",
          audio_base64: base64Data,
          mime_type: recordingRecorder.mimeType,
        });
      };
    };

    try {
      recordingRecorder.start();
      setIsRecordingAudio(true);
    } catch (err) {
      console.error("Falha ao iniciar gravador de áudio", err);
      toast.error("Erro ao iniciar gravador de áudio.");
      recordStream.getTracks().forEach((t) => t.stop());
      sendWSMessage({ type: "voice_broadcast_end" });
      setIsForceMuted(false);
    }
  };

  const grabLock = () => {
    sendWSMessage({ type: "grab_lock" });
  };

  const releaseLock = () => {
    sendWSMessage({ type: "release_lock" });
  };

  const requestPencil = () => {
    if (!currentLock || isLockHolder) return;

    if (pencilCooldownActive) {
      toast.error(`Aguarde ${pencilCooldownTimeLeft}s para pedir o lápis novamente.`);
      return;
    }

    sendWSMessage({ type: "request_pencil", name: getDisplayName() });

    setPencilRequestsCount((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        setPencilCooldownActive(true);
        setPencilCooldownTimeLeft(30);
        return 0;
      }
      return next;
    });
  };

  const showWhiteboard = whiteboardData.show_whiteboard === true;
  const mentionsExplicadorInInput =
    isMultiUserRoom && messageMentionsExplicador(message);

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

  if (!roomReady) {
    return <LoadingRoom lobbyStatus={lobbyStatus} />
  }

  return (
    <div
      ref={splitContainerRef}
      onPointerMove={handleSplitterPointerMove}
      style={{ height: viewportHeight }}
      className="explicador-room-container flex w-full overflow-hidden bg-transparent text-slate-800 select-none"
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
        .explicador-room-container {
          overscroll-behavior: none;
          overflow: hidden;
          touch-action: none;
        }
        .message-list-scroll {
          overscroll-behavior-y: contain;
          -webkit-overflow-scrolling: touch;
          scroll-anchor: auto;
        }
        .chat-input-safe-area {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>

      {isLockHolder && activePencilRequests.length > 0 && (
        <PencilRequests
          activePencilRequests={activePencilRequests}
        />
      )}

      {isOwner && activeVoiceRequests.length > 0 && (
        <VoiceRequest
          activeVoiceRequests={activeVoiceRequests}
          handleVoiceDecision={handleVoiceDecision}
        />
      )}

      <div
        style={{ width: isMobile ? (showWhiteboard ? "0%" : "100%") : (showWhiteboard ? `${splitPct}%` : "100%") }}
        className={`bg-transparent flex flex-col overflow-hidden shrink-0 h-full select-text transition-[width] duration-500 ease-in-out ${showWhiteboard ? (isMobile ? "hidden" : "border-r border-slate-200") : ""
          }`}
      >
        <Header
          isMultiUserRoom={isMultiUserRoom}
          combinedRoster={combinedRoster}
          shareUrl={shareUrl}
          isMicMuted={isMicMuted}
          toggleMute={toggleMute}
          roomReady={roomReady}
          isConnected={isConnected}
          setShowParticipantsModal={setShowParticipantsModal}
        />


        <MessageList
          chatHistory={chatHistory}
          activeStreamingMessageIndex={activeStreamingMessageIndex}
          isGenerating={isGenerating}
          whiteboardData={whiteboardData}
          showWhiteboard={showWhiteboard}
          setWhiteboardData={setWhiteboardData}
          chatEndRef={chatEndRef}
        />


        <MessageInput
          message={message}
          setMessage={setMessage}
          isGenerating={isGenerating}
          isRecordingAudio={isRecordingAudio}
          isSoloRoom={isSoloRoom}
          mentionsExplicadorInInput={mentionsExplicadorInInput}
          isLockHolder={isLockHolder}
          handleSendMessage={handleSendMessage}
          handleFileChange={handleFileChange}
          handleChatMic={handleChatMic}
          handleMentionExplicador={handleMentionExplicador}
          handleInterrupt={handleInterrupt}
          requestPencil={requestPencil}
          grabLock={grabLock}
          releaseLock={releaseLock}
          currentLock={whiteboardData.lock}
          isMultiUserRoom={isMultiUserRoom}
          chatInputRef={chatInputRef}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          pencilCooldownActive={pencilCooldownActive}
          pencilCooldownTimeLeft={pencilCooldownTimeLeft}
        />
      </div>

      {showWhiteboard && !isMobile && (
        <div
          onPointerDown={handleSplitterPointerDown}
          onPointerUp={handleSplitterPointerUp}
          className="w-1.5 hover:w-2 bg-slate-200 hover:bg-cyan-500 cursor-col-resize transition-all shrink-0 z-40 relative h-full flex items-center justify-center group"
        >
          <div className="w-0.5 h-8 rounded-full bg-slate-400 group-hover:bg-white" />
        </div>
      )}

      {showWhiteboard && (
        <Whiteboard
          showWhiteboard={showWhiteboard}
          setWhiteboardData={setWhiteboardData}
          displayedBoardText={displayedBoardText}
          isGenerating={isGenerating}
          isMobile={isMobile}
        />
      )}

      <Participants
        showParticipantsModal={showParticipantsModal}
        setShowParticipantsModal={setShowParticipantsModal}
        combinedRoster={combinedRoster}
      />
    </div>
  );
}