import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import AgendarVisita from "./AgendarVisita";

export const metadata: Metadata = {
  title: "Pawwi — Agendar visita al hogar",
};

export default async function VisitaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data: pawwer } = await supabase
    .from("pawwer")
    .select("id, status")
    .eq("id", user.id)
    .single();

  if (!pawwer) redirect("/pawwer/bienvenida");
  if (pawwer.status === "approved") redirect("/pawwer/dashboard");
  if (pawwer.status !== "visita_pendiente") redirect("/pawwer/dashboard");

  const { data: profile } = await supabase
    .from("profile")
    .select("name")
    .eq("id", user.id)
    .single();

  // Check if already scheduled
  const { data: existingVisita } = await supabase
    .from("visita_domiciliaria")
    .select("scheduled_date, time_slot, status")
    .eq("pawwer_id", user.id)
    .in("status", ["pending", "confirmed"])
    .maybeSingle();

  return (
    <AgendarVisita
      name={profile?.name ?? "Pawwer"}
      existingVisita={existingVisita ?? null}
    />
  );
}
