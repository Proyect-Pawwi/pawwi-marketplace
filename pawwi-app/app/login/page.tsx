import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Ingresar — Pawwi",
  description: "Ingresa a tu cuenta de Pawwi.",
};

export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-cream flex items-center justify-center px-4 py-12 overflow-hidden">
      {/* Blobs decorativos */}
      <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-plum/35 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-ice/35 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-midnight mb-2">
            Bienvenido de vuelta
          </h1>
          <p className="text-midnight/60 font-body">
            Tu peludo te está esperando.
          </p>
        </div>

        {/* Card glass */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-8">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
