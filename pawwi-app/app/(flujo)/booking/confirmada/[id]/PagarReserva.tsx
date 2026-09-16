"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { iniciarPago, verificarPago, type CheckoutConfig } from "@/app/actions/pago";

// El checkout lo pinta Bold: Pawwi nunca toca datos de tarjeta. El script se
// carga solo cuando el cliente va a pagar, no en cada visita a la página.
const BOLD_SCRIPT = "https://checkout.bold.co/library/boldPaymentButton.js";

type BoldCheckoutCtor = new (config: CheckoutConfig) => { open: () => void };
declare global {
  interface Window {
    BoldCheckout?: BoldCheckoutCtor;
  }
}

let scriptPromise: Promise<BoldCheckoutCtor> | null = null;

function cargarBold(): Promise<BoldCheckoutCtor> {
  if (window.BoldCheckout) return Promise.resolve(window.BoldCheckout);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = BOLD_SCRIPT;
    s.async = true;
    s.onload = () =>
      window.BoldCheckout ? resolve(window.BoldCheckout) : reject(new Error("BoldCheckout no disponible"));
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("No cargó el checkout de Bold"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
}

function minutosRestantes(iso: string) {
  return Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 60_000));
}

export default function PagarReserva({
  bookingId,
  total,
  dueAt,
  pawwerName,
  volvioDeBold,
}: {
  bookingId: string;
  total: number;
  dueAt: string;
  pawwerName: string;
  /** Bold devolvió al cliente con ?bold-order-id=… — hay que verificar. */
  volvioDeBold: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<"procesando" | "rechazado" | null>(null);
  const [minutos, setMinutos] = useState(() => minutosRestantes(dueAt));
  const verificado = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setMinutos(minutosRestantes(dueAt)), 30_000);
    return () => clearInterval(t);
  }, [dueAt]);

  // Al volver del checkout, preguntarle a Bold qué pasó. El estado que llega en
  // la URL (bold-tx-status) no se cree: lo puede escribir cualquiera.
  useEffect(() => {
    if (!volvioDeBold || verificado.current) return;
    verificado.current = true;
    startTransition(async () => {
      const res = await verificarPago(bookingId);
      if (res.estado === "pagado") router.refresh();
      else if (res.estado === "procesando") setAviso("procesando");
      else if (res.estado === "rechazado") setAviso("rechazado");
    });
  }, [volvioDeBold, bookingId, router]);

  const vencido = minutos <= 0;

  function pagar() {
    setError(null);
    startTransition(async () => {
      const res = await iniciarPago(bookingId);
      if ("error" in res) { setError(res.error); return; }
      if (res.estado === "pagado") { router.refresh(); return; }
      if (res.estado === "procesando") { setAviso("procesando"); return; }
      try {
        const Checkout = await cargarBold();
        new Checkout(res.config).open();
      } catch {
        setError("No pudimos abrir el pago. Revisa tu conexión e intenta de nuevo.");
      }
    });
  }

  function yaPague() {
    setError(null);
    startTransition(async () => {
      const res = await verificarPago(bookingId);
      if (res.estado === "pagado") { router.refresh(); return; }
      if (res.estado === "procesando") { setAviso("procesando"); return; }
      if (res.estado === "rechazado") { setAviso("rechazado"); return; }
      setError("Todavía no vemos tu pago. Si acabas de pagar, espera un minuto y vuelve a intentar.");
    });
  }

  return (
    <div className="bg-white rounded-[24px] shadow-[0_10px_30px_rgba(18,10,43,0.06)] p-5 space-y-4">
      <div>
        <p className="eyebrow text-[#FF7031] mb-1">Falta tu pago</p>
        <p className="text-sm text-[#120A2B]/70">
          <strong className="text-[#120A2B]">{pawwerName}</strong> aceptó tu reserva. Hasta que pagues,{" "}
          <strong className="text-[#120A2B]">no está confirmada</strong>.
        </p>
      </div>

      <div className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs border ${
        vencido ? "bg-red-50 border-red-100 text-red-600" : "bg-amber-50 border-amber-100 text-amber-700"
      }`}>
        <Clock size={13} className="shrink-0" />
        {vencido ? (
          <span>Se venció el plazo para pagar. Si alcanzaste a pagar, lo verás aquí en unos minutos.</span>
        ) : (
          <span>
            Paga antes de las <strong>{hora(dueAt)}</strong>
            {minutos < 120 && ` · quedan ${minutos} min`}. Si se vence, el cupo se libera.
          </span>
        )}
      </div>

      {aviso === "procesando" && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-3 py-2.5 text-xs text-blue-700">
          <Loader2 size={13} className="shrink-0 mt-0.5 animate-spin" />
          <span>Tu pago está en proceso. Si fue por PSE, el banco puede tardar unos minutos en confirmarlo.</span>
        </div>
      )}
      {aviso === "rechazado" && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-2xl px-3 py-2.5 text-xs text-red-600">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>El pago no pasó. Puedes intentarlo de nuevo con otro medio: tarjeta, PSE o Nequi.</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-2xl px-3 py-2.5 text-xs font-bold text-red-600">
          <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {!vencido && (
        <button
          onClick={pagar}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-extrabold text-sm bg-[#FF7031] text-white shadow-[0_8px_20px_rgba(255,112,49,0.35)] active:scale-95 transition-transform disabled:opacity-60"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
          {aviso === "rechazado" ? "Intentar de nuevo" : `Pagar ${fmtCOP(total)}`}
        </button>
      )}

      <button
        onClick={yaPague}
        disabled={pending}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-[#120A2B]/50 hover:text-[#120A2B] transition-colors disabled:opacity-60"
      >
        <RefreshCw size={12} /> Ya pagué — revisar el estado
      </button>

      <div className="flex items-start gap-2 text-[11px] text-[#120A2B]/45 leading-relaxed">
        <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-green-500" />
        <span>
          Pagas en el checkout seguro de Bold. Si cancelas con 48 horas o más de anticipación te
          devolvemos el 100%; con menos, no hay reembolso, porque tu Pawwer ya bloqueó el día.
        </span>
      </div>
    </div>
  );
}
