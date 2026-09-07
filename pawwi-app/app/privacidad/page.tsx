import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Política de Privacidad — Pawwi",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-[#FFF1EB] text-[#120A2B]">
      <header className="border-b border-black/5 bg-white/60 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/LogoPawwiCompleteOrange.svg" alt="Pawwi" className="h-6 w-auto" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="w-14 h-14 rounded-[18px] bg-white shadow-[0_12px_30px_rgba(18,10,43,0.06)] flex items-center justify-center text-[#FF7031] mb-5">
          <ShieldCheck size={26} />
        </div>
        <h1 className="text-4xl font-black mb-3 text-balance">Política de Privacidad</h1>
        <p className="text-[#6B7280] font-medium leading-relaxed text-pretty">
          Tu privacidad nos importa. Estamos finalizando la versión completa de nuestra
          Política de Privacidad, donde explicaremos qué datos recolectamos, cómo los
          usamos para conectarte con cuidadores cerca de ti y cómo los protegemos. Nunca
          mostramos tu dirección exacta a un Pawwer antes de que aceptes una reserva.
        </p>
        <a href="mailto:hola@pawwi.co" className="inline-flex items-center gap-2 mt-7 bg-[#120A2B] text-white font-bold text-sm px-6 py-3.5 rounded-full hover:bg-[#1e1145] transition-colors">
          Dudas sobre tus datos: hola@pawwi.co
        </a>
        <p className="text-xs text-gray-400 mt-10">Pawwi SAS · Bogotá, Colombia</p>
      </main>
    </div>
  );
}
