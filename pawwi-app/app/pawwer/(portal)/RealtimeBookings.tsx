"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/client";

// Refresca una pantalla server-rendered cuando cambian las solicitudes/cuidados
// del pawwer (nuevas directas, candidaturas fase 2/3, aceptadas, canceladas…).
// Reusa las tablas ya publicadas en supabase_realtime (migs. 16/19).
export default function RealtimeBookings({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const channel = supabase
      .channel(`pawwer-cuidados-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "booking", filter: `pawwer_id=eq.${userId}` }, refresh)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "booking_candidates", filter: `pawwer_id=eq.${userId}` }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
