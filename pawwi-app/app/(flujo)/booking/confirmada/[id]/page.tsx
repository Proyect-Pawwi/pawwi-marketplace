import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import { CheckCircle2, MessageCircle, ArrowRight, CreditCard } from "lucide-react";
import BookingActions from "./BookingActions";
import PagarReserva from "./PagarReserva";
import TicketCard, { TicketGrid } from "@/components/TicketCard";

export const metadata: Metadata = { title: "Tu reserva — Pawwi" };

const SERVICE_DISPLAY: Record<string, string> = {
  DayCare: "Guardería diurna",
  Night:   "Pernocta",
  Travel:  "Viaje con familia",
  Express: "Express (por horas)",
};

// Aceptada y sin pagar no es «Confirmada»: es el intermedio de S2 (mig 68).
const POR_PAGAR = { label: "Aceptada · falta tu pago", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-400" };

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
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BookingConfirmadaPage({ params, searchParams }: Props) {
  const { id } = await params;
  // Bold devuelve al cliente aquí con ?bold-order-id=…&bold-tx-status=…
  const volvioDeBold = Boolean((await searchParams)["bold-order-id"]);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/?modal=login&next=/booking/confirmada/${id}`);

  // OJO con las observaciones del cliente: la COLUMNA se llama `comments`.
  // `notes` es el nombre del PARÁMETRO de create_booking (p_notes), y pedirlo
  // aquí como columna tumbaba la consulta entera y rebotaba al home.
  const { data: booking, error } = await supabase
    .from("booking")
    .select(`
      id, start_date, end_date, total, status_id, created_at,
      charged_at, payment_due_at,
      service_type!fk_booking_service_type ( name ),
      pawwer!fk_booking_pawwer (
        id,
        profile!pawwer_profile_fk ( name, avatar_url )
      ),
      dog_booking!fk_dog_booking_booking (
        dog!fk_dog_booking_dog ( name, breed )
      )
    `)
    .eq("id", id)
    .eq("client_id", user.id)
    .single();

  // Rebotar al home sin decir por qué fue lo que escondió durante horas que las
  // pistas de FK del select no existían. Un redirect mudo no se depura.
  if (error) console.error("[Pawwi] detalle de reserva:", error.message, error.details);
  if (!booking) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = booking as any;
  const pawwerName   = b.pawwer?.profile?.name ?? "Pawwer";
  const pawwerAvatar = b.pawwer?.profile?.avatar_url ?? null;
  const pawwerId     = b.pawwer?.id ?? "";
  const serviceName  = b.service_type?.name ?? "";
  const dogs: string[] = (b.dog_booking ?? []).map((db: { dog: { name: string } | null }) => db.dog?.name).filter(Boolean);
  // Aceptada y esperando el pago del cliente. payment_due_at NULL = anterior a
  // S2: esas se confirmaron sin pasarela y se muestran como confirmadas.
  const porPagar     = b.status_id === 2 && !b.charged_at && !!b.payment_due_at;
  const status       = porPagar ? POR_PAGAR : STATUS_LABEL[b.status_id as number] ?? STATUS_LABEL[1]!;
  const ref          = `PWW-${id.slice(0, 8).toUpperCase()}`;
  const hero =
    porPagar             ? { icon: "pago", title: `${pawwerName} aceptó` } :
    b.status_id === 1    ? { icon: "ok",   title: "¡Solicitud enviada!" } :
    b.status_id === 2    ? { icon: "ok",   title: "Reserva confirmada" } :
                           { icon: "ok",   title: status.label };

  // ¿ya calificó este cuidado? (para mostrar/ocultar el formulario de reseña)
  const { data: reviewRow } = await supabase
    .from("reviews").select("id").eq("booking_id", id).maybeSingle();
  const alreadyReviewed = !!reviewRow;

  return (
    <div className="relative">

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
            {hero.icon === "pago"
              ? <CreditCard size={36} className="text-[#FF7031]" />
              : <CheckCircle2 size={40} className="text-green-500" />}
          </div>
          <h1 className="text-2xl font-extrabold text-[#120A2B] mb-1">{hero.title}</h1>
          <p className="text-sm text-[#120A2B]/50">
            Ref. <span className="font-bold text-[#120A2B]">{ref}</span>
          </p>
        </div>

        {/* Status */}
        <div className={`border rounded-[20px] px-4 py-3 flex items-center gap-2 ${status.bg}`}>
          <div className={`w-2 h-2 rounded-full ${status.dot} shrink-0`} />
          <span className={`text-sm font-bold ${status.color}`}>{status.label}</span>
        </div>

        {/* El pago — solo cuando el Pawwer ya aceptó (no se cobra nada antes) */}
        {porPagar && (
          <PagarReserva
            bookingId={id}
            total={Number(b.total)}
            dueAt={b.payment_due_at as string}
            pawwerName={pawwerName}
            volvioDeBold={volvioDeBold}
          />
        )}

        {/* La reserva como BILLETE. Antes eran dos tarjetas —«Tu Pawwer» y
            «Detalles»— con el total suelto al final de la segunda. Una reserva
            tiene titular, trayecto, hora e importe: es un billete, y las muescas
            lo dicen sin una palabra. Viene del diseño `21_ready_ticket`. */}
        <TicketCard
          footerLabel={b.charged_at ? "Total pagado" : "Total a pagar"}
          footerValue={fmtCOP(b.total)}
          header={
            <div className="flex items-center gap-3">
              {pawwerAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pawwerAvatar} alt={pawwerName} className="w-12 h-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-midnight flex items-center justify-center text-white font-extrabold text-lg shrink-0">
                  {pawwerName[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="eyebrow text-gray-400">Tu Pawwer</p>
                <p className="font-black text-midnight leading-tight truncate">{pawwerName}</p>
                <p className="text-xs text-midnight/40">Pawwer verificado ✓</p>
              </div>
              {pawwerId && (
                <Link
                  href={`/pawwer/${pawwerId}`}
                  className="text-xs font-bold text-tangerine hover:underline shrink-0"
                >
                  Ver perfil
                </Link>
              )}
            </div>
          }
        >
          <TicketGrid
            items={[
              {
                label: "Servicio",
                value: SERVICE_DISPLAY[serviceName] ?? serviceName,
              },
              {
                label: b.start_date !== b.end_date ? "Fechas" : "Fecha",
                value:
                  b.start_date !== b.end_date
                    ? `${fmtDate(b.start_date)} – ${fmtDate(b.end_date)}`
                    : fmtDate(b.start_date),
              },
              ...(dogs.length > 0
                ? [{
                    label: dogs.length === 1 ? "Mascota" : "Mascotas",
                    value: dogs.join(", "),
                  }]
                : []),
            ]}
          />
        </TicketCard>

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
                "Tu Pawwer tiene hasta 1 hora para aceptar tu solicitud.",
                "Si no puede y tú lo autorizaste al reservar, la ofrecemos a otros Pawwers verificados por el mismo precio.",
                "Cuando alguien acepte, aparece aquí y en tus reservas, y tienes 2 horas para pagar. No se te cobra nada antes.",
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
