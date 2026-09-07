import Link from "next/link";
import { ShieldCheck, Clock, CreditCard } from "lucide-react";

interface Props { bookingId: string; total: number; }

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

export default function Step4Resumen({ bookingId, total }: Props) {
  const ref = `PWW-2026-${bookingId.slice(0, 6).toUpperCase()}`;
  return (
    <div className="min-h-screen bg-[#FFF1EB] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Blobs */}
      <div aria-hidden className="pointer-events-none absolute top-[-10%] left-[-10%] w-[300px] h-[300px] bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[80px] opacity-40" />
      <div aria-hidden className="pointer-events-none absolute bottom-[10%] right-[-10%] w-[250px] h-[250px] bg-[#FF7031] rounded-full mix-blend-multiply filter blur-[80px] opacity-15" />

      <div className="relative z-10 max-w-sm w-full text-center space-y-5 py-12">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center shadow-[0_12px_32px_rgba(18,10,43,0.08)]">
          <ShieldCheck size={36} className="text-[#FF7031]" />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-extrabold text-[#120A2B] mb-1">Solicitud enviada</h1>
          <p className="text-sm text-[#120A2B]/50">
            Referencia <span className="font-bold text-[#120A2B]">{ref}</span>
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[24px] p-5 text-left space-y-3 shadow-[0_10px_30px_rgba(18,10,43,0.06)]">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#120A2B]/50 font-medium">Total a pagar</span>
            <span className="font-extrabold text-[#FF7031] text-lg">{fmtCOP(total)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2.5 text-xs text-amber-700">
            <Clock size={13} className="text-amber-500 shrink-0" />
            <span>El Pawwer tiene <strong>30 min</strong> para aceptar tu solicitud.</span>
          </div>
        </div>

        {/* Payment placeholder */}
        <div className="bg-white/70 backdrop-blur-sm rounded-[24px] p-5 border border-white shadow-[0_4px_16px_rgba(18,10,43,0.04)]">
          <div className="flex items-center justify-center gap-2 text-[#120A2B]/40 mb-1">
            <CreditCard size={18} />
            <span className="text-sm font-bold">Módulo de pago</span>
          </div>
          <p className="text-xs text-[#120A2B]/35 text-center">
            La pasarela de pagos se habilitará en la próxima versión.
          </p>
        </div>

        {/* Back link */}
        <Link
          href="/"
          className="block text-sm font-semibold text-[#120A2B]/40 hover:text-[#120A2B] transition-colors underline underline-offset-2"
        >
          Volver al marketplace
        </Link>
      </div>
    </div>
  );
}
