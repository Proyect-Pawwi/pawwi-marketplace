"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Ban, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cancelBookingClient, createReview, getCancelTerms, type CancelTerms } from "@/app/actions/client";

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

// Lo que pasa con el dinero si cancela ahora. La regla vive en la base
// (get_cancellation_terms); aquí solo se dice en palabras.
function textoCancelacion(t: CancelTerms | null, pawwerName: string): string {
  if (!t) return "Esta acción no se puede deshacer.";
  if (!t.charged) return "Todavía no has pagado, así que no se te cobra nada. Esta acción no se puede deshacer.";
  if (t.refund > 0) {
    return `Faltan más de 48 horas: te devolvemos el 100% (${fmtCOP(t.refund)}). Te escribimos por correo para hacer la devolución.`;
  }
  return `Faltan menos de 48 horas: no hay reembolso. ${pawwerName} bloqueó el día para tu perro y recibe su pago.`;
}

export default function BookingActions({
  bookingId,
  statusId,
  alreadyReviewed,
  pawwerName,
}: {
  bookingId: string;
  statusId: number;
  alreadyReviewed: boolean;
  pawwerName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Cancelación
  const [showCancel, setShowCancel] = useState(false);
  const [terms, setTerms] = useState<CancelTerms | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  // Reseña
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(alreadyReviewed);

  const canCancel = statusId === 1 || statusId === 2;
  const canReview = statusId === 4 && !reviewed;

  // Antes de pedir la confirmación, traer qué pasaría con el dinero.
  function abrirCancelar() {
    setError(null);
    startTransition(async () => {
      setTerms(await getCancelTerms(bookingId));
      setShowCancel(true);
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelBookingClient(bookingId);
      if (res.error) { setError(res.error); setShowCancel(false); return; }
      setResultado(
        res.refund && res.refund > 0
          ? `Reserva cancelada. Te devolvemos ${fmtCOP(res.refund)}: te escribimos por correo para hacer la devolución.`
          : res.late
            ? "Reserva cancelada. Como faltaban menos de 48 horas, no hay reembolso."
            : "Reserva cancelada. No se te cobró nada.",
      );
      router.refresh();
    });
  }

  function handleReview() {
    if (rating < 1) { setError("Selecciona una calificación."); return; }
    setError(null);
    startTransition(async () => {
      const res = await createReview(bookingId, rating, comment.trim());
      if (res.error) { setError(res.error); return; }
      setReviewed(true);
      router.refresh();
    });
  }

  if (!canCancel && !canReview && !reviewed && !resultado) return null;

  return (
    <div className="space-y-3">
      {resultado && (
        <div className="bg-white border border-gray-100 rounded-[16px] px-4 py-3 text-sm font-bold text-[#120A2B]">
          {resultado}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-[16px] px-4 py-3 text-sm font-bold text-red-600">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Reseña — cuidado completado */}
      {canReview && (
        <div className="bg-white rounded-[24px] shadow-[0_10px_30px_rgba(18,10,43,0.06)] p-5">
          <p className="text-[10px] font-extrabold text-[#120A2B]/40 uppercase tracking-widest mb-1">Califica tu experiencia</p>
          <p className="text-sm text-[#120A2B]/60 mb-4">¿Cómo te fue con {pawwerName}?</p>
          <div className="flex items-center justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                className="active:scale-90 transition-transform"
                aria-label={`${n} estrellas`}
              >
                <Star
                  size={34}
                  className={(hover || rating) >= n ? "text-amber-400 fill-amber-400" : "text-gray-200"}
                />
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={300}
            placeholder="Cuéntanos cómo cuidaron a tu peludo (opcional)…"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#120A2B] outline-none focus:border-[#FF7031] focus:ring-1 focus:ring-[#FF7031]/30 transition resize-none mb-3"
          />
          <button
            onClick={handleReview}
            disabled={pending || rating < 1}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-extrabold text-sm bg-[#FF7031] text-white shadow-[0_8px_20px_rgba(255,112,49,0.35)] active:scale-95 transition-transform disabled:opacity-50"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
            Enviar reseña
          </button>
        </div>
      )}

      {/* Confirmación de reseña enviada */}
      {statusId === 4 && reviewed && (
        <div className="bg-green-50 border border-green-100 rounded-[20px] px-4 py-3 flex items-center gap-2 text-sm font-bold text-green-700">
          <CheckCircle2 size={16} /> ¡Gracias por calificar a {pawwerName}!
        </div>
      )}

      {/* Cancelar reserva */}
      {canCancel && (
        showCancel ? (
          <div className="bg-white rounded-[20px] shadow-[0_10px_30px_rgba(18,10,43,0.06)] p-5">
            <p className="text-sm font-bold text-[#120A2B] text-center mb-1">¿Cancelar esta reserva?</p>
            <p className="text-xs text-[#120A2B]/50 text-center mb-4">
              {textoCancelacion(terms, pawwerName)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancel(false)}
                disabled={pending}
                className="flex-1 py-3.5 rounded-full font-bold text-sm bg-gray-100 text-[#120A2B] hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                Volver
              </button>
              <button
                onClick={handleCancel}
                disabled={pending}
                className="flex-[1.5] flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-sm bg-red-500 text-white shadow-[0_8px_20px_rgba(239,68,68,0.3)] active:scale-95 transition-transform disabled:opacity-60"
              >
                {pending ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                Sí, cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={abrirCancelar}
            disabled={pending}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full font-bold text-sm text-red-500 border border-red-100 bg-white hover:bg-red-50 active:scale-95 transition-all disabled:opacity-60"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />} Cancelar reserva
          </button>
        )
      )}
    </div>
  );
}
