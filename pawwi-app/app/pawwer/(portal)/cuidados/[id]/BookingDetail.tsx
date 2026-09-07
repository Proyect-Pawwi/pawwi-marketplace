"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, MessageCircle, Star,
  AlertCircle, Loader2, CheckCircle2, Clock,
  Calendar, Syringe, Car, MapPin, Ban, ArrowUpRight,
} from "lucide-react";
import { acceptBooking, declineSolicitud, setTransportProvider, cancelBooking } from "@/app/actions/portal";
import type { BookingRow } from "@/app/actions/portal";
import { type SearchPhase, payoutBreakdown } from "@/lib/booking-config";
import SolicitudMap from "./SolicitudMap";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SERVICE_LABEL: Record<string, string> = {
  DayCare: "Guardería (DayCare)",
  Night:   "Hospedaje (NightCare)",
  Travel:  "Viaje (Travel)",
  Express: "Visita (Express)",
};

function fmtCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string): string {
  // Supabase may return "2026-06-28 00:00:00+00" — take only the date part
  const datePart = iso.slice(0, 10);
  const d = new Date(datePart + "T12:00:00");
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function ageLabel(age: number | null | undefined): string | null {
  if (age == null) return null;
  if (age < 1) return "Cachorro";
  if (age <= 7) return "Adulto";
  return "Senior";
}

function fmtTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hour = parseInt(h!, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${suffix}`;
}

function useCountdown(expiresAt: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) { setRemaining(0); return; }
    setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    const id = setInterval(() => {
      const r = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(r);
      if (r <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "Tiempo agotado";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

const PHASE_LABEL_DETAIL: Record<SearchPhase, string> = {
  1: "Te eligió directamente",
  2: "Búsqueda relacionada",
  3: "Búsqueda de ciudad",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingDetail({
  booking,
  pawwerLat,
  pawwerLng,
}: {
  booking: BookingRow;
  userId: string;
  pawwerLat?: number | null;
  pawwerLng?: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction]           = useState<"accept" | "decline" | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(booking.status_id);
  const [doneType, setDoneType] = useState<"accepted" | "declined-p1" | "declined-p2p3" | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelPending, startCancelTransition] = useTransition();

  // Dirección del cliente → Google Maps en el punto exacto (coords) para
  // calcular distancia y coordinar el transporte. Fallback a barrio.
  const addrLabel = booking.client_address || booking.client_neighborhood || null;
  const mapsHref  =
    booking.client_lat != null && booking.client_lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${booking.client_lat},${booking.client_lng}`
      : addrLabel
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrLabel)}`
        : null;

  const remaining  = useCountdown(booking.phase_expires_at ?? null);
  const phase      = booking.search_phase as SearchPhase;
  const isPending1 = currentStatus === 1;
  const firstDog   = booking.dogs[0];

  // Transporte
  const transportFee = booking.transport_fee ?? 0;
  const legs         = booking.transport_legs ?? 0;
  const hasTransport = transportFee > 0;
  const rate         = booking.commission_rate ?? 0.25;  // tasa real congelada (0.20 élite / 0.25)
  const pay          = payoutBreakdown(booking.total, transportFee, rate);
  const transportEarn = pay.transport; // lo que gana el pawwer si lo toma (= 75% del transporte)
  const [provider, setProvider] = useState<"pawwer" | "pawwi">(booking.transport_provider ?? "pawwer");
  const [payout, setPayout]     = useState(booking.pawwer_payout);
  const [decided, setDecided]   = useState(booking.transport_decided ?? false);
  const [transportPending, startTransportTransition] = useTransition();
  // Fuerza el popup al llegar a un cuidado aceptado, con transporte y sin decidir
  // (p.ej. tras aceptar desde el home y caer en el detalle).
  const [showTransportModal, setShowTransportModal] = useState(
    () => (booking.transport_fee ?? 0) > 0
       && !(booking.transport_decided ?? false)
       && (booking.status_id === 2 || booking.status_id === 3),
  );

  // La decisión de transporte es final: solo se puede elegir una vez.
  function chooseProvider(p: "pawwer" | "pawwi") {
    if (decided) return;
    setProvider(p);
    setDecided(true);
    const cuidado    = booking.total - transportFee;
    const commission = Math.round(cuidado * rate) + (p === "pawwer" ? Math.round(transportFee * rate) : transportFee);
    setPayout(booking.total - commission);
    startTransportTransition(async () => { await setTransportProvider(booking.id, p); });
  }

  const allNotes = [
    booking.comments,
    ...booking.dogs.map(d => d.notes).filter(Boolean),
  ].filter(Boolean).join(" · ");

  function handleAccept() {
    setError(null);
    setAction("accept");
    startTransition(async () => {
      try {
        const res = await acceptBooking(booking.id);
        if (res.error) { setError(res.error); setAction(null); }
        else {
          setCurrentStatus(2);
          setDoneType("accepted");
          if (hasTransport && !decided) setShowTransportModal(true);  // popup bloqueante
        }
      } catch {
        setError("Algo salió mal. Intenta de nuevo.");
        setAction(null);
      }
    });
  }

  function handleCancel() {
    setError(null);
    startCancelTransition(async () => {
      const res = await cancelBooking(booking.id);
      if (res.error) { setError(res.error); setShowCancel(false); return; }
      router.push("/pawwer/cuidados?filter=canceladas");
    });
  }

  function handleDecline() {
    if (!showConfirm) { setShowConfirm(true); return; }
    setError(null);
    setAction("decline");
    startTransition(async () => {
      try {
        const res = await declineSolicitud(booking.id);
        if (res.error) { setError(res.error); setAction(null); setShowConfirm(false); }
        else { setDoneType(phase === 1 ? "declined-p1" : "declined-p2p3"); }
      } catch {
        setError("Algo salió mal. Intenta de nuevo.");
        setAction(null);
        setShowConfirm(false);
      }
    });
  }

  return (
    <div className="min-h-screen relative bg-[#FFF1EB] pb-40 overflow-hidden font-sans">

      {/* Atmósfera */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-5%] right-[-10%] w-80 h-80 bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[100px] opacity-40" />
        <div className="absolute top-[30%] left-[-15%] w-96 h-96 bg-[#E0F2FE] rounded-full mix-blend-multiply filter blur-[100px] opacity-50" />
        <div className="absolute bottom-[0%] right-[-10%] w-80 h-80 bg-[#FFD1BA] rounded-full mix-blend-multiply filter blur-[100px] opacity-40" />
      </div>

      {/* Header */}
      <header className="relative z-20 pt-12 pb-2">
        <div className="max-w-xl mx-auto px-6 flex items-center gap-4">
          <Link
            href="/pawwer/cuidados"
            className="w-10 h-10 bg-white/80 backdrop-blur-md border border-white rounded-[14px] flex items-center justify-center text-[#120A2B] shadow-[0_8px_20px_rgba(18,10,43,0.05)] active:scale-95 transition-transform"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="eyebrow text-[#FF7031] ">Detalle de Reserva</p>
            <h1 className="text-xl font-black text-[#120A2B] leading-none mt-0.5">
              {isPending1 && !doneType ? "Nueva Solicitud" : "Revisión de Cuidado"}
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-20 max-w-xl mx-auto px-6 space-y-4 pt-4">

        {/* 1. Urgencia */}
        {isPending1 && !doneType && (
          <div className="bg-white rounded-[24px] p-4 shadow-[0_12px_30px_rgba(18,10,43,0.05)] border border-red-50 flex items-center justify-between relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${remaining !== null && remaining < 600_000 ? "bg-red-500" : "bg-[#FF7031]"}`} />
            <div className="pl-3">
              <p className="eyebrow text-gray-400 mb-0.5">
                {PHASE_LABEL_DETAIL[phase]}
              </p>
              {remaining === null ? (
                <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
              ) : remaining > 0 ? (
                <p className={`text-sm font-extrabold leading-none ${remaining < 600_000 ? "text-red-500" : "text-[#120A2B]"}`}>
                  Responde a tiempo
                </p>
              ) : (
                <p className="text-sm font-extrabold text-red-500 leading-none">Tiempo agotado</p>
              )}
            </div>
            <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] ${
              remaining !== null && remaining < 600_000
                ? "bg-red-50 border border-red-100 text-red-600 animate-pulse"
                : "bg-[#FFF1EB] border border-[#FF7031]/20 text-[#FF7031]"
            }`}>
              <Clock size={14} />
              {remaining === null
                ? <span className="inline-block w-10 h-3 bg-gray-200 rounded animate-pulse" />
                : <span className="text-sm font-black tabular-nums">{fmtCountdown(remaining)}</span>
              }
            </div>
          </div>
        )}

        {/* 2. Emocional — foto y perfil del perro */}
        <div className="bg-white rounded-[32px] p-2 shadow-[0_12px_30px_rgba(18,10,43,0.04)] border border-white">
          <div className="relative rounded-[24px] overflow-hidden">
            {firstDog?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={firstDog.photo_url} alt={firstDog.name} className="w-full h-48 object-cover" />
            ) : (
              <div className="w-full h-48 bg-[#FFF1EB] flex flex-col items-center justify-center">
                <span className="text-5xl mb-2">🐾</span>
                <span className="text-xs font-bold text-[#FF7031] uppercase tracking-widest">Sin Foto</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#120A2B]/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-2xl font-black text-white drop-shadow-md">
                {firstDog ? firstDog.name : "Tu próximo cuidado"}
              </h2>
              {booking.dogs.length > 1 && (
                <p className="text-xs font-bold text-white/90 drop-shadow mt-0.5">
                  y {booking.dogs.length - 1} mascota{booking.dogs.length > 2 ? "s" : ""} más
                </p>
              )}
            </div>
          </div>
          <div className="px-4 py-4">
            {booking.dogs.map((dog) => {
              const chips = [
                dog.breed,
                ageLabel(dog.age),
                dog.weight_kg != null ? `${dog.weight_kg} kg` : null,
                dog.sex === "macho" ? "Macho" : dog.sex === "hembra" ? "Hembra" : null,
              ].filter(Boolean) as string[];
              return chips.length > 0 ? (
                <div key={dog.name} className="flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <span key={chip} className="text-xs font-extrabold px-3 py-1.5 bg-gray-50 text-[#120A2B] border border-gray-100 rounded-full">
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* 3. Alerta operativa — siempre visible en solicitudes pendientes */}
        {isPending1 && (
          <div className={`rounded-[28px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.04)] border ${allNotes ? "bg-amber-50 border-amber-100" : "bg-white border-white"}`}>
            <div className="flex gap-4">
              <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 ${allNotes ? "bg-amber-100" : "bg-gray-50"}`}>
                <Syringe size={20} className={allNotes ? "text-amber-500" : "text-gray-300"} />
              </div>
              <div>
                <p className="eyebrow text-gray-400 tracking-widest mb-1">Observaciones del cliente</p>
                {allNotes
                  ? <p className="text-sm font-semibold text-[#120A2B] leading-relaxed">{allNotes}</p>
                  : <p className="text-sm text-gray-300 italic">Sin observaciones especiales</p>
                }
              </div>
            </div>
          </div>
        )}

        {/* 3.5 Transporte — el pawwer decide quién lo hace (tras aceptar) */}
        {hasTransport && doneType !== "declined-p1" && doneType !== "declined-p2p3" && (
          <div className="bg-white rounded-[28px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.04)] border border-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-[14px] bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] shrink-0">
                <Car size={20} />
              </div>
              <div>
                <p className="eyebrow text-gray-400 ">Transporte</p>
                <p className="text-sm font-extrabold text-[#120A2B]">
                  {fmtCOP(transportFee)} · {legs === 1 ? "ida" : "ida y vuelta"}
                </p>
              </div>
            </div>

            {isPending1 ? (
              <p className="text-xs text-gray-500 leading-relaxed">
                Este cuidado incluye transporte. Si lo haces tú, sumas{" "}
                <span className="font-bold text-[#0284C7]">{fmtCOP(transportEarn)}</span> a tu ganancia.
                Podrás elegir si lo tomas tú o lo toma Pawwi al aceptar.
              </p>
            ) : decided ? (
              <div className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-4 py-3">
                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[#120A2B]">
                    {provider === "pawwer" ? "Tú haces el transporte" : "Pawwi hace el transporte"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {provider === "pawwer" ? `+${fmtCOP(transportEarn)} en tu ganancia` : "Sin logística para ti"}
                  </p>
                </div>
              </div>
            ) : (currentStatus === 2 || currentStatus === 3) ? (
              <div>
                <p className="text-xs font-bold text-gray-400 mb-2">¿Quién hace el transporte?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => chooseProvider("pawwer")}
                    disabled={transportPending}
                    className={[
                      "flex flex-col items-center gap-0.5 py-3 rounded-2xl border text-sm font-bold transition-all disabled:opacity-60",
                      provider === "pawwer"
                        ? "bg-[#120A2B] border-[#120A2B] text-white"
                        : "bg-white border-gray-200 text-[#120A2B] hover:border-gray-300",
                    ].join(" ")}
                  >
                    Lo hago yo
                    <span className={`text-[10px] font-bold ${provider === "pawwer" ? "text-green-300" : "text-green-600"}`}>
                      +{fmtCOP(transportEarn)}
                    </span>
                  </button>
                  <button
                    onClick={() => chooseProvider("pawwi")}
                    disabled={transportPending}
                    className={[
                      "flex flex-col items-center gap-0.5 py-3 rounded-2xl border text-sm font-bold transition-all disabled:opacity-60",
                      provider === "pawwi"
                        ? "bg-[#120A2B] border-[#120A2B] text-white"
                        : "bg-white border-gray-200 text-[#120A2B] hover:border-gray-300",
                    ].join(" ")}
                  >
                    Lo hace Pawwi
                    <span className={`text-[10px] font-medium ${provider === "pawwi" ? "text-white/50" : "text-gray-400"}`}>
                      Sin ingreso extra
                    </span>
                  </button>
                </div>
                {transportPending && (
                  <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Guardando…
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* 4. Ticket — logística + ganancia */}
        <div className="bg-white rounded-[32px] overflow-hidden shadow-[0_12px_30px_rgba(18,10,43,0.04)] border border-white">
          <div className="px-6 py-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-[14px] bg-[#FFF1EB] flex items-center justify-center shrink-0">
                <Calendar size={18} className="text-[#FF7031]" />
              </div>
              <div>
                <p className="eyebrow text-gray-400 ">Servicio</p>
                <p className="text-base font-extrabold text-[#120A2B] leading-tight">
                  {SERVICE_LABEL[booking.service_type] ?? booking.service_type}
                </p>
              </div>
            </div>
            <div className="space-y-4 bg-gray-50/50 rounded-[20px] p-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wide">Entrada</span>
                <span className="text-sm font-extrabold text-[#120A2B]">
                  {fmtDate(booking.start_date)}
                  {fmtTime(booking.start_time) && (
                    <span className="text-[#FF7031]"> · {fmtTime(booking.start_time)}</span>
                  )}
                </span>
              </div>
              {booking.start_date !== booking.end_date && (
                <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wide">Salida</span>
                  <span className="text-sm font-extrabold text-[#120A2B]">
                    {fmtDate(booking.end_date)}
                    {fmtTime(booking.end_time) && (
                      <span className="text-[#FF7031]"> · {fmtTime(booking.end_time)}</span>
                    )}
                  </span>
                </div>
              )}
              {booking.start_date === booking.end_date && fmtTime(booking.end_time) && (
                <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wide">Salida</span>
                  <span className="text-sm font-extrabold text-[#120A2B]">
                    <span className="text-[#FF7031]">{fmtTime(booking.end_time)}</span>
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wide">Cliente</span>
                <span className="text-sm font-extrabold text-[#120A2B]">{booking.client.name}</span>
              </div>
            </div>

            {/* Dirección — bloque tappable a Google Maps */}
            {addrLabel && (
              <a
                href={mapsHref ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-3 bg-[#E0F2FE]/40 border border-[#0284C7]/15 rounded-[18px] px-4 py-3 hover:bg-[#E0F2FE]/60 active:scale-[0.99] transition-all"
              >
                <div className="w-10 h-10 rounded-[14px] bg-[#0284C7] flex items-center justify-center text-white shrink-0 shadow-[0_6px_16px_rgba(2,132,199,0.3)]">
                  <MapPin size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-[#0284C7] ">
                    {booking.client_address ? "Dirección del cuidado" : "Zona del cliente"}
                  </p>
                  <p className="text-sm font-extrabold text-[#120A2B] truncate">{addrLabel}</p>
                </div>
                <span className="flex items-center gap-0.5 text-[10px] font-black text-[#0284C7] shrink-0 uppercase tracking-wide">
                  Mapa <ArrowUpRight size={13} />
                </span>
              </a>
            )}
          </div>

          {/* Skeuomorphism divider */}
          <div className="relative h-px mx-0">
            <div className="absolute inset-x-0 top-0 border-t-2 border-dashed border-gray-100" />
            <div className="absolute left-[-12px] top-[-12px] w-6 h-6 rounded-full bg-[#FFF1EB] shadow-[inset_-2px_0_4px_rgba(18,10,43,0.02)]" />
            <div className="absolute right-[-12px] top-[-12px] w-6 h-6 rounded-full bg-[#FFF1EB] shadow-[inset_2px_0_4px_rgba(18,10,43,0.02)]" />
          </div>

          <div className="bg-gray-50/30 px-6 py-6 flex items-center justify-between">
            <div>
              <p className="eyebrow text-gray-400 mb-1">Tu ganancia neta</p>
              <p className="text-3xl font-black text-[#120A2B] leading-none mb-2">{fmtCOP(payout)}</p>
              {hasTransport ? (
                <div className="text-[11px] font-semibold text-gray-500 space-y-0.5">
                  <p>Cuidado: <span className="font-black text-[#120A2B]">{fmtCOP(pay.cuidado)}</span></p>
                  <p>Transporte: <span className="font-black text-[#120A2B]">{provider === "pawwer" ? `+${fmtCOP(pay.transport)}` : "lo hace Pawwi"}</span></p>
                </div>
              ) : (
                <p className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block">Libre de comisiones</p>
              )}
            </div>
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm text-2xl border border-gray-50">
              💰
            </div>
          </div>
        </div>

        {/* 6. Mapa del cliente */}
        {booking.client_lat != null && booking.client_lng != null && (
          <div className="bg-white rounded-[32px] p-3 shadow-[0_12px_30px_rgba(18,10,43,0.04)] border border-white">
            <SolicitudMap
              clientLat={booking.client_lat}
              clientLng={booking.client_lng}
              pawwerLat={pawwerLat}
              pawwerLng={pawwerLng}
              neighborhood={booking.client_neighborhood}
            />
          </div>
        )}

        {/* Review */}
        {booking.review && (
          <div className="bg-white rounded-[28px] shadow-[0_12px_30px_rgba(18,10,43,0.04)] px-6 py-5 border border-white">
            <p className="eyebrow text-gray-400 tracking-widest mb-3">Reseña del cliente</p>
            <div className="flex items-center gap-1 mb-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={18} className={i < booking.review!.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
              ))}
            </div>
            {booking.review.comment && (
              <p className="text-sm font-semibold text-[#120A2B]/70 italic leading-relaxed">&ldquo;{booking.review.comment}&rdquo;</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-[20px] px-5 py-4 text-sm font-bold text-red-600 shadow-sm">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* Acciones — solicitud pendiente */}
        {!doneType && isPending1 && (
          <div className="bg-white rounded-[32px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.06)] border border-white">
            {showConfirm ? (
              <div>
                <p className="text-center text-xs font-bold text-gray-400 mb-4">
                  La solicitud pasará a otros pawwers disponibles.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 py-4 rounded-full font-bold bg-gray-100 text-[#120A2B] text-sm hover:bg-gray-200 transition-colors"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={isPending}
                    className="flex-[1.5] py-4 rounded-full font-bold bg-red-500 text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_8px_20px_rgba(239,68,68,0.3)] active:scale-95 transition-transform"
                  >
                    {isPending && action === "decline" ? <Loader2 size={16} className="animate-spin" /> : null}
                    Confirmar rechazo
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleDecline}
                  disabled={isPending}
                  className="py-4 px-6 rounded-full font-bold border-2 border-gray-100 bg-white text-gray-400 text-sm hover:bg-gray-50 transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  No puedo
                </button>
                <button
                  onClick={handleAccept}
                  disabled={isPending}
                  className="flex-1 py-4 rounded-full font-black bg-[#120A2B] text-white text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 shadow-[0_12px_30px_rgba(18,10,43,0.25)] transition-transform"
                >
                  {isPending && action === "accept"
                    ? <Loader2 size={18} className="animate-spin" />
                    : <CheckCircle2 size={18} />
                  }
                  Aceptar Solicitud
                </button>
              </div>
            )}
          </div>
        )}

        {/* Acciones — confirmada / en curso */}
        {!doneType && (currentStatus === 2 || currentStatus === 3) && (
          <div className="space-y-3">
            <Link
              href={`/pawwer/mensajes/${booking.id}`}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-full font-black bg-[#120A2B] text-white text-sm active:scale-95 shadow-[0_12px_30px_rgba(18,10,43,0.25)] transition-transform"
            >
              <MessageCircle size={18} />
              Ir al chat con el cliente
            </Link>
            <button
              onClick={() => setShowCancel(true)}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full font-bold text-red-500 border border-red-100 bg-white text-sm hover:bg-red-50 active:scale-95 transition-all"
            >
              <Ban size={16} />
              Cancelar cuidado
            </button>
          </div>
        )}

        {/* Feedback tras acción */}
        {doneType === "accepted" && (
          <div className="bg-white rounded-[32px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.06)] border border-white space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-green-600" />
              </div>
              <p className="text-sm font-bold text-[#120A2B]">¡Reserva aceptada!</p>
            </div>
            <Link
              href={`/pawwer/mensajes/${booking.id}`}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-full font-black bg-[#120A2B] text-white text-sm shadow-[0_12px_30px_rgba(18,10,43,0.25)] active:scale-95 transition-transform"
            >
              <MessageCircle size={18} />
              Saludar al cliente
            </Link>
          </div>
        )}

        {(doneType === "declined-p1" || doneType === "declined-p2p3") && (
          <div className="bg-white rounded-[32px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.06)] border border-white space-y-3">
            <p className="text-center text-sm font-semibold text-gray-500">
              {doneType === "declined-p1"
                ? "Solicitud enviada a otros Pawwers."
                : "Rechazo confirmado."}
            </p>
            <Link
              href="/pawwer/cuidados"
              className="flex items-center justify-center w-full py-4 rounded-full font-black bg-gray-100 text-[#120A2B] text-sm hover:bg-gray-200 transition-colors"
            >
              Volver a mi historial
            </Link>
          </div>
        )}

      </main>

      {/* Popup BLOQUEANTE: elegir transporte tras aceptar (no se puede cerrar sin elegir) */}
      {showTransportModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div aria-hidden className="absolute inset-0 bg-[#120A2B]/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-[28px] p-6 w-full max-w-sm shadow-[0_20px_60px_rgba(18,10,43,0.3)] animate-slide-up">
            <div className="w-12 h-12 rounded-[16px] bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] mb-4 mx-auto">
              <Car size={24} />
            </div>
            <h2 className="text-lg font-black text-[#120A2B] text-center mb-1">¿Quién hace el transporte?</h2>
            <p className="text-sm text-gray-500 text-center mb-5 leading-relaxed">
              Este cuidado incluye transporte de {fmtCOP(transportFee)} ({legs === 1 ? "ida" : "ida y vuelta"}). Elige una opción para continuar.
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => { chooseProvider("pawwer"); setShowTransportModal(false); }}
                disabled={transportPending}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-[#120A2B] text-white active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                <span className="text-left">
                  <span className="block font-bold text-sm">Lo hago yo</span>
                  <span className="block text-[11px] font-medium text-white/60">Sumas a tu ganancia</span>
                </span>
                <span className="font-black text-green-300 shrink-0">+{fmtCOP(transportEarn)}</span>
              </button>
              <button
                onClick={() => { chooseProvider("pawwi"); setShowTransportModal(false); }}
                disabled={transportPending}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-white border border-gray-200 text-[#120A2B] active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                <span className="text-left">
                  <span className="block font-bold text-sm">Que lo haga Pawwi</span>
                  <span className="block text-[11px] font-medium text-gray-400">Sin logística para ti</span>
                </span>
                <span className="text-xs font-bold text-gray-400 shrink-0">Pawwi lo coordina</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación: cancelar cuidado */}
      {showCancel && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div
            aria-hidden
            className="absolute inset-0 bg-[#120A2B]/50 backdrop-blur-sm"
            onClick={() => !cancelPending && setShowCancel(false)}
          />
          <div className="relative bg-white rounded-[28px] p-6 w-full max-w-sm shadow-[0_20px_60px_rgba(18,10,43,0.3)] animate-slide-up">
            <div className="w-12 h-12 rounded-[16px] bg-red-50 flex items-center justify-center text-red-500 mb-4 mx-auto">
              <Ban size={24} />
            </div>
            <h2 className="text-lg font-black text-[#120A2B] text-center mb-1">¿Cancelar este cuidado?</h2>
            <p className="text-sm text-gray-500 text-center mb-5 leading-relaxed">
              Se liberará tu cupo de esa fecha y le avisaremos al cliente. Cancelar cuidados
              confirmados afecta tu reputación como Pawwer.
            </p>
            <div className="space-y-2.5">
              <button
                onClick={handleCancel}
                disabled={cancelPending}
                className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-red-500 text-white font-bold active:scale-[0.98] transition-transform disabled:opacity-60 shadow-[0_8px_20px_rgba(239,68,68,0.3)]"
              >
                {cancelPending ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                Sí, cancelar cuidado
              </button>
              <button
                onClick={() => setShowCancel(false)}
                disabled={cancelPending}
                className="w-full px-5 py-3.5 rounded-2xl bg-gray-100 text-[#120A2B] font-bold active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                No, volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
