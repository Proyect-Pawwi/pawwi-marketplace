import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import CapacitacionPawwer from "./CapacitacionPawwer";

export const metadata: Metadata = {
  title: "Pawwi Academy — Capacitación",
};

export default async function CapacitacionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data: pawwer } = await supabase
    .from("pawwer")
    .select("id, status")
    .eq("id", user.id)
    .single();

  if (!pawwer) redirect("/pawwer/bienvenida");
  if (pawwer.status === "approved") redirect("/pawwer/dashboard");
  if (pawwer.status === "visita_pendiente") redirect("/pawwer/visita");
  if (pawwer.status !== "preselected") redirect("/pawwer/dashboard");

  const { data: profile } = await supabase
    .from("profile")
    .select("name")
    .eq("id", user.id)
    .single();

  return <CapacitacionPawwer name={profile?.name ?? "Pawwer"} />;
}
