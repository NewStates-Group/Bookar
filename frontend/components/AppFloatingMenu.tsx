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
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 font-sans">
        {menuOpen && (
          <div className="flex flex-col items-end gap-2.5 mb-1 animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* Quick Action: Caderno de Notas */}
            <div
              onClick={() => {
                setMenuOpen(false);
                openCaderno();
              }}
              className="flex items-center group cursor-pointer"
            >
              <span className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-white/95 backdrop-blur-sm border border-slate-200/60 shadow-sm rounded-lg mr-2 transition-all duration-200 group-hover:text-cyan-600 group-hover:border-cyan-200/50 group-hover:bg-cyan-50/20 select-none">
                Caderno de Notas
              </span>
              <button
                type="button"
                className="w-11 h-11 rounded-xl bg-white border border-slate-200/80 text-slate-500 shadow-sm group-hover:shadow-md group-hover:text-cyan-600 group-hover:border-cyan-200 group-hover:bg-cyan-50/30 transition-all duration-200 flex items-center justify-center cursor-pointer"
              >
                <BookMarked className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action: Explicador */}
            <div
              onClick={() => {
                setMenuOpen(false);
                setExplicadorOpen(true);
              }}
              className="flex items-center group cursor-pointer"
            >
              <span className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-white/95 backdrop-blur-sm border border-slate-200/60 shadow-sm rounded-lg mr-2 transition-all duration-200 group-hover:text-cyan-600 group-hover:border-cyan-200/50 group-hover:bg-cyan-50/20 select-none">
                Explicador IA
              </span>
              <button
                type="button"
                className="w-11 h-11 rounded-xl bg-white border border-slate-200/80 text-slate-500 shadow-sm group-hover:shadow-md group-hover:text-cyan-600 group-hover:border-cyan-200 group-hover:bg-cyan-50/30 transition-all duration-200 flex items-center justify-center cursor-pointer"
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Floating Button */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title="Ferramentas de IA"
          aria-label="Ferramentas de IA"
          aria-expanded={menuOpen}
          className={`w-13 h-13 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 cursor-pointer border 
            ${menuOpen
              ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-900"
              : "bg-cyan-500 border-cyan-400 text-white hover:bg-cyan-600 shadow-cyan-500/20"}
          `}
        >
          {menuOpen ? (
            <Plus className="w-5 h-5 rotate-45 transition-transform duration-200" />
          ) : (
            <Sparkles className="w-5 h-5 animate-pulse" />
          )}
        </button>
      </div>

      <ExplicadorPromptDialog open={explicadorOpen} onOpenChange={setExplicadorOpen} />
    </>
  );
}
