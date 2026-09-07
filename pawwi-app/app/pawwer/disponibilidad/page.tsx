import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import DisponibilidadCalendar from "./DisponibilidadCalendar";

export const metadata: Metadata = { title: "Mi disponibilidad — Pawwi" };

export default async function DisponibilidadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data: profile } = await supabase
    .from("profile")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "pawwer") redirect("/");

  // Disponibilidad próximos 60 días
  const now      = new Date();
  const today    = now.toISOString().split("T")[0]!;
  const in60days = new Date(now.getTime() + 60 * 86400000).toISOString().split("T")[0]!;

  const { data: slots } = await supabase
    .from("availability")
    .select("date, slots_remaining")
    .eq("pawwer_id", user.id)
    .gte("date", today)
    .lte("date", in60days)
    .order("date");

  const availMap: Record<string, number> = {};
  (slots ?? []).forEach(s => { availMap[s.date as string] = s.slots_remaining as number; });

  return (
    <DisponibilidadCalendar
      pawwerId={user.id}
      initialAvail={availMap}
      rangeStart={today}
      rangeEnd={in60days}
    />
  );
}
