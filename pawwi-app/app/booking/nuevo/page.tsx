import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import Step1Servicios from "./Step1Servicios";
import Step2Fechas from "./Step2Fechas";
import Step3Mascota from "./Step3Mascota";
import Step4Resumen from "./Step4Resumen";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reservar — Pawwi" };

interface Props {
  searchParams: Promise<{
    pawwer_id?:  string;
    step?:       string;
    service_id?: string;
    start?:      string;
    end?:        string;
    hours?:      string;
    start_time?: string;
    end_time?:   string;
    booking_id?: string;
    total?:      string;
  }>;
}

function getAvailabilityWindow() {
  const now      = new Date();
  const today    = now.toISOString().split("T")[0]!;
  const in60days = new Date(now.getTime() + 60 * 86400000).toISOString().split("T")[0]!;
  return { today, in60days };
}

export default async function BookingPage({ searchParams }: Props) {
  const sp         = await searchParams;
  const pawwer_id  = sp.pawwer_id ?? "";
  const step       = parseInt(sp.step ?? "1");
  const service_id = sp.service_id ? parseInt(sp.service_id) : null;
  const start      = sp.start ?? null;
  const end        = sp.end ?? null;
  const hours      = sp.hours ? parseInt(sp.hours) : null;
  const start_time = sp.start_time ?? null;
  const end_time   = sp.end_time ?? null;
  const booking_id = sp.booking_id ?? null;
  const total      = sp.total ? parseInt(sp.total) : null;

  if (!pawwer_id && step < 4) redirect("/");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const qs = new URLSearchParams(
      Object.entries(sp).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
    const returnTo = `/booking/nuevo${qs ? `?${qs}` : ""}`;
    redirect(`/?modal=login&next=${encodeURIComponent(returnTo)}`);
  }

  // ── Step 4: resumen pre-pago (placeholder S4) ─────────────────────────────
  if (step === 4 && booking_id && total !== null) {
    return <Step4Resumen bookingId={booking_id} total={total} />;
  }

  // ── Step 1: selección de servicio ─────────────────────────────────────────
  if (step === 1) {
    const { data: pawwer } = await supabase
      .from("pawwer")
      .select(`
        id, badge, neighborhood,
        profile!pawwer_profile_fk ( name, avatar_url ),
        services:service_X_Pawwer ( id_service, price, max_animals, is_active, service_type ( id, name ) )
      `)
      .eq("id", pawwer_id)
      .single();

    if (!pawwer) redirect("/");

    return (
      <Step1Servicios
        pawwer={pawwer as unknown as Parameters<typeof Step1Servicios>[0]["pawwer"]}
        preSelectedServiceId={service_id}
        preStart={start}
        preEnd={end}
        preHours={hours}
      />
    );
  }

  // ── Step 2: calendario de fechas ──────────────────────────────────────────
  if (step === 2) {
    if (!service_id) redirect(`/booking/nuevo?pawwer_id=${pawwer_id}&step=1`);

    const { today, in60days } = getAvailabilityWindow();

    const [pawwerRes, availRes] = await Promise.all([
      supabase
        .from("pawwer")
        .select("id, week_pattern, profile!pawwer_profile_fk ( name, avatar_url )")
        .eq("id", pawwer_id)
        .single(),
      supabase
        .from("availability")
        .select("date")
        .eq("pawwer_id", pawwer_id)
        .gte("date", today)
        .lte("date", in60days)
        .gt("slots_remaining", 0),
    ]);

    if (!pawwerRes.data) redirect("/");

    return (
      <Step2Fechas
        pawwer={pawwerRes.data as unknown as Parameters<typeof Step2Fechas>[0]["pawwer"]}
        serviceId={service_id}
        availableDates={(availRes.data ?? []).map((r) => r.date as string)}
        preStart={start}
        preEnd={end}
        preHours={hours}
        preStartTime={start_time}
        preEndTime={end_time}
      />
    );
  }

  // ── Step 3: selección de mascota y notas ──────────────────────────────────
  if (step === 3) {
    if (!service_id || !start) redirect(`/booking/nuevo?pawwer_id=${pawwer_id}&step=1`);

    const [pawwerRes, dogsRes, serviceRes] = await Promise.all([
      supabase
        .from("pawwer")
        .select("id, transport_price, profile!pawwer_profile_fk ( name, avatar_url )")
        .eq("id", pawwer_id)
        .single(),
      supabase
        .from("dog")
        .select("id, name, breed, size, photo_url, vaccine")
        .eq("owner_id", user.id)
        .order("created_at"),
      supabase
        .from("service_X_Pawwer")
        .select("price, service_type ( name )")
        .eq("id_pawwer", pawwer_id)
        .eq("id_service", service_id)
        .single(),
    ]);

    if (!pawwerRes.data) redirect("/");

    return (
      <Step3Mascota
        pawwer={pawwerRes.data as unknown as Parameters<typeof Step3Mascota>[0]["pawwer"]}
        dogs={(dogsRes.data ?? []) as Parameters<typeof Step3Mascota>[0]["dogs"]}
        serviceId={service_id}
        serviceName={(serviceRes.data?.service_type as { name?: string } | null)?.name ?? ""}
        servicePrice={serviceRes.data?.price ?? 0}
        transportPrice={(pawwerRes.data as { transport_price?: number }).transport_price ?? 0}
        start={start}
        end={end ?? start}
        hours={hours}
        startTime={start_time}
        endTime={end_time}
      />
    );
  }

  redirect("/");
}
