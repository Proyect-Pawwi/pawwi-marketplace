// Escapa valores controlados por el usuario antes de interpolarlos en HTML
// de emails (nombre, email, etc.) para evitar inyección de markup.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Adónde llegan los avisos para el equipo: reembolsos por hacer, preselecciones.
// Antes el fallback era luisa@pawwi.co, y Luisa ya no está en el proyecto.
export const ADMIN_EMAIL = process.env.PAWWI_ADMIN_EMAIL || "hola@pawwi.co";

// Envía emails usando la API de Resend directamente (sin paquete npm).
// Requiere RESEND_API_KEY en .env.local
// y dominio verificado en Resend (usar on-boarding@pawwi.co o similar).
//
// Nunca lanza: un correo que falla no puede tumbar la acción que lo manda. Antes
// un error de red subía hasta el server action DESPUÉS de haber cambiado el
// estado — el Pawwer veía «error» con el examen ya registrado.
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[Pawwi email] RESEND_API_KEY no configurado — email omitido:", opts.subject);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Pawwi <hola@pawwi.co>",
        ...opts,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      console.error("[Pawwi email] Error Resend:", res.status, body);
    }
  } catch (err) {
    console.error("[Pawwi email] Resend no respondió:", opts.subject, err);
  }
}

// Plantilla mínima y funcional: título, párrafos y un botón. Los textos que
// vengan del usuario se escapan antes de llegar aquí.
export function emailLayout(opts: { title: string; paragraphs: string[]; cta?: { label: string; href: string } }) {
  const button = opts.cta
    ? `<a href="${opts.cta.href}" style="display:inline-block;margin-top:16px;background:#FF7031;color:#fff;font-weight:bold;padding:12px 28px;border-radius:999px;text-decoration:none">${opts.cta.label}</a>`
    : "";
  return `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#120A2B">
      <img src="https://app.pawwi.co/LogoPawwiCompleteOrange.svg" alt="Pawwi" height="32" style="margin-bottom:24px" />
      <h2 style="font-size:22px;margin-bottom:8px">${opts.title}</h2>
      ${opts.paragraphs.map((p) => `<p style="color:#4B5563">${p}</p>`).join("")}
      ${button}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0" />
      <p style="font-size:12px;color:#9CA3AF">Pawwi SAS · Bogotá · <a href="https://pawwi.co" style="color:#FF7031">pawwi.co</a></p>
    </div>
  `;
}
