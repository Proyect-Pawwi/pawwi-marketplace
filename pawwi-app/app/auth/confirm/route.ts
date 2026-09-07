import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { safeNext } from "@/lib/safe-redirect";

// Handles both email confirmation and password recovery redirects from Supabase
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "email" | "recovery" | "magiclink" | null;
  const next = safeNext(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/?modal=login&error=token_invalido", origin));
}
