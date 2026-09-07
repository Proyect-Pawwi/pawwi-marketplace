"use server";

import { createClient } from "@/lib/server";
import { QUIZ_SECTIONS, PASSING_SCORE, TOTAL_QUESTIONS } from "@/lib/capacitacion";

export type CapacitacionResult =
  | { ok: true; passed: boolean; score: number }
  | { error: string };

// Recibe las respuestas seleccionadas (un índice por pregunta) y recalcula el
// puntaje en el servidor — el cliente nunca envía el score, evitando spoofing.
export async function submitCapacitacion(answers: number[]): Promise<CapacitacionResult> {
  if (!Array.isArray(answers) || answers.length !== TOTAL_QUESTIONS) {
    return { error: "Respuestas inválidas." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { data: pawwer } = await supabase
    .from("pawwer")
    .select("id, status")
    .eq("id", user.id)
    .single();

  if (!pawwer) return { error: "No encontramos tu perfil de Pawwer." };
  if (pawwer.status === "approved" || pawwer.status === "visita_pendiente") {
    return { error: "Ya completaste la capacitación." };
  }
  if (pawwer.status !== "preselected") {
    return { error: "No tienes acceso a la capacitación en este momento." };
  }

  // Recalcular el puntaje contra la clave de respuestas (server-side)
  const answerKey = QUIZ_SECTIONS.flatMap((s) => s.questions).map((q) => q.correct);
  const score = answerKey.reduce((acc, correct, i) => acc + (answers[i] === correct ? 1 : 0), 0);
  const passed = score >= PASSING_SCORE;

  const { error: rpcErr } = await supabase.rpc("set_pawwer_capacitacion_result", {
    p_score:  score,
    p_passed: passed,
  });

  if (rpcErr) {
    console.error("[Pawwi capacitación]", rpcErr.message);
    return { error: "No se pudo guardar tu resultado. Intenta de nuevo." };
  }

  return { ok: true, passed, score };
}
