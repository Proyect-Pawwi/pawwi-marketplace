"use server";

import { createClient } from "@/lib/server";
import { calcularPuntaje, clasificarResultado, EXAM_SECTIONS } from "@/lib/exam-pawwer";
import { sendEmail, escapeHtml } from "@/lib/email";

export type ExamResult =
  | { ok: true; result: "preselected" | "needs_review" | "rejected" }
  | { error: string };

export async function submitExamen(
  answers: Record<string, number>,
): Promise<ExamResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  // Verificar que todas las preguntas fueron contestadas
  const allIds = EXAM_SECTIONS.flatMap((s) => s.questions.map((q) => q.id));
  const missing = allIds.filter((id) => answers[id] === undefined);
  if (missing.length > 0) {
    return { error: "Hay preguntas sin responder. Revisa antes de enviar." };
  }

  // Obtener pawwer
  const { data: pawwer } = await supabase
    .from("pawwer")
    .select("id, status")
    .eq("id", user.id)
    .single();

  if (!pawwer) return { error: "No encontramos tu perfil de Pawwer." };
  if (pawwer.status !== "exam_ready") {
    return { error: "No puedes tomar el examen en este momento." };
  }

  const totalScore = calcularPuntaje(answers);
  const result     = clasificarResultado(totalScore);

  // Guardar resultado y actualizar estado (transacción implícita por orden)
  const { error: insertErr } = await supabase.from("exam_results").insert({
    pawwer_id:   pawwer.id,
    user_id:     user.id,
    responses:   answers,
    total_score: totalScore,
    result,
  });

  if (insertErr) {
    // Duplicate = ya lo tomó
    if (insertErr.code === "23505") return { error: "Ya completaste el examen." };
    console.error("[Pawwi exam] insert:", insertErr.message);
    return { error: "No se pudo guardar tu examen. Intenta de nuevo." };
  }

  const { error: updateErr } = await supabase.rpc("set_pawwer_exam_result", {
    p_result: result,
  });

  if (updateErr) {
    console.error("[Pawwi exam] status update:", updateErr.message);
    return { error: "No se pudo actualizar tu estado. Contacta a hola@pawwi.co." };
  }

  // Datos del perfil para los emails
  const { data: profile } = await supabase
    .from("profile")
    .select("name")
    .eq("id", user.id)
    .single();

  const nombre   = profile?.name ?? "Pawwer";
  const emailTo  = user.email ?? "";
  const adminEmail = process.env.PAWWI_ADMIN_EMAIL ?? "luisa@pawwi.co";

  // Email al Pawwer
  if (emailTo) {
    if (result === "preselected") {
      await sendEmail({
        to: emailTo,
        subject: "¡Felicitaciones! Fuiste preseleccionado como Pawwer 🎉",
        html: emailPreseleccionado(nombre),
      });
    } else if (result === "needs_review") {
      await sendEmail({
        to: emailTo,
        subject: "Tu evaluación Pawwi está en revisión",
        html: emailRevision(nombre),
      });
    } else {
      await sendEmail({
        to: emailTo,
        subject: "Resultado de tu evaluación Pawwi",
        html: emailRechazado(nombre),
      });
    }
  }

  // Email al equipo Pawwi cuando hay preselección
  if (result === "preselected") {
    await sendEmail({
      to: adminEmail,
      subject: `Nuevo Pawwer preseleccionado: ${escapeHtml(nombre)}`,
      html: emailAdminPreseleccion(nombre, emailTo, totalScore),
    });
  }

  return { ok: true, result };
}

// ── Plantillas de email ───────────────────────────────────────────────────────

function emailPreseleccionado(nombre: string) {
  return `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#120A2B">
      <img src="https://pawwi.co/LogoPawwiCompleteOrange.svg" alt="Pawwi" height="32" style="margin-bottom:24px" />
      <h2 style="font-size:22px;margin-bottom:8px">¡Hola ${escapeHtml(nombre)}! 🎉</h2>
      <p style="color:#4B5563">Completaste el examen psicotécnico y <strong>fuiste preseleccionado/a</strong> como Pawwer.</p>
      <p style="color:#4B5563">El equipo Pawwi se pondrá en contacto contigo pronto para coordinar la <strong>capacitación virtual y la visita al hogar</strong>.</p>
      <p style="color:#4B5563">¡Estamos muy contentos de tenerte en la comunidad! 🐾</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0" />
      <p style="font-size:12px;color:#9CA3AF">Pawwi SAS · Bogotá · <a href="https://pawwi.co" style="color:#FF7031">pawwi.co</a></p>
    </div>
  `;
}

function emailRevision(nombre: string) {
  return `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#120A2B">
      <img src="https://pawwi.co/LogoPawwiCompleteOrange.svg" alt="Pawwi" height="32" style="margin-bottom:24px" />
      <h2 style="font-size:22px;margin-bottom:8px">Hola ${escapeHtml(nombre)}</h2>
      <p style="color:#4B5563">Gracias por completar el examen psicotécnico de Pawwi.</p>
      <p style="color:#4B5563">Tu evaluación queda <strong>en revisión</strong> por nuestro equipo. Te contactaremos en los próximos días con el resultado y los próximos pasos.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0" />
      <p style="font-size:12px;color:#9CA3AF">Pawwi SAS · Bogotá · <a href="https://pawwi.co" style="color:#FF7031">pawwi.co</a></p>
    </div>
  `;
}

function emailRechazado(nombre: string) {
  return `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#120A2B">
      <img src="https://pawwi.co/LogoPawwiCompleteOrange.svg" alt="Pawwi" height="32" style="margin-bottom:24px" />
      <h2 style="font-size:22px;margin-bottom:8px">Hola ${escapeHtml(nombre)}</h2>
      <p style="color:#4B5563">Gracias por tu interés en unirte a Pawwi y por el tiempo que dedicaste a la evaluación.</p>
      <p style="color:#4B5563">En este momento <strong>tu perfil no cumple los requisitos</strong> para ser Pawwer. Podrás volver a postularte en <strong>6 meses</strong>.</p>
      <p style="color:#4B5563">Si tienes preguntas, escríbenos a <a href="mailto:hola@pawwi.co" style="color:#FF7031">hola@pawwi.co</a>.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0" />
      <p style="font-size:12px;color:#9CA3AF">Pawwi SAS · Bogotá · <a href="https://pawwi.co" style="color:#FF7031">pawwi.co</a></p>
    </div>
  `;
}

function emailAdminPreseleccion(nombre: string, email: string, score: number) {
  return `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#120A2B">
      <h2 style="font-size:20px;margin-bottom:8px">Nuevo Pawwer preseleccionado 🐾</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#6B7280">Nombre</td><td style="font-weight:bold">${escapeHtml(nombre)}</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280">Email</td><td>${escapeHtml(email)}</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280">Puntaje</td><td style="font-weight:bold;color:#FF7031">${score} / 95</td></tr>
      </table>
      <p style="margin-top:20px;color:#4B5563">El próximo paso es coordinar la <strong>capacitación y visita al hogar</strong>.</p>
    </div>
  `;
}
