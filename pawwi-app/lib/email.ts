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

// Envía emails usando la API de Resend directamente (sin paquete npm).
// Requiere RESEND_API_KEY en .env.local
// y dominio verificado en Resend (usar on-boarding@pawwi.co o similar).
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
}
