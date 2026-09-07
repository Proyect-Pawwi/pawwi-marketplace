import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";

type PawwerStatus =
  | "pending_review"
  | "exam_ready"
  | "preselected"
  | "needs_review"
  | "rejected"
  | "visita_pendiente"
  | "approved";

interface StatusConfig {
  emoji: string;
  title: string;
  body: string;
  step: number;
  cta?: { label: string; href: string };
  variant: "neutral" | "active" | "success" | "warning" | "danger";
}

const STATUS_CONFIG: Record<PawwerStatus, StatusConfig> = {
  pending_review: {
    emoji: "🔍",
    title: "Revisando tu cédula",
    body: "Luisa está verificando tu documento de identidad para confirmar tus antecedentes. Esto toma 1–2 días hábiles. Te avisaremos por correo cuando esté listo.",
    step: 1,
    variant: "neutral",
  },
  exam_ready: {
    emoji: "📝",
    title: "¡Tienes un examen pendiente!",
    body: "Tu cédula fue verificada. Ahora completa el examen psicotécnico (≈ 5 min) para seguir adelante.",
    step: 2,
    cta: { label: "Comenzar examen", href: "/pawwer/examen" },
    variant: "active",
  },
  preselected: {
    emoji: "🎉",
    title: "¡Fuiste preseleccionado!",
    body: "Pasaste el examen psicotécnico. El siguiente paso es completar la capacitación virtual de Pawwi Academy.",
    step: 3,
    cta: { label: "Ir a Pawwi Academy", href: "/pawwer/capacitacion" },
    variant: "success",
  },
  needs_review: {
    emoji: "⏳",
    title: "Tu examen está en revisión",
    body: "Nuestro equipo está analizando tu evaluación. Te contactaremos en los próximos días con el resultado.",
    step: 2,
    variant: "warning",
  },
  rejected: {
    emoji: "😔",
    title: "Por ahora no cumples los requisitos",
    body: "Gracias por tu interés. En este momento tu perfil no cumple los requisitos para ser Pawwer. Podrás volver a postularte en 6 meses.",
    step: 2,
    variant: "danger",
  },
  visita_pendiente: {
    emoji: "🏠",
    title: "Agenda tu visita al hogar",
    body: "¡Aprobaste la capacitación! El siguiente paso es agendar la visita domiciliaria para que el equipo Pawwi conozca tu hogar.",
    step: 4,
    cta: { label: "Agendar visita", href: "/pawwer/visita" },
    variant: "active",
  },
  approved: {
    emoji: "✅",
    title: "¡Eres Pawwer verificado!",
    body: "Tu perfil está publicado y puedes recibir reservas de clientes.",
    step: 5,
    variant: "success",
  },
};

const VARIANT_STYLES: Record<StatusConfig["variant"], string> = {
  neutral: "bg-gray-50 border-gray-200 text-gray-800",
  active:  "bg-blue-50 border-blue-200 text-blue-900",
  success: "bg-green-50 border-green-200 text-green-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  danger:  "bg-red-50 border-red-200 text-red-900",
};

const TIMELINE_STEPS = [
  "Cédula verificada",
  "Examen psicotécnico",
  "Capacitación",
  "Visita al hogar",
  "Perfil publicado",
];

export default async function PawwerDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const { data: pawwer } = await supabase
    .from("pawwer")
    .select("id, status")
    .eq("id", user.id)
    .single();

  if (!pawwer) redirect("/pawwer/bienvenida");

  const { data: profile } = await supabase
    .from("profile")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single();

  const status = (pawwer.status ?? "pending_review") as PawwerStatus;

  if (status === "approved") redirect("/pawwer/inicio");

  // If the pawwer already scheduled their home visit, show different copy
  let visitaAgendada = false;
  if (status === "visita_pendiente") {
    const { data: visita } = await supabase
      .from("visita_domiciliaria")
      .select("id")
      .eq("pawwer_id", user.id)
      .in("status", ["pending", "confirmed"])
      .maybeSingle();
    visitaAgendada = !!visita;
  }

  const baseConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_review;
  const config: StatusConfig = (status === "visita_pendiente" && visitaAgendada)
    ? {
        ...baseConfig,
        title: "Visita agendada",
        body: "Tu visita domiciliaria está agendada. Luisa del equipo Pawwi te contactará pronto para confirmar los detalles.",
        cta: { label: "Ver detalles de la visita", href: "/pawwer/visita" },
      }
    : baseConfig;

  const nombre     = profile?.name ?? "Pawwer";
  const firstName  = nombre.split(" ")[0] ?? "Pawwer";
  const isApproved = (status as string) === "approved";

  return (
    <main className="min-h-screen bg-[#FFF1EB]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <Image
            src="/LogoPawwiCompleteOrange.svg"
            alt="Pawwi"
            width={100}
            height={32}
            style={{ width: "auto", height: "1.75rem" }}
          />
          <Link
            href="/"
            className="text-xs text-[#120A2B]/50 hover:text-[#120A2B] border border-[#120A2B]/15 hover:border-[#120A2B]/40 rounded-full px-3 py-1.5 font-semibold transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

        {/* Saludo */}
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={nombre}
              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#120A2B] flex items-center justify-center text-white font-extrabold text-lg shrink-0">
              {firstName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs text-[#120A2B]/50 font-body">Panel de Pawwer</p>
            <h1 className="text-lg font-extrabold text-[#120A2B]">
              Hola, {firstName} 👋
            </h1>
          </div>
        </div>

        {/* Estado actual */}
        <div className={`border rounded-2xl p-5 ${VARIANT_STYLES[config.variant]}`}>
          <div className="flex items-start gap-3">
            <span className="text-3xl shrink-0 mt-0.5">{config.emoji}</span>
            <div className="flex-1">
              <p className="font-extrabold text-base mb-1">{config.title}</p>
              <p className="text-sm leading-relaxed opacity-80">{config.body}</p>
              {config.cta && (
                <Link
                  href={config.cta.href}
                  className="inline-flex items-center mt-4 bg-[#120A2B] text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-[#1e1145] transition-colors"
                >
                  {config.cta.label} →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Línea de tiempo — oculta solo para approved */}
        {!isApproved && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-extrabold text-[#120A2B]/40 uppercase tracking-widest mb-4">
              Tu proceso de verificación
            </p>
            <div className="space-y-0">
              {TIMELINE_STEPS.map((label, i) => {
                const stepNum = i + 1;
                const done    = stepNum < config.step;
                const active  = stepNum === config.step;
                const isLast  = i === TIMELINE_STEPS.length - 1;

                return (
                  <div key={label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={[
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 transition-all",
                        done   ? "bg-green-500 text-white" :
                        active ? "bg-[#FF7031] text-white ring-4 ring-[#FF7031]/20" :
                                 "bg-gray-100 text-gray-400",
                      ].join(" ")}>
                        {done ? "✓" : stepNum}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 min-h-[24px] flex-1 my-1 rounded-full ${done ? "bg-green-200" : "bg-gray-100"}`} />
                      )}
                    </div>
                    <div className="pb-5 pt-0.5">
                      <p className={[
                        "text-sm font-semibold",
                        done   ? "text-green-700" :
                        active ? "text-[#120A2B]" :
                                 "text-gray-400",
                      ].join(" ")}>
                        {label}
                      </p>
                      <p className={[
                        "text-xs font-medium mt-0.5",
                        done   ? "text-green-500" :
                        active ? "text-[#FF7031]" :
                                 "text-gray-300",
                      ].join(" ")}>
                        {done ? "Completado" : active ? "En curso" : "Pendiente"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel completo — solo para approved */}
        {isApproved && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <p className="text-xs font-extrabold text-[#120A2B]/40 uppercase tracking-widest">
              Panel de control
            </p>
            {[
              { label: "Gestionar disponibilidad", href: "/pawwer/disponibilidad", soon: false },
              { label: "Ver y responder reservas",  href: "/pawwer/reservas",       soon: true },
              { label: "Mis ingresos y pagos",      href: "/pawwer/ingresos",       soon: true },
              { label: "Editar perfil público",     href: "/pawwer/perfil",         soon: true },
            ].map(({ label, href, soon }) => (
              <Link
                key={label}
                href={soon ? "#" : href}
                className={[
                  "flex items-center justify-between p-3.5 rounded-xl border transition-colors",
                  soon
                    ? "border-dashed border-gray-200 text-gray-400 cursor-default pointer-events-none"
                    : "border-gray-200 text-[#120A2B] hover:border-[#FF7031] hover:bg-[#FFF1EB]/50",
                ].join(" ")}
              >
                <span className="text-sm font-semibold">{label}</span>
                {soon
                  ? <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold uppercase">Pronto</span>
                  : <span className="text-[#FF7031] font-bold">→</span>
                }
              </Link>
            ))}
          </div>
        )}

        <p className="text-xs text-center text-[#120A2B]/40 font-body pb-6">
          ¿Tienes preguntas? Escríbenos a{" "}
          <a href="mailto:hola@pawwi.co" className="text-[#FF7031] underline">
            hola@pawwi.co
          </a>
        </p>
      </div>
    </main>
  );
}
