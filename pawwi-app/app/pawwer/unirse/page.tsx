import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowLeft, Clock, ShieldCheck, Banknote } from "lucide-react";

export const metadata: Metadata = {
  title: "Conviértete en Pawwer — Pawwi",
  description: "Cuida perros en tu hogar, pon tus horarios y gana dinero. Únete a la comunidad Pawwi en Bogotá.",
};

const FEATURES = [
  {
    icon: <Clock size={24} strokeWidth={2} />,
    title: "Flexibilidad Total",
    desc: "Sin jefes ni horarios fijos. Tú decides cuándo abres tu hogar y qué solicitudes aceptas.",
  },
  {
    icon: <ShieldCheck size={24} strokeWidth={2} />,
    title: "Clientes verificados",
    desc: "Todo dueño pasa por verificación de identidad y llena el Pasaporte de su perro antes de poder reservarte.",
  },
  {
    icon: <Banknote size={24} strokeWidth={2} />,
    title: "Pagos Claros y Puntuales",
    desc: "Recibe el 75% del servicio cada semana directo a tu cuenta bancaria, sin falta.",
  },
];

const FAQS = [
  {
    q: "¿Necesito experiencia profesional con perros?",
    a: "No necesariamente. Lo más importante es que ames a los perros y tengas un espacio seguro. Te brindamos capacitación y certificación gratuita (PawwiCertified®) donde aprenderás manejo, lenguaje canino y seguridad antes de recibir tu primer invitado.",
  },
  {
    q: "¿Cuándo y cómo recibo mis pagos?",
    a: "Realizamos los pagos semanalmente (cada viernes) directamente a tu cuenta bancaria o billetera digital. Recibirás el 75% del valor del servicio. Si además haces el transporte, recibes el 75% de ese valor; si prefieres que Pawwi lo coordine, no te preocupas por la logística.",
  },
  {
    q: "¿Qué pasa si el perrito se enferma o hay una emergencia?",
    a: "Antes de reservar, el dueño registra en el Pasaporte de su perro las notas médicas, las vacunas y la rutina, y queda disponible por el chat durante todo el cuidado. Ante cualquier síntoma, escríbele de inmediato: es quien conoce a su perro y quien decide. Pawwi no presta servicio veterinario.",
  },
  {
    q: "¿Mi casa está protegida si hay daños?",
    a: "Pawwi te consigue los clientes y verifica su identidad, pero el cuidado es un acuerdo entre el dueño y tú: Pawwi no cubre daños. Por eso tú defines cuántos perros aceptas, de qué tamaño y en qué fechas, y puedes rechazar cualquier solicitud sin dar explicaciones.",
  },
  {
    q: "¿Puedo elegir qué perros cuidar y cuándo?",
    a: "¡Totalmente! Tú decides tus horarios, qué días estás disponible y puedes aceptar o rechazar solicitudes según el tamaño del perro y tu espacio. Eres dueño/a de tu tiempo.",
  },
  {
    q: "¿Qué requisitos necesito para postularme?",
    a: "Ser mayor de edad, vivir en Bogotá dentro de nuestra zona de cobertura, pasar la verificación de antecedentes y seguridad del hogar, y completar los módulos de capacitación virtual.",
  },
];

export default function UnirsePage() {
  return (
    <main className="min-h-screen bg-[#FFF1EB] font-body overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[#120A2B]/60 hover:text-[#120A2B] border border-[#120A2B]/20 hover:border-[#120A2B]/50 rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={2.5} /> Explorar
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/pawwer/login"
            className="text-[#120A2B] font-semibold text-xs sm:text-sm border border-[#120A2B]/30 hover:border-[#120A2B] px-3 py-1.5 sm:px-4 sm:py-2 rounded-full transition-colors hidden xs:block"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/pawwer/registro"
            className="bg-[#120A2B] text-white font-bold text-xs sm:text-sm px-4 py-2 sm:px-5 sm:py-2.5 rounded-full hover:bg-[#1e1145] transition-all shadow-sm"
          >
            Registrarme
          </Link>
          <Link
            href="/pawwer/login"
            className="text-[#120A2B] font-semibold text-xs border border-[#120A2B]/30 hover:border-[#120A2B] px-3 py-1.5 rounded-full transition-colors xs:hidden"
          >
            Ingresar
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Blobs */}
        <div
          className="absolute top-0 left-0 w-72 sm:w-[500px] h-72 sm:h-[500px] rounded-full opacity-50 blur-[80px] sm:blur-[100px] pointer-events-none"
          style={{ background: "radial-gradient(circle, #F7AEF1 0%, transparent 70%)", transform: "translate(-20%, -20%)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-64 sm:w-[450px] h-64 sm:h-[450px] rounded-full opacity-50 blur-[80px] sm:blur-[100px] pointer-events-none"
          style={{ background: "radial-gradient(circle, #C084FC 0%, transparent 70%)", transform: "translate(20%, 20%)" }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Texto */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left order-1">
            <span className="inline-block bg-white text-[#120A2B] text-[0.65rem] sm:text-xs font-extrabold uppercase tracking-widest px-4 py-2 rounded-full shadow-sm mb-5 sm:mb-7">
              🐾 Bogotá · Convocatoria abierta
            </span>

            <h1 className="text-[2.2rem] sm:text-4xl lg:text-[3.2rem] leading-[1.1] font-extrabold text-[#120A2B] mb-4 sm:mb-6 max-w-lg">
              Gana dinero extra cuidando perritos{" "}
              <span className="text-[#FF7031]">en tu casa ❤️</span>
            </h1>

            <p className="text-[#4B5563] text-sm sm:text-base lg:text-lg leading-relaxed mb-7 sm:mb-10 max-w-md">
              Únete a la red de cuidadores verificados de Pawwi en Bogotá. Gana el{" "}
              <strong className="text-[#120A2B]">75% por servicio</strong> con total flexibilidad de horarios.
            </p>

            <div className="flex flex-row flex-wrap gap-3 justify-center lg:justify-start">
              <Link
                href="/pawwer/registro"
                className="inline-flex items-center gap-2.5 bg-[#120A2B] text-white font-bold text-sm px-5 py-3 sm:px-7 sm:py-3.5 rounded-full shadow-[0_10px_25px_rgba(18,10,43,0.22)] hover:-translate-y-0.5 hover:shadow-[0_15px_35px_rgba(18,10,43,0.3)] transition-all whitespace-nowrap"
              >
                Registrarme gratis
                <span className="bg-white text-[#120A2B] w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                  <ArrowRight size={13} strokeWidth={3} />
                </span>
              </Link>

              <Link
                href="/pawwer/login"
                className="inline-flex items-center gap-2 font-semibold text-[#120A2B] border border-[#120A2B]/25 hover:border-[#120A2B]/60 hover:bg-[#120A2B]/5 text-sm px-5 py-3 sm:px-7 sm:py-3.5 rounded-full transition-all whitespace-nowrap"
              >
                Ya tengo cuenta · Ingresar
              </Link>
            </div>
          </div>

          {/* Imagen */}
          <div className="relative flex justify-center lg:justify-end order-2">
            <div className="relative bg-white p-2.5 sm:p-3 rounded-[32px] sm:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(18,10,43,0.15)] lg:rotate-2 lg:hover:rotate-0 lg:hover:scale-[1.01] transition-transform w-[260px] sm:w-[320px] lg:w-full lg:max-w-[380px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://pawwi.co/wp-content/uploads/2025/11/Gemini_Generated_Image_203br6203br6203b-scaled.webp"
                alt="Pawwer feliz con un perrito"
                className="w-full rounded-[26px] sm:rounded-[32px] aspect-[4/5] object-cover block"
              />

              {/* Tarjeta flotante — solo en sm+ */}
              <div className="absolute bottom-8 -left-12 bg-white rounded-xl shadow-lg hidden sm:flex items-center gap-3 px-4 py-3 min-w-[190px]">
                <div className="w-10 h-10 rounded-full bg-[#120A2B] flex items-center justify-center text-[#FF7031] shrink-0">
                  <Banknote size={18} strokeWidth={2} />
                </div>
                <div>
                  <p className="font-extrabold text-[#120A2B] text-sm leading-tight">Ganancias Claras</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">Pagos semanales</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Por qué Pawwi ── */}
      <section className="relative bg-[#FFF1EB] py-14 sm:py-20 px-4 sm:px-6 flex flex-col items-center overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full opacity-40 blur-[100px] pointer-events-none"
          style={{ background: "radial-gradient(circle, #FF6B8B 0%, transparent 70%)", transform: "translate(-50%, -50%)" }}
        />

        <div className="relative z-10 text-center max-w-2xl mb-10 sm:mb-14">
          <span className="bg-white text-[#120A2B] text-[0.65rem] sm:text-xs font-extrabold uppercase tracking-widest px-4 py-2 rounded-full shadow-sm mb-4 sm:mb-5 inline-block">
            ¿Por qué Pawwi?
          </span>
          <h2 className="text-2xl sm:text-[2.5rem] font-extrabold text-[#120A2B] leading-tight mb-3 sm:mb-4">
            Más que cuidar, es{" "}
            <span className="text-[#FF7031]">compartir amor</span>
          </h2>
          <p className="text-[#4B5563] text-sm sm:text-lg leading-relaxed">
            Deja atrás las guarderías masivas. Únete a una comunidad que valora tu tiempo y tu cariño.
          </p>
        </div>

        <div className="relative z-10 bg-white max-w-3xl w-full rounded-2xl sm:rounded-[32px] px-5 py-8 sm:px-12 sm:py-14 shadow-[0_20px_60px_-10px_rgba(18,10,43,0.10)] overflow-hidden">
          {/* Ribbon */}
          <div className="absolute top-7 -right-8 sm:top-9 sm:-right-9 rotate-45 bg-[#120A2B] text-white text-[0.55rem] sm:text-[0.65rem] font-extrabold uppercase tracking-[2px] px-8 sm:px-10 py-1.5 sm:py-2 shadow-md">
            PAWWER
          </div>

          <div className="flex flex-col gap-7 sm:gap-10 mb-8 sm:mb-12">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 sm:gap-6 items-start">
                <div className="shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[#FFF5F0] flex items-center justify-center text-[#FF7031]">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-base sm:text-xl font-extrabold text-[#120A2B] mb-1 sm:mb-2">{f.title}</h3>
                  <p className="text-[#6B7280] text-sm sm:text-base leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/pawwer/registro"
            className="flex items-center justify-center w-full bg-[#120A2B] text-white font-bold text-sm sm:text-base py-3.5 sm:py-4 rounded-full shadow-[0_8px_20px_rgba(18,10,43,0.2)] hover:bg-[#1e1145] hover:scale-[1.01] transition-all"
          >
            Quiero postularme
          </Link>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-[#FFF1EB] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">

          <div className="text-center mb-8 sm:mb-12">
            <span className="text-[#FF7031] font-extrabold uppercase text-xs sm:text-sm tracking-widest block mb-2 sm:mb-3">
              Preguntas Frecuentes
            </span>
            <h2 className="text-2xl sm:text-[2.2rem] font-extrabold text-[#FF7031] leading-tight mb-3 sm:mb-4">
              Resolver dudas es el primer paso
            </h2>
            <p className="text-[#6B7280] text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Todo lo que necesitas saber antes de convertirte en Pawwer.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group bg-white border border-gray-200 rounded-xl sm:rounded-2xl overflow-hidden hover:border-[#FF7031] transition-colors"
              >
                <summary className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 cursor-pointer font-bold text-[#120A2B] text-sm sm:text-base group-open:text-[#FF7031] transition-colors [&::-webkit-details-marker]:hidden list-none gap-3">
                  <span>{faq.q}</span>
                  <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#FFF5F0] text-[#FF7031] flex items-center justify-center text-base sm:text-xl font-bold shrink-0 group-open:rotate-45 group-open:bg-[#FF7031] group-open:text-white transition-all">
                    +
                  </span>
                </summary>
                <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-3 sm:pt-4 text-[#4B5563] text-xs sm:text-sm leading-relaxed border-t border-gray-100">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>

        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="bg-[#120A2B] py-12 sm:py-16 px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 sm:mb-4">
          ¿Listo para empezar?
        </h2>
        <p className="text-white/50 text-sm sm:text-base font-body mb-6 sm:mb-8 max-w-sm sm:max-w-md mx-auto leading-relaxed">
          El proceso toma menos de 10 minutos. Regístrate gratis y te contactamos para verificarte.
        </p>
        <Link
          href="/pawwer/registro"
          className="inline-flex items-center gap-3 bg-white text-[#120A2B] font-extrabold text-sm sm:text-base px-7 py-3 sm:px-10 sm:py-4 rounded-full shadow-lg hover:-translate-y-0.5 transition-all"
        >
          Registrarme gratis
          <span className="bg-[#FF7031] text-white w-7 h-7 rounded-full flex items-center justify-center shrink-0">
            <ArrowRight size={15} strokeWidth={3} />
          </span>
        </Link>
        <div className="mt-5">
          <Link
            href="/pawwer/login"
            className="inline-flex items-center gap-2 text-white/70 border border-white/25 hover:border-white/60 hover:bg-white/10 hover:text-white rounded-full px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all"
          >
            Ya tengo cuenta · Iniciar sesión
          </Link>
        </div>
      </section>

    </main>
  );
}
