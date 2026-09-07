import { Suspense } from "react";
import type { Metadata } from "next";
import RegistroForm from "./RegistroForm";

export const metadata: Metadata = {
  title: "Crear cuenta — Pawwi",
  description: "Regístrate en Pawwi y encuentra el cuidador perfecto para tu perro.",
};

export default function RegistroPage() {
  return (
    <main className="relative min-h-screen bg-cream flex items-center justify-center px-4 py-12 overflow-hidden">
      {/* Blobs decorativos */}
      <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-plum/35 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-blue-ice/35 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-midnight mb-2">
            Crea tu cuenta
          </h1>
          <p className="text-midnight/60 font-body">
            Encuentra el cuidador perfecto para tu peludo.
          </p>
        </div>

        {/* Card glass */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-8">
          <Suspense fallback={null}>
            <RegistroForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
