"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Star, CheckCircle2, Circle, X, ChevronRight, Info } from "lucide-react";
import {
  LEVEL_META,
  LEVEL_THRESHOLDS,
  NEXT_LEVEL,
  asLevel,
  type Level,
  type LevelDetail,
} from "@/lib/levels";

// Tarjeta "Tu Nivel" con REVELACIÓN PROGRESIVA: el pawwer solo ve su meta
// inmediata (nunca la final). Escaneable en "F". El detalle viene del RPC
// get_pawwer_level_detail() (mig 56).

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={16}
          className={
            i < full
              ? "text-amber-400 fill-amber-400"
              : i === full && half
                ? "text-amber-400 fill-amber-200"
                : "text-gray-200 fill-gray-200"
          }
        />
      ))}
    </div>
  );
}

function ChecklistRow({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {done ? (
        <CheckCircle2 size={17} className="text-green-500 shrink-0" />
      ) : (
        <Circle size={17} className="text-gray-300 shrink-0" />
      )}
      <span className={`text-sm ${done ? "font-bold text-[#120A2B]" : "font-medium text-[#120A2B]/60"}`}>
        {children}
      </span>
    </div>
  );
}

// Modal con la escalera completa de beneficios (se abre desde el CTA).
function BeneficiosModal({ current, onClose }: { current: Level; onClose: () => void }) {
  const rows: { level: Level; regla: string; beneficio: string }[] = [
    { level: "nuevo", regla: "Al empezar (hasta 5 reseñas)", beneficio: "Bienvenida. Los clientes ven que eres nuevo y te dan una oportunidad." },
    { level: "super", regla: "5+ reseñas · 4.5★ · cancelación ≤10%", beneficio: "Cuidador confiable. Visibilidad regular en las búsquedas." },
    { level: "ranger", regla: "15+ reseñas · 4.8★ · cancelación ≤2% · activo 30d", beneficio: "Comisión 20% (ganas más) + prioridad #1 en búsquedas." },
  ];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <div aria-hidden className="absolute inset-0 bg-[#120A2B]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[32px] w-full max-w-sm max-h-[85vh] flex flex-col shadow-[0_20px_60px_rgba(18,10,43,0.3)] animate-slide-up overflow-hidden">
        <div className="shrink-0 px-6 pt-6 pb-3 relative">
          <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <X size={15} />
          </button>
          <p className="text-base font-black text-[#120A2B]">Niveles Pawwi</p>
          <p className="text-xs text-[#120A2B]/50 mt-0.5">Sube de nivel para ganar más y aparecer primero.</p>
        </div>
        <div className="overflow-y-auto flex-1 px-5 pt-1 pb-6 space-y-3">
          {rows.map((r) => {
            const m = LEVEL_META[r.level];
            const Icon = m.icon;
            const isCurrent = r.level === current;
            return (
              <div key={r.level} className={`rounded-[22px] border p-4 ${isCurrent ? "border-[#FF7031]/40 bg-[#FFF1EB]/50" : "border-gray-100 bg-white"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${m.chip}`}>
                    <Icon size={12} /> {m.label}
                  </span>
                  {isCurrent && <span className="eyebrow text-[#FF7031]">Tu nivel</span>}
                </div>
                <p className="text-xs font-bold text-[#120A2B]/70">{r.regla}</p>
                <p className="text-xs text-[#120A2B]/50 mt-1 leading-relaxed">{r.beneficio}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function NivelCard({ detail }: { detail: LevelDetail }) {
  const [modalOpen, setModalOpen] = useState(false);

  const level = asLevel(detail.level);
  const meta = LEVEL_META[level];
  const LevelIcon = meta.icon;
  const next = NEXT_LEVEL[level];
  const rating = detail.rating;
  const reviews = detail.reviews_count;
  const cancelPct = Math.round(detail.cancel_rate * 100);

  // Meta hacia el siguiente nivel (o mantenimiento si ya es Ranger).
  const goal = next ? LEVEL_THRESHOLDS[next] : LEVEL_THRESHOLDS.ranger;
  const reviewsTarget = goal.reviews;
  const reviewsPct = Math.min(reviews / reviewsTarget, 1) * 100;
  const segments = next === "super"; // barra segmentada de 5 para Nuevo→Súper

  // Microtextos (revelación progresiva: solo la meta inmediata).
  let headerMicro = "";
  let goalMicro = "";
  if (level === "nuevo") {
    headerMicro = detail.is_grace_new
      ? "¡Estás a un paso de recibir a tu primer perrito!"
      : "Consigue tus primeras reseñas para destacar.";
    goalMicro = "Consigue 5 reseñas con buen promedio para destacar en búsquedas.";
  } else if (level === "super") {
    const faltan = Math.max(reviewsTarget - reviews, 0);
    headerMicro = "Cuidador confiable. Vas por buen camino.";
    goalMicro = faltan > 0
      ? `Estás a ${faltan} ${faltan === 1 ? "cuidado" : "cuidados"} de ganar más por cada servicio.`
      : "Mantén tu calidad para desbloquear la comisión del 20%.";
  } else {
    headerMicro = "¡Nivel máximo! Ganas más y apareces primero. 🎉";
    goalMicro = "Mantén tu actividad y calidad para conservar tus beneficios.";
  }

  const nextMeta = next ? LEVEL_META[next] : meta;
  const nextTitle = next
    ? `Próxima meta: ${nextMeta.label}${next === "ranger" ? " (Comisión 20%)" : ""}`
    : "Mantén tu nivel Ranger";

  return (
    <section className="space-y-3 enter enter-4">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tu Nivel</h2>
      <div className="bg-white rounded-[28px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.04)] space-y-5">

        {/* ── Cabecera: identidad + orgullo ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-gray-400">Nivel actual</p>
            <span className={`inline-flex items-center gap-1.5 mt-1.5 text-sm font-black px-3 py-1 rounded-full ${meta.chip}`}>
              <LevelIcon size={14} /> {meta.label}
            </span>
            <p className="text-xs text-[#120A2B]/55 mt-2 leading-relaxed">{headerMicro}</p>
          </div>
          <div className="text-right shrink-0">
            <Stars rating={rating} />
            <p className="text-lg font-black text-[#120A2B] mt-1 leading-none">
              {rating > 0 ? rating.toFixed(1) : "0.0"}
              <span className="text-xs font-bold text-gray-400"> / 5.0</span>
            </p>
          </div>
        </div>

        {/* ── Meta cercana ── */}
        <div>
          <p className={`text-[11px] font-black uppercase tracking-widest ${nextMeta.accent}`}>{nextTitle}</p>
          {/* Barra de progreso (segmentada hacia Súper, continua hacia Ranger) */}
          {segments ? (
            <div className="flex gap-1.5 mt-2">
              {Array.from({ length: reviewsTarget }).map((_, i) => (
                <div key={i} className={`h-2 flex-1 rounded-full ${i < reviews ? nextMeta.fill : "bg-gray-100"}`} />
              ))}
            </div>
          ) : (
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div className={`h-full rounded-full transition-all ${nextMeta.fill}`} style={{ width: `${next ? reviewsPct : 100}%` }} />
            </div>
          )}
          <p className="text-xs text-[#120A2B]/50 mt-2 leading-relaxed">{goalMicro}</p>
        </div>

        {/* ── Checklist accionable (solo lo relevante para la meta) ── */}
        <div className="space-y-2.5 bg-gray-50/70 rounded-2xl p-4">
          <ChecklistRow done={reviews >= reviewsTarget}>
            <span className="tabular-nums font-black">{reviews} / {reviewsTarget}</span>{" "}
            reseñas {next === "ranger" || level === "ranger" ? "excelentes" : "verificadas"}
          </ChecklistRow>
          <ChecklistRow done={rating >= goal.rating}>
            Promedio de {goal.rating.toFixed(1)} o superior
          </ChecklistRow>
          {(next === "ranger" || level === "ranger") && (
            <ChecklistRow done={detail.cancel_rate <= goal.cancel}>
              Cancelación baja (menor a {Math.round(goal.cancel * 100)}%){" "}
              <span className="text-[#120A2B]/35 font-medium">· vas {cancelPct}%</span>
            </ChecklistRow>
          )}
          {level === "ranger" && (
            <ChecklistRow done={detail.active_last_30d}>
              Activo en los últimos 30 días
            </ChecklistRow>
          )}
        </div>

        {/* ── CTA: modal de beneficios ── */}
        <button
          onClick={() => setModalOpen(true)}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold transition-colors ${
            level === "ranger"
              ? "bg-[#120A2B] text-white active:scale-[0.98]"
              : "bg-gray-100 text-[#120A2B] hover:bg-gray-200"
          }`}
        >
          <Info size={15} />
          {level === "ranger" ? "Ver cómo mantener mi nivel y beneficios" : "¿Cómo subir de nivel?"}
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Portal a <body>: el modal debe escapar del `transform` residual que deja
          la animación de entrada `.enter` en la <section> (si no, `position:fixed`
          se ancla a la tarjeta y el popup queda atrapado). */}
      {modalOpen &&
        createPortal(
          <BeneficiosModal current={level} onClose={() => setModalOpen(false)} />,
          document.body,
        )}
    </section>
  );
}
