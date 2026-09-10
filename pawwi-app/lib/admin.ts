import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con `service_role`. **Salta toda la RLS** — solo para código que
 * corre en el servidor y que ya verificó por su cuenta a quién representa.
 *
 * Existe porque algunas RPC del embudo no pueden ser llamables por el usuario:
 * escriben su propio estado de verificación, así que si el usuario pudiera
 * invocarlas se auto-certificaría (ver `supabase/66_hotfix_seguridad_embudo.sql`).
 * La frontera pasa a ser «solo el servidor», y el servidor deriva la identidad
 * de la sesión, nunca del formulario.
 *
 * ⚠️ Bajo `service_role`, `auth.uid()` es NULL dentro de la base. Toda RPC que
 * se llame por aquí tiene que recibir el id explícito — y ese id debe venir de
 * `getUser()`, jamás de la petición.
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;   // sin fallback a anon

  if (!url || !key) {
    throw new Error(
      "[Pawwi] Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL. " +
      "Sin ellas no se puede completar la verificación del Pawwer.",
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}
