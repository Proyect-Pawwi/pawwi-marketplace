"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/client";

// Estado LOCAL del usuario que tiene la webapp abierta:
//   "active" = pestaña visible y con foco   → punto verde
//   "idle"   = webapp abierta pero sin foco  → punto amarillo
// (el rojo/"offline" no es un estado local: se deriva en el que MIRA cuando dejan
//  de llegar latidos — ver usePresence).
export type LiveStatus = "active" | "idle";

const MyPresenceContext = createContext<LiveStatus>("active");
export const useMyPresence = () => useContext(MyPresenceContext);

// Cada cuánto reafirmamos presencia. usePresence considera "fresco" hasta 2.5×
// este intervalo (75s), así que 30s deja margen para un latido perdido.
const HEARTBEAT_MS = 30_000;

/**
 * Emite el latido de presencia mientras el usuario está en el portal. Se monta
 * una sola vez (en el layout) para que lata sin importar en qué pestaña esté.
 * Persiste vía RPC `heartbeat` (que también alimenta el log de métricas).
 */
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const supabaseRef = useRef(createClient());
  const [status, setStatus] = useState<LiveStatus>("active");

  useEffect(() => {
    const liveStatus = (): LiveStatus =>
      document.visibilityState === "visible" && document.hasFocus() ? "active" : "idle";

    // setState + RPC. Se invoca desde callbacks (timer/eventos) o diferido, nunca
    // de forma síncrona en el cuerpo del effect (evita renders en cascada).
    const beat = (s: LiveStatus) => {
      setStatus(s);
      // fire-and-forget: un latido perdido se recupera en el siguiente ciclo.
      supabaseRef.current.rpc("heartbeat", { p_status: s });
    };

    const kickoff = setTimeout(() => beat(liveStatus()), 0); // primer latido al entrar
    const interval = setInterval(() => beat(liveStatus()), HEARTBEAT_MS);

    const onVisibility = () => beat(liveStatus());
    const onFocus = () => beat("active");
    const onBlur = () => beat("idle");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    return () => {
      clearTimeout(kickoff);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return <MyPresenceContext.Provider value={status}>{children}</MyPresenceContext.Provider>;
}
