import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DogForm from "./DogForm";

export const metadata: Metadata = { title: "Agregar mascota — Pawwi" };

export default function NuevaMascotaPage() {
  return (
    <main className="relative min-h-screen bg-cream px-4 py-8 overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-plum/25 blur-3xl pointer-events-none" />

      <div className="relative max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/mis-mascotas"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
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
