import type { Metadata } from "next";
import BackButton from "@/components/BackButton";
import { safeNext } from "@/lib/safe-redirect";
import DogForm from "./DogForm";

export const metadata: Metadata = { title: "Agregar mascota — Pawwi" };

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NuevaMascotaPage({ searchParams }: Props) {
  // El paso 3 de la reserva llega aquí con `?back=<la reserva a medias>`. Esta
  // pantalla NO lo leía, así que el parámetro viajaba y se tiraba: al guardar,
  // el cliente caía en /mis-mascotas y **perdía la reserva**. Tenía que rehacer
  // los tres pasos para volver al punto donde estaba.
  const sp = await searchParams;
  const back = safeNext(typeof sp.back === "string" ? sp.back : null, "/mis-mascotas");
  const vieneDeReserva = back.startsWith("/booking/");

  // El marco —fondo, tipografía y atmósfera— lo da el layout de `(cliente)`.
  return (
    <main className="relative px-6 py-10">
      <div className="relative max-w-lg mx-auto">
        <header className="mb-8">
          {/* `router.back()` respeta de dónde vino; el fallback cubre el caso de
              entrar por un enlace directo, donde no hay historial. */}
          <div className="mb-4"><BackButton fallback={back} /></div>
          <p className="eyebrow text-tangerine">
            {vieneDeReserva ? "Para tu reserva" : "Tu familia"}
          </p>
          <h1 className="text-2xl font-black text-midnight leading-none mt-1.5">Agregar peludo</h1>
          <p className="text-sm text-midnight/50 mt-2">
            {vieneDeReserva
              ? "Al guardarlo vuelves a tu reserva, justo donde la dejaste."
              : "Cuéntanos sobre tu perro."}
          </p>
        </header>

        <DogForm back={back} />
      </div>
    </main>
  );
}
