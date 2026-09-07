"use client";

import { useState, useTransition, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Dog,
  Calendar,
  CalendarDays,
  MapPin,
  X,
  LogOut,
  KeyRound,
  ChevronRight,
  CalendarRange,
  HelpCircle,
  ExternalLink,
  Bell,
  Share2,
  Copy,
  MessageCircle,
  Wallet,
  Megaphone,
  CheckCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/client";
import { acceptBooking, declineSolicitud, getPawwerStats, getEarningsDaily } from "@/app/actions/portal";
import type { BookingRow, PawwerStats, ChartPoint } from "@/app/actions/portal";
import { type SearchPhase, PHASE_LABEL, payoutBreakdown } from "@/lib/booking-config";
import { SERVICE_LABEL_BRAND as SERVICE_DISPLAY, SERVICE_COLOR } from "@/lib/services";
import { useNotifications, type NotifItem, type NotifType } from "../NotificationsProvider";
import { useMyPresence } from "../PresenceProvider";
import NivelCard from "./NivelCard";
import type { LevelDetail } from "@/lib/levels";

// El chart (recharts) se carga lazy → fuera del bundle inicial del home.
const EarningsChart = dynamic(() => import("./EarningsChart"), {
  ssr: false,
  loading: () => <div className="h-[120px]" />,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  if (start === end) return `${s.getDate()} ${months[s.getMonth()]}`;
  if (s.getMonth() === e.getMonth())
    return `${s.getDate()}–${e.getDate()} ${months[s.getMonth()]}`;
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]}`;
}

// ── Date filter ───────────────────────────────────────────────────────────────

type FilterKey = "hoy" | "semana" | "mes" | "personalizado";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "hoy",          label: "Hoy" },
  { key: "semana",       label: "Semana" },
  { key: "mes",          label: "Mes" },
  { key: "personalizado", label: "Personalizado" },
];

function getRangeForKey(
  key: FilterKey,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string } {
  const today = new Date();
  const todayStr = isoDate(today);

  switch (key) {
    case "hoy":
      return { start: todayStr, end: todayStr };
    case "semana": {
      const dow = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: isoDate(monday), end: isoDate(sunday) };
    }
    case "mes": {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: isoDate(s), end: isoDate(e) };
    }
    case "personalizado":
      return { start: customStart ?? todayStr, end: customEnd ?? todayStr };
  }
}

// ── Solicitud (ticket) card ───────────────────────────────────────────────────

function SolicitudCard({
  booking,
  onAccept,
  onDecline,
  onExpire,
}: {
  booking: BookingRow;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onExpire: (id: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const dogNames = booking.dogs.map((d) => d.name).join(", ") || "Sin mascotas";
  const svcLabel = SERVICE_DISPLAY[booking.service_type] ?? booking.service_type;
  const svcColor = SERVICE_COLOR[booking.service_type] ?? "bg-gray-50 text-gray-600";
  const phase    = booking.search_phase as SearchPhase;
  const pay      = payoutBreakdown(booking.total, booking.transport_fee, booking.commission_rate);

  // Dirección del cliente → abre Google Maps en el punto exacto (coords) para
  // que el pawwer calcule distancia antes de decidir. Fallback a barrio.
  const addrLabel = booking.client_address || booking.client_neighborhood || null;
  const mapsHref  =
    booking.client_lat != null && booking.client_lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${booking.client_lat},${booking.client_lng}`
      : addrLabel
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrLabel)}`
        : null;

  function handleAccept(e: React.MouseEvent) {
    e.stopPropagation(); // Evita que se abra el detalle al hacer clic en el botón
    setError(null);
    setAction("accept");
    startTransition(async () => {
      const res = await acceptBooking(booking.id);
      if (res.error) { setError(res.error); setAction(null); return; }
      // Si incluye transporte, ir al detalle para elegir quién lo hace (popup obligatorio)
      if ((booking.transport_fee ?? 0) > 0) router.push(`/pawwer/cuidados/${booking.id}`);
      else onAccept(booking.id);
    });
  }

  function handleDecline(e: React.MouseEvent) {
    e.stopPropagation();
    if (!showConfirm) { setShowConfirm(true); return; }
    setError(null);
    setAction("decline");
    startTransition(async () => {
      const res = await declineSolicitud(booking.id);
      if (res.error) { setError(res.error); setAction(null); setShowConfirm(false); }
      else onDecline(booking.id);
    });
  }

  function goToDetail() {
    router.push(`/pawwer/cuidados/${booking.id}`);
  }

  // Timer local (regla de urgencia: < 3 minutos). Arranca en null para evitar
  // hydration mismatch: Date.now() difiere entre el render del servidor y el cliente.
  const getRemaining = useCallback(() => {
    if (!booking.phase_expires_at) return 0;
    return Math.max(0, new Date(booking.phase_expires_at).getTime() - Date.now());
  }, [booking.phase_expires_at]);

  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(getRemaining());
    const id = setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        // Vencida: la sacamos del home al instante (se escala a otros pawwers
        // en el backend al recargar/abrir). No es cancelación, es "perdida".
        if (booking.phase_expires_at) onExpire(booking.id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [getRemaining, onExpire, booking.id, booking.phase_expires_at]);

  const isCritical = remaining !== null && remaining > 0 && remaining < 180000;
  const expired    = remaining !== null && remaining <= 0;
  const mins = Math.floor((remaining ?? 0) / 60000);
  const secs = Math.floor(((remaining ?? 0) % 60000) / 1000);

  return (
    <div
      onClick={goToDetail}
      className="bg-white rounded-[28px] overflow-hidden shadow-[0_12px_30px_rgba(18,10,43,0.04)] border border-white cursor-pointer hover:-translate-y-1 transition-transform relative z-10"
    >
      {/* 1. Capa Superior: Identidad y Urgencia */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {booking.client.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={booking.client.avatar_url}
              alt={booking.client.name}
              className="w-10 h-10 rounded-full object-cover border border-gray-100 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#120A2B] flex items-center justify-center text-white font-extrabold text-sm shrink-0">
              {booking.client.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <p className="font-black text-[#120A2B] text-base truncate leading-none">
                {booking.client.name}
              </p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md leading-none ${svcColor}`}>
                {svcLabel}
              </span>
            </div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
              {PHASE_LABEL[phase] ?? "Nueva Solicitud"}
            </p>
          </div>
        </div>

        {/* Temporizador */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] shrink-0 ${
            isCritical
              ? "bg-red-50 text-red-600 animate-pulse border border-red-100"
              : expired
                ? "bg-gray-100 text-gray-400"
                : "bg-[#FFF1EB] text-[#120A2B] border border-[#FF7031]/20"
          }`}
        >
          <Clock size={12} className={isCritical ? "text-red-500" : expired ? "text-gray-400" : "text-[#FF7031]"} />
          <span className={`text-xs font-black tabular-nums ${isCritical ? "text-red-600" : expired ? "text-gray-400" : "text-[#120A2B]"}`}>
            {remaining === null ? "··:··" : expired ? "00:00" : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
          </span>
        </div>
      </div>

      {/* 2. Capa Media: Logística y Recompensa */}
      <div className="px-5 pb-5">
        <div className="bg-gray-50/80 rounded-[20px] p-4 flex items-center justify-between border border-gray-100/50">
          <div className="space-y-2.5 flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#120A2B]">
              <Calendar size={14} className="text-[#FF7031] shrink-0" />
              <span className="truncate">{fmtRange(booking.start_date, booking.end_date)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <Dog size={14} className="shrink-0" />
              <span className="truncate">{dogNames}</span>
            </div>
            {addrLabel && (
              <a
                href={mapsHref ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 text-xs font-bold text-[#0284C7] hover:underline active:opacity-70"
              >
                <MapPin size={14} className="text-[#FF7031] shrink-0" />
                <span className="truncate">{addrLabel}</span>
              </a>
            )}
          </div>

          <div className="text-right pl-4 border-l border-gray-200/60 shrink-0">
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-0.5">
              {pay.hasTransport ? "Cuidado" : "Ganas"}
            </p>
            <p className="text-xl font-black text-[#120A2B] leading-none tracking-tight">
              {fmtCOP(pay.cuidado)}
            </p>
            {pay.hasTransport && (
              <p className="text-[10px] font-bold text-[#0284C7] mt-1 leading-none">
                +{fmtCOP(pay.transport)} transp.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2 text-xs text-red-600 font-bold">
            <AlertCircle size={14} /> {error}
          </div>
        </div>
      )}

      {/* 3. Capa Inferior: Botonera */}
      <div
        className="px-5 pb-5 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {showConfirm ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }}
              className="flex-1 py-3.5 rounded-[18px] text-xs font-bold bg-gray-100 text-[#120A2B] hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDecline}
              disabled={isPending}
              className="flex-[1.5] py-3.5 rounded-[18px] text-xs font-bold bg-red-500 text-white shadow-[0_8px_20px_rgba(239,68,68,0.25)] flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
            >
              {isPending && action === "decline" && <Loader2 size={14} className="animate-spin" />}
              Sí, declinar
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleDecline}
              disabled={isPending}
              className="flex-none px-4 py-3.5 rounded-[18px] text-xs font-bold text-gray-400 border border-gray-200 hover:bg-gray-50 hover:text-gray-600 transition-colors disabled:opacity-40"
            >
              Declinar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goToDetail(); }}
              className="flex-1 py-3.5 rounded-[18px] text-xs font-bold bg-gray-100 text-[#120A2B] text-center hover:bg-gray-200 transition-colors"
            >
              Ver detalle
            </button>
            <button
              onClick={handleAccept}
              disabled={isPending}
              className="flex-[1.5] py-3.5 rounded-[18px] text-xs font-black bg-[#120A2B] text-white shadow-[0_8px_20px_rgba(18,10,43,0.2)] hover:bg-[#1e1145] flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-transform"
            >
              {isPending && action === "accept" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Aceptar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Active booking card ───────────────────────────────────────────────────────

function ActiveCard({ booking }: { booking: BookingRow }) {
  const dogNames = booking.dogs.map((d) => d.name).join(", ") || "Mascota";
  return (
    <Link
      href={`/pawwer/mensajes/${booking.id}`}
      className="flex items-center gap-4 bg-white/80 backdrop-blur-md border border-white/60 rounded-[24px] p-4 shadow-[0_12px_30px_rgba(18,10,43,0.03)] hover:scale-[1.01] transition-transform relative z-10"
    >
      {booking.client.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={booking.client.avatar_url}
          alt={booking.client.name}
          className="w-12 h-12 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-[#120A2B] flex items-center justify-center text-white font-extrabold shrink-0">
          {booking.client.name[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-extrabold text-sm text-[#120A2B] truncate">{booking.client.name}</p>
        <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
          <Dog size={12} className="text-gray-400" /> {dogNames} · {SERVICE_DISPLAY[booking.service_type] ?? booking.service_type}
        </p>
      </div>
      <span className="flex items-center gap-1.5 text-[10px] font-bold bg-green-50 text-green-600 rounded-full px-3 py-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        En curso
      </span>
    </Link>
  );
}

// ── Referral card ─────────────────────────────────────────────────────────────

function ReferralCard({ profileUrl }: { profileUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({
        title: "Reserva conmigo en Pawwi",
        text: "Cuido a tu perro con amor. Reserva aquí 🐾",
        url: profileUrl,
      }).catch(() => null);
    } else {
      try {
        await navigator.clipboard.writeText(profileUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // permiso de portapapeles denegado
      }
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // permiso de portapapeles denegado
    }
  }

  return (
    <div className="bg-[#120A2B] rounded-[28px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.15)]">
      <p className="eyebrow text-white/40 mb-3">Referidos</p>
      <h3 className="text-lg font-black text-white leading-tight mb-1">
        Multiplica tus ingresos
      </h3>
      <p className="text-sm text-white/60 leading-relaxed mb-5">
        Comparte tu perfil en los grupos de tu barrio. Si un vecino reserva, ganas{" "}
        <span className="text-[#FF7031] font-bold">$20.000 COP</span> extra.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-[1.5] flex items-center justify-center gap-2 bg-[#FF7031] text-white font-bold text-sm py-3.5 rounded-full shadow-[0_8px_20px_rgba(255,112,49,0.35)] active:scale-95 transition-transform"
        >
          <Share2 size={16} />
          Compartir perfil
        </button>
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 bg-white/10 text-white font-bold text-sm py-3.5 rounded-full active:scale-95 transition-transform border border-white/10"
        >
          {copied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
          {copied ? "¡Copiado!" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}

// ── Notificaciones ────────────────────────────────────────────────────────────

const NOTIF_META: Record<NotifType, { Icon: LucideIcon; tint: string }> = {
  cuidado: { Icon: CalendarDays,  tint: "bg-[#FFF1EB] text-[#FF7031]" },
  mensaje: { Icon: MessageCircle, tint: "bg-[#E0F2FE] text-[#0284C7]" },
  pago:    { Icon: Wallet,        tint: "bg-green-50 text-green-600" },
  noticia: { Icon: Megaphone,     tint: "bg-[#F7AEF1]/30 text-[#7c3aed]" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function NotificationsSheet({
  items,
  totalUnread,
  onClose,
  onOpenItem,
  onMarkAll,
}: {
  items: NotifItem[];
  totalUnread: number;
  onClose: () => void;
  onOpenItem: (n: NotifItem) => void;
  onMarkAll: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-[#120A2B]/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative bg-white max-w-xl mx-auto w-full max-h-[75vh] flex flex-col shadow-[0_-20px_40px_rgba(18,10,43,0.15)]"
        style={{ borderRadius: "32px 32px 0 0" }}
      >
        {/* Header */}
        <div className="shrink-0 px-6 pt-5 pb-3 relative border-b border-gray-50">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X size={15} />
          </button>
          <p className="text-base font-black text-[#120A2B] pr-10">
            Notificaciones
            {totalUnread > 0 && (
              <span className="ml-2 text-xs font-bold text-[#FF7031]">{totalUnread} nuevas</span>
            )}
          </p>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 px-3 py-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                <Bell size={28} className="text-gray-300" />
              </div>
              <p className="text-sm font-bold text-[#120A2B]">Sin notificaciones</p>
              <p className="text-xs text-gray-400 mt-1">Aquí verás nuevas reservas, mensajes y alertas.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((n) => {
                const meta = NOTIF_META[n.type];
                const unread = n.read_at === null;
                return (
                  <button
                    key={n.id}
                    onClick={() => onOpenItem(n)}
                    className={[
                      "w-full flex items-start gap-3 px-3 py-3 rounded-[18px] text-left transition-colors",
                      unread ? "bg-[#FFF1EB]/70 hover:bg-[#FFF1EB]" : "hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {n.actor_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.actor_avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 border border-white" />
                    ) : (
                      <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 ${meta.tint}`}>
                        <meta.Icon size={18} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-extrabold text-[#120A2B] truncate">{n.title}</p>
                        {unread && <span className="w-2 h-2 rounded-full bg-[#FF7031] shrink-0" />}
                      </div>
                      {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 text-pretty">{n.body}</p>}
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {totalUnread > 0 && (
          <div
            className="shrink-0 px-6 py-3 border-t border-gray-100"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <button
              onClick={onMarkAll}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-gray-100 text-[#120A2B] font-bold text-sm hover:bg-gray-200 transition-colors active:scale-[0.98]"
            >
              <CheckCheck size={16} /> Marcar todas como leídas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  userEmail: string;
  profile: { name: string; avatar_url: string | null } | null;
  initialStats: PawwerStats;
  initialChart: ChartPoint[];
  pendingBookings: BookingRow[];
  activeBookings: BookingRow[];
  levelDetail: LevelDetail;
}

export default function InicioClient({
  userId,
  userEmail,
  profile,
  initialStats,
  initialChart,
  pendingBookings: initialPending,
  activeBookings,
  levelDetail,
}: Props) {
  const firstName = profile?.name?.split(" ")[0] ?? "Pawwer";
  const router = useRouter();
  const gradientId = useId().replace(/:/g, "");
  const { counts, items: notifItems, markRead, markAllRead } = useNotifications();
  const myStatus = useMyPresence(); // presencia propia → punto verde/amarillo en mi avatar

  function handleOpenNotif(n: NotifItem) {
    markRead({ id: n.id });
    setNotifOpen(false);
    if (n.link) router.push(n.link);
  }

  const [activeFilter, setActiveFilter] = useState<FilterKey>("semana");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [stats, setStats] = useState(initialStats);
  const [chartData, setChartData] = useState(initialChart);
  const [isPending, startTransition] = useTransition();

  const [pending, setPending] = useState(initialPending);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [profileUrl, setProfileUrl] = useState(`/pawwer/${userId}`);

  useEffect(() => {
    setProfileUrl(`${window.location.origin}/pawwer/${userId}`);
  }, [userId]);

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/pawwer/login");
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handlePasswordReset() {
    if (!userEmail || isSendingReset || resetEmailSent) return;
    setIsSendingReset(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/nueva-contrasena`,
      });
      if (!error) setResetEmailSent(true);
    } finally {
      setIsSendingReset(false);
    }
  }

  function removePending(id: string) {
    setPending((prev) => prev.filter((b) => b.id !== id));
  }

  // Realtime: las solicitudes nuevas (fase 1 directo o candidatura fase 2/3)
  // aparecen en vivo sin refrescar. Reusa las tablas ya publicadas en
  // supabase_realtime; ante cualquier cambio relevante, re-consulta la lista
  // de pendientes (fuente de verdad, con todos los campos enriquecidos).
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const { data } = await supabase.rpc("get_pawwer_bookings", { p_status_ids: [1] });
        if (Array.isArray(data)) setPending(data as BookingRow[]);
      }, 250);
    };
    const channel = supabase
      .channel(`pawwer-solicitudes-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "booking", filter: `pawwer_id=eq.${userId}` }, reload)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "booking_candidates", filter: `pawwer_id=eq.${userId}` }, reload)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  function applyFilter(key: FilterKey, cStart?: string, cEnd?: string) {
    if (key === "personalizado" && (!cStart || !cEnd)) return;
    const { start, end } = getRangeForKey(key, cStart, cEnd);
    startTransition(async () => {
      try {
        const [newStats, newChart] = await Promise.all([
          getPawwerStats(start, end),
          getEarningsDaily(start, end),
        ]);
        setStats(newStats);
        setChartData(newChart);
      } catch {
        // las server actions tienen ?? fallbacks; este catch solo aplica a fallos de infraestructura
      }
    });
  }

  function handleFilterClick(key: FilterKey) {
    setActiveFilter(key);
    if (key !== "personalizado") applyFilter(key);
  }

  const avg = stats.bookings_completed > 0 ? stats.pawwer_earnings / stats.bookings_completed : 0;
  const hasEarnings = chartData.some((p) => p.earnings > 0);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#FFF1EB] font-sans">

      {/* Atmósfera */}
      <div aria-hidden className="absolute top-[-5%] right-[-10%] w-80 h-80 bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[100px] opacity-45 z-0 pointer-events-none" />
      <div aria-hidden className="absolute top-[40%] left-[-15%] w-96 h-96 bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[100px] opacity-45 z-0 pointer-events-none" />
      <div aria-hidden className="absolute bottom-[5%] right-[-10%] w-80 h-80 bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[100px] opacity-45 z-0 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-xl mx-auto px-6 pt-12 pb-4">
        {/* Row 1: logo + actions */}
        <div className="flex items-center justify-between mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/LogoOrange.svg" alt="Pawwi" className="h-7 w-auto" />
          <div className="flex items-center gap-2">
            {/* Notificaciones */}
            <button
              onClick={() => setNotifOpen(true)}
              className="relative w-10 h-10 rounded-[14px] bg-white/70 backdrop-blur-sm border border-white/80 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
            >
              <Bell size={18} className="text-[#120A2B]" />
              {counts.total > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#FFF1EB] leading-none tabular-nums">
                  {counts.total > 9 ? "9+" : counts.total}
                </span>
              )}
            </button>
            {/* Avatar → abre menú */}
            <button
              onClick={() => setMenuOpen(true)}
              className="relative active:scale-95 transition-transform"
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-10 h-10 rounded-[14px] object-cover shadow-[0_8px_20px_rgba(18,10,43,0.1)] border border-white"
                />
              ) : (
                <div className="w-10 h-10 rounded-[14px] bg-[#120A2B] flex items-center justify-center text-white font-extrabold text-base shadow-[0_8px_20px_rgba(18,10,43,0.1)]">
                  {profile?.name?.[0]?.toUpperCase() ?? "P"}
                </div>
              )}
              {/* Punto de presencia propia — verde (activo) / amarillo (sin foco). */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#FFF1EB] ${
                  myStatus === "active" ? "bg-green-500" : "bg-amber-400"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Row 2: greeting */}
        <div>
          <span className="eyebrow text-[#FF7031] ">
            Tu Resumen
          </span>
          <h1 className="text-[#120A2B] leading-none mt-1">
            <span className="block text-xl font-light tracking-tight">Hola,</span>
            <span className="block text-5xl font-black">{firstName} 👋</span>
          </h1>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-8 pb-10">

        {/* 1. Solicitudes pendientes */}
        <section className="space-y-4 enter enter-1">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Solicitudes
          </h2>
          {pending.length === 0 ? (
            <div className="bg-white/60 rounded-[24px] px-5 py-6 text-center border border-white/80">
              <p className="text-sm font-bold text-[#120A2B]">Sin solicitudes por ahora</p>
              <p className="text-xs text-gray-400 mt-1">Cuando un cliente te reserve, aparecerá aquí.</p>
            </div>
          ) : (
            pending.map((b) => (
              <SolicitudCard key={b.id} booking={b} onAccept={removePending} onDecline={removePending} onExpire={removePending} />
            ))
          )}
        </section>

        {/* 2. Cuidados en curso */}
        {activeBookings.length > 0 && (
          <section className="space-y-3 enter enter-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              En Curso
            </h2>
            {activeBookings.map((b) => (
              <ActiveCard key={b.id} booking={b} />
            ))}
          </section>
        )}

        {/* 3. Métricas */}
        <section className="space-y-3 enter enter-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Tus Ingresos
          </h2>
          <div className="bg-white rounded-[32px] overflow-hidden shadow-[0_12px_30px_rgba(18,10,43,0.04)] pb-4">

            {/* Filter pills */}
            <div className="px-5 pt-5 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => handleFilterClick(f.key)}
                  className={[
                    "flex-none px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap",
                    activeFilter === f.key
                      ? "bg-[#120A2B] text-white shadow-[0_8px_20px_rgba(18,10,43,0.2)]"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Custom date pickers */}
            {activeFilter === "personalizado" && (
              <div className="px-5 pb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="flex-1 text-xs text-[#120A2B] bg-gray-50 border border-gray-100 rounded-[14px] px-3 py-2.5 focus:outline-none"
                  />
                  <span className="text-gray-400 text-sm font-bold shrink-0">–</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="flex-1 text-xs text-[#120A2B] bg-gray-50 border border-gray-100 rounded-[14px] px-3 py-2.5 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => applyFilter("personalizado", customStart, customEnd)}
                  disabled={!customStart || !customEnd || isPending}
                  className="w-full py-2.5 rounded-[14px] text-xs font-bold bg-[#120A2B] text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : "Aplicar fechas"}
                </button>
              </div>
            )}

            {/* Stats trio */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 mt-2">
              <div className="px-2 py-3 text-center">
                <p className={`text-base font-black ${isPending ? "opacity-30" : "text-[#120A2B]"}`}>
                  {fmtCOP(stats.pawwer_earnings)}
                </p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-1">
                  Ingresos
                </p>
              </div>
              <div className="px-2 py-3 text-center">
                <p className={`text-base font-black ${isPending ? "opacity-30" : "text-[#120A2B]"}`}>
                  {stats.bookings_completed}
                </p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-1">
                  Cuidados
                </p>
              </div>
              <div className="px-2 py-3 text-center">
                <p className={`text-base font-black ${isPending ? "opacity-30" : "text-[#120A2B]"}`}>
                  {avg > 0 ? fmtCOP(avg) : "–"}
                </p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-1">
                  Promedio
                </p>
              </div>
            </div>

            {/* Area chart */}
            <div className="px-2 pt-2 relative">
              {isPending && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
                  <Loader2 size={24} className="animate-spin text-[#120A2B]" />
                </div>
              )}
              {!hasEarnings && !isPending ? (
                <div className="h-28 flex items-center justify-center">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Sin datos en este período</p>
                </div>
              ) : (
                <EarningsChart data={chartData} gradientId={gradientId} />
              )}
            </div>
          </div>
        </section>

        {/* 4. Tu Nivel */}
        <NivelCard detail={levelDetail} />

        {/* 5. Referidos */}
        <div className="enter enter-5">
          <ReferralCard profileUrl={profileUrl} />
        </div>

        {/* 6. Accesos rápidos */}
        <div className="grid grid-cols-2 gap-4 pt-2 enter enter-6">
          <Link
            href="/pawwer/cuidados"
            className="bg-white rounded-[28px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.04)] hover:-translate-y-1 transition-transform flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 rounded-[16px] bg-[#FFF1EB] flex items-center justify-center mb-3 text-[#FF7031]">
              <CalendarDays size={22} />
            </div>
            <p className="text-sm font-black text-[#120A2B]">Historial</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Registros</p>
          </Link>
          <Link
            href="/pawwer/disponibilidad"
            className="bg-white rounded-[28px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.04)] hover:-translate-y-1 transition-transform flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 rounded-[16px] bg-[#E0F2FE] flex items-center justify-center mb-3 text-[#0284C7]">
              <MapPin size={22} />
            </div>
            <p className="text-sm font-black text-[#120A2B]">Agenda</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Disponibilidad</p>
          </Link>
        </div>
      </main>

      {/* Panel de notificaciones */}
      {notifOpen && (
        <NotificationsSheet
          items={notifItems}
          totalUnread={counts.total}
          onClose={() => setNotifOpen(false)}
          onOpenItem={handleOpenNotif}
          onMarkAll={markAllRead}
        />
      )}

      {/* Bottom sheet menú */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-[#120A2B]/40 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)} />
          <div className="relative bg-white max-w-xl mx-auto w-full max-h-[88vh] flex flex-col shadow-[0_-20px_40px_rgba(18,10,43,0.15)]" style={{ borderRadius: "32px 32px 0 0" }}>
            <div className="shrink-0 px-6 pt-5 pb-0 relative">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
              <button onClick={() => setMenuOpen(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Contenido scrollable — sin el botón de cerrar sesión */}
            <div className="overflow-y-auto flex-1 px-8 pt-2 pb-4">
              <div className="flex flex-col items-center gap-3 mb-8 text-center mt-2">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile.name ?? ""} className="w-20 h-20 rounded-[24px] object-cover border-4 border-white shadow-[0_10px_25px_rgba(18,10,43,0.1)]" />
                ) : (
                  <div className="w-20 h-20 rounded-[24px] bg-[#120A2B] flex items-center justify-center text-white font-black text-3xl shadow-[0_10px_25px_rgba(18,10,43,0.1)]">
                    {profile?.name?.[0]?.toUpperCase() ?? "P"}
                  </div>
                )}
                <div>
                  <p className="font-black text-[#120A2B] text-xl">{profile?.name ?? "Pawwer"}</p>
                  <p className="text-sm text-gray-400 font-semibold">{userEmail}</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-100 rounded-full px-4 py-1.5">
                    <CheckCircle2 size={14} className="text-green-500" /> Verificado
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Link href={`/pawwer/${userId}`} onClick={() => setMenuOpen(false)} className="flex items-center gap-4 w-full px-5 py-4 rounded-[20px] bg-gray-50 hover:bg-gray-100 transition-colors">
                  <ExternalLink size={20} className="text-[#120A2B]" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-[#120A2B]">Perfil Público</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-400" />
                </Link>

                <button onClick={handlePasswordReset} disabled={isSendingReset || resetEmailSent} className="flex items-center gap-4 w-full px-5 py-4 rounded-[20px] bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-60 text-left">
                  {isSendingReset ? <Loader2 size={20} className="text-[#120A2B] animate-spin" /> : resetEmailSent ? <CheckCircle2 size={20} className="text-green-500" /> : <KeyRound size={20} className="text-[#120A2B]" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#120A2B]">{resetEmailSent ? "Correo enviado" : "Seguridad"}</p>
                  </div>
                  {!resetEmailSent && !isSendingReset && <ChevronRight size={18} className="text-gray-400" />}
                </button>

                <Link href="/soporte" onClick={() => setMenuOpen(false)} className="flex items-center gap-4 w-full px-5 py-4 rounded-[20px] bg-gray-50 hover:bg-gray-100 transition-colors">
                  <HelpCircle size={20} className="text-[#120A2B]" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-[#120A2B]">Soporte Pawwi</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-400" />
                </Link>

                <Link href="/pawwer/disponibilidad" onClick={() => setMenuOpen(false)} className="flex items-center gap-4 w-full px-5 py-4 rounded-[20px] bg-gray-50 hover:bg-gray-100 transition-colors">
                  <CalendarRange size={20} className="text-[#120A2B]" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-[#120A2B]">Disponibilidad</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-400" />
                </Link>
              </div>
            </div>

            {/* Cerrar sesión — siempre visible, pegado al fondo */}
            <div className="shrink-0 px-8 py-4 border-t border-gray-100" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-full bg-[#120A2B] text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-60 shadow-[0_8px_20px_rgba(18,10,43,0.2)]"
              >
                {isSigningOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                {isSigningOut ? "Saliendo…" : "Cerrar sesión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
