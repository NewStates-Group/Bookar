"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { WebSocketProvider } from "@/context/WebSocketContext";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider refetchOnWindowFocus={false}>
            <WebSocketProvider>
                {children}
            </WebSocketProvider>
        </SessionProvider>
    );
}
