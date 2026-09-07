import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import InicioClient from "./InicioClient";
import type { BookingRow, PawwerStats, ChartPoint } from "@/app/actions/portal";
import type { LevelDetail } from "@/lib/levels";

const DEFAULT_LEVEL_DETAIL: LevelDetail = {
  level: "nuevo",
  rating: 0,
  reviews_count: 0,
  cancel_rate: 0,
  active_last_30d: false,
  is_grace_new: true,
};

function getWeekRange(): { start: string; end: string } {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(monday), end: fmt(sunday) };
}

export default async function InicioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { start, end } = getWeekRange();

  // Avanza los cuidados por tiempo (confirmada→en curso→completada) EN PARALELO
  // con las lecturas — ya no bloquea la carga. El cron pg_cron (cada minuto) +
  // realtime cubren cualquier estado que acabe de cambiar. Ignoramos su resultado.
  const [, statsRes, chartRes, pendingRes, activeRes, profileRes, levelRes] = await Promise.all([
    supabase.rpc("advance_booking_statuses"),
    supabase.rpc("get_pawwer_stats", { p_start: start, p_end: end }),
    supabase.rpc("get_pawwer_earnings_daily", { p_start: start, p_end: end }),
    supabase.rpc("get_pawwer_bookings", { p_status_ids: [1] }),
    supabase.rpc("get_pawwer_bookings", { p_status_ids: [3] }),
    supabase.from("profile").select("name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.rpc("get_pawwer_level_detail"),
  ]);

  const levelDetail = (levelRes.data as LevelDetail | null) ?? DEFAULT_LEVEL_DETAIL;

  const stats: PawwerStats = (statsRes.data as PawwerStats) ?? {
    bookings_completed: 0,
    pawwer_earnings: 0,
    active_bookings: 0,
    pending_bookings: 0,
  };

  return (
    <InicioClient
      userId={user.id}
      userEmail={user.email ?? ""}
      profile={profileRes.data}
      initialStats={stats}
      initialChart={(chartRes.data as ChartPoint[]) ?? []}
      pendingBookings={(pendingRes.data as BookingRow[]) ?? []}
      activeBookings={(activeRes.data as BookingRow[]) ?? []}
      levelDetail={levelDetail}
    />
  );
}
