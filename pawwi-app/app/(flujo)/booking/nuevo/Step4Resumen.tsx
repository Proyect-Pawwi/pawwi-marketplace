import Link from "next/link";
import { ShieldCheck, Clock, CreditCard } from "lucide-react";
import SuccessStage from "@/components/SuccessStage";

interface Props { bookingId: string; total: number; }

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

export default function Step4Resumen({ bookingId, total }: Props) {
  const ref = `PWW-2026-${bookingId.slice(0, 6).toUpperCase()}`;
  return (
    // SIN confeti, a propósito: «solicitud enviada» NO es una confirmación. El
    // Pawwer tiene una hora para aceptar y puede declinar. Celebrar aquí sería
    // prometer algo que todavía no ha pasado — la misma deuda que PawwiProtect.
    // El marco (fondo, tipografía, atmósfera) lo da el layout de `(flujo)`.
    <SuccessStage
      confetti={false}
      icon={<ShieldCheck size={44} />}
      title="Solicitud enviada"
      description={
        <>
          Referencia <span className="font-bold text-midnight">{ref}</span>
        </>
      }
    >
      <div className="max-w-sm mx-auto w-full space-y-3 text-left">
        <div className="bg-cream/70 rounded-card p-5 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-midnight/50 font-medium">Total a pagar</span>
            <span className="font-black text-tangerine text-lg">{fmtCOP(total)}</span>
          </div>
          <div className="h-px bg-midnight/5" />
          {/* 1 hora, que es lo que pone set_booking_phase_expiry. Antes decía
              30 min y no correspondía con ninguna regla del sistema. */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2.5 text-xs text-amber-700">
            <Clock size={13} className="text-amber-500 shrink-0" />
            <span>El Pawwer tiene <strong>1 hora</strong> para aceptar tu solicitud.</span>
          </div>
        </div>

        {/* Cuándo se paga. No se cobra nada hasta que las dos partes aceptaron
            (mig 68): el pago es el último paso, no el primero. */}
        <div className="bg-cream/70 rounded-card p-5">
          <div className="flex items-center justify-center gap-2 text-midnight mb-1">
            <CreditCard size={18} className="text-tangerine" />
            <span className="text-sm font-bold">Todavía no pagas nada</span>
          </div>
          <p className="text-xs text-midnight/50 text-center leading-relaxed">
            Cuando tu Pawwer acepte, la reserva aparece en tus reservas y tienes 2 horas para
            pagar. Hasta entonces no se te cobra nada.
          </p>
        </div>

        {/* A la reserva — ahí aparece el botón de pagar cuando acepten */}
        <Link
          href={`/booking/confirmada/${bookingId}`}
          className="block w-full bg-midnight text-white rounded-full py-4 font-bold text-center shadow-dark active:scale-[0.98] transition-transform"
        >
          Ver mi reserva
        </Link>
        <Link
          href="/"
          className="block text-center text-sm font-semibold text-midnight/40 hover:text-midnight transition-colors underline underline-offset-2"
        >
          Volver al marketplace
        </Link>
      </div>
    </SuccessStage>
  );
}
