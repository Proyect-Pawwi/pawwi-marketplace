import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import PerfilHub from "./PerfilHub";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const [profileRes, pawwerRes] = await Promise.all([
    supabase.from("profile").select("name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase
      .from("pawwer")
      .select("badge, verified, accepting_bookings, recepcion_desde, recepcion_hasta, rating, reviews_count")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const pawwer = pawwerRes.data;

  return (
    <PerfilHub
      userId={user.id}
      name={(profile?.name as string | null) ?? ""}
      avatarUrl={(profile?.avatar_url as string | null) ?? null}
      badge={(pawwer?.badge as string | null) ?? "Verificado"}
      acceptingBookings={(pawwer?.accepting_bookings as boolean | null) ?? true}
      recepcionDesde={(pawwer?.recepcion_desde as string | null) ?? null}
      recepcionHasta={(pawwer?.recepcion_hasta as string | null) ?? null}
      rating={(pawwer?.rating as number | null) ?? 0}
      reviewsCount={(pawwer?.reviews_count as number | null) ?? 0}
    />
  );
}
