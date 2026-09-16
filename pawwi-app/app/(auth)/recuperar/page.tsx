import type { Metadata } from "next";
import RecuperarForm from "./RecuperarForm";

export const metadata: Metadata = {
  title: "Recuperar contraseña — Pawwi",
};

export default function RecuperarPage() {
  return (
    <main className="relative w-full">

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-midnight mb-2">
            ¿Olvidaste tu contraseña?
          </h1>
          <p className="text-midnight/60 font-body">
            No pasa nada, te ayudamos a recuperarla.
          </p>
        </div>

        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-8">
          <RecuperarForm />
        </div>
      </div>
    </main>
  );
}
