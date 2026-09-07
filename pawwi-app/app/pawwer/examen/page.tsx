import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import ExamenPawwer from "./ExamenPawwer";

export const metadata: Metadata = {
  title: "Evaluación Psicotécnica — Pawwi",
};

export default async function ExamenPage() {
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
  if (pawwer.status !== "exam_ready") redirect("/pawwer/dashboard");

  const { data: profile } = await supabase
    .from("profile")
    .select("name")
    .eq("id", user.id)
    .single();

  return <ExamenPawwer name={profile?.name ?? "Pawwer"} />;
}
