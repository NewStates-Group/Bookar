"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { WebSocketProvider } from "@/context/WebSocketContext";
import { NotebookProvider } from "@/context/NotebookContext";

const SESSION_REFETCH_INTERVAL_SEC = 13 * 60;

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      refetchOnWindowFocus={false}
      refetchInterval={SESSION_REFETCH_INTERVAL_SEC}
      refetchWhenOffline={false}
    >
      <NotebookProvider>
        <WebSocketProvider>
          {children}
        </WebSocketProvider>
      </NotebookProvider>
    </SessionProvider>
  );
}
