"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/client";

// Estado de presencia de OTRO usuario, tal como lo ve quien mira su perfil/chat.
export type PresenceState = "online" | "away" | "offline" | "unknown";

const FRESH_MS = 75_000; // último latido con menos de 75s → sigue "conectado"
const REFETCH_MS = 30_000; // backstop por si realtime no entrega (p. ej. anon)
const TICK_MS = 15_000; // re-deriva staleness (verde→rojo) y refresca "hace X"

interface PresenceRow {
  status: string;
  last_seen_at: string;
}

/**
 * Observa la presencia de `userId`: carga inicial + realtime + re-fetch periódico,
 * y un tick local que hace envejecer el estado (verde→rojo) sin depender de eventos.
 * Devuelve "unknown" mientras carga o si el usuario nunca ha emitido presencia
 * (p. ej. un cliente antes de que exista su portal) → dot neutro, sin verde falso.
 */
export function usePresence(userId: string | null | undefined) {
  const [row, setRow] = useState<PresenceRow | null>(null);
  // `now` arranca en null y se llena tras montar → evita hydration mismatch.
  const [now, setNow] = useState<number | null>(null);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    if (!userId) return;
    const supabase = supabaseRef.current;
    let cancelled = false;

    const fetchRow = async () => {
      const { data } = await supabase
        .from("presence")
        .select("status, last_seen_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!cancelled) setRow((data as PresenceRow | null) ?? null);
    };

    fetchRow();
    // setNow diferido → no es un setState síncrono en el cuerpo del effect.
    const kickoff = setTimeout(() => setNow(Date.now()), 0);

    const channel = supabase
      .channel(`presence-view-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (!cancelled && payload.new) setRow(payload.new as PresenceRow);
        },
      )
      .subscribe();

    const refetch = setInterval(fetchRow, REFETCH_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);

    return () => {
      cancelled = true;
      clearTimeout(kickoff);
      supabase.removeChannel(channel);
      clearInterval(refetch);
      clearInterval(tick);
    };
  }, [userId]);

  let state: PresenceState = "unknown";
  if (now !== null && row !== null) {
    const age = now - new Date(row.last_seen_at).getTime();
    if (age > FRESH_MS) state = "offline";
    else state = row.status === "idle" ? "away" : "online";
  }

  return { state, lastSeenAt: row?.last_seen_at ?? null, now };
}

// ── Presentación ──────────────────────────────────────────────────────────────

const DOT_COLOR: Record<PresenceState, string> = {
  online: "bg-green-500",
  away: "bg-amber-400",
  offline: "bg-gray-300",
  unknown: "bg-gray-300",
};

/**
 * Punto de estado. `ring` = color del borde (según el fondo sobre el que va).
 * `size`/`position` se pasan por className para adaptarlo a cada avatar.
 */
export function PresenceDot({
  state,
  className = "w-3 h-3",
  ring = "border-white",
}: {
  state: PresenceState;
  className?: string;
  ring?: string;
}) {
  return (
    <span
      className={`rounded-full border-2 ${ring} ${DOT_COLOR[state]} ${
        state === "online" ? "animate-pulse" : ""
      } ${className}`}
    />
  );
}

/** "hace 3 min", "hace 2 h", "hace 4 d", "hace 1 sem". */
export function lastSeenAgo(lastSeenAt: string | null, now: number | null): string {
  if (!lastSeenAt || now === null) return "";
  const min = Math.floor((now - new Date(lastSeenAt).getTime()) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  const w = Math.floor(d / 7);
  return `hace ${w} sem`;
}

/** Texto de estado listo para mostrar. "" cuando es unknown (no mostrar nada). */
export function presenceLabel(
  state: PresenceState,
  lastSeenAt: string | null,
  now: number | null,
): string {
  switch (state) {
    case "online":
      return "Activo ahora";
    case "away":
      return "Ausente";
    case "offline":
      return lastSeenAt ? `Activo ${lastSeenAgo(lastSeenAt, now)}` : "Desconectado";
    default:
      return "";
  }
}
