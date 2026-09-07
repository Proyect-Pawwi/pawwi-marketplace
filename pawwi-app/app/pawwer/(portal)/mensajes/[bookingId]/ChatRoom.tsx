"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, AlertCircle, Dog, MapPin, Car, ChevronRight, ImagePlus, LifeBuoy } from "lucide-react";
import { createClient } from "@/lib/client";
import { usePresence, PresenceDot, presenceLabel } from "@/components/Presence";
import type { BookingRow } from "@/app/actions/portal";
import { SERVICE_LABEL as SERVICE_DISPLAY } from "@/lib/services";

// Soporte por WhatsApp (mismo número del chat viejo)
const SUPPORT_WHATSAPP = "573332885462";

// Moderación: no compartir contacto para mantener la transacción en Pawwi.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\d[\s.\-]?){7,}/;

// Decodifica un File a imagen de forma robusta. `createImageBitmap` es rápido y
// respeta la orientación EXIF, pero falla con HEIC/HEIF —el formato de las fotos
// tomadas EN VIVO con la cámara del iPhone (modo Alta Eficiencia)— y en algunos
// Safari con imágenes grandes. En ese caso caemos a un <img> vía object URL, que
// sí decodifica HEIC y aplica la orientación. Así funcionan cámara y galería.
async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo decodificar la imagen")); };
      img.src = url;
    });
  }
}

// Reduce la foto a máx 1280px y la comprime a JPEG (sube menos peso a Storage y
// normaliza HEIC → JPEG para que Storage y el <img> del chat siempre la muestren).
async function resizeImage(file: File): Promise<Blob> {
  const source = await decodeImage(file);
  const srcW = (source as HTMLImageElement).naturalWidth || source.width;
  const srcH = (source as HTMLImageElement).naturalHeight || source.height;
  const maxSize = 1280;
  let width = srcW;
  let height = srcH;
  if (width > maxSize || height > maxSize) {
    const scale = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(source, 0, 0, width, height);
  if ("close" in source) source.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.8),
  );
}

interface MessageRow {
  id: string;
  booking_id: string;
  sender_id: string | null;
  content: string;
  photo_url: string | null;
  is_daily_report: boolean;
  is_system: boolean;
  created_at: string;
}

// ── Helpers para la tarjeta de resumen ──────────────────────────────────────
function fmtCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}
function fmtHora(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hour = parseInt(h!, 10);
  if (Number.isNaN(hour)) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${suffix}`;
}
function fmtDateShort(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = (bLat - aLat) * (Math.PI / 180);
  const dLng = (bLng - aLng) * (Math.PI / 180);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * (Math.PI / 180)) * Math.cos(bLat * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function fmtDistance(km: number): string {
  return km < 1 ? `a ${Math.round(km * 1000)} m` : `a ${km.toFixed(1)} km`;
}

const DAY_MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// Formateo DETERMINÍSTICO en hora de Bogotá (UTC-5, sin DST). Evita el
// hydration mismatch de toLocaleTimeString/DateString (Node ICU vs navegador
// difieren en el espacio de "a. m." y en la zona horaria).
function toBogota(iso: string): Date {
  // Restamos 5h y luego leemos con getUTC* → hora de pared de Bogotá.
  return new Date(new Date(iso).getTime() - 5 * 3600 * 1000);
}

function fmtTime(iso: string): string {
  const d = toBogota(iso);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDay(iso: string): string {
  const d = toBogota(iso);
  const now = toBogota(new Date().toISOString());
  const key = (x: Date) => `${x.getUTCFullYear()}-${x.getUTCMonth()}-${x.getUTCDate()}`;
  const yest = new Date(now.getTime() - 86_400_000);
  if (key(d) === key(now)) return "Hoy";
  if (key(d) === key(yest)) return "Ayer";
  return `${d.getUTCDate()} de ${DAY_MONTHS[d.getUTCMonth()]}`;
}

// ── Tarjeta "Resumen del cuidado" (mensaje de sistema) ──────────────────────
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[#120A2B]/40 font-semibold uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold text-[#120A2B] text-right">{value}</span>
    </div>
  );
}

function SummaryCard({
  booking,
  pawwerLat,
  pawwerLng,
}: {
  booking: BookingRow;
  pawwerLat?: number | null;
  pawwerLng?: number | null;
}) {
  const dog = booking.dogs[0];
  const chips = [
    dog?.breed,
    dog?.weight_kg != null ? `${dog.weight_kg} kg` : null,
    dog?.sex === "macho" ? "Macho" : dog?.sex === "hembra" ? "Hembra" : null,
  ].filter(Boolean) as string[];

  const distance = pawwerLat != null && pawwerLng != null && booking.client_lat != null && booking.client_lng != null
    ? fmtDistance(haversineKm(pawwerLat, pawwerLng, booking.client_lat, booking.client_lng))
    : null;
  const zona = [booking.client_neighborhood, distance].filter(Boolean).join(" · ");

  const sameDay = booking.start_date?.slice(0, 10) === booking.end_date?.slice(0, 10);
  const entrada = `${fmtDateShort(booking.start_date)}${fmtHora(booking.start_time) ? ` · ${fmtHora(booking.start_time)}` : ""}`;
  const salida  = sameDay
    ? (fmtHora(booking.end_time) ?? null)
    : `${fmtDateShort(booking.end_date)}${fmtHora(booking.end_time) ? ` · ${fmtHora(booking.end_time)}` : ""}`;

  const obs = [booking.comments, ...booking.dogs.map((d) => d.notes)].filter(Boolean).join(" · ");

  const fee = booking.transport_fee ?? 0;
  const transportLabel = fee > 0
    ? `${booking.transport_legs === 1 ? "Ida" : "Ida y vuelta"} · ${booking.transport_provider === "pawwi" ? "lo hace Pawwi" : "lo haces tú"}`
    : null;

  // Dirección de recogida (solo si hay transporte) → tappable a Google Maps.
  const pickupHref =
    booking.client_lat != null && booking.client_lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${booking.client_lat},${booking.client_lng}`
      : booking.client_address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.client_address)}`
        : null;

  return (
    <div className="my-5 mx-auto w-full max-w-sm">
      <p className="text-center eyebrow text-[#120A2B]/30 mb-2">
        Resumen del cuidado
      </p>
      <div className="bg-white rounded-[24px] border border-[#120A2B]/8 shadow-[0_8px_30px_-6px_rgba(18,10,43,0.1)] overflow-hidden">
        {/* Perro */}
        <div className="flex items-center gap-3 p-4">
          {dog?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dog.photo_url} alt={dog.name} className="w-14 h-14 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#FFF1EB] flex items-center justify-center text-2xl shrink-0">🐶</div>
          )}
          <div className="min-w-0">
            <p className="font-black text-[#120A2B] truncate">{dog?.name ?? "Mascota"}</p>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {chips.map((c) => (
                  <span key={c} className="text-[10px] font-bold px-2 py-0.5 bg-gray-50 text-[#120A2B] border border-gray-100 rounded-full">{c}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Logística */}
        <div className="px-4 pb-3 space-y-2 border-t border-gray-50 pt-3">
          <SummaryRow label="Servicio" value={SERVICE_DISPLAY[booking.service_type] ?? booking.service_type} />
          <SummaryRow label="Entrada" value={entrada} />
          {salida && <SummaryRow label="Salida" value={salida} />}
          {zona && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#120A2B]/40 font-semibold uppercase tracking-wide">Zona</span>
              <span className="text-sm font-bold text-[#120A2B] flex items-center gap-1 text-right">
                <MapPin size={12} className="text-[#FF7031] shrink-0" /> {zona}
              </span>
            </div>
          )}
          {transportLabel && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#120A2B]/40 font-semibold uppercase tracking-wide">Transporte</span>
              <span className="text-sm font-bold text-[#120A2B] flex items-center gap-1 text-right">
                <Car size={12} className="text-[#0284C7] shrink-0" /> {transportLabel}
              </span>
            </div>
          )}
          {fee > 0 && booking.client_address && (
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs text-[#120A2B]/40 font-semibold uppercase tracking-wide shrink-0 pt-0.5">Recogida</span>
              <a
                href={pickupHref ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-[#0284C7] flex items-center gap-1 text-right hover:underline min-w-0"
              >
                <MapPin size={12} className="text-[#FF7031] shrink-0" />
                <span className="min-w-0">{booking.client_address}</span>
              </a>
            </div>
          )}
        </div>

        {/* Observaciones */}
        {obs && (
          <div className="mx-4 mb-3 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2.5">
            <p className="eyebrow text-amber-600 tracking-widest mb-0.5">Observaciones</p>
            <p className="text-xs font-semibold text-[#120A2B] leading-relaxed">{obs}</p>
          </div>
        )}

        {/* Ganancia + link */}
        <Link
          href={`/pawwer/cuidados/${booking.id}`}
          className="flex items-center justify-between bg-gray-50/70 px-4 py-3 hover:bg-gray-100 transition-colors"
        >
          <div>
            <p className="eyebrow text-gray-400 tracking-widest">Tu ganancia</p>
            <p className="text-lg font-black text-[#120A2B]">{fmtCOP(booking.pawwer_payout)}</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-[#FF7031]">
            Ver reserva <ChevronRight size={14} />
          </span>
        </Link>
      </div>
    </div>
  );
}

interface Props {
  booking: BookingRow;
  initialMessages: MessageRow[];
  userId: string;
  pawwerLat?: number | null;
  pawwerLng?: number | null;
}

export default function ChatRoom({ booking, initialMessages, userId, pawwerLat, pawwerLng }: Props) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dogNames = booking.dogs.map((d) => d.name).join(", ") || "Mascota";

  // Presencia de la contraparte (el cliente). Neutro hasta que el cliente
  // tenga portal que emita latidos; ahí el punto se enciende solo.
  const presence = usePresence(booking.client.id);
  const presenceText = presenceLabel(presence.state, presence.lastSeenAt, presence.now);

  // Marca como vistos los mensajes de la contraparte y baja el contador
  // de notificaciones 'mensaje' de este booking (el provider se refresca solo
  // vía realtime sobre la tabla notifications).
  const markSeen = useCallback(() => {
    createClient().rpc("mark_messages_seen", { p_booking_id: booking.id });
  }, [booking.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Al abrir el chat
  useEffect(() => {
    markSeen();
  }, [markSeen]);

  // Al montar (incluye revisitas donde Next sirve la página cacheada), trae los
  // mensajes FRESCOS de la BD y los FUSIONA (nunca borra) — así no se "pierde"
  // un mensaje enviado justo antes de salir del chat.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, booking_id, sender_id, content, photo_url, is_daily_report, is_system, created_at")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled || !data) return;
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const merged = [...prev, ...(data as MessageRow[]).filter((m) => !ids.has(m.id))];
        merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return merged;
      });
    })();
    return () => { cancelled = true; };
  }, [booking.id]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${booking.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `booking_id=eq.${booking.id}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Mensaje entrante mientras miro el chat → márcalo visto al instante
          if (newMsg.sender_id !== userId) markSeen();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [booking.id, userId, markSeen]);

  // Agrega el mensaje al instante (envío optimista). El realtime dedup por id.
  function appendLocal(id: string, content: string, photo_url: string | null) {
    setMessages((prev) =>
      prev.some((m) => m.id === id)
        ? prev
        : [
            ...prev,
            {
              id,
              booking_id: booking.id,
              sender_id: userId,
              content,
              photo_url,
              is_daily_report: false,
              is_system: false,
              created_at: new Date().toISOString(),
            },
          ],
    );
  }

  function handleSend() {
    const content = input.trim();
    if (!content) return;
    // Moderación (feedback instantáneo; el servidor la valida de nuevo).
    if (EMAIL_RE.test(content)) { setError("Por seguridad, no compartas correos en el chat."); return; }
    if (PHONE_RE.test(content)) { setError("Por seguridad, no compartas números de teléfono en el chat."); return; }
    setError(null);
    setInput("");
    startTransition(async () => {
      const supabase = createClient();
      const { data: newId, error: rpcErr } = await supabase.rpc("send_message", {
        p_booking_id: booking.id,
        p_content: content,
        p_photo_url: null,
      });
      if (rpcErr) {
        setError(rpcErr.message || "No se pudo enviar el mensaje. Intenta de nuevo.");
        setInput(content);
        return;
      }
      if (typeof newId === "string") appendLocal(newId, content, null);
    });
  }

  // Foto: comprime → sube a Storage (chat-photos) → manda el mensaje con la URL.
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const blob = await resizeImage(file);
      const path = `${booking.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("chat-photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("chat-photos").getPublicUrl(path);
      const { data: newId, error: rpcErr } = await supabase.rpc("send_message", {
        p_booking_id: booking.id,
        p_content: "",
        p_photo_url: publicUrl,
      });
      if (rpcErr) throw rpcErr;
      if (typeof newId === "string") appendLocal(newId, "", publicUrl);
    } catch (err) {
      console.error("Error al enviar la foto del chat:", err);
      setError("No se pudo enviar la foto. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // El PRIMER mensaje de sistema (el "¡Reserva confirmada!" que abre el chat) se
  // pinta como la tarjeta Resumen. Los demás mensajes de sistema (p.ej. avisos de
  // cancelación) se muestran como una nota de texto centrada — NO como otra tarjeta.
  const summaryId = messages.find((m) => m.is_system)?.id ?? null;

  // Group messages by day
  const grouped: Array<{ day: string; messages: MessageRow[] }> = [];
  for (const msg of messages) {
    const day = fmtDay(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.day === day) last.messages.push(msg);
    else grouped.push({ day, messages: [msg] });
  }

  return (
    // Overlay full-screen enfocado: cubre el BottomNav del portal y usa 100dvh
    // (se adapta al chrome del móvil y al teclado). z-[60] > nav (z-50).
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#FFF1EB] overflow-hidden font-sans" style={{ height: "100dvh" }}>
      {/* Atmósfera — blobs soft UI */}
      <div aria-hidden className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-8%] right-[-12%] w-72 h-72 bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[90px] opacity-40" />
        <div className="absolute bottom-[8%] left-[-12%] w-80 h-80 bg-[#92C0E9] rounded-full mix-blend-multiply filter blur-[90px] opacity-35" />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/80 backdrop-blur-xl border-b border-white/50 shadow-sm shrink-0">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link
            href="/pawwer/mensajes"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-[#120A2B]/10 hover:bg-[#FFF1EB] transition-colors shrink-0"
          >
            <ArrowLeft size={16} className="text-[#120A2B]" />
          </Link>
          <div className="relative shrink-0">
            {booking.client.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={booking.client.avatar_url}
                alt={booking.client.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#120A2B] flex items-center justify-center text-white font-extrabold text-sm border-2 border-white shadow-sm">
                {booking.client.name[0]?.toUpperCase()}
              </div>
            )}
            <PresenceDot
              state={presence.state}
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3"
              ring="border-white"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm text-[#120A2B] truncate leading-tight">{booking.client.name}</p>
            {presenceText && (
              <p
                className={`text-[11px] font-bold truncate leading-tight mt-0.5 ${
                  presence.state === "online"
                    ? "text-green-600"
                    : presence.state === "away"
                      ? "text-amber-600"
                      : "text-[#120A2B]/40"
                }`}
              >
                {presenceText}
              </p>
            )}
            <p className="text-[11px] text-[#120A2B]/50 flex items-center gap-1 truncate mt-0.5">
              <Dog size={11} className="text-[#FF7031] shrink-0" />
              {dogNames}
              {" · "}
              {SERVICE_DISPLAY[booking.service_type] ?? booking.service_type}
            </p>
          </div>
          <button
            onClick={() =>
              window.open(
                `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Hola, necesito ayuda con un cuidado en Pawwi 🐾")}`,
                "_blank",
              )
            }
            className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-[#120A2B]/5 border border-[#120A2B]/10 text-[#120A2B] text-xs font-bold hover:bg-[#120A2B]/10 transition-colors shrink-0"
          >
            <LifeBuoy size={14} /> Ayuda
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-xl mx-auto w-full"
        style={{ backgroundImage: "radial-gradient(rgba(247,174,241,0.3) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-14 h-14 rounded-full bg-[#FFF1EB] flex items-center justify-center mb-3">
              <Send size={22} className="text-[#FF7031]" />
            </div>
            <p className="text-sm text-[#120A2B]/50">
              Escríbele a {booking.client.name} para coordinar el cuidado.
            </p>
          </div>
        )}

        {grouped.map(({ day, messages: dayMsgs }) => (
          <div key={day}>
            {/* Day label */}
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-[#120A2B]/10" />
              <span className="text-[10px] font-extrabold text-[#120A2B]/30 uppercase tracking-widest whitespace-nowrap">
                {day}
              </span>
              <div className="flex-1 h-px bg-[#120A2B]/10" />
            </div>

            {/* Messages */}
            <div className="space-y-1">
              {dayMsgs.map((msg) => {
                if (msg.is_system) {
                  // El opener → tarjeta Resumen; cualquier otro aviso de sistema → nota de texto.
                  if (msg.id === summaryId) {
                    return <SummaryCard key={msg.id} booking={booking} pawwerLat={pawwerLat} pawwerLng={pawwerLng} />;
                  }
                  return (
                    <div key={msg.id} className="my-3 flex justify-center">
                      <span className="max-w-[85%] text-center text-[11px] font-semibold text-[#120A2B]/50 bg-white/70 border border-[#120A2B]/8 rounded-full px-4 py-1.5">
                        {msg.content}
                      </span>
                    </div>
                  );
                }
                const isMe = msg.sender_id === userId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"} animate-slide-up`}
                  >
                    <div
                      className={[
                        "max-w-[75%] rounded-2xl text-sm leading-relaxed overflow-hidden",
                        msg.photo_url ? "p-1.5" : "px-4 py-2.5",
                        isMe
                          ? "bg-[#120A2B] text-white rounded-br-md"
                          : "bg-white text-[#120A2B] border border-[#120A2B]/8 rounded-bl-md shadow-sm",
                      ].join(" ")}
                    >
                      {msg.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={msg.photo_url}
                          alt="Foto del cuidado"
                          className="rounded-xl w-64 max-w-full max-h-80 object-cover block"
                        />
                      )}
                      {msg.content && <p className={msg.photo_url ? "px-2 pt-1.5" : ""}>{msg.content}</p>}
                      <p
                        className={[
                          "text-[10px] mt-1 text-right",
                          isMe ? "text-white/50" : "text-[#120A2B]/40",
                          msg.photo_url ? "px-2 pb-1" : "",
                        ].join(" ")}
                      >
                        {fmtTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="relative z-20 bg-white/90 backdrop-blur-xl border-t border-white/60 shadow-[0_-4px_16px_rgba(18,10,43,0.04)] px-4 pt-3 shrink-0 w-full"
      >
        <div className="max-w-xl mx-auto" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}>
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-3 py-2 text-xs text-red-600 mb-2">
            <AlertCircle size={13} /> {error}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-[#120A2B] hover:bg-gray-200 transition-colors disabled:opacity-50"
            title="Enviar foto"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje…"
            rows={1}
            maxLength={2000}
            className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-[#120A2B] placeholder:text-gray-400 focus:outline-none focus:border-gray-400 bg-gray-50 max-h-32 overflow-y-auto"
            style={{ minHeight: "2.75rem" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className={[
              "w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0",
              input.trim() && !isSending
                ? "bg-[#120A2B] text-white hover:bg-[#1e1145] shadow-[0_4px_12px_rgba(18,10,43,0.25)] active:scale-[0.95]"
                : "bg-gray-100 text-gray-400",
            ].join(" ")}
          >
            {isSending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
