import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Dog, ArrowRight, Plus } from "lucide-react";
import { createClient } from "@/lib/server";
import { safeNext } from "@/lib/safe-redirect";
import SuccessStage from "@/components/SuccessStage";

export const metadata: Metadata = { title: "¡Peludo agregado! — Pawwi" };

/**
 * «Peludo agregado» — la celebración que faltaba.
 *
 * Hasta hoy, guardar una mascota terminaba en un salto mudo a la lista: el
 * cliente rellenaba el formulario, pulsaba guardar, y aparecía en otra pantalla
 * sin una sola señal de que hubiera salido bien. Registrar a tu perro es el
 * primer momento en que Pawwi te pide confianza; merece acuse de recibo.
 *
 * Vive en `(flujo)` y no en `(cliente)` a propósito: es pantalla de paso, sin
 * nav inferior ni `pb-32`, para que la curva llegue hasta el borde.
 *
 * El botón principal NO va siempre a «mis peludos». Si llegaste aquí desde el
 * paso 3 de una reserva, te devuelve a la reserva a medias — perderla es
 * exactamente el fallo que ya se corrigió una vez en `crearMascota`.
 */
export default async function MascotaAgregadaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { id } = await params;
  const { next } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?modal=login&next=/mis-mascotas");

  // La RLS ya limita a los propios; el `.eq("owner_id")` es la segunda capa.
  const { data: perro, error } = await supabase
    .from("dog")
    .select("id, name, photo_url, breed")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) console.error("[Pawwi] mascota agregada:", error.message);
  // Sin perro no hay nada que celebrar: no se inventa una pantalla de éxito.
  if (!perro) redirect("/mis-mascotas");

  const destino = safeNext(next, "/mis-mascotas");
  const vuelveALaReserva = destino.startsWith("/booking/");

  return (
    <SuccessStage
      icon={
        perro.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={perro.photo_url}
            alt={perro.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <Dog size={46} strokeWidth={2.2} />
        )
      }
      title={<>¡{perro.name} ya<br />está en Pawwi!</>}
      description={
        vuelveALaReserva
          ? <>Ya puedes seguir con la reserva y elegir a {perro.name} para el cuidado.</>
          : <>Su perfil quedó guardado. Podrás elegirlo cada vez que reserves un cuidado.</>
      }
    >
      <Link
        href={destino}
        className="w-full flex items-center justify-center gap-2 bg-tangerine text-white font-bold
                   px-6 py-4 rounded-full text-base hover:bg-[#e6652c] transition-colors
                   shadow-[0_8px_20px_rgba(255,112,49,0.32)] active:scale-[0.98]"
      >
        {vuelveALaReserva ? "Seguir con la reserva" : "Ver mis peludos"}
        <ArrowRight size={18} />
      </Link>

      {!vuelveALaReserva && (
        <Link
          href="/mis-mascotas/nueva"
          className="w-full flex items-center justify-center gap-2 text-midnight/55 font-bold
                     px-6 py-3 rounded-full text-sm hover:bg-cream transition-colors"
        >
          <Plus size={16} /> Agregar otro peludo
        </Link>
      )}
    </SuccessStage>
  );
}
