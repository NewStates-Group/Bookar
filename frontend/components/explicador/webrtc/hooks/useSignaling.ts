"use client";

import { useCallback, useRef } from "react";
import type { WebRTCSignal } from "../types/webrtc";

export type WSMessageHandler = (data: Record<string, unknown>) => void | Promise<void>;

export interface UseSignalingReturn {
  wsMessageHandlerRef: React.MutableRefObject<WSMessageHandler>;
  registerHandler: (handler: WSMessageHandler) => void;
  parseWebRTCSignal: (
    data: Record<string, unknown>
  ) => { senderId: string; signal: WebRTCSignal } | null;
}

/**
 * Keeps the WebSocket message handler ref fresh so socket.onmessage
 * never invokes a stale closure.
 */
export function useSignaling(): UseSignalingReturn {
  const wsMessageHandlerRef = useRef<WSMessageHandler>(() => {});

  const registerHandler = useCallback((handler: WSMessageHandler) => {
    wsMessageHandlerRef.current = handler;
  }, []);

  const parseWebRTCSignal = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type !== "webrtc_signal") return null;
      const senderId = data.sender_connection_id as string | undefined;
      const signal = data.signal as WebRTCSignal | undefined;
      if (!senderId || !signal?.type) return null;
      return { senderId, signal };
    },
    []
  );

  return { wsMessageHandlerRef, registerHandler, parseWebRTCSignal };
}
