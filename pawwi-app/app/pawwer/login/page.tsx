import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import LoginPawwerForm from "./LoginPawwerForm";

export const metadata: Metadata = {
  title: "Panel Pawwers — Pawwi",
  description: "Accede a tu panel de cuidador Pawwi.",
};

export default function LoginPawwerPage() {
  return (
    <main className="relative min-h-screen bg-midnight flex items-center justify-center px-4 py-12 overflow-hidden">
      <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-plum/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-tangerine/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">

        {/* Nav: volver + logo */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/pawwer/unirse"
            className="flex items-center gap-1.5 text-white/60 hover:text-white border border-white/20 hover:border-white/50 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <ArrowLeft size={13} strokeWidth={2.5} /> Volver
          </Link>
          <Image
            src="/LogoPawwiCompleteOrange.svg"
            alt="Pawwi"
            width={110}
            height={36}
            style={{ width: "auto", height: "2rem" }}
          />
          <div className="w-16" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-white mb-2">
            Panel de Pawwers
          </h1>
          <p className="text-white/50 font-body text-sm">
            Acceso exclusivo para cuidadores verificados.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <LoginPawwerForm />
        </div>

        <div className="text-center mt-6">
          <Link
            href="/pawwer/registro"
            className="inline-flex items-center gap-1.5 text-white/60 border border-white/20 hover:border-white/50 hover:text-white rounded-full px-5 py-2 text-xs font-semibold transition-colors"
          >
            ¿Quieres ser Pawwer? Regístrate gratis
          </Link>
        </div>
      </div>
    </main>
  );
}
