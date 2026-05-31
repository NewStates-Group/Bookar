"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { WebSocketProvider } from "@/context/WebSocketContext";
import { PendingExplicadorRoomModal } from "@/components/PendingExplicadorRoomModal";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider refetchOnWindowFocus={false}>
            <WebSocketProvider>
                {children}
                <PendingExplicadorRoomModal />
            </WebSocketProvider>
        </SessionProvider>
    );
}
