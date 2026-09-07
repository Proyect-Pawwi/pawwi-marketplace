"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ShieldCheck, ExternalLink, Share2, Calendar, Clock, Images, FileText,
  Star, HelpCircle, CreditCard, Lock, LifeBuoy, LogOut, Trash2, ChevronRight,
  PawPrint, Loader2, AlertCircle, Check, Power,
} from "lucide-react";
import { setAcceptingBookings, setRecepcionHorario, deactivateAccount } from "@/app/actions/perfil";
import { cerrarSesion } from "@/app/actions/auth";

const SUPPORT_WHATSAPP = "573332885462";

// "08:00" → "8:00 a. m." (determinístico, sin toLocale*).
function fmt12(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined) return "";
  const ampm = h >= 12 ? "p. m." : "a. m.";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface Props {
  userId: string;
  name: string;
  avatarUrl: string | null;
  badge: string;
  acceptingBookings: boolean;
  recepcionDesde: string | null;
  recepcionHasta: string | null;
  rating: number;
  reviewsCount: number;
}

// Fila de menú estilo iOS Settings, espaciosa.
function MenuRow({
  icon, title, subtitle, href, onClick, danger,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${danger ? "bg-red-50 text-red-500" : "bg-[#FFF1EB] text-[#FF7031]"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className={`text-sm font-black ${danger ? "text-red-500" : "text-[#120A2B]"}`}>{title}</p>
        {subtitle && <p className="text-[13px] font-medium text-[#120A2B]/45 mt-0.5 truncate">{subtitle}</p>}
      </div>
      <ChevronRight size={18} className="text-[#120A2B]/20 shrink-0" />
    </div>
  );

  const cls = "block w-full hover:bg-[#FFF1EB]/50 transition-colors active:bg-[#FFF1EB]";
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <button onClick={onClick} className={cls}>{inner}</button>;
}

// Contenedor de sección.
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-black tracking-widest text-[#120A2B]/40 uppercase px-3 mb-2.5">{label}</p>
      <div className="bg-white rounded-[28px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] overflow-hidden divide-y divide-gray-50">
        {children}
      </div>
    </div>
  );
}

export default function PerfilHub({
  userId, name, avatarUrl, badge,
  acceptingBookings: initialAccepting,
  recepcionDesde, recepcionHasta, rating, reviewsCount,
}: Props) {
  const firstName = name.split(" ")[0] || "Pawwer";

  const [accepting, setAccepting] = useState(initialAccepting);
  const [, startAccepting] = useTransition();
  const [desde, setDesde] = useState((recepcionDesde ?? "").slice(0, 5));
  const [hasta, setHasta] = useState((recepcionHasta ?? "").slice(0, 5));
  const [horarioSaved, setHorarioSaved] = useState(false);
  const [savingHorario, startHorario] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, startDelete] = useTransition();
  const [loggingOut, startLogout] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function togglePause() {
    const next = !accepting;
    setAccepting(next);
    startAccepting(async () => {
      const res = await setAcceptingBookings(next);
      if (res.error) { setAccepting(!next); setError(res.error); }
    });
  }

  function saveHorario() {
    setError(null);
    startHorario(async () => {
      const res = await setRecepcionHorario(desde || null, hasta || null);
      if (res.error) setError(res.error);
      else { setHorarioSaved(true); setTimeout(() => setHorarioSaved(false), 2500); }
    });
  }

  function share() {
    const url = `${window.location.origin}/pawwer/${userId}`;
    if (navigator.share) navigator.share({ title: `${firstName} en Pawwi`, url }).catch(() => {});
    else { navigator.clipboard?.writeText(url); setError("Link copiado ✓"); setTimeout(() => setError(null), 2000); }
  }

  function handleDelete() {
    setError(null);
    startDelete(async () => {
      const res = await deactivateAccount();
      if (res.error) { setError(res.error); return; }
      window.location.href = "/pawwer/login?desactivada=1";
    });
  }

  return (
    <div className="min-h-screen relative font-sans">
      {/* Header */}
      <header className="relative z-20 pt-12 pb-4">
        <div className="max-w-xl mx-auto px-6">
          <p className="eyebrow text-[#FF7031] ">Configuración</p>
          <div className="flex items-end justify-between gap-3 mt-1.5">
            <h1 className="text-3xl font-black text-[#120A2B] leading-none">Mi Perfil</h1>
            <span className="w-11 h-11 rounded-2xl bg-[#120A2B] flex items-center justify-center text-white shrink-0 shadow-[0_10px_25px_rgba(18,10,43,0.18)]">
              <PawPrint size={20} />
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-5 pb-12 enter enter-1">

        {error && (
          <div className="mb-4 flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-[13px] font-bold text-red-600 animate-slide-up">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        {/* ── Cabecera de estado global ── */}
        <div className="bg-white rounded-[32px] border border-white shadow-[0_12px_40px_rgba(18,10,43,0.05)] overflow-hidden mb-6">
          <div className="p-6 flex items-center gap-5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name} className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#120A2B] flex items-center justify-center text-white font-black text-3xl shrink-0">
                {name[0]?.toUpperCase() || "P"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-black text-[#120A2B] text-xl leading-tight truncate">{name || firstName}</p>
              <span className="inline-flex items-center gap-1.5 eyebrow tracking-wide text-[#0284C7] bg-[#E0F2FE] px-2.5 py-1 rounded-full mt-1.5">
                <ShieldCheck size={12} /> Pawwi {badge}
              </span>
              {reviewsCount > 0 && (
                <p className="flex items-center gap-1 text-[13px] font-bold text-[#120A2B]/50 mt-2">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <span className="text-[#120A2B]">{rating.toFixed(1)}</span> · {reviewsCount} reseñas
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 px-6 pb-5">
            <Link
              href={`/pawwer/${userId}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold text-[#120A2B] bg-[#FFF1EB] border border-[#FF7031]/10 hover:bg-[#FFE8DC] transition-colors"
            >
              <ExternalLink size={14} /> Ver perfil público
            </Link>
            <button
              onClick={share}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold text-[#120A2B] bg-[#FFF1EB] border border-[#FF7031]/10 hover:bg-[#FFE8DC] transition-colors"
            >
              <Share2 size={14} /> Compartir
            </button>
          </div>

          {/* Toggle pausar */}
          <button
            onClick={togglePause}
            className={`w-full flex items-center gap-4 px-6 py-5 border-t transition-colors ${accepting ? "border-gray-50 bg-white hover:bg-[#FFF1EB]/40" : "border-amber-100 bg-amber-50"}`}
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${accepting ? "bg-green-100 text-green-600" : "bg-amber-200 text-amber-700"}`}>
              <Power size={18} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[15px] font-black text-[#120A2B]">{accepting ? "Perfil activo" : "Perfil en pausa"}</p>
              <p className="text-xs font-medium text-[#120A2B]/50 mt-0.5">{accepting ? "Apareces en las búsquedas" : "Oculto del marketplace"}</p>
            </div>
            {/* Switch */}
            <span className={`relative w-14 h-8 rounded-full transition-colors duration-300 shrink-0 ${accepting ? "bg-green-500" : "bg-gray-300"}`}>
              <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-300 ${accepting ? "left-[30px]" : "left-0.5"}`} />
            </span>
          </button>
        </div>

        {/* ── Módulo 1: Agenda y logística ── */}
        <Section label="Agenda y logística">
          <MenuRow icon={<Calendar size={18} />} title="Mi disponibilidad" subtitle="Días que puedes recibir mascotas" href="/pawwer/disponibilidad" />
          <div className="px-5 py-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF1EB] text-[#FF7031] flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-[#120A2B]">Horarios de recepción</p>
                <p className="text-xs font-medium text-[#120A2B]/45 mt-0.5">Define tu franja de atención diaria</p>
              </div>
            </div>
            <div className="bg-[#FFF1EB]/50 rounded-2xl p-4 border border-[#FF7031]/10">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="eyebrow text-[#120A2B]/40 block mb-1.5">Recibo desde</label>
                  <input type="time" value={desde} onChange={(e) => setDesde(e.target.value)}
                    className="w-full bg-white rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-[#120A2B] focus:outline-none focus:border-[#120A2B] transition-colors shadow-sm" />
                </div>
                <div className="flex-1">
                  <label className="eyebrow text-[#120A2B]/40 block mb-1.5">Hasta las</label>
                  <input type="time" value={hasta} onChange={(e) => setHasta(e.target.value)}
                    className="w-full bg-white rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-[#120A2B] focus:outline-none focus:border-[#120A2B] transition-colors shadow-sm" />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-[#120A2B]/10">
                <p className="text-xs font-bold text-[#120A2B]/55">
                  {desde && hasta
                    ? <>Franja: <span className="text-[#120A2B]">{fmt12(desde)}</span> a <span className="text-[#120A2B]">{fmt12(hasta)}</span></>
                    : "Horario sin definir"}
                </p>
                <button onClick={saveHorario} disabled={savingHorario || (!desde && !hasta)}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#120A2B] text-white disabled:opacity-40 shrink-0 flex items-center gap-2 active:scale-95 transition-transform">
                  {savingHorario ? <Loader2 size={14} className="animate-spin" /> : horarioSaved ? <><Check size={14} /> Listo</> : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Módulo 2: Tu vitrina ── */}
        <Section label="Tu vitrina pública">
          <MenuRow icon={<Images size={18} />} title="Fotos del hogar" subtitle="Agrega fotos nítidas de tus espacios" href="/pawwer/perfil/fotos" />
          <MenuRow icon={<FileText size={18} />} title="Presentación y detalles" subtitle="Profesión, experiencia y reglas de tu casa" href="/pawwer/perfil/vitrina" />
          <MenuRow icon={<HelpCircle size={18} />} title="Preguntas frecuentes" subtitle="Crea respuestas para tus clientes" href="/pawwer/perfil/faq" />
          <MenuRow icon={<Star size={18} />} title="Mis reseñas" subtitle="Lee las calificaciones de tus cuidados" href="/pawwer/perfil/resenas" />
        </Section>

        {/* ── Módulo 3: Finanzas y reglas ── */}
        <Section label="Finanzas y reglas">
          <MenuRow icon={<PawPrint size={18} />} title="Tarifas de cuidado" subtitle="Precios y calculadora de ganancias netas" href="/pawwer/perfil/tarifas" />
          <MenuRow icon={<CreditCard size={18} />} title="Cuenta para pagos" subtitle="Donde te depositamos cada viernes" href="/pawwer/perfil/pago" />
        </Section>

        {/* ── Módulo 4: Seguridad y soporte ── */}
        <Section label="Seguridad y soporte">
          <MenuRow icon={<Lock size={18} />} title="Seguridad" subtitle="Cambiar contraseña de acceso" href="/recuperar" />
          <MenuRow icon={<LifeBuoy size={18} />} title="Soporte Pawwi" subtitle="Escríbenos por WhatsApp"
            onClick={() => window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Hola, necesito ayuda con mi cuenta de Pawwer 🐾")}`, "_blank")} />
          <MenuRow icon={loggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />} title="Cerrar sesión"
            onClick={() => startLogout(async () => { await cerrarSesion(); })} />
          <MenuRow icon={<Trash2 size={18} />} title="Eliminar cuenta" danger onClick={() => setShowDelete(true)} />
        </Section>

        <p className="text-center text-[11px] font-bold text-[#120A2B]/30 pt-4 pb-6">Pawwi S.A.S. · Bogotá, Colombia 🐾</p>
      </main>

      {/* Modal eliminar cuenta */}
      {showDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div aria-hidden className="absolute inset-0 bg-[#120A2B]/50 backdrop-blur-sm" onClick={() => !deleting && setShowDelete(false)} />
          <div className="relative bg-white rounded-[32px] p-7 w-full max-w-sm shadow-[0_20px_60px_rgba(18,10,43,0.3)] animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 mb-5 mx-auto">
              <Trash2 size={28} />
            </div>
            <h2 className="text-xl font-black text-[#120A2B] text-center mb-2">¿Eliminar tu cuenta?</h2>
            <p className="text-sm font-medium text-gray-500 text-center mb-6 leading-relaxed">
              Dejarás de recibir reservas y perderás todas tus reseñas y clientes recurrentes de forma <strong className="text-red-500">irrecuperable</strong>.
            </p>

            <label className="text-[11px] font-black tracking-widest text-[#120A2B]/40 block mb-2 text-center">Escribe <span className="text-red-500">ELIMINAR</span> para confirmar</label>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="ELIMINAR"
              className="w-full bg-gray-50 rounded-xl border border-gray-200 px-4 py-3.5 text-sm font-bold text-center text-[#120A2B] focus:outline-none focus:border-red-300 focus:bg-white transition-colors mb-5"
            />

            <div className="space-y-3">
              <button
                onClick={handleDelete}
                disabled={deleteText !== "ELIMINAR" || deleting}
                className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-red-500 text-white font-bold active:scale-95 transition-transform disabled:opacity-30 shadow-[0_8px_20px_rgba(239,68,68,0.3)]"
              >
                {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                Eliminar mi cuenta
              </button>
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                className="w-full px-5 py-4 rounded-2xl bg-gray-100 text-[#120A2B] font-bold active:scale-95 transition-transform disabled:opacity-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
