import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import type { BookingRow, PayoutSummary } from "@/app/actions/portal";
import GananciasClient from "./GananciasClient";

export default async function GananciasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const [payoutRes, completedRes, cancelledRes, pawwerRes] = await Promise.all([
    supabase.rpc("get_pawwer_payout_summary"),
    supabase.rpc("get_pawwer_bookings", { p_status_ids: [4] }),
    supabase.rpc("get_pawwer_bookings", { p_status_ids: [5] }),
    supabase.from("pawwer").select("rating, reviews_count").eq("id", user.id).maybeSingle(),
  ]);

  // Fecha de "hoy" en Bogotá, determinística (independiente del TZ del servidor)
  // para que el filtrado por período no difiera entre SSR e hidratación.
  const todayBogota =
    (payoutRes.data as PayoutSummary | null)?.today ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

  return (
    <GananciasClient
      payout={payoutRes.data as PayoutSummary | null}
      completed={(completedRes.data as BookingRow[]) ?? []}
      cancelled={(cancelledRes.data as BookingRow[]) ?? []}
      today={todayBogota}
      rating={(pawwerRes.data?.rating as number | null) ?? 0}
      reviewsCount={(pawwerRes.data?.reviews_count as number | null) ?? 0}
    />
  );
}
