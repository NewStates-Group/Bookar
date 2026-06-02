"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  Bot,
  Plus,
  Sparkles,
} from "lucide-react";
import { useNotebook } from "@/context/NotebookContext";
import {
  platformDialogHeaderIcon,
  platformFab,
  platformFabOpen,
  platformQuickAction,
} from "@/lib/platform-ui";
import { ExplicadorPromptDialog } from "@/components/ExplicadorPromptDialog";

export function AppFloatingMenu() {
  const { status } = useSession();
  const pathname = usePathname();
  const { openCaderno } = useNotebook();

  const [menuOpen, setMenuOpen] = useState(false);
  const [explicadorOpen, setExplicadorOpen] = useState(false);

  const isExplicadorRoom =
    pathname.startsWith("/app/explicador/") && pathname !== "/app/explicador";

  if (status !== "authenticated" || isExplicadorRoom) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5">
        {menuOpen && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openCaderno();
              }}
              className={platformQuickAction}
            >
              <span className={platformDialogHeaderIcon}>
                <BookMarked className="w-4 h-4 text-cyan-600" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Caderno de Notas
                </span>
                <span className="block text-[11px] text-slate-500 font-medium">
                  Folhas de estudo
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setExplicadorOpen(true);
              }}
              className={platformQuickAction}
            >
              <span className={platformDialogHeaderIcon}>
                <Bot className="w-4 h-4 text-cyan-600" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-800">Explicador</span>
                <span className="block text-[11px] text-slate-500 font-medium">
                  Tira dúvidas com IA
                </span>
              </span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title="Ferramentas de IA"
          aria-label="Ferramentas de IA"
          aria-expanded={menuOpen}
          className={menuOpen ? platformFabOpen : platformFab}
        >
          {menuOpen ? (
            <Plus className="w-6 h-6 rotate-45" />
          ) : (
            <span className="relative flex items-center justify-center">
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-500/10 blur-sm" />
              <Sparkles className="w-6 h-6 relative text-cyan-600" />
            </span>
          )}
        </button>
      </div>

      <ExplicadorPromptDialog open={explicadorOpen} onOpenChange={setExplicadorOpen} />
    </>
  );
}
