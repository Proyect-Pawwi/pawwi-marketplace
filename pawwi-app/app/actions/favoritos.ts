"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/server";

/**
 * Guardar y quitar favoritos.
 *
 * `client_id` sale SIEMPRE de `getUser()`, nunca de un parámetro. La RLS
 * (`favourite_owner`, migración 03) ya lo exigiría —y para INSERT Postgres usa
 * el `USING` como `WITH CHECK` cuando no hay uno propio—, así que mandar el id
 * de otro daría permiso denegado. Pero no se manda: la regla es que un id
 * restringido no viaja desde el navegador aunque haya un guardia detrás.
 *
 * La tabla tiene `uq_favourite UNIQUE (client_id, pawwer_id)`, de modo que dos
 * toques simultáneos no pueden dejar filas duplicadas: el segundo choca contra
 * el índice y se trata como éxito.
 */

/**
 * Ojo con esto: NO se usa `z.string().uuid()`.
 *
 * Zod 4 valida el dígito de VERSIÓN del UUID (solo acepta 1–8), y los diez
 * Pawwers del seed tienen ids fabricados a mano —`a1000000-0000-0000-0000-…`—
 * con un `0` ahí. Resultado: la validación rechazaba a 10 de los 11 Pawwers del
 * marketplace y guardar un favorito solo funcionaba con el único que nació de
 * `gen_random_uuid()`. Lo reportó Nicolás desde el móvil el 2026-09-17.
 *
 * Postgres NO mira la versión: su tipo `uuid` acepta cualquier valor de 128 bits
 * con ese formato. Una validación más estricta que la base de datos no protege
 * de nada y rechaza datos legítimos, así que aquí se comprueba exactamente la
 * forma que Postgres acepta — 8-4-4-4-12 en hexadecimal— y lo demás se lo deja
 * a la base, que devuelve 22P02 si llega basura.
 */
const UUID = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
);

export type FavoritoResult =
  | { ok: true; favorito: boolean }
  | { ok: false; error: "sin-sesion" | "id-invalido" | "fallo" };

export async function toggleFavorito(pawwerId: string): Promise<FavoritoResult> {
  if (!UUID.safeParse(pawwerId).success) return { ok: false, error: "id-invalido" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "sin-sesion" };

  const { data: existente, error: eLectura } = await supabase
    .from("favourite")
    .select("id")
    .eq("client_id", user.id)
    .eq("pawwer_id", pawwerId)
    .maybeSingle();

  if (eLectura) {
    console.error("[Pawwi] favoritos · leer:", eLectura.message);
    return { ok: false, error: "fallo" };
  }

  if (existente) {
    // El `.eq("client_id")` es redundante con la RLS y va a propósito: si algún
    // día alguien afloja la policy, este borrado sigue sin poder tocar filas
    // ajenas.
    const { error } = await supabase
      .from("favourite")
      .delete()
      .eq("id", existente.id)
      .eq("client_id", user.id);
    if (error) {
      console.error("[Pawwi] favoritos · borrar:", error.message);
      return { ok: false, error: "fallo" };
    }
    revalidatePath("/mis-favoritos");
    return { ok: true, favorito: false };
  }

  const { error } = await supabase
    .from("favourite")
    .insert({ client_id: user.id, pawwer_id: pawwerId });

  // 23505 = choque con `uq_favourite`: ya estaba guardado (doble toque, dos
  // pestañas). El resultado que quería el usuario ya es cierto, así que no es
  // un fallo.
  if (error && error.code !== "23505") {
    console.error("[Pawwi] favoritos · guardar:", error.message);
    return { ok: false, error: "fallo" };
  }

  revalidatePath("/mis-favoritos");
  return { ok: true, favorito: true };
}
