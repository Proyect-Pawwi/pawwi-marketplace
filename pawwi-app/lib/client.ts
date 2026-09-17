import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * El cliente de Supabase del navegador — UNO solo para toda la pestaña.
 *
 * Antes esta función construía un `createBrowserClient` NUEVO en cada llamada.
 * La home sola creaba cinco, más el del nav: seis instancias de GoTrue, cada una
 * con su propio candado de sesión y su propia suscripción de refresco, todas
 * sobre las mismas cookies.
 *
 * Además de ser trabajo tirado, multiplica por seis los titulares del candado
 * que provocó el abrazo mortal del 2026-09-15 —el que dejaba el marketplace
 * vacío al iniciar sesión—. Menos instancias, menos formas de repetirlo.
 *
 * El singleton es por módulo, así que vive lo que vive la pestaña. En el
 * servidor no se usa nunca: allí va `lib/server.ts`, que sí debe crear uno por
 * petición porque cada una trae sus propias cookies.
 */
let cliente: SupabaseClient | undefined;

export function createClient() {
  cliente ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return cliente;
}
