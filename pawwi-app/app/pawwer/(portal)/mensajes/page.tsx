import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/server";
import type { BookingRow } from "@/app/actions/portal";
import { MessageCircle, ChevronRight, Dog } from "lucide-react";

import { SERVICE_LABEL as SERVICE_DISPLAY, SERVICE_COLOR } from "@/lib/services";

interface Msg {
  booking_id: string;
  content: string;
  photo_url: string | null;
  is_system: boolean;
  sender_id: string | null;
  seen_at: string | null;
  created_at: string;
}

// Hora relativa del último mensaje: "10:30 AM" hoy · "Ayer" · "5 nov".
// Formateo DETERMINÍSTICO en hora de Bogotá (UTC-5, sin DST): esto es un server
// component, así que toLocale* tomaría la zona horaria del SERVIDOR (UTC en prod)
// y mostraría las horas corridas 5h. Restamos 5h y leemos con getUTC*.
const REL_MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fmtRelTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000);
  const now = new Date(Date.now() - 5 * 3600 * 1000);
  const key = (x: Date) => `${x.getUTCFullYear()}-${x.getUTCMonth()}-${x.getUTCDate()}`;
  const yest = new Date(now.getTime() - 86_400_000);
  if (key(d) === key(now)) {
    let h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  if (key(d) === key(yest)) return "Ayer";
  return `${d.getUTCDate()} ${REL_MONTHS[d.getUTCMonth()]}`;
}

function preview(m: Msg | undefined, meId: string): string {
  if (!m) return "Toca para empezar a coordinar 🐾";
  if (m.is_system) return "📋 Resumen del cuidado";
  const prefix = m.sender_id === meId ? "Tú: " : "";
  if (m.photo_url) return `${prefix}📷 Foto`;
  return `${prefix}${m.content}`;
}

export default async function MensajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data } = await supabase.rpc("get_pawwer_bookings", { p_status_ids: [2, 3] });
  const threads = (data as BookingRow[]) ?? [];

  // Último mensaje + no-leídos por conversación (RLS ya restringe a las partes).
  const lastByBooking = new Map<string, Msg>();
  const unreadByBooking = new Map<string, boolean>();
  if (threads.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("booking_id, content, photo_url, is_system, sender_id, seen_at, created_at")
      .in("booking_id", threads.map((t) => t.id))
      .order("created_at", { ascending: false });
    for (const m of (msgs as Msg[]) ?? []) {
      if (!lastByBooking.has(m.booking_id)) lastByBooking.set(m.booking_id, m);
      if (m.sender_id && m.sender_id !== user.id && !m.seen_at) unreadByBooking.set(m.booking_id, true);
    }
  }

  // En curso primero, luego por actividad (último mensaje más reciente arriba).
  const sorted = [...threads].sort((a, b) => {
    if ((b.status_id === 3 ? 1 : 0) !== (a.status_id === 3 ? 1 : 0)) {
      return (b.status_id === 3 ? 1 : 0) - (a.status_id === 3 ? 1 : 0);
    }
    const ta = lastByBooking.get(a.id)?.created_at ?? a.created_at;
    const tb = lastByBooking.get(b.id)?.created_at ?? b.created_at;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

  return (
    <div className="min-h-screen relative font-sans">
      {/* Header estilo home */}
      <header className="relative z-20 pt-12 pb-3">
        <div className="max-w-xl mx-auto px-6">
          <p className="eyebrow text-[#FF7031] ">Coordina el cuidado</p>
          <div className="flex items-end justify-between gap-3 mt-1.5">
            <h1 className="text-3xl font-black text-[#120A2B] leading-none">Mensajes</h1>
            <span className="w-10 h-10 rounded-[14px] bg-[#120A2B] flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(18,10,43,0.15)]">
              <MessageCircle size={18} />
            </span>
          </div>
          <p className="text-sm text-[#120A2B]/50 mt-2">
            {threads.length > 0
              ? `${threads.length} conversación${threads.length !== 1 ? "es" : ""} con tus clientes`
              : "Chatea con tus clientes sobre sus peludos"}
          </p>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 pb-10 space-y-3 enter enter-1">
        {sorted.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-[32px] border border-white/80 p-10 text-center mt-4 shadow-[0_12px_30px_rgba(18,10,43,0.04)]">
            <div className="w-16 h-16 rounded-full bg-[#FFF1EB] flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} className="text-[#FF7031]" />
            </div>
            <p className="text-base font-black text-[#120A2B]">Sin conversaciones aún</p>
            <p className="text-xs text-[#120A2B]/45 mt-1.5 leading-relaxed">
              Cuando aceptes un cuidado, aquí se abre el chat con el cliente para
              coordinar y enviarle fotos de su peludo. 🐾
            </p>
          </div>
        ) : (
          sorted.map((b) => {
            const dogNames = b.dogs.map((d) => d.name).join(", ") || "Mascota";
            const isActive = b.status_id === 3;
            const last = lastByBooking.get(b.id);
            const unread = unreadByBooking.get(b.id) ?? false;
            const svcColor = SERVICE_COLOR[b.service_type] ?? "bg-gray-50 text-gray-600";

            return (
              <Link
                key={b.id}
                href={`/pawwer/mensajes/${b.id}`}
                className="flex items-center gap-3.5 bg-white rounded-[24px] border border-white shadow-[0_10px_30px_-10px_rgba(18,10,43,0.12)] p-4 hover:-translate-y-0.5 transition-transform relative"
              >
                {/* Avatar + punto de estado */}
                <div className="relative shrink-0">
                  {b.client.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.client.avatar_url} alt={b.client.name} className="w-14 h-14 rounded-[18px] object-cover border border-gray-100" />
                  ) : (
                    <div className="w-14 h-14 rounded-[18px] bg-[#120A2B] flex items-center justify-center text-white font-extrabold text-lg">
                      {b.client.name[0]?.toUpperCase()}
                    </div>
                  )}
                  {isActive && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[15px] truncate ${unread ? "font-black text-[#120A2B]" : "font-extrabold text-[#120A2B]"}`}>
                      {b.client.name}
                    </p>
                    <span className="text-[11px] font-semibold text-[#120A2B]/35 shrink-0">
                      {last ? fmtRelTime(last.created_at) : ""}
                    </span>
                  </div>

                  <p className={`text-sm truncate mt-0.5 ${unread ? "font-bold text-[#120A2B]/80" : "text-[#120A2B]/50"}`}>
                    {preview(last, user.id)}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${svcColor}`}>
                      {SERVICE_DISPLAY[b.service_type] ?? b.service_type}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#120A2B]/40 truncate">
                      <Dog size={11} className="text-[#FF7031] shrink-0" />
                      <span className="truncate">{dogNames}</span>
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-black text-green-600 shrink-0 ml-auto">En curso</span>
                    )}
                  </div>
                </div>

                {/* No leído / chevron */}
                {unread ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF7031] shrink-0 self-start mt-1" />
                ) : (
                  <ChevronRight size={16} className="text-[#120A2B]/20 shrink-0 self-center" />
                )}
              </Link>
            );
          })
        )}
      </main>
    </div>
  );
}
