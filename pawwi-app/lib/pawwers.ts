import { asLevel, type Level } from "@/lib/levels";

/**
 * La forma de un Pawwer tal y como lo pinta el marketplace, y la única
 * traducción de fila-de-base a esa forma.
 *
 * Vive aquí y no en `app/page.tsx` porque desde hoy hay DOS pantallas que
 * muestran la misma tarjeta —la home y /mis-favoritos— y el `select` lleva
 * pistas de llave foránea escritas a mano (`!pawwer_profile_fk`,
 * `!fk_service_x_pawwer_service_type`). Copiar ese select a una segunda
 * pantalla es copiar cuatro nombres que, si alguien los toca en la base, hay
 * que acordarse de cambiar en dos sitios. Ya pasó: cuatro pistas inventadas
 * dieron PGRST200 y dejaron /mis-reservas en blanco.
 */

// ── El SELECT compartido ────────────────────────────────────────────────────
// Se usa tal cual sobre `pawwer`, y anidado como `pawwer ( … )` desde
// `favourite`. Los saltos de línea los limpia postgrest-js.
export const PAWWER_FIELDS = `
  id, price, rating, reviews_count, lat, lng, badge, level, neighborhood,
  transport_price, verified, accepting_bookings, deactivated_at,
  profile!pawwer_profile_fk ( name, avatar_url ),
  services:service_X_Pawwer ( price, service_type!fk_service_x_pawwer_service_type ( name ) ),
  images:Pawwer_images ( image )
`;

// ── El tipo ─────────────────────────────────────────────────────────────────
export interface Pawwer {
  id: string;
  name: string;
  price: string;            // ya formateado: "$60k"
  lat: number;
  lng: number;
  location: string;
  distance: string;
  transportPrice: number;   // 0 = no ofrece transporte
  rating: number;
  reviews: number;
  badge: string;
  level: Level;
  image: string;
  avatar: string;
  services: string[];
  /** false si se desactivó o perdió la verificación: sigue en favoritos, pero no se puede reservar. */
  disponible: boolean;
}

// ── Imágenes de relleno mientras los Pawwers no suben las suyas ─────────────
export const FALLBACK_HOMES = [
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
export const FALLBACK_AVATARS = [
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

// ── La traducción ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbPawwer(row: any, i: number): Pawwer {
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
    transportPrice: Number(row.transport_price ?? 0),
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
    // `verified` y `deactivated_at` pueden no venir en selects antiguos: sin el
    // dato se asume disponible, que es el estado normal.
    disponible: row.verified !== false && !row.deactivated_at,
  };
}

// ── Colores de los chips de servicio ────────────────────────────────────────
export const SERVICE_BADGE: Record<string, string> = {
  DayCare: "bg-[#FFF1EB] text-[#FF7031] border-[#FF7031]/20",
  Night:   "bg-[#120A2B]/8 text-[#120A2B] border-[#120A2B]/10",
  Travel:  "bg-[#92C0E9]/20 text-[#1a6fa8] border-[#92C0E9]/30",
  Express: "bg-[#F7AEF1]/40 text-[#7c3aed] border-[#F7AEF1]/60",
};
