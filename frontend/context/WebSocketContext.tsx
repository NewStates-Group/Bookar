"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ensureFreshSession } from "@/lib/auth-session";

interface WebSocketContextType {
  lastMessage: any;
  isConnected: boolean;
  sendMessage: (data: any) => void;
  addListener: (callback: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000];

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<(data: any) => void>>(new Set());
  const activeTokenRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const mountedRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;
  const hasConnectedRef = useRef(false);
  
  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const connectRef = useRef<() => Promise<void>>(async () => {});

  const connect = async () => {
    if (!mountedRef.current) return;
    if (socketRef.current) return;

    // const fresh = await ensureFreshSession();
    // const token = fresh?.accessToken || (session as { accessToken?: string })?.accessToken;
    const token = accessToken;
    if (!token) return;

    if (hasConnectedRef.current) return;
    hasConnectedRef.current = true;


    activeTokenRef.current = token;
    clearReconnectTimer();

    if (socketRef.current) {
      intentionalCloseRef.current = true;
      socketRef.current.close();
      socketRef.current = null;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiUrl) return;

    const wsUrl = `${apiUrl.replace(/^http/, "ws")}/ws/updates/?t=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    intentionalCloseRef.current = false;

    socket.onopen = () => {
      if (!mountedRef.current) return;
      reconnectAttemptsRef.current = 0;
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        listenersRef.current.forEach((listener) => listener(data));
      } catch {
        /* ignore */
      }
    };

    socket.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      socketRef.current = null;

      if (intentionalCloseRef.current) return;

      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;

      reconnectAttemptsRef.current += 1;
      const delay =
        RECONNECT_DELAYS_MS[reconnectAttemptsRef.current - 1] ??
        RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1];
      reconnectTimerRef.current = setTimeout(() => {
        void connectRef.current();
      }, delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  };

  connectRef.current = connect;

  useEffect(() => {
    if (status !== "authenticated") return;

    connect()
  
    return () => {
      mountedRef.current = false;
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      hasConnectedRef.current = false;
    };
  }, [status]);

  const sendMessage = (data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  };

  const addListener = (callback: (data: any) => void) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  };

  return (
    <WebSocketContext.Provider value={{ lastMessage, isConnected, sendMessage, addListener }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};
