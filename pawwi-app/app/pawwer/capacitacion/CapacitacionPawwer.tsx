"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2, ArrowLeft, Loader2,
  AlertCircle, ChevronDown, ChevronUp, Award,
} from "lucide-react";
import {
  VIDEO_MODULES, QUIZ_SECTIONS, PASSING_SCORE,
  TOTAL_QUESTIONS, TOTAL_VIDEOS,
} from "@/lib/capacitacion";
import { submitCapacitacion } from "@/app/actions/capacitacion";

type Phase = "videos" | "quiz" | "result";

function getSectionAndQuestion(flatIdx: number) {
  let remaining = flatIdx;
  for (let s = 0; s < QUIZ_SECTIONS.length; s++) {
    const len = QUIZ_SECTIONS[s]!.questions.length;
    if (remaining < len) return { sectionIdx: s, questionInSec: remaining };
    remaining -= len;
  }
  const last = QUIZ_SECTIONS.length - 1;
  return { sectionIdx: last, questionInSec: QUIZ_SECTIONS[last]!.questions.length - 1 };
}

export default function CapacitacionPawwer({ name }: { name: string }) {
  const firstName = name.split(" ")[0] || "Pawwer";

  // ── Videos phase ──────────────────────────────────────────────────────────
  const [phase, setPhase]           = useState<Phase>("videos");
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  function toggleVideo(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }
  function markWatched(id: number) {
    setWatchedIds((prev) => new Set([...prev, id]));
    setExpandedId(null);
  }

  // ── Quiz phase ─────────────────────────────────────────────────────────────
  const allQuestions = QUIZ_SECTIONS.flatMap((s) => s.questions);
  const [questionIdx,   setQuestionIdx]   = useState(0);
  const [answers,       setAnswers]       = useState<Record<number, number>>({});
  const [showFeedback,  setShowFeedback]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [isPending,     startTransition]  = useTransition();

  const { sectionIdx, questionInSec } = getSectionAndQuestion(questionIdx);
  const currentSection = QUIZ_SECTIONS[sectionIdx]!;
  const currentQ       = currentSection.questions[questionInSec]!;
  const selectedAnswer = answers[questionIdx];
  const hasAnswered    = selectedAnswer !== undefined;
  const isLastQuestion = questionIdx === TOTAL_QUESTIONS - 1;
  const quizProgress   = ((questionIdx + (hasAnswered ? 1 : 0)) / TOTAL_QUESTIONS) * 100;

  function selectAnswer(optIdx: number) {
    if (hasAnswered) return;
    setAnswers((prev) => ({ ...prev, [questionIdx]: optIdx }));
    setShowFeedback(true);
  }

  function nextQuestion() {
    if (!hasAnswered) return;
    if (isLastQuestion) {
      // Enviar las respuestas seleccionadas; el servidor recalcula el puntaje.
      const answerArr = allQuestions.map((_, i) => answers[i] ?? -1);
      handleSubmit(answerArr);
      return;
    }
    setQuestionIdx((i) => i + 1);
    setShowFeedback(answers[questionIdx + 1] !== undefined);
  }

  function handleSubmit(answerArr: number[]) {
    setError(null);
    startTransition(async () => {
      const res = await submitCapacitacion(answerArr);
      if ("error" in res) {
        setError(res.error);
      } else {
        setFinalScore(res.score);
        setFinalPassed(res.passed);
        setPhase("result");
      }
    });
  }

  // ── Result phase ───────────────────────────────────────────────────────────
  const [finalScore,  setFinalScore]  = useState(0);
  const [finalPassed, setFinalPassed] = useState(false);

  // ══════════════════════════════════════════════════════════════════════════
  // RESULT SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === "result") {
    return (
      <div className="min-h-screen bg-[#FFF1EB] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <Image
              src="/LogoPawwiCompleteOrange.svg"
              alt="Pawwi"
              width={120}
              height={40}
              style={{ width: "auto", height: "2rem" }}
            />
          </div>

          <div className={`rounded-3xl border p-8 text-center ${
            finalPassed
              ? "bg-green-50 border-green-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <p className="text-5xl mb-4">{finalPassed ? "🎓" : "📚"}</p>
            <h1 className="text-xl font-extrabold text-[#120A2B] mb-2">
              {finalPassed ? "¡Pawwer Certificado!" : "Sigue repasando"}
            </h1>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              {finalPassed
                ? "¡Completaste la capacitación! El siguiente paso es agendar tu visita domiciliaria para que el equipo Pawwi conozca tu hogar."
                : `Necesitas ${PASSING_SCORE} respuestas correctas. Repasa los videos y vuelve a intentarlo.`}
            </p>

            <div className="mt-6 bg-white rounded-2xl py-4 px-6 inline-block shadow-sm">
              <p className="text-xs font-extrabold text-[#120A2B]/40 uppercase tracking-widest mb-1">Tu puntaje</p>
              <p className="text-4xl font-extrabold text-[#FF7031]">
                {finalScore}<span className="text-lg text-[#120A2B]/30 font-semibold">/{TOTAL_QUESTIONS}</span>
              </p>
            </div>
          </div>

          {finalPassed ? (
            <Link
              href="/pawwer/visita"
              className="block w-full text-center bg-[#FF7031] text-white font-extrabold text-sm py-4 rounded-2xl hover:bg-[#e6652c] transition-colors"
            >
              Agendar visita domiciliaria →
            </Link>
          ) : (
            <button
              onClick={() => {
                setPhase("videos");
                setAnswers({});
                setQuestionIdx(0);
                setShowFeedback(false);
                setError(null);
              }}
              className="w-full text-center bg-[#120A2B] text-white font-extrabold text-sm py-4 rounded-2xl hover:bg-[#1e1145] transition-colors"
            >
              Volver a los videos e intentar de nuevo
            </button>
          )}

          <p className="text-xs text-center text-[#120A2B]/40">
            ¿Preguntas? Escríbenos a{" "}
            <a href="mailto:hola@pawwi.co" className="text-[#FF7031] underline">hola@pawwi.co</a>
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // QUIZ SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === "quiz") {
    return (
      <div className="min-h-screen bg-[#FFF1EB] pb-32">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-white/50 shadow-sm px-4 py-3">
          <div className="max-w-lg mx-auto">
            <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  if (questionIdx === 0) {
                    setPhase("videos");
                  } else {
                    const prev = questionIdx - 1;
                    setQuestionIdx(prev);
                    setShowFeedback(answers[prev] !== undefined);
                  }
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
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
                  {currentSection.emoji} {currentSection.title} · {questionInSec + 1}/{currentSection.questions.length}
                </span>
              </div>
              <div />
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF7031] rounded-full transition-all duration-500"
                style={{ width: `${quizProgress}%` }}
              />
            </div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-8">
          {/* Número de pregunta */}
          <div className="flex items-center gap-2 mb-4">
            <div className={[
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 transition-colors",
              hasAnswered
                ? selectedAnswer === currentQ.correct
                  ? "bg-green-500 text-white"
                  : "bg-red-500 text-white"
                : "bg-[#120A2B] text-white",
            ].join(" ")}>
              {questionIdx + 1}
            </div>
            <p className="text-sm font-extrabold text-[#120A2B]/40 uppercase tracking-widest">
              Pregunta {questionIdx + 1} de {TOTAL_QUESTIONS}
            </p>
          </div>

          {/* Pregunta */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-5">
            <p className="text-base font-extrabold text-[#120A2B] leading-snug">
              {currentQ.text}
            </p>
          </div>

          {/* Opciones */}
          <div className="space-y-3 mb-6">
            {currentQ.options.map((opt, oi) => {
              const isSelected = selectedAnswer === oi;
              const isCorrect  = oi === currentQ.correct;
              let cls = "w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all leading-snug ";
              if (!hasAnswered) {
                cls += "border-gray-200 bg-white text-[#120A2B] hover:border-gray-300 hover:bg-gray-50";
              } else if (isCorrect) {
                cls += "border-green-500 bg-green-50 text-green-800 font-bold";
              } else if (isSelected && !isCorrect) {
                cls += "border-red-400 bg-red-50 text-red-700";
              } else {
                cls += "border-gray-100 bg-gray-50 text-gray-400";
              }

              return (
                <button
                  key={oi}
                  type="button"
                  disabled={hasAnswered}
                  onClick={() => selectAnswer(oi)}
                  className={cls}
                >
                  <span className="flex items-center gap-3">
                    <span className={[
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0",
                      !hasAnswered ? "bg-gray-100 text-gray-500" :
                      isCorrect    ? "bg-green-500 text-white" :
                      isSelected   ? "bg-red-400 text-white" :
                                     "bg-gray-100 text-gray-400",
                    ].join(" ")}>
                      {["A", "B", "C", "D"][oi]}
                    </span>
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {showFeedback && hasAnswered && (
            <div className={[
              "rounded-2xl p-4 border",
              selectedAnswer === currentQ.correct
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200",
            ].join(" ")}>
              <p className={[
                "text-sm font-extrabold mb-1",
                selectedAnswer === currentQ.correct ? "text-green-700" : "text-red-700",
              ].join(" ")}>
                {selectedAnswer === currentQ.correct ? "¡Correcto!" : "Incorrecto"}
              </p>
              <p className="text-sm text-[#4B5563]">{currentQ.rationale}</p>
            </div>
          )}
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
              onClick={nextQuestion}
              disabled={!hasAnswered || isPending}
              className={[
                "w-full py-4 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-2",
                hasAnswered && !isPending
                  ? "bg-[#FF7031] text-white hover:bg-[#e6652c] shadow-md active:scale-95"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
              ].join(" ")}
            >
              {isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              ) : isLastQuestion ? (
                "Enviar examen final"
              ) : (
                "Siguiente →"
              )}
            </button>
            {!hasAnswered && (
              <p className="text-xs text-center text-[#120A2B]/40">
                Selecciona una opción para continuar.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIDEOS SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  const watchedCount  = watchedIds.size;
  const allWatched    = watchedCount === TOTAL_VIDEOS;
  const videoProgress = (watchedCount / TOTAL_VIDEOS) * 100;

  return (
    <div className="min-h-screen bg-[#FFF1EB] pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-white/50 shadow-sm px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 mb-3">
            <Link
              href="/pawwer/dashboard"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="flex flex-col items-center gap-0.5">
              <Image
                src="/LogoPawwiCompleteOrange.svg"
                alt="Pawwi"
                width={80}
                height={26}
                style={{ width: "auto", height: "1.3rem" }}
              />
              <span className="text-[11px] text-[#120A2B]/50 font-semibold">
                Pawwi Academy
              </span>
            </div>
            <div />
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF7031] rounded-full transition-all duration-500"
              style={{ width: `${videoProgress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Saludo */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award size={20} className="text-[#FF7031]" />
            <h1 className="text-xl font-extrabold text-[#120A2B]">
              Pawwi Academy
            </h1>
          </div>
          <p className="text-sm text-[#6B7280]">
            Hola {firstName}, mira los {TOTAL_VIDEOS} videos antes de presentar el examen final.
          </p>
        </div>

        {/* Contador de progreso */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
          <div className={[
            "w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-base shrink-0 transition-colors",
            allWatched ? "bg-green-100 text-green-600" : "bg-[#FFF1EB] text-[#FF7031]",
          ].join(" ")}>
            {allWatched ? "✓" : `${watchedCount}/${TOTAL_VIDEOS}`}
          </div>
          <div>
            <p className="text-sm font-extrabold text-[#120A2B]">
              {allWatched ? "¡Todos los videos completados!" : `${watchedCount} de ${TOTAL_VIDEOS} videos vistos`}
            </p>
            <p className="text-xs text-[#6B7280]">
              {allWatched ? "Ya puedes presentar el examen final." : "Ve cada video y marca 'Listo' para continuar."}
            </p>
          </div>
        </div>

        {/* Lista de videos */}
        <div className="space-y-2">
          <p className="text-xs font-extrabold text-[#120A2B]/40 uppercase tracking-widest mb-3">
            Módulos de capacitación
          </p>
          {VIDEO_MODULES.map((mod, idx) => {
            const isWatched  = watchedIds.has(mod.id);
            const isExpanded = expandedId === mod.id;

            return (
              <div
                key={mod.id}
                className={[
                  "bg-white rounded-2xl border overflow-hidden transition-all",
                  isWatched
                    ? "border-green-200"
                    : isExpanded
                    ? "border-[#120A2B]/20"
                    : "border-gray-100",
                ].join(" ")}
              >
                {/* Card header */}
                <button
                  type="button"
                  onClick={() => toggleVideo(mod.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                >
                  {/* Number / check */}
                  <div className={[
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors text-sm font-extrabold",
                    isWatched
                      ? "bg-green-100 text-green-600"
                      : isExpanded
                      ? "bg-[#120A2B] text-white"
                      : "bg-gray-100 text-[#120A2B]/50",
                  ].join(" ")}>
                    {isWatched ? (
                      <CheckCircle2 size={16} className="text-green-600" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className={[
                      "text-sm font-semibold leading-snug",
                      isWatched ? "text-green-700" : "text-[#120A2B]",
                    ].join(" ")}>
                      {mod.title}
                    </p>
                    {!isWatched && (
                      <p className="text-xs text-[#9CA3AF] mt-0.5">{mod.duration}</p>
                    )}
                  </div>

                  {/* Expand chevron */}
                  <div className="text-[#120A2B]/25 shrink-0">
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </button>

                {/* Video expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${mod.youtubeId}?rel=0&modestbranding=1&playsinline=1`}
                        title={mod.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                      />
                    </div>
                    {!isWatched ? (
                      <button
                        type="button"
                        onClick={() => markWatched(mod.id)}
                        className="mt-3 w-full flex items-center justify-center gap-2 bg-[#120A2B] hover:bg-[#1e1145] text-white font-bold text-sm py-3 rounded-xl transition-colors"
                      >
                        <CheckCircle2 size={15} /> Listo — lección completada
                      </button>
                    ) : (
                      <p className="mt-3 text-center text-xs text-green-600 font-semibold">
                        Módulo completado
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-center text-[#120A2B]/30 pb-2">
          Gira el celular para ver los videos en pantalla completa.
        </p>
      </main>

      {/* Bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-4 z-30 shadow-[0_-8px_24px_rgba(18,10,43,0.08)]"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))" }}
      >
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setQuestionIdx(0);
              setShowFeedback(false);
              setPhase("quiz");
            }}
            disabled={!allWatched}
            className={[
              "w-full py-4 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-2",
              allWatched
                ? "bg-[#FF7031] text-white hover:bg-[#e6652c] shadow-md active:scale-95"
                : "bg-gray-100 text-gray-400 cursor-not-allowed",
            ].join(" ")}
          >
            {allWatched ? "Iniciar examen final" : `Completa los ${TOTAL_VIDEOS} videos para continuar`}
          </button>
          {!allWatched && (
            <p className="text-xs text-center text-[#120A2B]/40 mt-2">
              {TOTAL_VIDEOS - watchedCount} {TOTAL_VIDEOS - watchedCount === 1 ? "video restante" : "videos restantes"} antes del examen.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
