"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/client";

// Refresca "Mis reservas" cuando cambia cualquier reserva del cliente
// (el pawwer acepta, el cuidado avanza de estado, se cancela, etc.).
export default function RealtimeClientBookings({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const channel = supabase
      .channel(`client-bookings-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "booking", filter: `client_id=eq.${userId}` }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
