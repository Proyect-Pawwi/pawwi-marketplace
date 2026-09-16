import type { Metadata } from "next";
import BackButton from "@/components/BackButton";
import DogForm from "./DogForm";

export const metadata: Metadata = { title: "Agregar mascota — Pawwi" };

export default function NuevaMascotaPage() {
  // El marco —fondo, tipografía y atmósfera— lo da el layout de `(cliente)`.
  // Esta pantalla repetía `min-h-screen bg-cream … overflow-hidden` y su propio
  // blob, que ahora duplicaban los del shell.
  return (
    <main className="relative px-4 py-8">
      <div className="relative max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          {/* Antes era un <Link> a /mis-mascotas con otro estilo (`w-9`,
              `rounded-full`, borde gris). Con `router.back()` vuelve a DONDE
              VINO: si el cliente llegó desde el paso 3 de una reserva, regresa
              a la reserva y no a la lista de mascotas. */}
          <BackButton fallback="/mis-mascotas" />
          <div>
            <h1 className="text-xl font-heading font-extrabold text-midnight">Agregar mascota</h1>
            <p className="text-xs text-midnight/50 font-body">Cuéntanos sobre tu perro</p>
          </div>
        </div>

        <DogForm />
      </div>
    </main>
  );
}
