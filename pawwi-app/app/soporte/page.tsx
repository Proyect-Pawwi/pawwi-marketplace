import Link from "next/link";
import { ArrowLeft, Mail, MessageCircle, HelpCircle } from "lucide-react";

export const metadata = {
  title: "Soporte — Pawwi",
  description: "¿Necesitas ayuda? El equipo Pawwi está para ti.",
};

const TOPICS = [
  { q: "¿Cómo reservo un cuidador?", a: "Busca por tu barrio en la página principal, elige un Pawwer verificado y selecciona las fechas. Te guiamos paso a paso." },
  { q: "¿Qué es PawwiProtect™?", a: "Es la cobertura veterinaria y el soporte que incluimos sin costo en cada reserva, para tu tranquilidad." },
  { q: "Soy Pawwer, ¿cómo recibo mis pagos?", a: "Los cortes son semanales y se pagan los viernes. Puedes ver tus ingresos en tu panel." },
];

export default function SoportePage() {
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
        <span className="eyebrow text-[#FF7031] ">Estamos para ayudarte</span>
        <h1 className="text-4xl font-black mt-1 mb-3 text-balance">Soporte Pawwi</h1>
        <p className="text-[#6B7280] font-medium mb-8 text-pretty">
          ¿Tienes una duda o algo que resolver? Escríbenos y te respondemos lo antes posible.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <a href="mailto:hola@pawwi.co" className="flex items-center gap-4 bg-white rounded-[24px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.05)] border border-white hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-[16px] bg-[#FFF1EB] flex items-center justify-center text-[#FF7031] shrink-0">
              <Mail size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black">Correo</p>
              <p className="text-xs text-gray-500 truncate">hola@pawwi.co</p>
            </div>
          </a>
          <a href="https://wa.me/573000000000" className="flex items-center gap-4 bg-white rounded-[24px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.05)] border border-white hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-[16px] bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] shrink-0">
              <MessageCircle size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black">WhatsApp</p>
              <p className="text-xs text-gray-500 truncate">Chatea con el equipo</p>
            </div>
          </a>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={18} className="text-[#FF7031]" />
          <h2 className="text-lg font-black">Preguntas frecuentes</h2>
        </div>
        <div className="space-y-3">
          {TOPICS.map((t) => (
            <div key={t.q} className="bg-white rounded-[20px] p-5 shadow-[0_12px_30px_rgba(18,10,43,0.04)] border border-white">
              <p className="text-sm font-extrabold mb-1">{t.q}</p>
              <p className="text-sm text-gray-500 leading-relaxed text-pretty">{t.a}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
