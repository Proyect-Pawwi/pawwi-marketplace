import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import FaqClient from "./FaqClient";
import type { FaqItem } from "@/app/actions/perfil";

export default async function FaqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data } = await supabase.from("pawwer").select("faqs").eq("id", user.id).maybeSingle();
  const raw = data?.faqs;
  const faqs: FaqItem[] = Array.isArray(raw)
    ? (raw as unknown[]).map((x) => {
        const o = x as { q?: string; a?: string };
        return { q: o.q ?? "", a: o.a ?? "" };
      })
    : [];

  return <FaqClient initial={faqs} />;
}
