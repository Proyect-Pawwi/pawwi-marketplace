"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/client";
import { usePresence, PresenceDot, presenceLabel } from "@/components/Presence";
import { LEVEL_META, asLevel, type Level } from "@/lib/levels";
import {
  ArrowLeft, Share, ShieldCheck, Star,
  ChevronLeft, ChevronRight, Check, Clock,
  ChevronDown, ChevronUp, Briefcase, PawPrint,
  Sun, Moon, Plane, Cat, Home as HomeIcon, TreePine, ShieldAlert, Car,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ServiceDef {
  id: string;
  name: string;
  price: number;
  unit: string;
  icon: React.ReactNode;
  maxAnimals: number;
  maxSize: number; // 1=Pequeño, 2=Mediano, 3=Grande
}

const SIZE_LABEL: Record<number, string> = { 1: "Pequeño", 2: "Mediano", 3: "Grande" };

interface HomeDetail {
  icon: React.ElementType;
  title: string;
  desc: string;
}

interface Faq { q: string; a: string; }

interface Review {
  id: string;
  author: string;
  date: string;
  pet: string;
  rating: number;
  text: string;
}

interface PawwerData {
  id: string;
  name: string;
  title: string;
  location: string;
  avatar: string;
  rating: number;
  reviewsCount: number;
  badge: string;
  stats: { experience: string; cares: string };
  images: string[];
  services: ServiceDef[];
  transportPrice: number;
  about: string;
  experience: string[];
  homeDetails: HomeDetail[];
  weekPattern: { d: string; active: boolean }[];
  responseTime: string;
  faqs: Faq[];
  reviews: Review[];
  availableDates: string[]; // ISO date strings con slots_remaining > 0
  acceptingBookings: boolean;
  recepcionDesde: string | null;
  recepcionHasta: string | null;
  level: Level;
  verified: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SEMANA = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];

// weekPattern índice → JS getDay()  (L=1 M=2 M=3 J=4 V=5 S=6 D=0)
const WEEK_DAY_MAP = [1, 2, 3, 4, 5, 6, 0];


// ─── DB → UI mapping ──────────────────────────────────────────────────────────
const SERVICE_ICON_MAP: Record<string, Omit<ServiceDef, "price" | "maxAnimals" | "maxSize">> = {
  DayCare:  { id: "daycare",   name: "Daycare",   unit: "día",   icon: <Sun   size={18} /> },
  Night:    { id: "nightcare", name: "Nightcare", unit: "noche", icon: <Moon  size={18} /> },
  Travel:   { id: "travel",    name: "Travel",    unit: "día",   icon: <Plane size={18} /> },
  Express:  { id: "express",   name: "Express",   unit: "hora",  icon: <Clock size={18} /> },
};

// service.id (UI) → service_type.id (DB: DayCare=1, Night=2, Travel=3, Express=4)
const SERVICE_DB_ID_MAP: Record<string, number> = {
  daycare: 1, nightcare: 2, travel: 3, express: 4,
};

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?q=80&w=800&auto=format&fit=crop",
];
const FALLBACK_AVATAR = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop";

const WEEK_KEYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const WEEK_LABELS = ["L","M","M","J","V","S","D"];

function formatReviewDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1)  return "Hoy";
  if (days < 7)  return `Hace ${days} día${days > 1 ? "s" : ""}`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} semana${Math.floor(days / 7) > 1 ? "s" : ""}`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `Hace ${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? "s" : ""}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbToPawwer(row: any, availableDates: string[] = []): PawwerData {
  const wp = row.week_pattern ?? {};

  const services: ServiceDef[] = (row.services ?? [])
    .filter((s: any) => s.is_active && s.service_type?.name && SERVICE_ICON_MAP[s.service_type.name])
    .map((s: any) => ({
      ...SERVICE_ICON_MAP[s.service_type.name]!,
      price: s.price,
      maxAnimals: s.max_animals ?? 1,
      maxSize: s.max_size ?? 3,
    }));

  const images: string[] = (row.images ?? [])
    .slice()
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((img: any) => (typeof img.image === "string" && img.image.startsWith("http") ? img.image : null))
    .filter(Boolean);

  const yrs = Number(row.years_experience ?? 0);

  const reviews: Review[] = (row.reviews ?? []).map((r: any) => ({
    id: r.id,
    author: r.reviewer?.name ?? "Cliente verificado",
    date: formatReviewDate(r.created_at),
    pet: "Cliente verificado",
    rating: Number(r.rating),
    text: r.comment ?? "",
  }));

  return {
    id: row.id,
    name: row.profile?.name ?? "Pawwer",
    title: row.profession ?? "",
    location: row.neighborhood ? `${row.neighborhood}, Bogotá` : "Bogotá",
    avatar: row.profile?.avatar_url ?? FALLBACK_AVATAR,
    rating: Number(row.rating ?? 0),
    reviewsCount: row.reviews_count ?? 0,
    badge: row.badge ?? "Nuevo",
    stats: { experience: yrs > 0 ? `${yrs} ${yrs === 1 ? "Año" : "Años"}` : "Nuevo", cares: `+${row.reviews_count ?? 0}` },
    images: images.length > 0 ? images : FALLBACK_IMAGES,
    services: services.length > 0 ? services : [{ ...SERVICE_ICON_MAP.DayCare!, price: row.price ?? 50000, maxAnimals: 1, maxSize: 3 }],
    transportPrice: row.transport_price ?? 0,
    about: row.bio ?? "",
    experience: Array.isArray(row.experience) ? row.experience : [],
    homeDetails: [
      { icon: Cat,         title: "Mascotas en casa", desc: (Array.isArray(row.animales_en_casa) && row.animales_en_casa.length ? row.animales_en_casa.join(" · ") : "Consúltalo por chat") },
      { icon: HomeIcon,    title: "Tipo de hogar",    desc: row.tipo_inmueble || "Verificado por Pawwi" },
      { icon: TreePine,    title: "Áreas externas",   desc: (Array.isArray(row.areas_externas) && row.areas_externas.length ? row.areas_externas.join(" · ") : "Consúltalo por chat") },
      { icon: ShieldAlert, title: "Seguridad",        desc: row.mi_espacio || "Protocolo de seguridad Pawwi" },
    ] as HomeDetail[],
    weekPattern: WEEK_LABELS.map((d, i) => ({ d, active: wp[WEEK_KEYS[i]!] ?? false })),
    responseTime: row.response_time ?? "< 2 horas",
    faqs: Array.isArray(row.faqs) ? row.faqs as Faq[] : [],
    reviews,
    availableDates,
    acceptingBookings: row.accepting_bookings ?? true,
    recepcionDesde: row.recepcion_desde ?? null,
    recepcionHasta: row.recepcion_hasta ?? null,
    level: asLevel(row.level),
    verified: row.verified ?? false,
  };
}

// "08:00:00" → "8:00 a. m."
function fmtHora(t: string | null): string | null {
  if (!t) return null;
  const [hStr, m] = t.split(":");
  const h = parseInt(hStr!, 10);
  if (Number.isNaN(h)) return null;
  const ampm = h >= 12 ? "p. m." : "a. m.";
  const hh = h % 12 || 12;
  return `${hh}:${m} ${ampm}`;
}

function fmtCOP(n: number) {
  return `$${(n / 1000).toFixed(0)}k`;
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

// ─── CalendarWidget ───────────────────────────────────────────────────────────
function CalendarWidget({
  selectedDate, rangeStart, rangeEnd, isTravel,
  blockedDaysOfWeek, availableDates, onDateClick,
}: {
  selectedDate: Date | null;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  isTravel: boolean;
  blockedDaysOfWeek: number[];
  availableDates: string[];
  onDateClick: (d: Date) => void;
}) {
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  function prevMonth() {
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();

  type Cell = { key: string; empty: true } | { key: string; empty: false; date: Date; day: number };
  const cells: Cell[] = [
    ...Array.from({ length: firstDay }, (_, i): Cell => ({ key: `e${i}`, empty: true })),
    ...Array.from({ length: totalDays }, (_, i): Cell => {
      const d = new Date(viewYear, viewMonth, i + 1);
      d.setHours(0, 0, 0, 0);
      return { key: `d${i}`, empty: false, date: d, day: i + 1 };
    }),
  ];

  function isSel(d: Date) {
    if (isTravel) return rangeStart?.getTime() === d.getTime() || rangeEnd?.getTime() === d.getTime();
    return selectedDate?.getTime() === d.getTime();
  }
  function inRange(d: Date) {
    if (!isTravel || !rangeStart || !rangeEnd) return false;
    return d > rangeStart && d < rangeEnd;
  }
  function isUnavailable(d: Date) {
    if (d < today) return true;
    if (blockedDaysOfWeek.includes(d.getDay())) return true;
    // Si hay datos de disponibilidad cargados, solo permitir fechas con slots
    if (availableDates.length > 0) {
      const iso = d.toISOString().split("T")[0]!;
      return !availableDates.includes(iso);
    }
    return false;
  }

  return (
    <div className="border border-white/60 bg-white/70 backdrop-blur-md rounded-[20px] p-4 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <button onClick={prevMonth}
          disabled={viewYear === today.getFullYear() && viewMonth === today.getMonth()}
          className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm disabled:opacity-30"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="font-extrabold text-[#120A2B] text-sm">
          {MESES[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth}
          className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className={`text-center text-[10px] font-extrabold py-1 ${
            blockedDaysOfWeek.includes(i === 0 ? 0 : i) ? "text-gray-300" : "text-gray-400"
          }`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map(cell => {
          if (cell.empty) return <div key={cell.key} />;
          const d = cell.date;
          const unavail = isUnavailable(d);
          const sel     = isSel(d);
          const mid     = inRange(d);
          return (
            <button key={cell.key} disabled={unavail} onClick={() => !unavail && onDateClick(d)}
              className={`h-9 w-full rounded-xl text-xs font-bold flex items-center justify-center transition-colors relative z-10
                ${unavail
                  ? "text-gray-300 cursor-not-allowed line-through"
                  : sel   ? "bg-[#120A2B] text-white shadow-md"
                  : mid   ? "bg-[#F7AEF1]/40 text-[#120A2B]"
                  : "text-[#120A2B] hover:bg-white border border-transparent hover:border-gray-200 cursor-pointer"
                }`}
            >
              {mid && <div className="absolute inset-0 bg-[#F7AEF1]/30 -z-10 w-[110%] -ml-[5%]" />}
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {blockedDaysOfWeek.length > 0 && (
        <p className="text-[10px] text-gray-400 text-center mt-2">
          Días tachados = no disponible para este Pawwer
        </p>
      )}
    </div>
  );
}

// ─── PhotoGallery ─────────────────────────────────────────────────────────────
function PhotoGallery({ images, level }: { images: string[]; level: Level }) {
  const [cur, setCur] = useState(0);
  const lvl = LEVEL_META[level];
  const LvlIcon = lvl.icon;
  return (
    <>
      {/* Desktop: asymmetric grid — original design ratios */}
      <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-3 h-[480px] rounded-[32px] overflow-hidden relative">
        {/* Main image — full height, left half */}
        <div className="col-span-2 row-span-2 relative group cursor-pointer bg-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="" className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" />
        </div>
        {/* Top-right */}
        <div className="col-span-2 row-span-1 relative group cursor-pointer bg-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[1]} alt="" className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" />
        </div>
        {/* Bottom-right */}
        <div className="col-span-2 row-span-1 relative group cursor-pointer bg-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[2]} alt="" className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" />
        </div>
        {/* Nivel */}
        <div className={`absolute top-5 left-5 px-4 py-2 rounded-full font-extrabold text-xs shadow-lg flex items-center gap-2 uppercase tracking-wide ${lvl.chip}`}>
          <LvlIcon size={14} /> {lvl.label}
        </div>
      </div>

      {/* Mobile: full-width carousel con altura generosa */}
      <div className="md:hidden relative w-full overflow-hidden" style={{ height: "56vw", minHeight: 260, maxHeight: 380 }}>
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ width: `${images.length * 100}%`, transform: `translateX(-${(cur * 100) / images.length}%)` }}
        >
          {images.map((src, i) => (
            <div key={i} className="relative h-full" style={{ width: `${100 / images.length}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover object-top" />
            </div>
          ))}
        </div>
        {/* Gradient bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        {/* Nivel */}
        <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-full font-extrabold text-[10px] shadow-lg flex items-center gap-1.5 uppercase tracking-wider z-10 ${lvl.chip}`}>
          <LvlIcon size={11} /> {lvl.label}
        </div>
        {/* Counter pill top-right */}
        <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full text-white text-xs font-bold z-10">
          {cur + 1} / {images.length}
        </div>
        {/* Dots */}
        <div className="absolute bottom-4 left-0 w-full flex justify-center gap-1.5 z-10">
          {images.map((_, i) => (
            <button key={i} onClick={() => setCur(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${i === cur ? "bg-white w-6" : "bg-white/50 w-1.5"}`} />
          ))}
        </div>
        {/* Tap zones para cambiar foto (mobile-friendly) */}
        {cur > 0 && (
          <button onClick={() => setCur(i => i - 1)}
            className="absolute left-0 top-0 h-full w-1/3 z-10 flex items-center pl-3"
            aria-label="Foto anterior"
          >
            <div className="bg-black/30 backdrop-blur-sm rounded-full p-2">
              <ChevronLeft size={18} className="text-white" />
            </div>
          </button>
        )}
        {cur < images.length - 1 && (
          <button onClick={() => setCur(i => i + 1)}
            className="absolute right-0 top-0 h-full w-1/3 z-10 flex items-center justify-end pr-3"
            aria-label="Siguiente foto"
          >
            <div className="bg-black/30 backdrop-blur-sm rounded-full p-2">
              <ChevronRight size={18} className="text-white" />
            </div>
          </button>
        )}
      </div>
    </>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#FFF1EB] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-[#FF7031] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#6B7280]">Cargando perfil...</p>
      </div>
    </div>
  );
}

// ─── Page (data fetcher) ───────────────────────────────────────────────────────
export default function PawwerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pawwer, setPawwer] = useState<PawwerData | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const today    = new Date().toISOString().split("T")[0]!;
    const in60days = new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0]!;

    Promise.all([
      supabase
        .from("pawwer")
        .select(`
          id, price, rating, reviews_count, badge, level, verified, neighborhood, transport_price,
          bio, profession, response_time, experience, week_pattern, faqs, years_experience,
          animales_en_casa, tipo_inmueble, areas_externas, ninos_pequenos, mi_espacio,
          accepting_bookings, deactivated_at, recepcion_desde, recepcion_hasta,
          profile!pawwer_profile_fk ( name, avatar_url ),
          services:service_X_Pawwer ( price, is_active, max_animals, max_size, service_type!fk_service_x_pawwer_service_type ( name ) ),
          images:Pawwer_images ( image, sort_order ),
          reviews ( id, rating, comment, created_at, reviewer:profile!reviews_client_id_fkey ( name ) )
        `)
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("availability")
        .select("date")
        .eq("pawwer_id", id)
        .gte("date", today)
        .lte("date", in60days)
        .gt("slots_remaining", 0),
    ]).then(([{ data, error }, { data: avail }]) => {
      if (error) console.error("[Pawwi] pawwer profile:", error.message);
      // No encontrado (id inválido) o cuenta desactivada → pantalla "no disponible"
      // (antes: id inválido dejaba el skeleton cargando para siempre).
      if (!data || data.deactivated_at) { setGone(true); return; }
      const availableDates = (avail ?? []).map((r: { date: string }) => r.date);
      setPawwer(mapDbToPawwer(data, availableDates));
    });
  }, [id]);

  if (gone) {
    return (
      <div className="min-h-screen bg-[#FFF1EB] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-white flex items-center justify-center mb-5 shadow-[0_12px_30px_rgba(18,10,43,0.06)] text-gray-300">
          <ShieldAlert size={30} />
        </div>
        <h1 className="text-xl font-black text-[#120A2B] mb-1.5">Este perfil ya no está disponible</h1>
        <p className="text-sm text-gray-500 max-w-xs mb-7 leading-relaxed">El cuidador desactivó su cuenta. Explora otros pawwers en Pawwi.</p>
        <Link href="/" className="bg-[#120A2B] text-white font-bold text-sm px-6 py-3.5 rounded-full active:scale-95 transition-transform">Ver otros pawwers</Link>
      </div>
    );
  }
  if (!pawwer) return <LoadingSkeleton />;
  return <PawwerProfileUI pawwer={pawwer} />;
}

// ─── Profile UI ───────────────────────────────────────────────────────────────
function PawwerProfileUI({ pawwer }: { pawwer: PawwerData }) {
  const [activeService, setActiveService]   = useState<ServiceDef>(pawwer.services[0]!);
  const [hours, setHours]                   = useState(1);
  const [transportLegs, setTransportLegs]   = useState(0);
  const [selectedDate, setSelectedDate]     = useState<Date | null>(null);
  const [rangeStart, setRangeStart]         = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd]             = useState<Date | null>(null);
  const [openFaq, setOpenFaq]               = useState<number | null>(null);

  const isTravel  = activeService.id === "travel";
  const isExpress = activeService.id === "express";
  const bookable  = pawwer.acceptingBookings;  // perfil en pausa → no reservable

  // Presencia del pawwer, tal como la ve el cliente (verde/amarillo/rojo + "hace X").
  const presence = usePresence(pawwer.id);
  const presenceText = presenceLabel(presence.state, presence.lastSeenAt, presence.now);

  // Derive blocked days of week from the pawwer's weekPattern
  const blockedDaysOfWeek = pawwer.weekPattern
    .map((d, i) => !d.active ? WEEK_DAY_MAP[i]! : -1)
    .filter(n => n !== -1);

  function handleServiceChange(svc: ServiceDef) {
    setActiveService(svc);
    setHours(1);
    setTransportLegs(0);
    setSelectedDate(null);
    setRangeStart(null);
    setRangeEnd(null);
  }

  function handleDateClick(d: Date) {
    if (isTravel) {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(d); setRangeEnd(null);
      } else if (d < rangeStart) {
        setRangeEnd(rangeStart); setRangeStart(d);
      } else if (d.getTime() === rangeStart.getTime()) {
        setRangeStart(null); setRangeEnd(null);
      } else {
        setRangeEnd(d);
      }
    } else {
      setSelectedDate(d);
    }
  }

  function getDaysDiff() {
    if (!rangeStart || !rangeEnd) return 0;
    return Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1;
  }

  function getSubtotal() {
    if (isExpress) return activeService.price * hours;
    if (isTravel) {
      const days = getDaysDiff();
      return activeService.price * (days < 2 ? 2 : days);
    }
    return activeService.price;
  }
  const getTransportTotal = () => transportLegs * pawwer.transportPrice;
  const getTotal          = () => getSubtotal() + getTransportTotal();

  function hasSelection() {
    if (isTravel) return !!(rangeStart && rangeEnd);
    return selectedDate !== null;
  }

  function fmtDate(d: Date) {
    return `${d.getDate()} ${MESES[d.getMonth()]!.slice(0, 3)}`;
  }

  function selectionLabel() {
    if (isTravel) {
      if (rangeStart && rangeEnd) return `${fmtDate(rangeStart)} → ${fmtDate(rangeEnd)}`;
      if (rangeStart) return `Desde ${fmtDate(rangeStart)}`;
      return "Elige fechas";
    }
    return selectedDate ? fmtDate(selectedDate) : "Elige una fecha";
  }

  function bookingHref() {
    if (!hasSelection() || !bookable) return "#";
    const params = new URLSearchParams({
      pawwer_id:  pawwer.id,
      step:       "1",
      service_id: String(SERVICE_DB_ID_MAP[activeService.id] ?? 1),
    });
    if (isTravel) {
      params.set("start", toISO(rangeStart!));
      params.set("end", toISO(rangeEnd!));
    } else {
      params.set("start", toISO(selectedDate!));
    }
    if (isExpress) params.set("hours", String(hours));
    return `/booking/nuevo?${params.toString()}`;
  }

  // ── Sidebar booking card (reused on desktop) ───────────────────────────────
  function BookingCard() {
    return (
      <div className="bg-white/90 backdrop-blur-2xl border border-white rounded-[28px] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] space-y-5">

        {/* Price header */}
        <div className="pb-4 border-b border-gray-100">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-[#120A2B]">
              {fmtCOP(activeService.price)}
            </span>
            <span className="text-sm text-gray-500">/ {activeService.unit}</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Star size={12} className="text-[#FFC107] fill-[#FFC107]" />
            <span className="text-xs font-bold text-[#120A2B]">{pawwer.rating}</span>
            <span className="text-xs text-gray-400">({pawwer.reviewsCount} reseñas)</span>
          </div>
        </div>

        {/* Service selector */}
        <div>
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-2">Servicio</p>
          <div className="grid grid-cols-2 gap-2">
            {pawwer.services.map(svc => (
              <button key={svc.id} onClick={() => handleServiceChange(svc)}
                className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition-all
                  ${activeService.id === svc.id
                    ? "bg-[#120A2B] border-[#120A2B] text-white"
                    : "bg-white border-gray-200 text-[#120A2B] hover:border-[#120A2B]"
                  }`}
              >
                <span className={activeService.id === svc.id ? "text-white" : "text-[#FF7031]"}>{svc.icon}</span>
                <span className="text-xs font-bold">{svc.name}</span>
                <span className={`text-[10px] font-medium ${activeService.id === svc.id ? "text-white/70" : "text-gray-400"}`}>
                  {fmtCOP(svc.price)}/{svc.unit}
                </span>
              </button>
            ))}
          </div>
          {/* Reglas de mascotas del servicio seleccionado */}
          <div className="flex items-center gap-2 mt-2 text-[11px] font-semibold text-[#120A2B]/55 bg-[#FFF1EB]/60 border border-[#FF7031]/10 rounded-xl px-3 py-2">
            <PawPrint size={13} className="text-[#FF7031] shrink-0" />
            <span>Acepta hasta <b className="text-[#120A2B]">{activeService.maxAnimals}</b> {activeService.maxAnimals === 1 ? "perro" : "perros"} · hasta tamaño <b className="text-[#120A2B]">{SIZE_LABEL[activeService.maxSize] ?? "Grande"}</b></span>
          </div>
        </div>

        {/* Express hours */}
        {isExpress && (
          <div>
            <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-2">Horas</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setHours(h => Math.max(1, h - 1))}
                className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center font-bold text-gray-600 hover:border-[#120A2B] transition-colors">−</button>
              <span className="text-lg font-extrabold text-[#120A2B] w-8 text-center">{hours}</span>
              <button onClick={() => setHours(h => Math.min(12, h + 1))}
                className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center font-bold text-gray-600 hover:border-[#120A2B] transition-colors">+</button>
              <span className="text-xs text-gray-500">{hours === 1 ? "hora" : "horas"}</span>
            </div>
          </div>
        )}

        {/* Calendar */}
        <div>
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-2">
            {isTravel ? "Rango de fechas" : "Fecha"}
          </p>
          <CalendarWidget
            selectedDate={selectedDate}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            isTravel={isTravel}
            blockedDaysOfWeek={blockedDaysOfWeek}
            availableDates={pawwer.availableDates}
            onDateClick={handleDateClick}
          />
        </div>

        {/* Transport */}
        {!isTravel && pawwer.transportPrice > 0 && (
          <div>
            <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Car size={12} /> Transporte <span className="normal-case font-medium text-gray-400">({fmtCOP(pawwer.transportPrice)}/trayecto)</span>
            </p>
            <div className="flex gap-2">
              {([{v:0,l:"No"},{v:1,l:"Ida"},{v:2,l:"Ida y vuelta"}] as const).map(opt => (
                <button key={opt.v} onClick={() => setTransportLegs(opt.v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors
                    ${transportLegs === opt.v
                      ? "bg-[#120A2B] text-white border-[#120A2B]"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price breakdown */}
        {hasSelection() && (
          <div className="bg-[#FFF1EB] rounded-xl p-3.5 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-600">
              <span>{activeService.name} · {isExpress ? `${hours} h` : isTravel ? `${getDaysDiff()} días` : "1 día"}</span>
              <span>{fmtCOP(getSubtotal())}</span>
            </div>
            {transportLegs > 0 && (
              <div className="flex justify-between text-xs text-gray-600">
                <span>Transporte ({transportLegs === 1 ? "ida" : "ida y vuelta"})</span>
                <span>+{fmtCOP(getTransportTotal())}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-[#120A2B] pt-1.5 border-t border-[#FF7031]/20">
              <span>Total estimado</span>
              <span>{fmtCOP(getTotal())}</span>
            </div>
            <p className="text-[10px] text-gray-400 text-center">No se cobrará nada aún</p>
          </div>
        )}

        {/* CTA */}
        {!bookable && (
          <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-center mb-1">
            No está recibiendo reservas en este momento.
          </p>
        )}
        <Link
          href={bookingHref()}
          className={`block w-full text-center py-4 rounded-2xl font-extrabold text-base transition-all
            ${hasSelection() && bookable
              ? "bg-[#FF7031] text-white hover:bg-[#e6652c] shadow-md hover:shadow-lg active:scale-95"
              : "bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none"
            }`}
        >
          {bookable ? "Continuar reserva" : "No disponible"}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF1EB] text-[#120A2B] relative pb-36 lg:pb-0">

      {/* Blobs — contained so they never cause horizontal overflow */}
      <div aria-hidden className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[80px] opacity-40 blob-1" />
        <div className="absolute top-[20%] right-[-10%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-[#FF7031] rounded-full mix-blend-multiply filter blur-[90px] opacity-10 blob-2" />
      </div>

      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-white/50 sticky top-0 z-50 px-4 md:px-6 lg:px-10 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-9 h-9 flex items-center justify-center hover:bg-white bg-white/60 border border-white/80 rounded-full transition-colors shadow-sm">
            <ArrowLeft size={18} />
          </Link>
          <img src="/LogoPawwiCompleteOrange.svg" alt="Pawwi" className="hidden md:block h-5 w-auto" />
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 bg-white/60 hover:bg-white border border-white rounded-full transition-colors shadow-sm text-sm font-semibold">
          <Share size={15} />
          <span className="hidden sm:inline">Compartir</span>
        </button>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-0 md:px-5 lg:px-10 py-0 md:py-6">

        <PhotoGallery images={pawwer.images} level={pawwer.level} />

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 mt-[-28px] md:mt-6 relative z-20">

          {/* ── Left column ── */}
          <div className="flex-1 bg-white/85 backdrop-blur-xl rounded-t-[2rem] md:rounded-[1.75rem] border border-white/60 shadow-[0_-8px_32px_rgba(18,10,43,0.08)] md:shadow-sm">

            {/* Avatar overlap row */}
            <div className="flex justify-between items-end pl-5 pr-5 md:pl-7 md:pr-7 pt-0 -mt-12 md:-mt-14 mb-5">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pawwer.avatar} alt={pawwer.name}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover object-top border-4 border-[#FFF1EB] shadow-lg" />
                <PresenceDot
                  state={presence.state}
                  className="absolute bottom-0.5 right-0.5 w-4 h-4"
                  ring="border-[#FFF1EB]"
                />
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2 text-right shadow-sm border border-gray-100">
                <div className="text-lg md:text-xl font-extrabold text-[#120A2B] leading-tight">
                  {fmtCOP(pawwer.services[0]!.price)}
                </div>
                <div className="text-[11px] text-gray-500 font-medium">Desde / {pawwer.services[0]!.unit}</div>
              </div>
            </div>

            <div className="px-5 md:px-7 pb-8 space-y-7">

              {/* Banner: perfil en pausa */}
              {!bookable && (
                <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <Clock size={16} className="text-amber-600 shrink-0" />
                  <p className="text-xs font-bold text-amber-700 leading-relaxed">
                    Este pawwer no está recibiendo reservas por ahora. Puedes ver su perfil, pero no reservar.
                  </p>
                </div>
              )}

              {/* Identity */}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h1 className="text-xl md:text-2xl font-extrabold text-[#120A2B]">{pawwer.name}</h1>
                  {(() => {
                    const m = LEVEL_META[pawwer.level];
                    const LvlIcon = m.icon;
                    return (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${m.chip}`}>
                        <LvlIcon size={11} /> {m.label}
                      </span>
                    );
                  })()}
                  {pawwer.verified && (
                    <span className="text-xs bg-[#E0F2FE] text-[#0284C7] px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                      <ShieldCheck size={10} /> Verificado
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 font-medium mb-2">{pawwer.title} · {pawwer.location}</p>
                {presenceText && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <PresenceDot state={presence.state} className="w-2 h-2" ring="border-white" />
                    <span
                      className={`text-xs font-bold ${
                        presence.state === "online"
                          ? "text-green-600"
                          : presence.state === "away"
                            ? "text-amber-600"
                            : "text-gray-400"
                      }`}
                    >
                      {presenceText}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="flex items-center gap-1 font-bold text-[#120A2B]">
                    <Star size={14} className="text-[#FFC107] fill-[#FFC107]" />
                    {pawwer.rating}
                    <span className="font-normal text-gray-400">({pawwer.reviewsCount} reseñas)</span>
                  </span>
                  <span className="flex items-center gap-1 text-gray-500">
                    <Clock size={13} className="text-[#FF7031]" /> {pawwer.responseTime}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { icon: Briefcase,  bg: "bg-[#FFF0F6]", color: "text-[#E04882]", value: pawwer.stats.experience, label: "Experiencia" },
                  { icon: PawPrint,   bg: "bg-[#F3E5F5]", color: "text-[#9C27B0]", value: pawwer.stats.cares,      label: "Cariños dados" },
                  { icon: ShieldCheck,bg: "bg-[#E3F2FD]", color: "text-[#1976D2]", value: "Verificado",             label: "Perfil seguro" },
                ].map(({ icon: Icon, bg, color, value, label }) => (
                  <div key={label} className="bg-white/70 border border-white rounded-2xl p-3 flex flex-col items-center text-center shadow-sm">
                    <div className={`w-8 h-8 rounded-xl ${bg} ${color} flex items-center justify-center mb-1.5`}>
                      <Icon size={16} />
                    </div>
                    <strong className="text-[#120A2B] font-extrabold text-xs">{value}</strong>
                    <small className="text-gray-400 text-[9px] uppercase tracking-wide font-bold">{label}</small>
                  </div>
                ))}
              </div>

              {/* Services — mobile: horizontal scroll */}
              <div>
                <h2 className="text-base font-extrabold text-[#120A2B] mb-3">Servicios disponibles</h2>
                <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
                  {pawwer.services.map(svc => (
                    <button key={svc.id} onClick={() => handleServiceChange(svc)}
                      className={`flex-shrink-0 snap-start flex flex-col items-start gap-1 px-4 py-3 rounded-2xl border transition-all min-w-[120px]
                        ${activeService.id === svc.id
                          ? "bg-[#120A2B] border-[#120A2B] text-white shadow-md"
                          : "bg-white/70 border-white text-[#120A2B] hover:border-gray-200"
                        }`}
                    >
                      <span className={activeService.id === svc.id ? "text-[#FF7031]" : "text-[#FF7031]"}>{svc.icon}</span>
                      <span className="text-sm font-extrabold">{svc.name}</span>
                      <span className={`text-xs font-medium ${activeService.id === svc.id ? "text-white/70" : "text-gray-400"}`}>
                        {fmtCOP(svc.price)}/{svc.unit}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Reglas de mascotas del servicio seleccionado */}
                <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-[#120A2B]/60 bg-[#FFF1EB]/70 border border-[#FF7031]/10 rounded-2xl px-4 py-2.5">
                  <PawPrint size={14} className="text-[#FF7031] shrink-0" />
                  <span>Acepta hasta <b className="text-[#120A2B]">{activeService.maxAnimals}</b> {activeService.maxAnimals === 1 ? "perro" : "perros"} · hasta tamaño <b className="text-[#120A2B]">{SIZE_LABEL[activeService.maxSize] ?? "Grande"}</b> a la vez</span>
                </div>
              </div>

              {/* Mobile configurator */}
              <div className="lg:hidden space-y-4">
                {/* Hours (Express) */}
                {isExpress && (
                  <div className="bg-white/70 border border-white rounded-2xl p-4">
                    <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-3">¿Cuántas horas?</p>
                    <div className="flex items-center gap-4">
                      <button onClick={() => setHours(h => Math.max(1, h - 1))}
                        className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center font-bold text-lg hover:border-[#120A2B] transition-colors">−</button>
                      <span className="text-2xl font-extrabold text-[#120A2B] w-10 text-center">{hours}</span>
                      <button onClick={() => setHours(h => Math.min(12, h + 1))}
                        className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center font-bold text-lg hover:border-[#120A2B] transition-colors">+</button>
                      <span className="text-sm text-gray-500">{hours === 1 ? "hora" : "horas"} · {fmtCOP(activeService.price * hours)}</span>
                    </div>
                  </div>
                )}

                {/* Calendar */}
                <div>
                  <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-2">
                    {isTravel ? "Selecciona el rango" : "Selecciona la fecha"}
                  </p>
                  <CalendarWidget
                    selectedDate={selectedDate}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    isTravel={isTravel}
                    blockedDaysOfWeek={blockedDaysOfWeek}
                    availableDates={pawwer.availableDates}
                    onDateClick={handleDateClick}
                  />
                </div>

                {/* Transport */}
                {!isTravel && pawwer.transportPrice > 0 && (
                  <div className="bg-white/70 border border-white rounded-2xl p-4">
                    <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <Car size={12} className="text-gray-400" /> Transporte · {fmtCOP(pawwer.transportPrice)}/trayecto
                    </p>
                    <div className="flex gap-2">
                      {([{v:0,l:"No"},{v:1,l:"Ida"},{v:2,l:"Ida y vuelta"}] as const).map(opt => (
                        <button key={opt.v} onClick={() => setTransportLegs(opt.v)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold border transition-colors
                            ${transportLegs === opt.v
                              ? "bg-[#120A2B] text-white border-[#120A2B]"
                              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                            }`}
                        >{opt.l}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-gray-100" />

              {/* Availability week dots */}
              <div>
                <h2 className="text-base font-extrabold text-[#120A2B] mb-3">Disponibilidad habitual</h2>
                <div className="flex gap-1.5">
                  {pawwer.weekPattern.map((day, i) => (
                    <div key={i}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold border transition-colors
                        ${day.active
                          ? "bg-[#120A2B] text-white border-[#120A2B]"
                          : "bg-gray-100 text-gray-300 border-gray-200 line-through"
                        }`}
                    >{day.d}</div>
                  ))}
                </div>
                {fmtHora(pawwer.recepcionDesde) && fmtHora(pawwer.recepcionHasta) && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mt-3">
                    <Clock size={13} className="text-[#FF7031]" />
                    Recibe y entrega de <span className="font-bold text-[#120A2B]">{fmtHora(pawwer.recepcionDesde)}</span> a <span className="font-bold text-[#120A2B]">{fmtHora(pawwer.recepcionHasta)}</span>
                  </p>
                )}
              </div>

              {/* About */}
              <div>
                <h2 className="text-base font-extrabold text-[#120A2B] mb-2">Sobre mí</h2>
                <p className="text-sm text-gray-600 font-medium leading-relaxed">{pawwer.about}</p>
              </div>

              {/* Experience bullets */}
              <ul className="space-y-2">
                {pawwer.experience.map((exp, i) => (
                  <li key={i} className="flex items-start gap-2.5 bg-white/50 border border-white p-3 rounded-xl">
                    <Check size={15} className="text-[#FF7031] shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 font-medium">{exp}</span>
                  </li>
                ))}
              </ul>

              {/* Home details */}
              <div>
                <h2 className="text-base font-extrabold text-[#120A2B] mb-3">En casa</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {pawwer.homeDetails.map((detail, i) => {
                    const Icon = detail.icon;
                    return (
                      <div key={i} className="bg-white/60 border border-white p-3.5 rounded-2xl flex items-start gap-3 shadow-sm">
                        <div className="bg-[#120A2B]/5 p-2 rounded-lg shrink-0">
                          <Icon size={16} className="text-[#120A2B]" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-[#120A2B] text-xs mb-0.5">{detail.title}</h4>
                          <p className="text-xs text-gray-500 font-medium leading-relaxed">{detail.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reviews */}
              <div>
                <h2 className="text-base font-extrabold text-[#120A2B] mb-3 flex items-center gap-2">
                  Reseñas
                  <span className="text-[#FF7031] bg-[#FF7031]/10 px-2 py-0.5 rounded-lg text-xs">{pawwer.reviewsCount}</span>
                </h2>
                <div className="space-y-3">
                  {pawwer.reviews.map(review => (
                    <div key={review.id} className="bg-white/70 border border-white p-4 rounded-2xl shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-extrabold text-[#120A2B] text-sm">{review.author}</p>
                          <p className="text-xs text-gray-400">{review.pet} · {review.date}</p>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: review.rating }).map((_, j) => (
                            <Star key={j} size={11} className="text-[#FFC107] fill-[#FFC107]" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed italic">&ldquo;{review.text}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ */}
              <div>
                <h2 className="text-base font-extrabold text-[#120A2B] mb-3">Preguntas frecuentes</h2>
                <div className="bg-white/60 border border-white rounded-2xl overflow-hidden shadow-sm">
                  {pawwer.faqs.map((faq, i) => (
                    <div key={i} className="border-b border-white/50 last:border-0">
                      <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full p-4 flex justify-between items-center text-left hover:bg-white/40 transition-colors"
                      >
                        <span className="font-extrabold text-[#120A2B] text-sm pr-4">{faq.q}</span>
                        {openFaq === i
                          ? <ChevronUp size={15} className="text-gray-400 shrink-0" />
                          : <ChevronDown size={15} className="text-gray-400 shrink-0" />
                        }
                      </button>
                      {openFaq === i && (
                        <div className="px-4 pb-4 text-sm text-gray-600 font-medium leading-relaxed bg-white/20">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* ── Desktop sidebar ── */}
          <div className="hidden lg:block w-[360px] shrink-0">
            <div className="sticky top-20">
              <BookingCard />
            </div>
          </div>

        </div>
      </main>

      {/* ── Mobile bottom bar — safe area para iOS/Android ── */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-5 pt-4 shadow-[0_-8px_32px_rgba(18,10,43,0.12)]"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))' }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-[#120A2B]">{fmtCOP(getTotal())}</span>
              <span className="text-xs text-gray-400 font-medium">total est.</span>
            </div>
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {activeService.name} · {selectionLabel()}
            </p>
          </div>
          <Link
            href={bookingHref()}
            className={`shrink-0 px-8 py-4 rounded-2xl font-extrabold text-base transition-all
              ${hasSelection() && bookable
                ? "bg-[#FF7031] text-white shadow-lg active:scale-95"
                : "bg-gray-100 text-gray-400 pointer-events-none"
              }`}
          >
            {bookable ? "Continuar" : "En pausa"}
          </Link>
        </div>
      </div>

    </div>
  );
}
