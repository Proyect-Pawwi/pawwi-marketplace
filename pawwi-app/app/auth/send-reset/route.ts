import { resend } from "../../../lib/resend";
import { resetPasswordEmail } from "../../../lib/emails/reset-password";

export async function POST(req: Request) {
  const { email, resetUrl } =
    await req.json();

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Recuperar contraseña",
    html: resetPasswordEmail(
      resetUrl
    ),
  });

  return Response.json({
    success: true,
  });
}