"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { WebSocketProvider } from "@/context/WebSocketContext";
import { NotebookProvider } from "@/context/NotebookContext";
import { PendingExplicadorRoomModal } from "@/components/PendingExplicadorRoomModal";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider refetchOnWindowFocus={false}>
            <NotebookProvider>
                <WebSocketProvider>
                    {children}
                    <PendingExplicadorRoomModal />
                </WebSocketProvider>
            </NotebookProvider>
        </SessionProvider>
    );
}
