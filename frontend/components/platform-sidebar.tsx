"use client";

import React from "react";
import {
  BookOpen,
  GraduationCap,
  User,
  LogOut,
  Network,
  PanelLeftClose,
  X,
  ChevronRight,
  Trash2,
  Loader2,
  Plus,
  Bot,
  Crown,
  BarChart3,
  Sun,
  Moon,
  Bell,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import useSWR from "swr";
import { authenticatedFetcher, apiRequest } from "@/lib/api";
import { useWebSocket } from "@/context/WebSocketContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface PlatformSidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  isMobileOpen: boolean;
  closeMobile: () => void;
}

interface ExplicadorRoom {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string;
}

const menuItems = [
  { title: "Cursos", href: "/app/courses", icon: BookOpen },
  { title: "Mapas Mentais", href: "/app/mind-maps", icon: Network },
  { title: "Explicador", href: "/app/explicador", icon: Bot },
  { title: "Notificações", href: "/app/notifications", icon: Bell },
];

export function PlatformSidebar({
  isOpen,
  toggleSidebar,
  isMobileOpen,
  closeMobile,
}: PlatformSidebarProps) {
  const { data: session } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const user = session?.user as any;
  const dark = resolvedTheme === "dark";

  const isExplicadorActive = pathname.startsWith("/app/explicador");

  const [unreadCount, setUnreadCount] = React.useState(0);
  const { lastMessage } = useWebSocket();

  React.useEffect(() => {
    if (!session?.accessToken) return;
    apiRequest(
      `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/notifications/unread-count`
    ).then((d: any) => setUnreadCount(d.count)).catch(() => {});
  }, [session?.accessToken]);

  React.useEffect(() => {
    if (lastMessage?.event === "notification") {
      setUnreadCount((c) => c + 1);
    }
  }, [lastMessage]);

  const { data: rooms, mutate: mutateRooms } = useSWR<ExplicadorRoom[]>(
    session?.accessToken && isExplicadorActive
      ? [`${process.env.NEXT_PUBLIC_API_URL}/explicador`, session.accessToken]
      : null,
    ([url, token]) => authenticatedFetcher(url, token as string),
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const [localRooms, setLocalRooms] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("bookar-explicador-history");
      if (raw) {
        try {
          setLocalRooms(JSON.parse(raw));
        } catch { }
      }
    }
  }, [pathname]);

  const displayedRooms = React.useMemo(() => {
    const apiList = rooms || [];
    const localList = localRooms || [];
    const combined = [...apiList];
    const seenIds = new Set(apiList.map((r) => r.id));

    for (const lr of localList) {
      if (!seenIds.has(lr.id)) {
        combined.push({
          id: lr.id,
          title: lr.title,
          is_active: lr.is_active,
          created_at: lr.created_at,
        });
        seenIds.add(lr.id);
      }
    }
    return combined;
  }, [rooms, localRooms]);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleDeleteRoom = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isLocal = localRooms.some((r) => r.id === id);
    const inApi = rooms?.some((r) => r.id === id);

    if (isLocal) {
      const nextLocal = localRooms.filter((r) => r.id !== id);
      setLocalRooms(nextLocal);
      localStorage.setItem("bookar-explicador-history", JSON.stringify(nextLocal));
    }

    if (inApi) {
      setDeletingId(id);
      try {
        await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/explicador/${id}`, {
          method: "DELETE",
        });
        toast.success("Sala eliminada com sucesso!");
        mutateRooms();
        if (pathname === `/app/explicador/${id}`) {
          router.push("/app/explicador");
        }
      } catch {
        toast.error("Não foi possível eliminar a sala do servidor.");
      } finally {
        setDeletingId(null);
      }
    } else if (isLocal) {
      if (pathname === `/app/explicador/${id}`) {
        router.push("/app/explicador");
      }
    }
  };

  // Render the core sidebar content. We support both expanded and collapsed responsive states.
  const renderContent = (isExpanded: boolean) => (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950 text-slate-700 dark:text-neutral-300 select-none overflow-hidden border-r border-slate-200/60 dark:border-neutral-800">

      {/* ── Header Logo & Toggle ── */}
      <div className={`flex items-center justify-between px-4 py-4 border-b border-slate-200/60 dark:border-neutral-800 ${!isExpanded ? "flex-col gap-4" : ""}`}>
        <div
          onClick={closeMobile}
          className="flex items-center gap-3 group flex-shrink-0"
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg group-hover:scale-105 transition-transform duration-200">
            <Image
              src="/logo.png"
              alt="Bookar Logo"
              width={30}
              height={30}
              className="object-contain dark:invert"
            />
          </div>
          {isExpanded && (
            <span className="text-xl font-bold text-slate-800 dark:text-neutral-100 tracking-tight transition-all duration-200">
              Bookar
            </span>
          )}
        </div>

        {/* Mobile close button (only relevant inside drawer) */}
        {isExpanded && (
          <button
            onClick={closeMobile}
            className="md:hidden flex items-center justify-center p-1.5 rounded-lg text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100 hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition-all duration-200 cursor-pointer flex-shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        )}
      </div>

      {/* ── Navigation Links ── */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              title={!isExpanded ? item.title : undefined}
              className={`relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${isExpanded ? "px-3 py-2.5 gap-3" : "p-2.5 justify-center"
                } ${isActive
                  ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 border border-slate-200/80 dark:border-neutral-700 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100 hover:bg-slate-200/40 dark:hover:bg-neutral-800 border border-transparent"
                }`}
            >
              <item.icon
                className={`w-[20px] h-[20px] flex-shrink-0 transition-colors duration-200 ${isActive ? "text-cyan-600 dark:text-cyan-400" : "text-slate-500 dark:text-neutral-400"
                  }`}
              />
              {item.href === "/app/notifications" && unreadCount > 0 && (
                <span className={`flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 leading-none ${isExpanded ? "ml-auto" : "absolute -top-1 -right-1"
                  }`}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              {isExpanded && <span className="truncate">{item.title}</span>}
            </Link>
          );
        })}

        {/* Tutor — coming soon dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <button
              title={!isExpanded ? "Tutor (Em Breve)" : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-medium text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100 hover:bg-slate-200/40 dark:hover:bg-neutral-800 border border-transparent transition-all duration-200 cursor-pointer ${isExpanded ? "px-3 py-2.5 gap-3" : "p-2.5 justify-center"
                }`}
            >
              <GraduationCap className="w-[18px] h-[18px] flex-shrink-0 text-slate-500 dark:text-neutral-400" />
              {isExpanded && (
                <>
                  <span className="truncate flex-1 text-left">Tutor</span>
                  <Badge className="bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 text-[9px] px-1.5 py-0.5 leading-none border border-slate-300/40 dark:border-neutral-600 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded-md font-semibold">
                    Breve
                  </Badge>
                </>
              )}
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px] border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-slate-700 dark:text-neutral-300 shadow-2xl">
            <DialogHeader className="space-y-4">
              <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-cyan-50 dark:bg-cyan-950 border border-cyan-100 dark:border-cyan-900">
                <GraduationCap className="w-8 h-8 text-cyan-600 dark:text-cyan-400 animate-pulse" />
              </div>
              <DialogTitle className="text-center text-2xl font-bold text-slate-800 dark:text-neutral-100">
                Tutor em Breve!
              </DialogTitle>
              <DialogDescription className="text-center text-slate-500 dark:text-neutral-400 leading-relaxed">
                Estamos a trabalhar arduamente para trazer o seu assistente pessoal de aprendizagem.
                <span className="block mt-2 font-semibold text-cyan-600 dark:text-cyan-400">
                  A sua jornada está prestes a ficar mais inteligente.
                </span>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        {/* ── Explicador Rooms History (shown only when Explicador is active) ── */}
        {isExpanded && isExplicadorActive && displayedRooms && displayedRooms.length > 0 && (
          <div className="pt-3">
            <div className="flex items-center justify-between px-3 pb-1.5">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">
                Salas Anteriores
              </span>
              <Link
                href="/app/explicador"
                onClick={closeMobile}
                title="Nova Sala"
                className="w-5 h-5 flex items-center justify-center rounded text-slate-400 dark:text-neutral-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-0.5">
              {displayedRooms.map((room) => {
                return (
                  <div key={room.id} className="group relative flex items-center">
                    <Link
                      href={`/app/explicador/${room.id}`}
                      onClick={closeMobile}
                      className={`flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 pr-8
                        text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100 hover:bg-slate-200/40 dark:hover:bg-neutral-800 border border-transparent
                      }`}
                    >
                      <span className="truncate">{room.title}</span>
                    </Link>
                    <button
                      onClick={(e) => handleDeleteRoom(room.id, e)}
                      disabled={deletingId === room.id}
                      className="absolute right-1.5 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-all duration-200 cursor-pointer"
                      title="Remover sala"
                    >
                      {deletingId === room.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Theme toggle */}
      <div className={`px-3 pb-1 flex-shrink-0 hidden md:block ${!isExpanded ? "flex justify-center" : ""}`}>
        <button
          onClick={() => setTheme(dark ? "light" : "dark")}
          title={dark ? "Modo claro" : "Modo escuro"}
          className={`flex items-center rounded-xl text-sm font-medium text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100 hover:bg-slate-200/40 dark:hover:bg-neutral-800 border border-transparent transition-all duration-200 cursor-pointer ${isExpanded ? "px-3 py-2 gap-3 w-full" : "p-2.5 justify-center"
            }`}
        >
          {dark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          {isExpanded && <span>{dark ? "Modo claro" : "Modo escuro"}</span>}
        </button>
      </div>

      {/* Desktop collapse toggle */}
      <div className={`px-3 pb-2 flex-shrink-0 hidden md:block ${!isExpanded ? "flex justify-center" : ""}`}>
        <button
          onClick={toggleSidebar}
          title={isExpanded ? "Ocultar barra lateral" : "Mostrar barra lateral"}
          className={`flex items-center rounded-xl text-sm font-medium text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100 hover:bg-slate-200/40 dark:hover:bg-neutral-800 border border-transparent transition-all duration-200 cursor-pointer ${isExpanded ? "px-3 py-2 gap-3 w-full" : "p-2.5 justify-center"
            }`}
        >
          <PanelLeftClose className={`w-4.5 h-4.5 transition-transform duration-300 ${!isExpanded ? "rotate-180" : ""}`} />
          {isExpanded && <span>Recolher barra</span>}
        </button>
      </div>

      {/* ── Footer / Profile ── */}
      <div className="p-3 border-t border-slate-200/60 dark:border-neutral-800 bg-white/50 dark:bg-neutral-950/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title={!isExpanded ? (user?.first_name || user?.email || "Minha Conta") : undefined}
              className={`flex items-center w-full rounded-xl hover:bg-slate-200/40 dark:hover:bg-neutral-800 border border-transparent hover:border-slate-200/40 dark:hover:border-neutral-700 transition-all duration-200 cursor-pointer text-left focus:outline-none group ${isExpanded ? "p-2.5 gap-3" : "p-1.5 justify-center"
                }`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0 w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 overflow-hidden bg-slate-100 dark:bg-neutral-800">
                {user?.avatar ? (
                  <Avatar className="w-9 h-9 rounded-none">
                    <AvatarImage
                      src={
                        user.avatar.startsWith("http")
                          ? user.avatar
                          : `${process.env.NEXT_PUBLIC_API_URL}${user.avatar}`
                      }
                      alt={user.first_name || user.email}
                    />
                    <AvatarFallback className="rounded-none bg-slate-200 dark:bg-neutral-700 text-slate-750 dark:text-neutral-300 text-sm font-bold">
                      {(user.first_name || user.email || "U")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
                  </div>
                )}
              </div>

              {isExpanded && (
                <>
                  {/* Name & email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100 truncate leading-tight">
                      {user?.first_name
                        ? `${user.first_name} ${user.last_name || ""}`.trim()
                        : user?.email}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate leading-tight">
                      {user?.email}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-neutral-500 flex-shrink-0 group-hover:text-slate-600 dark:group-hover:text-neutral-300 transition-colors" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align={isExpanded ? "end" : "start"}
            side="top"
            sideOffset={10}
            className="w-60 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 shadow-2xl rounded-xl py-1.5"
          >
            <DropdownMenuItem asChild>
              <Link
                href="/app/profile"
                onClick={closeMobile}
                className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800 focus:bg-slate-50 dark:focus:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-neutral-100 focus:text-slate-900 dark:focus:text-neutral-100 rounded-lg mx-1"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span>Perfil</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/app/subscription"
                onClick={closeMobile}
                className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800 focus:bg-slate-50 dark:focus:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-neutral-100 focus:text-slate-900 dark:focus:text-neutral-100 rounded-lg mx-1"
              >
                <Crown className="w-4 h-4 text-slate-400" />
                <span>Subscrição</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/app/stats"
                onClick={closeMobile}
                className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800 focus:bg-slate-50 dark:focus:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-neutral-100 focus:text-slate-900 dark:focus:text-neutral-100 rounded-lg mx-1"
              >
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <span>Estatísticas</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100 dark:bg-neutral-800 my-1" />

            {/* Sign out */}
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950 rounded-lg mx-1 mb-0.5"
            >
              <LogOut className="w-4 h-4 text-red-500 dark:text-red-400" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop Sidebar (Toggles width dynamically on collapse instead of translating out) ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 h-full transition-all duration-300 ease-in-out hidden md:block shadow-sm ${isOpen ? "w-[260px]" : "w-[68px]"
          }`}
      >
        {renderContent(isOpen)}
      </aside>

      {/* ── Mobile/Tablet Drawer (slides in from left, always renders full-expanded content) ── */}
      <div
        className={`fixed inset-0 z-50 transition-all duration-300 md:hidden ${isMobileOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
          }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
          onClick={closeMobile}
        />

        {/* Slide Panel */}
        <aside
          className={`absolute inset-y-0 left-0 w-[280px] h-full shadow-2xl transition-transform duration-300 ease-in-out ${isMobileOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          {renderContent(true)}
        </aside>
      </div>
    </>
  );
}
