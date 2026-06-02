"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { WebSocketProvider } from "@/context/WebSocketContext";
import { NotebookProvider } from "@/context/NotebookContext";
import { PendingExplicadorRoomModal } from "@/components/PendingExplicadorRoomModal";

/** Renova access token ~2 min antes dos 15 min do backend; evita sobrepor com ensureFreshSession. */
const SESSION_REFETCH_INTERVAL_SEC = 13 * 60;

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      refetchOnWindowFocus
      refetchInterval={SESSION_REFETCH_INTERVAL_SEC}
      refetchWhenOffline={false}
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
