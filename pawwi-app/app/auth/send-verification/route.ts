import { resend } from "../../../lib/resend";
import { verificationEmail } from "../../../lib/emails/verification";

export async function POST(req: Request) {
  const { email, verificationUrl } =
    await req.json();

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Verifica tu cuenta",
    html: verificationEmail(
      verificationUrl
    ),
  });

  return Response.json({
    success: true,
  });
}