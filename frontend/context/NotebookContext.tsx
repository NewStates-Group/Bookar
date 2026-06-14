"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { CadernoNotasModal } from "@/components/CadernoNotasModal";
import { FolhaEditorModal } from "@/components/FolhaEditorModal";

export interface FolhaSummary {
  id: string;
  title: string;
  content: string;
  mind_map_id?: string | null;
  mind_map_title?: string | null;
  node_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface NotebookContextValue {
  openCaderno: () => void;
  openFolha: (folhaId: string) => void;
  openFolhaForMindMapNode: (
    mindMapId: string,
    nodeId: string,
    nodeTitle: string,
    existingContent?: string
  ) => Promise<void>;
  refreshFolhas: () => void;
  folhasVersion: number;
}

const NotebookContext = createContext<NotebookContextValue | null>(null);

export function useNotebook() {
  const ctx = useContext(NotebookContext);
  if (!ctx) {
    throw new Error("useNotebook must be used within NotebookProvider");
  }
  return ctx;
}

export function NotebookProvider({ children }: { children: React.ReactNode }) {
  const [cadernoOpen, setCadernoOpen] = useState(false);
  const [editorFolhaId, setEditorFolhaId] = useState<string | null>(null);
  const [folhasVersion, setFolhasVersion] = useState(0);

  const refreshFolhas = useCallback(() => {
    setFolhasVersion((v) => v + 1);
  }, []);

  const openCaderno = useCallback(() => {
    setCadernoOpen(true);
  }, []);

  const openFolha = useCallback((folhaId: string) => {
    setEditorFolhaId(folhaId);
    setCadernoOpen(false);
  }, []);

  const openFolhaForMindMapNode = useCallback(
    async (
      mindMapId: string,
      nodeId: string,
      nodeTitle: string,
      existingContent?: string
    ) => {
      const base = process.env.NEXT_PUBLIC_API_URL;
      try {
        const folha = await apiRequest(
          `${base}/folhas/lookup?mind_map_id=${encodeURIComponent(mindMapId)}&node_id=${encodeURIComponent(nodeId)}`
        );
        window.dispatchEvent(new CustomEvent("opencode-caderno", { detail: { folhaId: folha.id } }));
      } catch {
        try {
          const created = await apiRequest(`${base}/folhas`, {
            method: "POST",
            body: JSON.stringify({
              title: nodeTitle || "Anotação do mapa mental",
              content: existingContent || "",
              mind_map_id: mindMapId,
              node_id: nodeId,
            }),
          });
          refreshFolhas();
          window.dispatchEvent(new CustomEvent("opencode-caderno", { detail: { folhaId: created.id } }));
        } catch (err: any) {
          toast.error(err.message || "Erro ao criar folha de anotação.");
        }
      }
    },
    [refreshFolhas]
  );

  const closeEditor = useCallback(() => {
    setEditorFolhaId(null);
    refreshFolhas();
  }, [refreshFolhas]);

  return (
    <NotebookContext.Provider
      value={{
        openCaderno,
        openFolha,
        openFolhaForMindMapNode,
        refreshFolhas,
        folhasVersion,
      }}
    >
      {children}
      <CadernoNotasModal
        open={cadernoOpen}
        onOpenChange={setCadernoOpen}
        onOpenFolha={openFolha}
        folhasVersion={folhasVersion}
      />
      <FolhaEditorModal folhaId={editorFolhaId} onClose={closeEditor} />
    </NotebookContext.Provider>
  );
}
