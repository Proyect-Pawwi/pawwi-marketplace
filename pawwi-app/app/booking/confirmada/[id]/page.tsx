import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import { CheckCircle2, Calendar, Dog, MessageCircle, ArrowRight } from "lucide-react";
import BookingActions from "./BookingActions";

export const metadata: Metadata = { title: "Reserva confirmada — Pawwi" };

const SERVICE_DISPLAY: Record<string, string> = {
  DayCare: "Guardería diurna",
  Night:   "Pernocta",
  Travel:  "Viaje con familia",
  Express: "Express (por horas)",
};

const STATUS_LABEL: Record<number, { label: string; color: string; bg: string; dot: string }> = {
  1: { label: "Pendiente de aceptación", color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",  dot: "bg-amber-400" },
  2: { label: "Confirmada",             color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",    dot: "bg-blue-400" },
  3: { label: "En curso",               color: "text-green-700",  bg: "bg-green-50 border-green-200",   dot: "bg-green-500" },
  4: { label: "Completada",             color: "text-gray-600",   bg: "bg-gray-50 border-gray-200",     dot: "bg-gray-400" },
  5: { label: "Cancelada",              color: "text-red-600",    bg: "bg-red-50 border-red-200",       dot: "bg-red-400" },
  6: { label: "Sin cuidador disponible", color: "text-gray-500",  bg: "bg-gray-50 border-gray-200",     dot: "bg-gray-400" },
};

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BookingConfirmadaPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/?modal=login&next=/booking/confirmada/${id}`);

  const { data: booking } = await supabase
    .from("booking")
    .select(`
      id, start_date, end_date, total, status_id, notes, created_at,
      service_type!booking_service_type_fkey ( name ),
      pawwer!booking_pawwer_id_fkey (
        id,
        profile!pawwer_profile_fk ( name, avatar_url )
      ),
      dog_booking!dog_booking_booking_id_fkey (
        dog!dog_booking_dog_id_fkey ( name, breed )
      )
    `)
    .eq("id", id)
    .eq("client_id", user.id)
    .single();

  if (!booking) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = booking as any;
  const pawwerName   = b.pawwer?.profile?.name ?? "Pawwer";
  const pawwerAvatar = b.pawwer?.profile?.avatar_url ?? null;
  const pawwerId     = b.pawwer?.id ?? "";
  const serviceName  = b.service_type?.name ?? "";
  const dogs: string[] = (b.dog_booking ?? []).map((db: { dog: { name: string } | null }) => db.dog?.name).filter(Boolean);
  const status       = STATUS_LABEL[b.status_id as number] ?? STATUS_LABEL[1]!;
  const ref          = `PWW-${id.slice(0, 8).toUpperCase()}`;

  // ¿ya calificó este cuidado? (para mostrar/ocultar el formulario de reseña)
  const { data: reviewRow } = await supabase
    .from("reviews").select("id").eq("booking_id", id).maybeSingle();
  const alreadyReviewed = !!reviewRow;

  return (
    <div className="min-h-screen bg-[#FFF1EB] relative overflow-hidden">
      {/* Blobs */}
      <div aria-hidden className="pointer-events-none absolute top-[-8%] left-[-8%] w-[320px] h-[320px] bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[80px] opacity-40" />
      <div aria-hidden className="pointer-events-none absolute bottom-[10%] right-[-8%] w-[250px] h-[250px] bg-[#FF7031] rounded-full mix-blend-multiply filter blur-[80px] opacity-15" />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/50 sticky top-0 z-20 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="/LogoPawwiCompleteOrange.svg" alt="Pawwi" className="h-6 w-auto" />
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-4 py-8 space-y-5">

        {/* Hero */}
        <div className="text-center py-4">
          <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center shadow-[0_12px_32px_rgba(18,10,43,0.08)] mb-4">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#120A2B] mb-1">¡Solicitud enviada!</h1>
          <p className="text-sm text-[#120A2B]/50">
            Ref. <span className="font-bold text-[#120A2B]">{ref}</span>
          </p>
        </div>

        {/* Status */}
        <div className={`border rounded-[20px] px-4 py-3 flex items-center gap-2 ${status.bg}`}>
          <div className={`w-2 h-2 rounded-full ${status.dot} shrink-0`} />
          <span className={`text-sm font-bold ${status.color}`}>{status.label}</span>
        </div>

        {/* Pawwer card */}
        <div className="bg-white rounded-[24px] shadow-[0_10px_30px_rgba(18,10,43,0.06)] p-4">
          <p className="text-[10px] font-extrabold text-[#120A2B]/40 uppercase tracking-widest mb-3">Tu Pawwer</p>
          <div className="flex items-center gap-3">
            {pawwerAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pawwerAvatar} alt={pawwerName} className="w-12 h-12 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#120A2B] flex items-center justify-center text-white font-extrabold text-lg shrink-0">
                {pawwerName[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-[#120A2B]">{pawwerName}</p>
              <p className="text-xs text-[#120A2B]/40">Pawwer verificado ✓</p>
            </div>
            <Link
              href={`/pawwer/${pawwerId}`}
              className="text-xs font-bold text-[#FF7031] hover:underline shrink-0"
            >
              Ver perfil
            </Link>
          </div>
        </div>

        {/* Booking details */}
        <div className="bg-white rounded-[24px] shadow-[0_10px_30px_rgba(18,10,43,0.06)] p-4 space-y-3">
          <p className="text-[10px] font-extrabold text-[#120A2B]/40 uppercase tracking-widest">Detalles</p>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#FFF1EB] flex items-center justify-center shrink-0">
              <Calendar size={15} className="text-[#FF7031]" />
            </div>
            <div>
              <p className="text-xs text-[#120A2B]/40">Servicio · Fechas</p>
              <p className="text-sm font-extrabold text-[#120A2B]">
                {SERVICE_DISPLAY[serviceName] ?? serviceName}
                {" · "}
                {fmtDate(b.start_date)}
                {b.start_date !== b.end_date && ` – ${fmtDate(b.end_date)}`}
              </p>
            </div>
          </div>

          {dogs.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#FFF1EB] flex items-center justify-center shrink-0">
                <Dog size={15} className="text-[#FF7031]" />
              </div>
              <div>
                <p className="text-xs text-[#120A2B]/40">Mascotas</p>
                <p className="text-sm font-extrabold text-[#120A2B]">{dogs.join(", ")}</p>
              </div>
            </div>
          )}

          <div className="h-px bg-gray-100" />

          <div className="flex justify-between items-center">
            <span className="text-sm text-[#120A2B]/50">Total</span>
            <span className="text-lg font-extrabold text-[#FF7031]">{fmtCOP(b.total)}</span>
          </div>
        </div>

        {/* Acciones del cliente: reseña (completada) / cancelar (antes de iniciar) */}
        <BookingActions
          bookingId={id}
          statusId={b.status_id as number}
          alreadyReviewed={alreadyReviewed}
          pawwerName={pawwerName}
        />

        {/* What's next — solo mientras está pendiente de aceptación */}
        {b.status_id === 1 && (
          <div className="bg-white rounded-[24px] shadow-[0_10px_30px_rgba(18,10,43,0.06)] p-4">
            <p className="text-[10px] font-extrabold text-[#120A2B]/40 uppercase tracking-widest mb-3">¿Qué sigue?</p>
            <ol className="space-y-3">
              {[
                "El Pawwer recibirá tu solicitud y tendrá hasta 1 hora para aceptarla.",
                "Si no responde a tiempo, buscamos otro Pawwer para ti automáticamente.",
                "Cuando alguien acepte, podrás coordinar los detalles por el chat de Pawwi.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#FFF1EB] text-[#FF7031] text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-[#120A2B]/60 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5 pb-8">
          <Link
            href="/mis-reservas"
            className="flex items-center justify-between w-full bg-[#120A2B] text-white rounded-[20px] px-5 py-4 font-bold text-sm hover:bg-[#1e1145] transition-colors shadow-[0_8px_20px_rgba(18,10,43,0.25)]"
          >
            <span className="flex items-center gap-2">
              <MessageCircle size={16} />
              Ver mis reservas
            </span>
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center w-full text-sm text-[#120A2B]/40 hover:text-[#120A2B] transition-colors py-3 font-medium"
          >
            Volver al marketplace
          </Link>
        </div>

      </main>
    </div>
  );
}
