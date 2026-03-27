"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

interface WebSocketContextType {
    lastMessage: any;
    isConnected: boolean;
    sendMessage: (data: any) => void;
    addListener: (callback: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { data: session } = useSession();
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const listenersRef = useRef<Set<(data: any) => void>>(new Set());

    const connect = () => {
        if (!session?.accessToken || socketRef.current) return;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        // If NEXT_PUBLIC_API_URL is available, use it to derive the WS URL
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        const wsUrl = `${apiUrl.replace(/^http/, "ws")}/ws/updates/?token=${(session as any).accessToken}`;

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            // console.log("WebSocket Connected");
            setIsConnected(true);
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setLastMessage(data);
            listenersRef.current.forEach((listener) => listener(data));
        };

        socket.onclose = () => {
            setIsConnected(false);
            socketRef.current = null;
            setTimeout(connect, 3000); // Reconnect after 3 seconds
        };

        socket.onerror = (error) => {
            // console.error("WebSocket Error:", error);
            socket.close();
        };

        socketRef.current = socket;
    };

    useEffect(() => {
        connect();
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [session?.accessToken]);

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
