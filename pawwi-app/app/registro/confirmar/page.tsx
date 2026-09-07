import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Revisa tu email — Pawwi",
};

export default function ConfirmarPage() {
  return (
    <main className="relative min-h-screen bg-cream flex items-center justify-center px-4 overflow-hidden">
      {/* Blobs decorativos */}
      <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-plum/35 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-blue-ice/35 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md text-center">
        <div className="text-5xl mb-6">📬</div>
        <h1 className="text-2xl font-heading font-bold text-midnight mb-3">
          Revisa tu email
        </h1>
        <p className="text-midnight/60 font-body mb-2">
          Te enviamos un link de confirmación a tu correo.
        </p>
        <p className="text-midnight/60 font-body mb-8">
          Una vez confirmes, podrás entrar a Pawwi.
        </p>
        <Link
          href="/"
          className="text-sm text-midnight/50 font-body underline hover:text-tangerine"
        >
          Explorar Pawwers mientras tanto
        </Link>
      </div>
    </main>
  );
}
