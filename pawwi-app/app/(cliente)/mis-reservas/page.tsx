import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import { Calendar, Dog, ChevronRight, PawPrint, CalendarDays, Search } from "lucide-react";
import RealtimeClientBookings from "./RealtimeClientBookings";
import { SERVICE_LABEL as SERVICE_DISPLAY } from "@/lib/services";

export const metadata: Metadata = { title: "Mis reservas — Pawwi" };

// El Pawwer aceptó y falta el pago del cliente (mig 68). No es «Confirmada».
const POR_PAGAR = { label: "Por pagar", bg: "bg-cream", text: "text-tangerine" };

const STATUS_CONFIG: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: "Pendiente",    bg: "bg-amber-50",  text: "text-amber-700" },
  2: { label: "Confirmada",   bg: "bg-blue-50",   text: "text-blue-700" },
  3: { label: "En curso",     bg: "bg-green-50",  text: "text-green-700" },
  4: { label: "Completada",   bg: "bg-gray-50",   text: "text-gray-500" },
  5: { label: "Cancelada",    bg: "bg-red-50",    text: "text-red-600" },
  6: { label: "Sin cuidador", bg: "bg-gray-50",   text: "text-gray-500" },
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

  const { data, error } = await supabase
    .from("booking")
    .select(`
      id, start_date, end_date, total, status_id, created_at,
      charged_at, payment_due_at, search_phase, allow_pool,
      service_type!fk_booking_service_type ( name ),
      pawwer!fk_booking_pawwer (
        id,
        profile!pawwer_profile_fk ( name, avatar_url )
      ),
      dog_booking!fk_dog_booking_booking (
        dog!fk_dog_booking_dog ( name )
      )
    `)
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  // Si el select falla, `data` es null y la lista sale VACÍA — indistinguible de
  // «no tienes reservas». Sin este log, el cliente ve un estado vacío que miente.
  if (error) console.error("[Pawwi] mis-reservas:", error.message, error.details);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookings = (data ?? []) as any[];

  const active    = bookings.filter(b => [1, 2, 3].includes(b.status_id));
  const past      = bookings.filter(b => [4, 5, 6].includes(b.status_id));

  return (
    <div className="relative">
      {/* Actualiza en vivo cuando el pawwer acepta / el cuidado avanza / se cancela */}
      <RealtimeClientBookings userId={user.id} />

      {/* Cabecera de pantalla-TAB, el patrón del design system: antetítulo +
          `h1 text-3xl font-black` + chip de ícono, y SIN botón de volver —es una
          pestaña, no hay a dónde volver—. Antes era una barra pegajosa con
          flecha y `text-base`, que es el patrón de una SUB-pantalla. */}
      <header className="relative z-20 pt-12 pb-4">
        <div className="max-w-xl mx-auto px-6">
          <p className="eyebrow text-tangerine">Tus reservas</p>
          <div className="flex items-end justify-between gap-3 mt-1.5">
            <h1 className="text-3xl font-black text-midnight leading-none">Mis Reservas</h1>
            <span className="w-10 h-10 rounded-chip bg-midnight flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(18,10,43,0.15)]">
              <CalendarDays size={18} />
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-8 pb-10">

        {bookings.length === 0 ? (
          <div className="enter enter-1 mt-8 flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-card">
              <PawPrint size={36} className="text-midnight/20" />
            </div>
            <div>
              <p className="font-black text-midnight mb-1">Sin reservas todavía</p>
              <p className="text-sm text-midnight/40">Encuentra el Pawwer perfecto para tu peludo.</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-tangerine text-white font-bold px-6 py-3.5 rounded-full text-sm shadow-[0_8px_20px_rgba(255,112,49,0.35)] active:scale-95 transition-transform"
            >
              Explorar Pawwers
            </Link>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section className="space-y-3 enter enter-1">
                <p className="eyebrow text-gray-400">Activas</p>
                {active.map(b => <BookingCard key={b.id} booking={b} />)}
              </section>
            )}

            {past.length > 0 && (
              <section className="space-y-3 enter enter-2">
                <p className="eyebrow text-gray-400">Historial</p>
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
  const porPagar  = b.status_id === 2 && !b.charged_at && !!b.payment_due_at;
  const status    = porPagar ? POR_PAGAR : STATUS_CONFIG[b.status_id as number] ?? STATUS_CONFIG[1]!;

  // 🔴 EL BLOQUEADOR #3 DEL PLAN, ARREGLADO AQUÍ.
  // Cuando una reserva pasa a la bolsa, el cron hace `pawwer_id = NULL`. Esta
  // tarjeta hacía `?? "Pawwer"`, así que la clienta veía literalmente la palabra
  // «Pawwer» con una «P» genérica donde antes estaba «Juliana M.» y su foto.
  // No era «falta una notificación»: **parecía un error de la aplicación**, y le
  // ocurría en el momento de más ansiedad — cuando no sabe quién va a cuidar a
  // su perro. La regla ahora es absoluta: la palabra «Pawwer» NUNCA aparece
  // donde debería ir un nombre. Si no hay cuidador, la tarjeta DICE qué pasa.
  const tienePawwer = !!b.pawwer?.profile?.name;
  const pawwerName  = b.pawwer?.profile?.name ?? null;
  const pawwerAvatar = b.pawwer?.profile?.avatar_url ?? null;

  // Sin cuidador asignado, el título explica el estado real en lugar de mentir.
  const sinCuidador =
    b.status_id === 6 ? "Nadie pudo tomarla"
    : b.search_phase === 2 ? "Buscando otro cuidador"
    : "Buscando cuidador";

  const dogs: string[] = (b.dog_booking ?? []).map((db: { dog: { name: string } | null }) => db.dog?.name).filter(Boolean);
  const serviceName = b.service_type?.name ?? "";

  return (
    <Link
      href={`/booking/confirmada/${b.id}`}
      className={[
        "flex items-center gap-3 bg-white rounded-card shadow-card p-4",
        "hover:-translate-y-1 transition-transform",
        dimmed ? "opacity-70" : "",
      ].join(" ")}
    >
      {/* Avatar: foto si hay Pawwer, y si no un ícono de búsqueda — nunca una
          inicial inventada a partir de la palabra «Pawwer». */}
      {tienePawwer && pawwerAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pawwerAvatar} alt={pawwerName!} className="w-12 h-12 rounded-full object-cover shrink-0" />
      ) : tienePawwer ? (
        <div className="w-12 h-12 rounded-full bg-midnight flex items-center justify-center text-white font-black text-lg shrink-0">
          {pawwerName![0]?.toUpperCase()}
        </div>
      ) : (
        <div className="w-12 h-12 rounded-full bg-cream border border-tangerine/20 flex items-center justify-center text-tangerine shrink-0">
          <Search size={18} />
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`font-black text-sm truncate ${tienePawwer ? "text-midnight" : "text-midnight/70"}`}>
            {tienePawwer ? pawwerName : sinCuidador}
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${status.bg} ${status.text}`}>
            {status.label}
          </span>
        </div>

        {/* Con la reserva en la bolsa, se explica en una línea qué está pasando.
            El consentimiento previo (`allow_pool`) evita la sustitución
            silenciosa, pero permiso no es lo mismo que enterarse. */}
        {!tienePawwer && b.status_id !== 6 && (
          <p className="text-xs text-tangerine font-semibold truncate">
            {b.allow_pool
              ? "Buscamos entre los Pawwers verificados por el mismo precio"
              : "Tu Pawwer no pudo — elige otro cuando quieras"}
          </p>
        )}

        <p className="text-xs text-midnight/45 flex items-center gap-1.5 truncate">
          <Calendar size={10} className="shrink-0" />
          {fmtDate(b.start_date)}{b.start_date !== b.end_date ? ` – ${fmtDate(b.end_date)}` : ""}
          {serviceName && ` · ${SERVICE_DISPLAY[serviceName] ?? serviceName}`}
        </p>

        {dogs.length > 0 && (
          <p className="text-xs text-midnight/40 flex items-center gap-1 truncate">
            <Dog size={10} className="shrink-0" />
            {dogs.join(", ")}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-black text-tangerine">{fmtCOP(b.total)}</span>
        <ChevronRight size={14} className="text-midnight/20" />
      </div>
    </Link>
  );
}
