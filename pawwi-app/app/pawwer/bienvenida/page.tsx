import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import OnboardingWizard from "./OnboardingWizard";

export const metadata: Metadata = { title: "Completa tu perfil Pawwer — Pawwi" };

export default async function PawwerBienvenidaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data: profile } = await supabase
    .from("profile")
    .select("name, role, avatar_url, phone")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "pawwer") redirect("/");

  const { data: pawwer } = await supabase
    .from("pawwer")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (pawwer) redirect("/pawwer/dashboard");

  return (
    <OnboardingWizard
      name={profile?.name ?? "Pawwer"}
      avatarUrl={profile?.avatar_url ?? null}
      phone={profile?.phone ?? ""}
    />
  );
}
