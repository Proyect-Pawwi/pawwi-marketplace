"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import AuthModal from "@/components/AuthModal";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Search, MapPin, Star, ShieldCheck, Heart,
  Menu, User, Minus, Plus, ChevronDown, X, Map as MapIcon, List,
} from "lucide-react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { createClient } from "@/lib/client";
import { purgeSesionCliente } from "@/app/actions/auth";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { MapPawwer, LatLng } from "@/components/MapView";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import HeroImage from "@/components/HeroImage";
import { LEVEL_META, levelRank, asLevel, type Level } from "@/lib/levels";

// Load the map client-side only (no SSR — Google Maps requires window)
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

// ── Constants ──────────────────────────────────────────────────────────────
const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DIAS_SEMANA = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];

const SERVICE_MAP: Record<string, string> = {
  Daycare: "DayCare",
  Nightcare: "Night",
  Travel: "Travel",
  Express: "Express",
};

const SERVICE_BADGE: Record<string, string> = {
  DayCare: "bg-[#FFF1EB] text-[#FF7031] border-[#FF7031]/20",
  Night:   "bg-[#120A2B]/8 text-[#120A2B] border-[#120A2B]/10",
  Travel:  "bg-[#92C0E9]/20 text-[#1a6fa8] border-[#92C0E9]/30",
  Express: "bg-[#F7AEF1]/40 text-[#7c3aed] border-[#F7AEF1]/60",
};

const FILTER_ACTIVE: Record<string, string> = {
  Todos:     "bg-[#120A2B] text-white",
  Daycare:   "bg-[#FF7031] text-white",
  Nightcare: "bg-[#120A2B] text-white",
  Travel:    "bg-[#92C0E9] text-[#120A2B]",
};

const RADIUS_METERS: Record<string, number> = {
  "1 km": 1000,
  "2 km": 2000,
  "5 km": 5000,
  "10 km": 10000,
};

// ── Types ──────────────────────────────────────────────────────────────────
interface Pawwer extends MapPawwer {
  location: string;
  distance: string;
  rating: number;
  reviews: number;
  badge: string;
  level: Level;
  image: string;
  avatar: string;
  services: string[];
}

// ── Fallbacks while Pawwers don't have photos yet ─────────────────────────
const FALLBACK_HOMES = [
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1576941089067-2de3c901e126?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?q=80&w=800&auto=format&fit=crop",
];
const FALLBACK_AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1566492031773-4f4e44671857?q=80&w=200&auto=format&fit=crop",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbPawwer(row: any, i: number): Pawwer {
  const imageVal = row.images?.[0]?.image;
  const image = typeof imageVal === "string" && imageVal.startsWith("http")
    ? imageVal
    : FALLBACK_HOMES[i % FALLBACK_HOMES.length];
  const avatar = row.profile?.avatar_url ?? FALLBACK_AVATARS[i % FALLBACK_AVATARS.length];
  const services: string[] = (row.services ?? [])
    .map((s: { service_type?: { name?: string } }) => s.service_type?.name)
    .filter(Boolean);
  return {
    id: row.id as string,
    name: row.profile?.name ?? "Pawwer",
    location: row.neighborhood ?? "",
    distance: "—",
    price: `$${Math.round((row.price ?? 0) / 1000)}k`,
    rating: Number(row.rating ?? 0),
    reviews: row.reviews_count ?? 0,
    badge: row.badge ?? "Nuevo",
    level: asLevel(row.level),
    image,
    avatar,
    services,
    lat: row.lat,
    lng: row.lng,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Deterministic jitter from UUID — consistent between renders, ~300m max offset
function uuidSeed(uuid: string): number {
  return uuid.replace(/-/g, "").split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
}

function jitterCoords(id: string, lat: number, lng: number): LatLng {
  const seed = uuidSeed(id);
  const frac = (n: number) => n - Math.floor(n);
  const dLat = (frac(Math.sin(seed * 127.1) * 43758.5) - 0.5) * 0.005;
  const dLng = (frac(Math.sin(seed * 311.7) * 43758.5) - 0.5) * 0.005;
  return { lat: lat + dLat, lng: lng + dLng };
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLng = (b.lng - a.lng) * (Math.PI / 180);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * (Math.PI / 180)) * Math.cos(b.lat * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function datesBetween(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) { out.push(toISO(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PawwiHome() {
  const [activeTab, setActiveTab] = useState("daycare");
  const [activeFilter, setActiveFilter] = useState("Todos");

  const [searchLocation, setSearchLocation] = useState("");
  const [searchRadius, setSearchRadius] = useState("2 km");
  const [petsCount, setPetsCount] = useState(1);

  const [activeSearchPanel, setActiveSearchPanel] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState("where");

  const [calendarDate, setCalendarDate] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null, end: null,
  });

  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [pawwers, setPawwers] = useState<Pawwer[]>([]);
  const [availablePawwerIds, setAvailablePawwerIds] = useState<Set<string> | null>(null);

  // Geocoded coordinates of the typed search location
  const [searchCoords, setSearchCoords] = useState<LatLng | null>(null);

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const geocodingLib = useMapsLibrary("geocoding");
  const pawwersSectionRef = useRef<HTMLDivElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const [selectedPawwerId, setSelectedPawwerId] = useState<string | null>(null);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch pawwers from Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("pawwer")
      .select(`
        id, price, rating, reviews_count, lat, lng, badge, level, neighborhood,
        profile!pawwer_profile_fk ( name, avatar_url ),
        services:service_X_Pawwer ( price, service_type!fk_service_x_pawwer_service_type ( name ) ),
        images:Pawwer_images ( image )
      `)
      .eq("verified", true)
      .eq("accepting_bookings", true)
      .is("deactivated_at", null)
      .not("lat", "is", null)
      .then(({ data, error }) => {
        if (error) console.error("[Pawwi] fetch pawwers:", error.message, error.details);
        if (data) setPawwers(data.map(mapDbPawwer));
      });
  }, []);

  // Clear selected marker when filter or search location changes
  useEffect(() => { setSelectedPawwerId(null); }, [activeFilter, searchCoords]);

  // Filter by real availability when a date (or date range) is selected
  useEffect(() => {
    const isTravel = activeTab === "travel";
    const days = isTravel
      ? (selectedRange.start && selectedRange.end ? datesBetween(selectedRange.start, selectedRange.end) : null)
      : (selectedDate ? [toISO(selectedDate)] : null);

    if (!days) { setAvailablePawwerIds(null); return; }

    const supabase = createClient();
    supabase
      .from("availability")
      .select("pawwer_id, date")
      .in("date", days)
      .gt("slots_remaining", 0)
      .then(({ data, error }) => {
        if (error) { console.error("[Pawwi] fetch availability:", error.message); setAvailablePawwerIds(null); return; }
        const counts = new Map<string, number>();
        (data ?? []).forEach((r) => counts.set(r.pawwer_id as string, (counts.get(r.pawwer_id as string) ?? 0) + 1));
        const ids = new Set([...counts.entries()].filter(([, c]) => c === days.length).map(([id]) => id));
        setAvailablePawwerIds(ids);
      });
  }, [activeTab, selectedDate, selectedRange.start, selectedRange.end]);

  // Reset mobile sheet to "Dónde" on every open
  useEffect(() => { if (mobileSearchOpen) setMobileSection("where"); }, [mobileSearchOpen]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setActiveSearchPanel(null);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleTabChange(tab: string) {
    setActiveTab(tab.toLowerCase());
    setActiveFilter(tab);
    if (tab.toLowerCase() === "travel") setSelectedDate(null);
    else setSelectedRange({ start: null, end: null });
  }

  async function handleSearch() {
    setActiveSearchPanel(null);
    setMobileSearchOpen(false);
    pawwersSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!searchLocation.trim() || !geocodingLib) return;
    setIsSearching(true);
    try {
      const geocoder = new geocodingLib.Geocoder();
      const result = await geocoder.geocode({
        address: searchLocation + ", Bogotá, Colombia",
        componentRestrictions: { country: "co" },
      });
      const loc = result.results[0]?.geometry?.location;
      if (loc) setSearchCoords({ lat: loc.lat(), lng: loc.lng() });
    } catch {}
    setIsSearching(false);
  }

  function clearFilters() {
    setSearchLocation("");
    setSearchCoords(null);
    setSearchRadius("2 km");
    setActiveFilter("Todos");
    setActiveTab("daycare");
    setSelectedDate(null);
    setSelectedRange({ start: null, end: null });
    setAvailablePawwerIds(null);
    setSelectedPawwerId(null);
    setPetsCount(1);
  }

  function handleMarkerClick(id: string) {
    setSelectedPawwerId(id);
    const card = cardsContainerRef.current?.querySelector(`[data-pawwer-id="${id}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function handleSignOut() {
    setUserMenuOpen(false);
    // Cierre a prueba de balas (3 capas):
    // 1) signOut local → limpia la sesión EN MEMORIA del cliente-navegador.
    try { await createClient().auth.signOut({ scope: "local" }); } catch { /* no-op */ }
    // 2) purga server-side → borra explícitamente TODAS las cookies sb-* (incl.
    //    chunks .0/.1), aunque signOut haya fallado por sesión corrupta.
    try { await purgeSesionCliente(); } catch { /* no-op */ }
    // 3) recarga dura → estado 100% limpio (server + navegador releen sin sesión).
    window.location.assign("/");
  }

  function toggleFavorite(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleDateClick(date: number) {
    const today = startOfDay(new Date());
    const clicked = new Date(calendarDate.year, calendarDate.month, date);
    if (clicked < today) return;

    if (activeTab !== "travel") {
      setSelectedDate(clicked);
      setActiveSearchPanel("who");
    } else {
      if (!selectedRange.start || selectedRange.end) {
        setSelectedRange({ start: clicked, end: null });
      } else if (clicked > selectedRange.start) {
        setSelectedRange((p) => ({ ...p, end: clicked }));
        setActiveSearchPanel("who");
      } else {
        setSelectedRange({ start: clicked, end: null });
      }
    }
  }

  function prevMonth() {
    const now = new Date();
    if (calendarDate.year === now.getFullYear() && calendarDate.month === now.getMonth()) return;
    setCalendarDate((p) =>
      p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }
    );
  }

  function nextMonth() {
    setCalendarDate((p) =>
      p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }
    );
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const hasActiveFilters = !!(searchLocation || activeFilter !== "Todos" || selectedDate || selectedRange.start);

  function displayDistance(p: Pawwer): string {
    if (!searchCoords) return p.distance;
    const km = haversineKm(searchCoords, { lat: p.lat, lng: p.lng });
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }

  const serviceFiltered = pawwers
    .filter((p) => activeFilter === "Todos" || p.services.includes(SERVICE_MAP[activeFilter] ?? activeFilter))
    .filter((p) => availablePawwerIds === null || availablePawwerIds.has(p.id));

  // Auto-expand: if search returns 0 results at selected radius, try 3km, then show all — never empty screen
  const distanceFiltered = (() => {
    if (!searchCoords) return serviceFiltered;
    const atRadius = serviceFiltered.filter(
      (p) => haversineKm(searchCoords, { lat: p.lat, lng: p.lng }) <= RADIUS_METERS[searchRadius] / 1000
    );
    if (atRadius.length > 0) return atRadius;
    const at3km = serviceFiltered.filter(
      (p) => haversineKm(searchCoords, { lat: p.lat, lng: p.lng }) <= 3
    );
    return at3km.length > 0 ? at3km : serviceFiltered;
  })();

  // Ordenamiento por calidad: Ranger > Súper > Nuevo, luego mejor rating.
  const filteredPawwers = [...distanceFiltered].sort(
    (a, b) => levelRank(b.level) - levelRank(a.level) || b.rating - a.rating,
  );

  const selectedPawwer = selectedPawwerId != null
    ? filteredPawwers.find((p) => p.id === selectedPawwerId) ?? null
    : null;

  // Jittered coords for map display — real coords kept for distance filtering
  const mapPawwers = filteredPawwers.map((p) => ({
    ...p,
    ...jitterCoords(p.id, p.lat, p.lng),
  }));

  const fechasLabel = (() => {
    if (activeTab === "travel") {
      if (selectedRange.start && selectedRange.end)
        return `${formatDate(selectedRange.start)} – ${formatDate(selectedRange.end)}`;
      if (selectedRange.start) return `${formatDate(selectedRange.start)} → ...`;
      return "Rango de fechas";
    }
    return selectedDate ? formatDate(selectedDate) : "Elige un día";
  })();

  const datesFilled = activeTab === "travel"
    ? !!(selectedRange.start && selectedRange.end)
    : !!selectedDate;

  // ── Calendar (shared between desktop dropdown and mobile sheet) ───────────
  function CalendarContent() {
    const today = startOfDay(new Date());
    const { year, month } = calendarDate;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const isTravel = activeTab === "travel";

    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <span className="font-bold text-[#120A2B]">{MESES[month]} {year}</span>
          <div className="flex gap-1">
            <button
              onClick={prevMonth}
              disabled={calendarDate.year === new Date().getFullYear() && calendarDate.month === new Date().getMonth()}
              className="w-10 h-10 flex items-center justify-center rounded-full text-xl font-bold disabled:text-gray-300 disabled:cursor-not-allowed hover:bg-gray-100 text-[#120A2B]"
            >‹</button>
            <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full text-[#120A2B] text-xl font-bold">›</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {DIAS_SEMANA.map((d) => <div key={d} className="text-xs text-gray-400 font-medium">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((date) => {
            const d = new Date(year, month, date);
            const isPast = d < today;
            const isSel = isTravel
              ? selectedRange.start?.getTime() === d.getTime() || selectedRange.end?.getTime() === d.getTime()
              : selectedDate?.getTime() === d.getTime();
            const inRange =
              isTravel && selectedRange.start && selectedRange.end &&
              d > selectedRange.start && d < selectedRange.end;

            return (
              <button
                key={date}
                onClick={() => handleDateClick(date)}
                disabled={isPast}
                className={`w-9 h-9 text-sm font-medium flex items-center justify-center mx-auto transition-colors
                  ${isPast ? "text-gray-300 cursor-not-allowed rounded-full" :
                    isSel ? "bg-[#FF7031] text-white shadow-md rounded-full" :
                    inRange ? "bg-[#FFF1EB] text-[#FF7031]" :
                    "hover:bg-gray-100 text-[#120A2B] cursor-pointer rounded-full"}`}
              >
                {date}
              </button>
            );
          })}
        </div>
        {isTravel && (
          <p className="text-xs text-center text-gray-500 mt-4">
            {!selectedRange.start ? "Toca la fecha de entrada"
              : !selectedRange.end ? "Ahora toca la fecha de salida"
              : "✓ Rango seleccionado"}
          </p>
        )}
      </div>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
    <div className="min-h-screen bg-[#FFF1EB] font-sans text-[#120A2B] relative flex flex-col">

      {/* Background blobs — contained so they never cause horizontal overflow */}
      <div aria-hidden className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[100px] opacity-40 blob-1" />
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-[#FF7031] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 blob-2" />
        <div className="absolute bottom-[10%] left-[30%] w-[350px] h-[350px] bg-[#92C0E9] rounded-full mix-blend-multiply filter blur-[110px] opacity-25 blob-1" />
      </div>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="relative z-50 bg-white w-full border-b border-gray-200 shadow-sm sticky top-0">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-4 pb-4 flex justify-between items-center">
          <Link href="/" className="flex items-center w-1/3">
            <img src="/LogoPawwiCompleteOrange.svg" alt="Pawwi" className="h-7 w-auto" />
          </Link>

          <div className="hidden md:flex items-center gap-6 w-1/3 justify-center">
            {["Daycare","Nightcare","Travel"].map((id) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                  activeTab === id.toLowerCase()
                    ? "border-[#120A2B] text-[#120A2B] font-bold"
                    : "border-transparent text-[#6B7280] hover:text-[#120A2B] hover:border-gray-300"
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-1/3 justify-end">
            <Link href="/pawwer/unirse" className="hidden md:block text-sm font-bold text-[#120A2B] hover:bg-gray-50 px-4 py-2 rounded-full transition-colors whitespace-nowrap">
              Conviértete en Pawwer
            </Link>
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 bg-white px-3 py-2 rounded-full shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <Menu size={18} className="text-gray-500 ml-1" />
                  <div className="bg-[#FF7031] text-white p-1.5 rounded-full">
                    <User size={16} />
                  </div>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
                    <Link href="/reservas" className="block px-4 py-2.5 text-sm font-medium text-[#120A2B] hover:bg-gray-50">Mis reservas</Link>
                    <Link href="/mascotas" className="block px-4 py-2.5 text-sm font-medium text-[#120A2B] hover:bg-gray-50">Mis mascotas</Link>
                    <div className="my-1 h-px bg-gray-100" />
                    <button onClick={handleSignOut} className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50">
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/?modal=login" className="text-sm font-bold text-[#120A2B] hover:bg-gray-50 px-4 py-2 rounded-full transition-colors">
                  Ingresar
                </Link>
                <Link href="/?modal=registro" className="text-sm font-bold text-white bg-[#FF7031] hover:bg-[#e6652c] px-4 py-2 rounded-full transition-colors">
                  Registrarme
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Search pill */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pb-6 flex justify-center" ref={searchRef}>
          {/* Desktop */}
          <div className={`hidden md:flex items-center bg-white border rounded-full transition-[box-shadow,border-color] duration-200 w-full max-w-4xl h-16 relative
            ${activeSearchPanel ? "shadow-xl border-gray-300" : "shadow-md border-gray-200 hover:shadow-lg"}`}>

            {/* WHERE */}
            <div className="flex-1 h-full relative">
              <button
                onClick={() => setActiveSearchPanel(activeSearchPanel === "where" ? null : "where")}
                className={`w-full h-full flex flex-col justify-center px-8 rounded-full transition-colors text-left
                  ${activeSearchPanel === "where" ? "bg-white shadow-lg relative z-10" : "hover:bg-gray-100 group"}`}
              >
                <span className="text-xs font-bold text-[#120A2B]">Dónde</span>
                <span className={`text-sm truncate ${searchLocation ? "text-[#120A2B] font-medium" : "text-gray-500 group-hover:text-gray-800"}`}>
                  {searchLocation || "Explora tu barrio"}
                </span>
              </button>
              {activeSearchPanel === "where" && (
                <div className="absolute top-full mt-4 left-0 w-[400px] bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 z-50">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Dirección</label>
                  <AddressAutocomplete
                    value={searchLocation}
                    onChange={setSearchLocation}
                    onSelect={(coords, label) => { setSearchCoords(coords); setSearchLocation(label); }}
                    autoFocus
                  />
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-4 mb-2 block">Radio de búsqueda</label>
                  <div className="flex flex-wrap gap-2">
                    {["1 km", "2 km", "5 km", "10 km"].map((rad) => (
                      <button key={rad} onClick={() => { setSearchRadius(rad); setActiveSearchPanel("when"); }}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors
                          ${searchRadius === rad ? "bg-[#FFF1EB] border-[#FF7031] text-[#FF7031]" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                        {rad}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-gray-300" />

            {/* WHEN */}
            <div className="flex-1 h-full relative">
              <button
                onClick={() => setActiveSearchPanel(activeSearchPanel === "when" ? null : "when")}
                className={`w-full h-full flex flex-col justify-center px-8 rounded-full transition-colors text-left
                  ${activeSearchPanel === "when" ? "bg-white shadow-lg relative z-10" : "hover:bg-gray-100 group"}`}
              >
                <span className="text-xs font-bold text-[#120A2B]">Fechas</span>
                <span className={`text-sm truncate ${datesFilled ? "text-[#120A2B] font-medium" : "text-gray-500 group-hover:text-gray-800"}`}>
                  {fechasLabel}
                </span>
              </button>
              {activeSearchPanel === "when" && (
                <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-[360px] bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 z-50">
                  <CalendarContent />
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-gray-300" />

            {/* WHO */}
            <div className="flex-[1.2] h-full relative">
              <button
                onClick={() => setActiveSearchPanel(activeSearchPanel === "who" ? null : "who")}
                className={`w-full h-full flex flex-col justify-center pl-8 pr-24 rounded-full transition-colors text-left
                  ${activeSearchPanel === "who" ? "bg-white shadow-lg relative z-10" : "hover:bg-gray-100 group"}`}
              >
                <span className="text-xs font-bold text-[#120A2B]">Mascota</span>
                <span className="text-sm text-[#120A2B] font-medium">
                  {petsCount} {petsCount === 1 ? "peludo" : "peludos"}
                </span>
              </button>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#FF7031] rounded-full flex items-center justify-center text-white hover:bg-[#e6652c] transition-[background-color,transform] duration-150 active:scale-[0.96] shadow-md z-20 disabled:opacity-70"
              >
                {isSearching
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Search size={20} strokeWidth={3} />}
              </button>
              {activeSearchPanel === "who" && (
                <div className="absolute top-full mt-4 right-0 w-[300px] bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 z-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[#120A2B]">Mascotas</h4>
                      <p className="text-xs text-gray-500">¿Cuántos peludos van?</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setPetsCount(Math.max(1, petsCount - 1))}
                        className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors
                          ${petsCount <= 1 ? "border-gray-200 text-gray-300 cursor-not-allowed" : "border-gray-400 text-gray-600 hover:border-[#120A2B]"}`}>
                        <Minus size={14} />
                      </button>
                      <span className="w-5 text-center font-bold text-[#120A2B] tabular-nums">{petsCount}</span>
                      <button onClick={() => setPetsCount(petsCount + 1)}
                        className="w-10 h-10 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center hover:border-[#120A2B] transition-colors">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile pill */}
          <div
            className={`md:hidden flex items-center rounded-full shadow-md px-4 py-3 gap-3 cursor-pointer transition-colors
              ${hasActiveFilters ? "bg-white border-2 border-[#FF7031]" : "bg-white border border-gray-200"}`}
            onClick={() => setMobileSearchOpen(true)}
          >
            <Search size={20} className="text-[#FF7031] shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-bold text-[#120A2B] truncate">
                {searchLocation || "¿Dónde necesitas cuidador?"}
              </span>
              <span className="text-xs text-gray-500 truncate">
                {datesFilled ? fechasLabel : activeFilter !== "Todos" ? activeFilter : searchRadius} · {petsCount} {petsCount === 1 ? "peludo" : "peludos"}
              </span>
            </div>
            {hasActiveFilters && (
              <button
                onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                className="shrink-0 w-7 h-7 bg-[#FF7031] rounded-full flex items-center justify-center text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Desktop overlay */}
      {activeSearchPanel && (
        <div className="fixed inset-0 bg-black/10 z-40 hidden md:block" onClick={() => setActiveSearchPanel(null)} />
      )}

      {/* ── MOBILE BOTTOM SHEET ────────────────────────────────────────────── */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[60] md:hidden flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSearchOpen(false)} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-4 pb-10 flex flex-col max-h-[92vh] overflow-y-auto">
            <div className="relative flex items-center justify-center mb-5">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
              <button onClick={() => setMobileSearchOpen(false)} className="absolute right-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} className="text-gray-600" />
              </button>
            </div>

            <div className="flex gap-2 mb-5">
              {["Daycare","Nightcare","Travel"].map((id) => (
                <button key={id} onClick={() => handleTabChange(id)}
                  className={`flex-1 py-2 rounded-full text-sm font-bold transition-colors
                    ${activeTab === id.toLowerCase() ? "bg-[#120A2B] text-white" : "bg-gray-100 text-[#6B7280]"}`}>
                  {id}
                </button>
              ))}
            </div>

            {/* Dónde */}
            <button onClick={() => setMobileSection(mobileSection === "where" ? "" : "where")}
              className="w-full flex items-center justify-between py-4 border-b border-gray-100">
              <div className="text-left">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Dónde</p>
                <p className="text-sm font-semibold text-[#120A2B]">{searchLocation || "Explora tu barrio"}</p>
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${mobileSection === "where" ? "rotate-180" : ""}`} />
            </button>
            {mobileSection === "where" && (
              <div className="py-4 flex flex-col gap-3">
                <AddressAutocomplete
                  value={searchLocation}
                  onChange={setSearchLocation}
                  onSelect={(coords, label) => { setSearchCoords(coords); setSearchLocation(label); }}
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  {["1 km", "2 km", "5 km", "10 km"].map((rad) => (
                    <button key={rad} onClick={() => setSearchRadius(rad)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors
                        ${searchRadius === rad ? "bg-[#FFF1EB] border-[#FF7031] text-[#FF7031]" : "border-gray-200 text-gray-600"}`}>
                      {rad}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fechas */}
            <button onClick={() => setMobileSection(mobileSection === "when" ? "" : "when")}
              className="w-full flex items-center justify-between py-4 border-b border-gray-100">
              <div className="text-left">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Fechas</p>
                <p className={`text-sm font-semibold ${datesFilled ? "text-[#FF7031]" : "text-[#120A2B]"}`}>{fechasLabel}</p>
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${mobileSection === "when" ? "rotate-180" : ""}`} />
            </button>
            {mobileSection === "when" && <div className="py-4"><CalendarContent /></div>}

            {/* Mascota */}
            <button onClick={() => setMobileSection(mobileSection === "who" ? "" : "who")}
              className="w-full flex items-center justify-between py-4 border-b border-gray-100">
              <div className="text-left">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Mascota</p>
                <p className="text-sm font-semibold text-[#120A2B]">{petsCount} {petsCount === 1 ? "peludo" : "peludos"}</p>
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${mobileSection === "who" ? "rotate-180" : ""}`} />
            </button>
            {mobileSection === "who" && (
              <div className="py-5 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#120A2B]">Mascotas</h4>
                  <p className="text-xs text-gray-500">¿Cuántos peludos van?</p>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => setPetsCount(Math.max(1, petsCount - 1))}
                    className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors
                      ${petsCount <= 1 ? "border-gray-200 text-gray-300 cursor-not-allowed" : "border-gray-400 text-gray-600 hover:border-[#120A2B]"}`}>
                    <Minus size={16} />
                  </button>
                  <span className="text-lg font-bold text-[#120A2B] w-5 text-center tabular-nums">{petsCount}</span>
                  <button onClick={() => setPetsCount(petsCount + 1)}
                    className="w-10 h-10 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center hover:border-[#120A2B] transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            )}

            <button onClick={handleSearch} disabled={isSearching}
              className="mt-6 w-full bg-[#FF7031] hover:bg-[#e6652c] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.96] disabled:opacity-70">
              {isSearching
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Search size={20} strokeWidth={3} /> Buscar</>}
            </button>
          </div>
        </div>
      )}

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 py-10 lg:py-14">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

          {/* Text column */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left">
            <span className="hero-item [animation-delay:0ms] inline-flex items-center gap-1.5 bg-white border border-[#FF7031]/20 text-[#FF7031] text-xs font-bold px-4 py-2 rounded-full shadow-sm mb-5">
              📍 Cuidadores verificados en tu barrio
            </span>
            <h1 className="hero-item [animation-delay:80ms] text-4xl lg:text-5xl font-extrabold tracking-tight text-[#120A2B] mb-4 max-w-lg text-balance">
              Cuidamos a tu perro en{" "}
              <span className="text-[#FF7031]">hogares de familia</span>, no en jaulas.
            </h1>
            <p className="hero-item [animation-delay:160ms] text-base lg:text-lg text-[#6B7280] font-medium max-w-md mb-7 text-pretty">
              La primera red de cuidadores verificados en tu mismo barrio. Atención personalizada, cero jaulas y póliza PawwiProtect™ incluida.
            </p>
            <div className="hero-item [animation-delay:240ms] flex flex-wrap gap-3 justify-center lg:justify-start">
              {[
                { icon: <Star size={16} className="text-yellow-500 fill-yellow-500" />, bg: "bg-yellow-50",      stat: "4.9 / 5",       label: "+500 reseñas Google" },
                { icon: <MapPin size={16} className="text-[#120A2B]" />,               bg: "bg-[#92C0E9]",      stat: "15 Pawwers",     label: "Verificados" },
                { icon: <ShieldCheck size={16} className="text-[#120A2B]" />,          bg: "bg-[#F7AEF1]",      stat: "PawwiProtect™",  label: "En toda reserva" },
              ].map(({ icon, bg, stat, label }) => (
                <div key={label} className="flex items-center gap-2.5 bg-white/80 px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
                    {icon}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-extrabold text-[#120A2B] leading-tight">{stat}</p>
                    <p className="text-[10px] text-gray-400 font-medium">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero image with 3D tilt */}
          <div className="hero-item [animation-delay:200ms] flex-1 relative h-[320px] lg:h-[460px] w-full max-w-sm mx-auto lg:max-w-none">
            <HeroImage />
          </div>
        </div>
      </main>

      {/* ── ESTO ES PAWWI — Photo marquee ──────────────────────────────────── */}
      {(() => {
        const row1 = [
          { src: "/carousel/02650da6-4f11-4008-8e0b-f28876619d50.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/04284acc-d07b-45d4-9f54-164d9c340321.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/0c57d4f1-a18a-495c-9b92-892e9de04c45.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/0daedfad-0ce4-4086-9e3f-a13959e181f0.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/12c58930-3ee4-49f0-8665-32168c639cb5.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/19686d24-a3b7-4a6b-a87d-d752bdf44a47.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/25888dfa-fd61-4dd8-98c9-78de8c7a22f5.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/2ffa9a61-c209-4426-8860-af7d15e19253.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/61b68ff9-fcc5-4c65-a33d-ee503a5dd8fb.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/79654533-4e79-4da9-98f4-52ddbe830c43.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/81efc07d-0fed-4946-852b-1c8386975504.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/8847ab90-af2f-483c-9f1f-d134ce37e211.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/895cf90e-34d8-4ce5-8f48-dbb305f2c4dd.webp", alt: "Perrito en hogar Pawwi" },
        ];
        const row2 = [
          { src: "/carousel/907922cf-ae1c-4cb7-a168-e81118a57add.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/9e1545b6-210a-446e-b65b-5a6d879ae7ae.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/DSC00097.webp",  alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/DSC00099.webp",  alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/IMG_0723.webp",  alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/IMG_2934.webp",  alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/IMG_4685.webp",  alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/b17eb622-2818-4765-bcf0-cc1103d3c777.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/b632edc8-6e40-433a-b194-6ed4cad24e89.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/d90e5daf-9cd4-4808-81b5-b45b4c2ba8c8.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/dc76e28a-fb9f-48a5-9d9c-f8e4004ea7f7.webp", alt: "Perrito en hogar Pawwi" },
          { src: "/carousel/fa1868ef-211a-4a8d-9671-1b0a297a8fd3.webp", alt: "Perrito en hogar Pawwi" },
        ];

        return (
          <section className="relative z-10 pt-2 pb-10 lg:pb-14">
            <style>{`
              @keyframes pawwi-scroll {
                from { transform: translateX(0); }
                to   { transform: translateX(-50%); }
              }
            `}</style>

            {/* Heading */}
            <div className="max-w-7xl mx-auto px-6 lg:px-12 mb-8 text-center">
              <p className="text-xs font-extrabold text-[#92C0E9] tracking-[0.2em] uppercase mb-3">Esto es Pawwi</p>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-[#120A2B] text-balance">
                Hogares reales.{" "}
                <span className="text-[#FF7031]">Perritos felices.</span>
              </h2>
              <p className="text-sm text-gray-500 font-medium mt-2">Sin jaulas. Sin estrés. Solo amor y fotos diarias.</p>
            </div>

            {/* Row 1 — scrolls left */}
            <div style={{ overflow: "hidden", marginBottom: "12px" }}>
              <div style={{
                display: "flex",
                gap: "12px",
                width: "max-content",
                animationName: "pawwi-scroll",
                animationDuration: "45s",
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDirection: "normal",
              }}>
                {[...row1, ...row1].map(({ src, alt }, i) => (
                  <div
                    key={i}
                    style={{ flexShrink: 0, borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 12px rgba(18,10,43,0.08)" }}
                    className={i % 3 === 0 ? "w-48 h-60" : i % 3 === 1 ? "w-56 h-52" : "w-44 h-64"}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={alt} className="w-full h-full object-cover" draggable={false} />
                  </div>
                ))}
              </div>
            </div>

            {/* Row 2 — scrolls right */}
            <div style={{ overflow: "hidden" }}>
              <div style={{
                display: "flex",
                gap: "12px",
                width: "max-content",
                animationName: "pawwi-scroll",
                animationDuration: "38s",
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDirection: "reverse",
              }}>
                {[...row2, ...row2].map(({ src, alt }, i) => (
                  <div
                    key={i}
                    style={{ flexShrink: 0, borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 12px rgba(18,10,43,0.08)" }}
                    className={i % 3 === 0 ? "w-52 h-56" : i % 3 === 1 ? "w-44 h-64" : "w-56 h-52"}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={alt} className="w-full h-full object-cover" draggable={false} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── PAWWERS SECTION ────────────────────────────────────────────────── */}
      <section className="relative z-10 bg-white rounded-t-[40px] lg:rounded-t-[60px] w-full shadow-[0_-20px_40px_rgba(18,10,43,0.05)]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">

          {/* Section header */}
          <div ref={pawwersSectionRef} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-12 pb-8">
            <div>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-[#120A2B] mb-2 text-balance">
                Hogares en <span className="text-[#FF7031]">{searchLocation || "Bogotá"}</span> disponibles
              </h2>
              <p className="text-[#6B7280] font-medium text-pretty">
                {filteredPawwers.length} {filteredPawwers.length === 1 ? "hogar verificado" : "hogares verificados"}
                {searchCoords ? ` a menos de ${searchRadius}` : " en Bogotá"}.
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 shrink-0 items-center">
              {["Todos","Daycare","Nightcare","Travel"].map((id) => (
                <button key={id}
                  onClick={() => { setActiveFilter(id); if (id !== "Todos") handleTabChange(id); }}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-[background-color,color] duration-150 whitespace-nowrap active:scale-[0.96] ${
                    activeFilter === id
                      ? (FILTER_ACTIVE[id] ?? "bg-[#120A2B] text-white")
                      : "bg-gray-100 text-[#6B7280] hover:bg-gray-200"
                  }`}>
                  {id}
                </button>
              ))}
              {hasActiveFilters && (
                <button onClick={clearFilters}
                  className="px-4 py-2 rounded-full text-sm font-bold border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors whitespace-nowrap flex items-center gap-1.5">
                  <X size={13} /> Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Split layout: cards scroll internally | map fixed */}
          <div className="flex flex-col lg:flex-row gap-6 pb-24 lg:pb-6 lg:h-[86vh]">

            {/* Cards column — hidden on mobile when map is open */}
            <div ref={cardsContainerRef} className={`w-full lg:w-[62%] lg:h-full lg:overflow-y-auto ${mobileMapOpen ? "hidden lg:block" : "block"}`}>
            <div className={`grid gap-4 items-start pb-4
              ${filteredPawwers.length === 1
                ? "grid-cols-1 max-w-sm"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}
            >
              {filteredPawwers.length === 0 ? (
                <div className="col-span-3 flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-4xl mb-3">🐾</p>
                  <p className="font-bold text-[#120A2B] mb-1">Sin resultados</p>
                  <p className="text-sm text-gray-500">
                    {availablePawwerIds !== null
                      ? `Ningún Pawwer disponible para ${fechasLabel}. Prueba otra fecha.`
                      : searchCoords
                      ? `Ningún Pawwer a menos de ${searchRadius}. Intenta ampliar el radio o cambiar la dirección.`
                      : "No hay Pawwers con ese servicio. Prueba otro filtro."}
                  </p>
                  {(searchCoords || availablePawwerIds !== null) && (
                    <button onClick={clearFilters} className="mt-4 text-sm font-bold text-[#FF7031] underline underline-offset-2">
                      Ver todos en Bogotá
                    </button>
                  )}
                </div>
              ) : filteredPawwers.map((pawwer) => (
                <Link
                  key={pawwer.id}
                  data-pawwer-id={pawwer.id}
                  href={`/pawwer/${pawwer.id}`}
                  className={`bg-white rounded-[28px] p-3 shadow-[0_10px_30px_-5px_rgba(18,10,43,0.08)] hover:shadow-[0_20px_40px_-10px_rgba(18,10,43,0.15)] transition-[box-shadow,transform] duration-200 active:scale-[0.98] group flex flex-col border self-start
                    ${selectedPawwerId === pawwer.id ? "border-[#FF7031] ring-2 ring-[#FF7031]/30" : "border-gray-100 hover:border-gray-200"}`}
                >
                  <div className="relative h-44 w-full rounded-2xl overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pawwer.image} alt="Hogar" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 outline outline-1 -outline-offset-1 outline-black/10" />
                    {(() => {
                      const m = LEVEL_META[pawwer.level];
                      const LvlIcon = m.icon;
                      return (
                        <div className={`absolute top-3 left-3 text-[0.7rem] font-extrabold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1 ${m.chip}`}>
                          <LvlIcon size={14} /> {m.label}
                        </div>
                      );
                    })()}
                    <button onClick={(e) => toggleFavorite(pawwer.id, e)}
                      className={`absolute top-3 right-3 w-10 h-10 backdrop-blur-md rounded-full flex items-center justify-center transition-colors
                        ${favorites.has(pawwer.id) ? "bg-white text-[#FF7031]" : "bg-white/30 text-white hover:bg-white hover:text-[#FF7031]"}`}>
                      <Heart size={16} className={favorites.has(pawwer.id) ? "fill-current" : ""} />
                    </button>
                    <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-xl text-sm font-extrabold flex items-center gap-1 text-[#120A2B] shadow-sm">
                      <Star size={13} className="text-yellow-500 fill-current" /> {pawwer.rating}
                    </div>
                  </div>

                  <div className="p-3 pt-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pawwer.avatar} alt={pawwer.name} className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover -mt-8 relative z-10 bg-white shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-bold text-[#120A2B] leading-tight truncate">{pawwer.name}</h4>
                        <p className="text-xs font-medium text-[#6B7280] flex items-center gap-1">
                          <MapPin size={11} className="text-[#FF7031] shrink-0" />
                          <span className="truncate">{pawwer.location} · A {displayDistance(pawwer)}</span>
                        </p>
                      </div>
                      <div className="bg-[#FFF1EB] px-3 py-1.5 rounded-xl shrink-0">
                        <p className="text-sm font-extrabold text-[#120A2B]">{pawwer.price}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {pawwer.services.map((srv) => (
                        <span key={srv} className={`text-[0.65rem] font-bold px-2 py-1 rounded-md border uppercase tracking-wide ${SERVICE_BADGE[srv] ?? "bg-gray-50 text-gray-600 border-gray-100"}`}>
                          {srv}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            </div>

            {/* Map column — always visible on desktop, toggle on mobile */}
            <div className={`lg:w-[38%] lg:h-full ${mobileMapOpen ? "block h-[70vh]" : "hidden lg:block"}`}>
              <div className="h-full rounded-[32px] overflow-hidden border border-gray-200 shadow-lg">
                <MapView
                  pawwers={mapPawwers}
                  searchCenter={searchCoords}
                  radiusMeters={RADIUS_METERS[searchRadius]}
                  selectedId={selectedPawwerId}
                  onMarkerClick={handleMarkerClick}
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MOBILE PAWWER PREVIEW CARD ────────────────────────────────────── */}
      {mobileMapOpen && selectedPawwer && (
        <div className="lg:hidden fixed bottom-[88px] left-4 right-4 z-40 animate-slide-up">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="flex gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedPawwer.image} alt={selectedPawwer.name} className="w-28 h-24 rounded-2xl object-cover shrink-0" />
              <div className="flex-1 min-w-0 py-0.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-[#120A2B] leading-tight">{selectedPawwer.name}</h4>
                  <button onClick={() => setSelectedPawwerId(null)} className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin size={11} className="text-[#FF7031] shrink-0" />
                  <span className="truncate">{selectedPawwer.location}</span>
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Star size={12} className="text-yellow-500 fill-current" />
                  <span className="text-xs font-bold text-[#120A2B]">{selectedPawwer.rating}</span>
                  <span className="text-xs text-gray-400">({selectedPawwer.reviews} reseñas)</span>
                </div>
              </div>
            </div>
            <div className="px-3 pb-3 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400">desde </span>
                <span className="font-extrabold text-[#120A2B] text-base">{selectedPawwer.price}</span>
              </div>
              <Link href={`/pawwer/${selectedPawwer.id}`}
                className="bg-[#FF7031] hover:bg-[#e6652c] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
                Ver perfil →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE MAP TOGGLE ─────────────────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <button
          onClick={() => setMobileMapOpen(!mobileMapOpen)}
          className="pointer-events-auto flex items-center gap-2 bg-[#120A2B] text-white px-6 py-3.5 rounded-full shadow-2xl font-bold text-sm transition-transform active:scale-95"
        >
          {mobileMapOpen ? <><List size={16} /> Ver lista</> : <><MapIcon size={16} /> Ver mapa</>}
        </button>
      </div>

      {/* ── TRUST SECTION ─────────────────────────────────────────────────── */}
      <section className="bg-[#120A2B] text-white py-16 px-6 lg:px-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl lg:text-3xl font-extrabold text-center mb-12 text-balance">La tranquilidad de estar en familia</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { icon: <ShieldCheck size={32} />, color: "text-[#F7AEF1]", title: "100% Verificados",  body: "Cada Pawwer pasa por filtros de seguridad, entrevistas y revisión de su hogar." },
              { icon: <Star size={32} />,       color: "text-[#FF7031]", title: "Reseñas Reales",   body: "Solo usuarios que han completado reservas pueden dejar comentarios y calificaciones." },
              { icon: <Heart size={32} />,      color: "text-[#92C0E9]", title: "PawwiProtect™",    body: "Seguro veterinario y soporte 24/7 incluido en todas tus reservas sin costo adicional." },
            ].map(({ icon, color, title, body }) => (
              <div key={title} className="flex flex-col items-center">
                <div className={`w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 ${color}`}>{icon}</div>
                <h3 className="text-xl font-bold mb-2">{title}</h3>
                <p className="text-gray-400 text-sm max-w-xs">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="bg-white pt-12 pb-8 px-6 lg:px-12 border-t border-gray-100 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-8">

          {/* Pawwer CTA — prominente en mobile donde el nav lo oculta */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 bg-[#FFF1EB] rounded-2xl px-6 py-5">
            <p className="text-sm font-semibold text-[#4B5563] text-center sm:text-left">
              ¿Quieres ganar dinero cuidando perritos en tu hogar?
            </p>
            <Link
              href="/pawwer/unirse"
              className="shrink-0 inline-flex items-center gap-2 bg-[#120A2B] text-white text-sm font-extrabold px-5 py-2.5 rounded-full hover:bg-[#1e1145] transition-colors whitespace-nowrap"
            >
              Conviértete en Pawwer →
            </Link>
          </div>

          <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/LogoPawwiCompletoAzul.svg" alt="Pawwi" className="h-6 w-auto" />
            </div>
            <div className="flex gap-6 text-sm font-bold text-[#6B7280]">
              <Link href="/terminos" className="hover:text-[#120A2B]">Términos</Link>
              <Link href="/privacidad" className="hover:text-[#120A2B]">Privacidad</Link>
              <Link href="/soporte" className="hover:text-[#120A2B]">Soporte</Link>
            </div>
            <p className="text-xs text-gray-400 font-medium">© 2026 Pawwi SAS. Hecho con ❤️ en Bogotá.</p>
          </div>
        </div>
      </footer>

    </div>

    <Suspense fallback={null}>
      <AuthModal />
    </Suspense>
    </APIProvider>
  );
}