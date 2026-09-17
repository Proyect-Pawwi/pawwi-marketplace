import { createClient } from "@/lib/server";
import { getSesion } from "@/lib/session";
import { PAWWER_FIELDS, mapDbPawwer, type Pawwer } from "@/lib/pawwers";
import HomeClient from "./HomeClient";

/**
 * La home, resuelta en el servidor.
 *
 * Este archivo es nuevo; el componente de 1.200 líneas se movió a
 * `HomeClient.tsx` sin tocarle el cuerpo. Lo único que cambia es QUIÉN busca los
 * datos.
 *
 * Antes la home era un Client Component sin ninguna señal dinámica, así que Next
 * la prerenderizaba ESTÁTICA: el HTML de `/` salía congelado con el header de
 * deslogueado para todo el mundo, y el navegador tenía que corregirlo después
 * con tres consultas. En el móvil eso se veía como tres mentiras sucesivas antes
 * de que la pantalla se arreglara sola (reportado el 2026-09-17).
 *
 * Es el mismo patrón que ya usaba el portal del Pawwer —`inicio/page.tsx` →
 * `InicioClient.tsx`— y que la superficie del cliente nunca adoptó.
 */
export default async function HomePage() {
  const supabase = await createClient();

  // En paralelo: nada de esto depende de lo otro. En serie serían ~0,6 s.
  const [sesion, pawwersRes] = await Promise.all([
    getSesion(),
    supabase
      .from("pawwer")
      .select(PAWWER_FIELDS)
      .eq("verified", true)
      .eq("accepting_bookings", true)
      .is("deactivated_at", null)
      .not("lat", "is", null),
  ]);

  // Un fallo aquí NO puede quedarse mudo: la home vacía sin una sola pista fue
  // lo que escondió durante meses que `authenticated` no tenía permisos.
  if (pawwersRes.error) {
    console.error("[Pawwi] home · pawwers:", pawwersRes.error.message, pawwersRes.error.details);
  }
  const pawwers: Pawwer[] = (pawwersRes.data ?? []).map(mapDbPawwer);

  // Los favoritos solo se piden si hay quien los tenga. La RLS ya limita la
  // tabla a los del propio cliente, así que no hace falta filtrar por id.
  let favoritos: string[] = [];
  if (sesion.usuario) {
    const { data, error } = await supabase.from("favourite").select("pawwer_id");
    if (error) console.error("[Pawwi] home · favoritos:", error.message);
    favoritos = (data ?? []).map((f) => f.pawwer_id as string);
  }

  return (
    <HomeClient
      initialUsuario={sesion.usuario}
      initialPawwers={pawwers}
      initialFavoritos={favoritos}
    />
  );
}
