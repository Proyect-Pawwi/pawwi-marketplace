import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/server";
import type { BookingRow } from "@/app/actions/portal";
import { type SearchPhase, PHASE_LABEL, payoutBreakdown } from "@/lib/booking-config";
import { Dog, ClipboardList, CalendarX2, Clock, ChevronRight, MapPin } from "lucide-react";
import MarkNotificationsRead from "../MarkNotificationsRead";
import RealtimeBookings from "../RealtimeBookings";
import CuidadoTimer from "./CuidadoTimer";
import { SERVICE_LABEL_BRAND as SERVICE_DISPLAY, SERVICE_COLOR } from "@/lib/services";

// ── Configuraciones ───────────────────────────────────────────────────────────

const FILTERS = [
  { key: "nuevas",      label: "Nuevas",     ids: [1] },
  { key: "confirmadas", label: "Confirmadas", ids: [2] },
  { key: "en-curso",    label: "En curso",    ids: [3] },
  { key: "completadas", label: "Completadas", ids: [4] },
  { key: "canceladas",  label: "Canceladas",  ids: [5] },
] as const;

const STATUS_BADGE: Record<number, { label: string; cls: string; dot?: boolean; dotColor?: string }> = {
  1: { label: "Por revisar",  cls: "bg-red-50 text-red-600 border border-red-100", dot: true, dotColor: "bg-red-500" },
  2: { label: "Confirmada",   cls: "bg-[#E0F2FE] text-[#0284C7] border border-[#0284C7]/20" },
  3: { label: "En curso",     cls: "bg-green-50 text-green-600 border border-green-100", dot: true, dotColor: "bg-green-500" },
  4: { label: "Completada",   cls: "bg-gray-100 text-gray-500 border border-gray-200" },
  5: { label: "Cancelada",    cls: "bg-red-50 text-red-500 border border-red-100" },
  6: { label: "Sin cuidador", cls: "bg-gray-100 text-gray-400 border border-gray-200" },
};

const PHASE_BADGE_CLS: Record<SearchPhase, string> = {
  1: "bg-[#FF7031]/10 text-[#FF7031]",
  2: "bg-[#92C0E9]/20 text-[#0284C7]",
  3: "bg-[#F7AEF1]/30 text-[#6B21A8]",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DAYS   = ["dom","lun","mar","mié","jue","vie","sáb"];

function fmtRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  if (start === end) return `${s.getDate()} ${MONTHS[s.getMonth()]}`;
  if (s.getMonth() === e.getMonth())
    return `${s.getDate()}–${e.getDate()} ${MONTHS[s.getMonth()]}`;
  return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]}`;
}

// "8:00 AM" — Supabase devuelve "08:00:00"
function fmtTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hour = parseInt(h!, 10);
  if (Number.isNaN(hour)) return null;
  const suffix  = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${suffix}`;
}

function relativeDay(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0)  return "Hoy";
  if (diff === 1)  return "Mañana";
  if (diff === -1) return "Ayer";
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Formato humano: mismo día → "Hoy · 8:00 AM – 6:00 PM"; rango → "12 ago – 15 ago"
function fmtWhen(b: BookingRow): string {
  const start = b.start_date?.slice(0, 10);
  const end   = b.end_date?.slice(0, 10);
  if (!start) return "Fecha por confirmar";
  if (end && end !== start) return fmtRange(start, end);

  const day = relativeDay(start);
  const s   = fmtTime(b.start_time);
  const e   = fmtTime(b.end_time);
  if (s && e) return `${day} · ${s} – ${e}`;
  if (s)      return `${day} · ${s}`;
  return day;
}

// Distancia aproximada pawwer ↔ cliente (haversine, sin costo de API)
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = (bLat - aLat) * (Math.PI / 180);
  const dLng = (bLng - aLng) * (Math.PI / 180);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * (Math.PI / 180)) * Math.cos(bLat * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function fmtDistance(km: number): string {
  return km < 1 ? `a ${Math.round(km * 1000)} m de ti` : `a ${km.toFixed(1)} km de ti`;
}

function timeLeft(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Vencida";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m`;
}

function fmtCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CuidadosPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { filter: filterKey = "nuevas" } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];

  // Avanza los cuidados por tiempo EN PARALELO con las lecturas — ya no bloquea.
  // El cron pg_cron (cada minuto) + realtime cubren estados recién cambiados.
  const [, { data }, { data: pawwer }] = await Promise.all([
    supabase.rpc("advance_booking_statuses"),
    supabase.rpc("get_pawwer_bookings", {
      p_status_ids: activeFilter!.ids as unknown as number[],
    }),
    supabase.from("pawwer").select("lat, lng").eq("id", user.id).maybeSingle(),
  ]);
  const bookings = (data as BookingRow[]) ?? [];
  const pawwerLat = (pawwer?.lat as number | null) ?? null;
  const pawwerLng = (pawwer?.lng as number | null) ?? null;

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#FFF1EB] font-sans pb-10">

      {/* Al entrar a Cuidados, baja el contador de notificaciones de cuidado */}
      <MarkNotificationsRead type="cuidado" />

      {/* Solicitudes/cuidados en vivo: refresca al llegar/cambiar una reserva */}
      <RealtimeBookings userId={user.id} />

      {/* Atmósfera */}
      <div aria-hidden className="absolute top-[-5%] right-[-10%] w-80 h-80 bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[100px] opacity-25 z-0 pointer-events-none" />
      <div aria-hidden className="absolute top-[30%] left-[-15%] w-96 h-96 bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[100px] opacity-25 z-0 pointer-events-none" />
      <div aria-hidden className="absolute bottom-[0%] right-[-10%] w-80 h-80 bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[100px] opacity-25 z-0 pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 pt-12 pb-4">
        <div className="max-w-xl mx-auto px-6">
          <p className="eyebrow text-[#FF7031] ">Historial</p>
          <div className="flex items-end justify-between gap-3 mt-1.5 mb-6">
            <h1 className="text-3xl font-black text-[#120A2B] leading-none">Mis Cuidados</h1>
            <span className="w-10 h-10 rounded-[14px] bg-[#120A2B] flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(18,10,43,0.15)]">
              <ClipboardList size={18} />
            </span>
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={`/pawwer/cuidados?filter=${f.key}`}
                className={[
                  "flex-none px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
                  f.key === filterKey
                    ? "bg-[#120A2B] text-white shadow-[0_8px_20px_rgba(18,10,43,0.2)]"
                    : "bg-white/80 text-gray-500 hover:bg-white border border-white/50",
                ].join(" ")}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Lista */}
      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-4 enter enter-1">
        {bookings.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-sm rounded-[32px] border border-white/80 p-10 text-center mt-6 shadow-[0_12px_30px_rgba(18,10,43,0.03)]">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarX2 size={28} className="text-gray-300" />
            </div>
            <p className="text-base font-black text-[#120A2B]">Nada por aquí</p>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              No tienes reservas en estado{" "}
              <span className="font-bold text-[#120A2B]">&quot;{activeFilter.label}&quot;</span>.
            </p>
          </div>
        ) : (
          bookings.map((b) => {
            const badge    = STATUS_BADGE[b.status_id];
            const firstDog = b.dogs[0];
            // Identidad: "Bimba (Mestizo, 15kg)" — raza y peso si existen
            const dogTraits = firstDog
              ? [firstDog.breed, firstDog.weight_kg != null ? `${firstDog.weight_kg}kg` : null].filter(Boolean).join(", ")
              : "";
            const dogLabel = firstDog
              ? `${firstDog.name}${dogTraits ? ` (${dogTraits})` : ""}`
              : "Sin mascotas";
            const moreDogs = b.dogs.length > 1 ? ` +${b.dogs.length - 1}` : "";
            const svcLabel = SERVICE_DISPLAY[b.service_type] ?? b.service_type;
            const svcColor = SERVICE_COLOR[b.service_type] ?? "bg-gray-50 text-gray-600";
            const phase    = b.search_phase as SearchPhase;
            const left     = b.status_id === 1 ? timeLeft(b.phase_expires_at) : null;
            const distance = pawwerLat != null && pawwerLng != null && b.client_lat != null && b.client_lng != null
              ? fmtDistance(haversineKm(pawwerLat, pawwerLng, b.client_lat, b.client_lng))
              : null;
            const pay = payoutBreakdown(b.total, b.transport_fee, b.commission_rate);
            const pawwiTransp = b.transport_decided === true && b.transport_provider === "pawwi";

            return (
              <Link
                key={b.id}
                href={`/pawwer/cuidados/${b.id}`}
                className="block bg-white rounded-[28px] overflow-hidden shadow-[0_12px_30px_rgba(18,10,43,0.04)] border border-white hover:-translate-y-1 transition-transform"
              >
                {/* Phase banner — solo solicitudes nuevas */}
                {b.status_id === 1 && (
                  <div className={`px-5 pt-3 pb-2 flex items-center justify-between ${PHASE_BADGE_CLS[phase]}`}>
                    <span className="eyebrow ">
                      {PHASE_LABEL[phase]}
                    </span>
                    {left && (
                      <span className="flex items-center gap-1 text-[10px] font-bold">
                        <Clock size={10} />
                        {left}
                      </span>
                    )}
                  </div>
                )}

                {/* Timer de urgencia — confirmado (comienza en) / en curso (termina en) */}
                {(b.status_id === 2 || b.status_id === 3) && (
                  <CuidadoTimer
                    statusId={b.status_id}
                    startDate={b.start_date}
                    endDate={b.end_date}
                    startTime={b.start_time ?? null}
                    endTime={b.end_time ?? null}
                  />
                )}

                {/* Top */}
                <div className="px-5 pt-4 pb-3 flex justify-between items-center">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {b.client.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.client.avatar_url}
                        alt={b.client.name}
                        className="w-12 h-12 rounded-[16px] object-cover border border-gray-100 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-[16px] bg-[#120A2B] flex items-center justify-center text-white font-extrabold text-base shrink-0">
                        {b.client.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-extrabold text-[#120A2B] text-base truncate">
                        {b.client.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        🐾 {dogLabel}{moreDogs}
                      </p>
                      <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md ${svcColor}`}>
                        {svcLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0 pl-2">
                    {badge && (
                      <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-full ${badge.cls}`}>
                        {badge.dot && <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${badge.dotColor ?? "bg-green-500"}`} />}
                        {badge.label}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </div>

                {/* Ticket perforation */}
                <div className="relative h-px mx-0 my-2">
                  <div className="absolute inset-x-0 top-0 border-t-2 border-dashed border-gray-100" />
                  <div className="absolute left-[-10px] top-[-10px] w-5 h-5 rounded-full bg-[#FFF1EB]" />
                  <div className="absolute right-[-10px] top-[-10px] w-5 h-5 rounded-full bg-[#FFF1EB]" />
                </div>

                {/* Bottom */}
                <div className="px-5 py-4 flex items-center justify-between bg-gray-50/50">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-extrabold text-[#120A2B]">
                      {fmtWhen(b)}
                    </p>
                    {(distance || b.client_address || b.client_neighborhood) && (
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 min-w-0">
                        <MapPin size={11} className="text-[#FF7031] shrink-0" />
                        <span className="truncate">
                          {[distance, b.client_address || b.client_neighborhood].filter(Boolean).join(" · ")}
                        </span>
                      </p>
                    )}
                    {b.dogs.length > 1 && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Dog size={11} className="text-[#FF7031] shrink-0" />
                        <span className="truncate">{b.dogs.map(d => d.name).join(", ")}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 pl-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                      {pay.hasTransport ? "Cuidado" : "Ganancia"}
                    </p>
                    <p className="text-lg font-black text-[#120A2B]">{fmtCOP(pay.cuidado)}</p>
                    {pay.hasTransport && (
                      pawwiTransp
                        ? <p className="text-[10px] font-bold text-gray-400 mt-0.5">Transp. Pawwi</p>
                        : <p className="text-[10px] font-bold text-[#0284C7] mt-0.5">+{fmtCOP(pay.transport)} transp.</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </main>
    </div>
  );
}
