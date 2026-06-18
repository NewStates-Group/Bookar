"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, CheckCheck, ExternalLink, Loader2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { apiRequest } from "@/lib/api";
import { useWebSocket } from "@/context/WebSocketContext";
import { useRouter } from "next/navigation";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export function NotificationPanel({ isCollapsed }: { isCollapsed?: boolean }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { lastMessage } = useWebSocket();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const data = await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/notifications/unread-count`
      ) as { count: number };
      setUnreadCount(data.count);
    } catch {}
  }, [session?.accessToken]);

  const fetchNotifications = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const data = await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/notifications`
      ) as Notification[];
      setNotifications(data);
      const unread = data.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch {}
    setLoading(false);
  }, [session?.accessToken]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (lastMessage?.event === "notification") {
      setUnreadCount((c) => c + 1);
      setNotifications((prev) => [lastMessage.notification, ...prev]);
    }
  }, [lastMessage]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/notifications/read-all`,
        { method: "POST" }
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
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
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) await handleMarkRead(n.id);
    if (n.link) {
      router.push(n.link);
      setOpen(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        title="Notificações"
        className={`relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
          isCollapsed
            ? "p-2.5 justify-center mx-auto"
            : "px-3 py-2.5 gap-3 w-full"
        } ${
          open
            ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 border border-slate-200/80 dark:border-neutral-700 shadow-sm"
            : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100 hover:bg-slate-200/40 dark:hover:bg-neutral-800 border border-transparent"
        }`}
      >
        <Bell className="w-[20px] h-[20px] flex-shrink-0" />
        {!isCollapsed && (
          <span className="truncate flex-1 text-left">Notificações</span>
        )}
        {unreadCount > 0 && (
          <span
            className={`flex items-center justify-center bg-cyan-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 ${
              isCollapsed ? "absolute -top-0.5 -right-0.5" : ""
            }`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`absolute z-50 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-2xl overflow-hidden ${
            isCollapsed
              ? "left-full ml-2 top-0"
              : "left-0 right-0"
          }`}
          style={{
            width: isCollapsed ? "360px" : "100%",
            minWidth: isCollapsed ? "360px" : undefined,
            maxHeight: "480px",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
            <span className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
              Notificações
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas lidas
              </button>
            )}
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Bell className="w-8 h-8 mb-2" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800/50 ${
                      !n.is_read ? "bg-cyan-50/40 dark:bg-cyan-950/20" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0" />
                          )}
                          <p
                            className={`text-sm truncate ${
                              !n.is_read
                                ? "font-semibold text-slate-800 dark:text-neutral-200"
                                : "text-slate-600 dark:text-neutral-400"
                            }`}
                          >
                            {n.title}
                          </p>
                        </div>
                        {n.message && (
                          <p className="text-xs text-slate-500 dark:text-neutral-500 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                            {formatTime(n.created_at)}
                          </span>
                          {n.link && (
                            <ExternalLink className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(n.id);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded transition-colors flex-shrink-0 mt-0.5"
                          title="Marcar como lida"
                        >
                          <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
