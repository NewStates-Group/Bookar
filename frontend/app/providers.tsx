"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { WebSocketProvider } from "@/context/WebSocketContext";
import { NotebookProvider } from "@/context/NotebookContext";
import { PendingExplicadorRoomModal } from "@/components/PendingExplicadorRoomModal";

/** Renova access token antes dos 15 min (backend) ao voltar ao separador ou em background. */
const SESSION_REFETCH_INTERVAL_SEC = 12 * 60;

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      refetchOnWindowFocus
      refetchInterval={SESSION_REFETCH_INTERVAL_SEC}
    >
      <NotebookProvider>
        <WebSocketProvider>
          {children}
          <PendingExplicadorRoomModal />
        </WebSocketProvider>
      </NotebookProvider>
    </SessionProvider>
  );
}
