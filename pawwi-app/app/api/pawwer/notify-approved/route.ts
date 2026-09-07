import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, escapeHtml } from "@/lib/email";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;   // sin fallback a anon
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const secret = process.env.PAWWI_WEBHOOK_SECRET;

  // Fail-closed: sin secret o sin service role configurados, el endpoint no opera.
  // (Antes era fail-open: si faltaba el secret, quedaba público.)
  if (!secret || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[notify-approved] PAWWI_WEBHOOK_SECRET o SUPABASE_SERVICE_ROLE_KEY sin configurar");
    return NextResponse.json({ error: "Endpoint no configurado" }, { status: 503 });
  }
  if (req.headers.get("x-pawwi-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { user_id?: string; email?: string };
  try {
    const text = await req.text();
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { user_id, email = "" } = body;
  if (!user_id) {
    return NextResponse.json({ error: "user_id requerido" }, { status: 400 });
  }

  const supabase = adminClient();

  const { data: pawwer, error: updateErr } = await supabase
    .from("pawwer")
    .update({ status: "exam_ready" })
    .eq("id", user_id)
    .eq("status", "pending_review")
    .select("id, status")
    .single();

  if (updateErr || !pawwer) {
    console.error("[notify-approved]", updateErr?.message);
    return NextResponse.json({ error: "Pawwer no encontrado" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profile")
    .select("name")
    .eq("id", user_id)
    .single();

  const nombre = profile?.name ?? "Pawwer";
  const appUrl = process.env.PAWWI_URL ?? "https://app.pawwi.co";

  if (email) {
    await sendEmail({
      to: email,
      subject: "Tu cédula fue verificada — completa el examen psicotécnico",
      html: `
        <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#120A2B">
          <img src="${appUrl}/LogoPawwiCompleteOrange.svg" alt="Pawwi" height="32" style="margin-bottom:24px" />
          <h2 style="font-size:22px;margin-bottom:8px">¡Hola ${escapeHtml(nombre)}! 🎉</h2>
          <p style="color:#4B5563">
            Tu <strong>cédula de ciudadanía fue verificada</strong> exitosamente por el equipo Pawwi.
          </p>
          <p style="color:#4B5563">
            El siguiente paso es completar el <strong>examen psicotécnico</strong>, que toma aproximadamente 5 minutos.
            Entra a tu panel y comienza cuando estés listo/a.
          </p>
          <a href="${appUrl}/pawwer/examen"
             style="display:inline-block;margin-top:16px;background:#FF7031;color:#fff;font-weight:bold;padding:12px 28px;border-radius:999px;text-decoration:none">
            Hacer el examen →
          </a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0" />
          <p style="font-size:12px;color:#9CA3AF">
            Pawwi SAS · Bogotá · <a href="https://pawwi.co" style="color:#FF7031">pawwi.co</a>
          </p>
        </div>
      `,
    });
  }

  return NextResponse.json({ ok: true, status: "exam_ready" });
}
