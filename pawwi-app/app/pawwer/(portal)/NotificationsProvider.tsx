"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/client";

export type NotifType = "cuidado" | "mensaje" | "pago" | "noticia";

export interface NotifItem {
  id: string;
  type: NotifType;
  title: string;
  body: string | null;
  booking_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotifCounts {
  total: number;
  cuidado: number;
  mensaje: number;
  pago: number;
  noticia: number;
}

const ZERO: NotifCounts = { total: 0, cuidado: 0, mensaje: 0, pago: 0, noticia: 0 };

interface NotifCtx {
  counts: NotifCounts;
  items: NotifItem[];
  loading: boolean;
  refresh: () => void;
  markRead: (opts?: { type?: NotifType; bookingId?: string; id?: string }) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotifContext = createContext<NotifCtx>({
  counts: ZERO,
  items: [],
  loading: true,
  refresh: () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

export const useNotifications = () => useContext(NotifContext);

export function NotificationsProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
  const [counts, setCounts] = useState<NotifCounts>(ZERO);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());

  const refresh = useCallback(async () => {
    const supabase = supabaseRef.current;
    const [countsRes, itemsRes] = await Promise.all([
      supabase.rpc("get_notif_counts"),
      supabase.rpc("get_notifications", { p_limit: 30 }),
    ]);
    if (countsRes.data) setCounts({ ...ZERO, ...(countsRes.data as Partial<NotifCounts>) });
    if (Array.isArray(itemsRes.data)) setItems(itemsRes.data as NotifItem[]);
    setLoading(false);
  }, []);

  // markRead optimista: actualiza UI al instante, luego persiste y reconcilia.
  const markRead = useCallback<NotifCtx["markRead"]>(
    async (opts = {}) => {
      const { type, bookingId, id } = opts;

      setItems((prev) =>
        prev.map((n) =>
          n.read_at === null &&
          (id ? n.id === id : true) &&
          (type ? n.type === type : true) &&
          (bookingId ? n.booking_id === bookingId : true)
            ? { ...n, read_at: new Date().toISOString() }
            : n,
        ),
      );

      const supabase = supabaseRef.current;
      if (id) {
        await supabase.rpc("mark_notification_read", { p_id: id });
      } else {
        await supabase.rpc("mark_notifications_read", {
          p_type: type ?? null,
          p_booking_id: bookingId ?? null,
        });
      }
      await refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(() => markRead(), [markRead]);

  useEffect(() => {
    refresh();

    const supabase = supabaseRef.current;
    const channel = supabase
      .channel("pawwer-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return (
    <NotifContext.Provider value={{ counts, items, loading, refresh, markRead, markAllRead }}>
      {children}
    </NotifContext.Provider>
  );
}
