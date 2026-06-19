"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useWebSocket } from "@/context/WebSocketContext";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

const ITEMS_PER_PAGE = 15;

const fullDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const timeAgo = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  if (hours < 48) return "ontem";
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
};

type FilterMode = "all" | "unread" | "read";

export default function NotificationsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { lastMessage } = useWebSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [page, setPage] = useState(1);

  const fetchAll = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const data = await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/notifications`
      ) as Notification[];
      setNotifications(data);
    } catch {}
    setLoading(false);
  }, [session?.accessToken]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (lastMessage?.event === "notification") {
      setNotifications((prev) => {
        const exists = prev.some((n) => n.id === lastMessage.notification.id);
        if (exists) return prev;
        return [lastMessage.notification, ...prev];
      });
    }
  }, [lastMessage]);

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const filtered = useMemo(() => {
    let items = notifications;

    if (filter === "unread") items = items.filter((n) => !n.is_read);
    else if (filter === "read") items = items.filter((n) => n.is_read);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.message && n.message.toLowerCase().includes(q))
      );
    }

    return items;
  }, [notifications, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/notifications/read-all`,
        { method: "POST" }
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const handleMarkRead = async (id: number) => {
    try {
      await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/notifications/${id}/read`,
        { method: "POST" }
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {}
  };

  const filterTabs: { key: FilterMode; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "unread", label: `Não lidas (${unreadCount})` },
    { key: "read", label: "Lidas" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-neutral-100">
            Notificações
          </h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} não ${unreadCount === 1 ? "lida" : "lidas"}`
              : "Veja as notificações que temos para si"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 rounded-lg transition-all cursor-pointer self-start"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar todas lidas
          </button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar notificações..."
            className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl text-slate-800 dark:text-neutral-200 placeholder:text-slate-400 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/10 transition-all"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-neutral-800 rounded-xl p-0.5 self-start">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                filter === tab.key
                  ? "bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-100 shadow-sm"
                  : "text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-neutral-500">
          <Bell className="w-10 h-10 mb-3" />
          <p className="text-sm font-medium">
            {search || filter !== "all"
              ? "Nenhuma notificação encontrada"
              : "Nenhuma notificação"}
          </p>
          <p className="text-xs mt-1">
            {search || filter !== "all"
              ? "Tenta alterar os filtros ou a pesquisa"
              : "As tuas notificações aparecerão aqui"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((n) => (
            <div
              key={n.id}
              className={`group relative rounded-xl border transition-all ${
                !n.is_read
                  ? "border-cyan-200/60 dark:border-cyan-700/40 bg-cyan-50/30 dark:bg-cyan-950/20"
                  : "border-slate-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              }`}
            >
              <div className="flex items-start gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0" />
                    )}
                    <p
                      className={`text-sm leading-snug ${
                        !n.is_read
                          ? "font-semibold text-slate-800 dark:text-neutral-200"
                          : "text-slate-600 dark:text-neutral-400"
                      }`}
                    >
                      {n.title}
                    </p>
                  </div>
                  {n.message && (
                    <p className="text-sm text-slate-500 dark:text-neutral-500 mt-0.5 leading-relaxed">
                      {n.message}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] text-slate-400 dark:text-neutral-500" title={fullDate(n.created_at)}>
                      {timeAgo(n.created_at)}
                    </span>
                    {n.type !== "info" && (
                      <span className="text-[10px] uppercase text-slate-400 dark:text-neutral-500 font-medium">
                        {n.type}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-1 flex-shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-all cursor-pointer"
                      title="Marcar como lida"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {n.link && (
                    <button
                      onClick={() => router.push(n.link)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                      title="Abrir"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              if (totalPages <= 7) return true;
              if (p === 1 || p === totalPages) return true;
              if (Math.abs(p - page) <= 1) return true;
              return false;
            })
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center">
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span className="px-1 text-slate-300 dark:text-neutral-600 text-sm">...</span>
                )}
                <button
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    page === p
                      ? "bg-cyan-500 text-white shadow-sm"
                      : "text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {p}
                </button>
              </span>
            ))}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
