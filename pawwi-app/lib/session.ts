import { cache } from "react";
import { createClient } from "@/lib/server";

/**
 * La sesión del cliente, resuelta UNA VEZ en el servidor.
 *
 * Por qué existe (2026-09-17): la superficie del cliente resolvía el usuario
 * DESPUÉS de pintar, y eso producía cuatro parpadeos distintos en el móvil —el
 * header decía «Ingresar» unos segundos, el nav inferior no existía, la home
 * afirmaba «No hay Pawwers» y el botón del mapa nacía justo donde iba a
 * aparecer el nav. No eran cuatro bugs: era este.
 *
 * El portal del Pawwer nunca lo tuvo porque su layout SÍ es `async` y resuelve
 * la sesión en el servidor (`app/pawwer/(portal)/layout.tsx`). Esto trae ese
 * mismo patrón al cliente.
 *
 * `cache()` de React deduplica dentro de un mismo render: el layout y la página
 * pueden llamarlo los dos y solo se paga una resolución.
 *
 * Devuelve una forma MÍNIMA a propósito. El objeto `User` de Supabase lleva
 * metadatos que el navegador no necesita, y todo lo que se devuelva aquí viaja
 * al cliente en el payload.
 */

export interface SesionCliente {
  usuario: { id: string; nombre: string | null } | null;
  /** Cualquier sesión que NO sea pawwer cuenta como cliente. */
  esCliente: boolean;
}

export const getSesion = cache(async (): Promise<SesionCliente> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { usuario: null, esCliente: false };

  const meta = user.user_metadata as { full_name?: unknown } | undefined;
  const desdeMeta = typeof meta?.full_name === "string" ? meta.full_name.trim() : "";

  const { data: profile, error } = await supabase
    .from("profile")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  // Un fallo aquí NO puede degradar en silencio a «no eres cliente»: dejaría al
  // cliente sin nav inferior sin una sola pista. Se registra y se asume cliente,
  // que es el caso mayoritario y el que menos daño hace si se equivoca.
  if (error) console.error("[Pawwi] getSesion · rol:", error.message);

  const nombre = (profile?.name ?? "").trim() || desdeMeta || null;

  // Mismo criterio que usaba `ClientNav` y que usa `app/actions/auth.ts`: se
  // compara contra 'pawwer' y no contra 'client' para cubrir las cuentas viejas
  // con `role` nulo o vacío (el default 'client' del trigger solo aplica a los
  // registros posteriores a la migración 27).
  return { usuario: { id: user.id, nombre }, esCliente: profile?.role !== "pawwer" };
});
