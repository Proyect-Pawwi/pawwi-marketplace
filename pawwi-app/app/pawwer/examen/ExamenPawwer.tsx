"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Check, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { EXAM_SECTIONS } from "@/lib/exam-pawwer";
import { submitExamen } from "@/app/actions/pawwer-exam";
import Link from "next/link";

interface Props {
  name: string;
}

type ResultType = "preselected" | "needs_review" | "rejected";

const RESULT_UI: Record<ResultType, { emoji: string; title: string; body: string; color: string }> = {
  preselected: {
    emoji: "🎉",
    title: "¡Fuiste preseleccionado!",
    body: "Pasaste el examen con éxito. El equipo Pawwi te contactará pronto para coordinar la capacitación y la visita al hogar. ¡Bienvenido a la comunidad!",
    color: "bg-green-50 border-green-200",
  },
  needs_review: {
    emoji: "⏳",
    title: "Tu evaluación está en revisión",
    body: "Nuestro equipo revisará tu examen con detalle. Te contactaremos en los próximos días con el resultado y los próximos pasos.",
    color: "bg-amber-50 border-amber-200",
  },
  rejected: {
    emoji: "😔",
    title: "Por ahora no cumples los requisitos",
    body: "Gracias por tu interés en ser Pawwer. En este momento tu perfil no cumple los requisitos. Podrás volver a postularte en 6 meses. Si tienes preguntas, escríbenos a hola@pawwi.co.",
    color: "bg-red-50 border-red-200",
  },
};

export default function ExamenPawwer({ name }: Props) {
  const firstName = name.split(" ")[0] || "Pawwer";

  // answers: { questionId → optionIndex | scaleValue }
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [sectionIdx, setSectionIdx] = useState(0);
  const [result, setResult] = useState<ResultType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const section = EXAM_SECTIONS[sectionIdx]!;
  const isLast  = sectionIdx === EXAM_SECTIONS.length - 1;

  // Todas las preguntas de la sección actual respondidas
  const sectionComplete = section.questions.every((q) => answers[q.id] !== undefined);

  function setAnswer(qId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  function handleNext() {
    if (isLast) {
      setError(null);
      startTransition(async () => {
        const res = await submitExamen(answers);
        if ("error" in res) {
          setError(res.error);
        } else {
          setResult(res.result);
        }
      });
    } else {
      setSectionIdx((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ── Pantalla de resultado ─────────────────────────────────────────────────
  if (result) {
    const ui = RESULT_UI[result];
    return (
      <div className="min-h-screen bg-[#FFF1EB] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Image
            src="/LogoPawwiCompleteOrange.svg"
            alt="Pawwi"
            width={120}
            height={40}
            style={{ width: "auto", height: "2rem" }}
            className="mx-auto mb-8"
          />
          <div className={`border rounded-3xl p-8 text-center ${ui.color}`}>
            <p className="text-5xl mb-4">{ui.emoji}</p>
            <h1 className="text-xl font-extrabold text-[#120A2B] mb-3">{ui.title}</h1>
            <p className="text-sm text-[#4B5563] leading-relaxed mb-6">{ui.body}</p>
            {result === "preselected" && (
              <p className="text-xs text-green-700 font-semibold">
                Te enviamos un email de confirmación. Revisa tu bandeja.
              </p>
            )}
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/pawwer/dashboard"
              className="inline-flex items-center gap-2 text-[#120A2B]/60 border border-[#120A2B]/20 hover:border-[#120A2B]/50 hover:text-[#120A2B] rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Ir a mi panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Examen ───────────────────────────────────────────────────────────────
  const progress = ((sectionIdx + 1) / EXAM_SECTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-[#FFF1EB] pb-28">

      {/* Header sticky */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-white/50 shadow-sm px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSectionIdx((i) => Math.max(0, i - 1))}
              disabled={sectionIdx === 0}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-0 disabled:pointer-events-none transition-opacity"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <Image
                src="/LogoPawwiCompleteOrange.svg"
                alt="Pawwi"
                width={80}
                height={26}
                style={{ width: "auto", height: "1.3rem" }}
              />
              <span className="text-[11px] text-[#120A2B]/50 font-semibold">
                Sección {sectionIdx + 1} de {EXAM_SECTIONS.length}
              </span>
            </div>
            <div />
          </div>
          {/* Barra de progreso */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF7031] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Cabecera de sección */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">{section.emoji}</span>
            <h1 className="text-xl font-extrabold text-[#120A2B]">{section.title}</h1>
          </div>
          {sectionIdx === 0 && (
            <p className="text-sm text-[#6B7280] font-body">
              Hola {firstName}, responde con honestidad — no hay respuestas incorrectas, solo queremos conocerte mejor.
            </p>
          )}
        </div>

        {/* Preguntas */}
        {section.questions.map((q, qi) => {
          const answered = answers[q.id] !== undefined;
          return (
            <div key={q.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start gap-2 mb-4">
                <div className={[
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5 transition-colors",
                  answered ? "bg-[#FF7031] text-white" : "bg-gray-100 text-gray-400",
                ].join(" ")}>
                  {answered ? <Check size={13} /> : qi + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#120A2B] leading-snug">{q.text}</p>
                  {q.hint && <p className="text-xs text-[#9CA3AF] mt-0.5">{q.hint}</p>}
                </div>
              </div>

              {q.type.kind === "scale" ? (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswer(q.id, n)}
                      className={[
                        "flex-1 h-12 rounded-xl border text-sm font-extrabold transition-all",
                        answers[q.id] === n
                          ? "bg-[#120A2B] text-white border-[#120A2B] scale-105"
                          : "bg-white text-gray-400 border-gray-200 hover:border-gray-300",
                      ].join(" ")}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {q.type.options.map((opt, oi) => (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => setAnswer(q.id, oi)}
                      className={[
                        "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all leading-snug",
                        answers[q.id] === oi
                          ? "border-[#120A2B] bg-[#120A2B] text-white"
                          : "border-gray-200 bg-white text-[#120A2B] hover:border-gray-300",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-4 z-30 shadow-[0_-8px_24px_rgba(18,10,43,0.08)]"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))" }}
      >
        <div className="max-w-lg mx-auto space-y-2">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-600">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={!sectionComplete || isPending}
            className={[
              "w-full py-4 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-2",
              sectionComplete && !isPending
                ? "bg-[#FF7031] text-white hover:bg-[#e6652c] shadow-md active:scale-95"
                : "bg-gray-100 text-gray-400 cursor-not-allowed",
            ].join(" ")}
          >
            {isPending
              ? <><Loader2 size={16} className="animate-spin" /> Enviando...</>
              : isLast ? "Enviar evaluación" : "Continuar"
            }
          </button>
          {!sectionComplete && (
            <p className="text-xs text-center text-[#120A2B]/40 font-body">
              Responde todas las preguntas de esta sección para continuar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
