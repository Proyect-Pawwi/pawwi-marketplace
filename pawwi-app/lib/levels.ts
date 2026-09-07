import { ShieldCheck, Sparkles, Award } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Niveles de rendimiento del pawwer. Metadatos ÚNICOS para que el portal, el
// perfil público y el marketplace usen EXACTAMENTE los mismos colores (regla del
// spec). Los umbrales son espejo de compute_pawwer_level() en supabase/56_levels.sql.

export type Level = "nuevo" | "super" | "ranger";

export interface LevelMeta {
  label: string; // "Nuevo" | "Súper" | "Ranger"
  rank: number; // 1 < 2 < 3 (para ordenar)
  chip: string; // clases del chip (bg + text) según el spec
  icon: LucideIcon;
  accent: string; // color de texto para "próxima meta" / relleno de progreso
  fill: string; // clase bg del relleno de la barra de progreso
}

export const LEVEL_META: Record<Level, LevelMeta> = {
  nuevo: {
    label: "Nuevo",
    rank: 1,
    chip: "bg-blue-300 text-[#0a1f44]",
    icon: ShieldCheck,
    accent: "text-[#0284C7]",
    fill: "bg-blue-400",
  },
  super: {
    label: "Súper",
    rank: 2,
    chip: "bg-fuchsia-300 text-[#3b0764]",
    icon: Sparkles,
    accent: "text-fuchsia-600",
    fill: "bg-fuchsia-400",
  },
  ranger: {
    label: "Ranger",
    rank: 3,
    chip: "bg-[#FF7031] text-white",
    icon: Award,
    accent: "text-[#FF7031]",
    fill: "bg-[#FF7031]",
  },
};

export function asLevel(level: string | null | undefined): Level {
  return level === "ranger" || level === "super" ? level : "nuevo";
}

export function levelRank(level: string | null | undefined): number {
  return LEVEL_META[asLevel(level)].rank;
}

// Umbrales de cada nivel (espejo del backend). El siguiente nivel a alcanzar.
export const LEVEL_THRESHOLDS: Record<"super" | "ranger", { reviews: number; rating: number; cancel: number }> = {
  super: { reviews: 5, rating: 4.5, cancel: 0.1 },
  ranger: { reviews: 15, rating: 4.8, cancel: 0.02 },
};

export const NEXT_LEVEL: Record<Level, "super" | "ranger" | null> = {
  nuevo: "super",
  super: "ranger",
  ranger: null,
};

// Detalle que devuelve get_pawwer_level_detail() (mig 56) para la tarjeta.
export interface LevelDetail {
  level: Level;
  rating: number;
  reviews_count: number;
  cancel_rate: number;
  active_last_30d: boolean;
  is_grace_new: boolean;
}
