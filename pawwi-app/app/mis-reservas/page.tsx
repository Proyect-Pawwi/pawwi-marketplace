import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import { ArrowLeft, Calendar, Dog, ChevronRight, PawPrint } from "lucide-react";
import RealtimeClientBookings from "./RealtimeClientBookings";
import { SERVICE_LABEL as SERVICE_DISPLAY } from "@/lib/services";

export const metadata: Metadata = { title: "Mis reservas — Pawwi" };

const STATUS_CONFIG: Record<number, { label: string; dot: string; bg: string; text: string }> = {
  1: { label: "Pendiente",   dot: "bg-amber-400",  bg: "bg-amber-50",  text: "text-amber-700" },
  2: { label: "Confirmada",  dot: "bg-blue-400",   bg: "bg-blue-50",   text: "text-blue-700" },
  3: { label: "En curso",    dot: "bg-green-500",  bg: "bg-green-50",  text: "text-green-700" },
  4: { label: "Completada",  dot: "bg-gray-300",   bg: "bg-gray-50",   text: "text-gray-500" },
  5: { label: "Cancelada",   dot: "bg-red-400",    bg: "bg-red-50",    text: "text-red-600" },
  6: { label: "Sin cuidador", dot: "bg-gray-300",  bg: "bg-gray-50",   text: "text-gray-500" },
};

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

export default async function MisReservasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?modal=login&next=/mis-reservas");

  const { data } = await supabase
    .from("booking")
    .select(`
      id, start_date, end_date, total, status_id, created_at,
      service_type!booking_service_type_fkey ( name ),
      pawwer!booking_pawwer_id_fkey (
        id,
        profile!pawwer_profile_fk ( name, avatar_url )
      ),
      dog_booking!dog_booking_booking_id_fkey (
        dog!dog_booking_dog_id_fkey ( name )
      )
    `)
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookings = (data ?? []) as any[];

  const active    = bookings.filter(b => [1, 2, 3].includes(b.status_id));
  const past      = bookings.filter(b => [4, 5, 6].includes(b.status_id));

  return (
    <div className="min-h-screen bg-[#FFF1EB] relative overflow-hidden">
      {/* Actualiza en vivo cuando el pawwer acepta / el cuidado avanza / se cancela */}
      <RealtimeClientBookings userId={user.id} />

      {/* Blobs */}
      <div aria-hidden className="pointer-events-none absolute top-[-8%] left-[-8%] w-[280px] h-[280px] bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[80px] opacity-40" />
      <div aria-hidden className="pointer-events-none absolute bottom-[10%] right-[-5%] w-[220px] h-[220px] bg-[#FF7031] rounded-full mix-blend-multiply filter blur-[80px] opacity-15" />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/50 sticky top-0 z-20 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-[#120A2B]/10 hover:bg-white/60 transition-colors shrink-0"
          >
            <ArrowLeft size={16} className="text-[#120A2B]" />
          </Link>
          <h1 className="text-base font-extrabold text-[#120A2B]">Mis reservas</h1>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-4 py-5 space-y-6 pb-12">

        {bookings.length === 0 ? (
          <div className="mt-12 flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(18,10,43,0.06)]">
              <PawPrint size={36} className="text-[#120A2B]/20" />
            </div>
            <div>
              <p className="font-extrabold text-[#120A2B] mb-1">Sin reservas todavía</p>
              <p className="text-sm text-[#120A2B]/40">Encuentra el Pawwer perfecto para tu peludo.</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#FF7031] text-white font-bold px-6 py-3 rounded-full text-sm hover:bg-[#e6652c] transition-colors shadow-[0_4px_12px_rgba(255,112,49,0.3)]"
            >
              Explorar Pawwers
            </Link>
          </div>
        ) : (
          <>
            {/* Active */}
            {active.length > 0 && (
              <section className="space-y-3">
                <p className="text-[10px] font-extrabold text-[#120A2B]/40 uppercase tracking-widest">
                  Activas
                </p>
                {active.map(b => <BookingCard key={b.id} booking={b} />)}
              </section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <section className="space-y-3">
                <p className="text-[10px] font-extrabold text-[#120A2B]/40 uppercase tracking-widest">
                  Historial
                </p>
                {past.map(b => <BookingCard key={b.id} booking={b} dimmed />)}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BookingCard({ booking: b, dimmed = false }: { booking: any; dimmed?: boolean }) {
  const status    = STATUS_CONFIG[b.status_id as number] ?? STATUS_CONFIG[1]!;
  const pawwerName = b.pawwer?.profile?.name ?? "Pawwer";
  const pawwerAvatar = b.pawwer?.profile?.avatar_url ?? null;
  const dogs: string[] = (b.dog_booking ?? []).map((db: { dog: { name: string } | null }) => db.dog?.name).filter(Boolean);
  const serviceName = b.service_type?.name ?? "";

  return (
    <Link
      href={`/booking/confirmada/${b.id}`}
      className={[
        "flex items-center gap-3 bg-white rounded-[20px] shadow-[0_8px_24px_rgba(18,10,43,0.06)] p-4 hover:shadow-[0_12px_32px_rgba(18,10,43,0.10)] transition-shadow",
        dimmed ? "opacity-70" : "",
      ].join(" ")}
    >
      {/* Pawwer avatar */}
      {pawwerAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pawwerAvatar} alt={pawwerName} className="w-12 h-12 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-[#120A2B] flex items-center justify-center text-white font-extrabold text-lg shrink-0">
          {pawwerName[0]?.toUpperCase()}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-extrabold text-sm text-[#120A2B] truncate">{pawwerName}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${status.bg} ${status.text}`}>
            {status.label}
          </span>
        </div>

        <p className="text-xs text-[#120A2B]/45 flex items-center gap-1.5 truncate">
          <Calendar size={10} className="shrink-0" />
          {fmtDate(b.start_date)}{b.start_date !== b.end_date ? ` – ${fmtDate(b.end_date)}` : ""}
          {serviceName && ` · ${SERVICE_DISPLAY[serviceName] ?? serviceName}`}
        </p>

        {dogs.length > 0 && (
          <p className="text-xs text-[#120A2B]/40 flex items-center gap-1 truncate">
            <Dog size={10} className="shrink-0" />
            {dogs.join(", ")}
          </p>
        )}
      </div>

      {/* Price + chevron */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-extrabold text-[#FF7031]">{fmtCOP(b.total)}</span>
        <ChevronRight size={14} className="text-[#120A2B]/20" />
      </div>
    </Link>
  );
}
