"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { iniciarSesion, type LoginState } from "@/app/actions/auth";
import { createClient } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const ERROR_MESSAGES: Record<string, string> = {
  token_invalido: "El link expiró o ya se usó. Intenta de nuevo.",
};

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(iniciarSesion, undefined);
  const [googlePending, setGooglePending] = useState(false);

  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const urlError = searchParams.get("error");
  const registroHref = `/?modal=registro${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  // Login OK → recarga DURA a `next`. Un reload completo hace que el home y el
  // proxy relean la sesión recién creada (evita el estado "logueado a medias").
  useEffect(() => {
    if (state?.success) window.location.assign(state.next || "/");
  }, [state]);

  async function handleGoogle() {
    setGooglePending(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next ?? "/")}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setGooglePending(false); // si falla, reactivar; si no, redirige fuera
  }

  const busy = pending || !!state?.success;

  return (
    <form action={action} className="flex flex-col gap-5">
      {next && <input type="hidden" name="next" value={next} />}

      {(state?.message || (urlError && ERROR_MESSAGES[urlError])) && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-body">
          {state?.message ?? ERROR_MESSAGES[urlError!]}
        </div>
      )}

      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="tu@email.com"
        autoComplete="email"
        error={state?.errors?.email?.[0]}
      />

      <div className="flex flex-col gap-1.5">
        <Input
          label="Contraseña"
          name="password"
          type="password"
          placeholder="Tu contraseña"
          autoComplete="current-password"
          error={state?.errors?.password?.[0]}
        />
        <div className="flex justify-end">
          <Link
            href="/?modal=recuperar"
            className="text-xs text-midnight/50 font-body hover:text-tangerine"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>

      <Button type="submit" loading={busy} className="w-full mt-1">
        {busy ? "Ingresando..." : "Ingresar"}
      </Button>

      <div className="relative flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-midnight/10" />
        <span className="text-sm text-midnight/40 font-body">o</span>
        <div className="flex-1 h-px bg-midnight/10" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googlePending || busy}
        className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-semibold text-midnight font-body disabled:opacity-60"
      >
        {/* Google "G" logo */}
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.3z"/>
          <path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.9-6c-2.2 1.5-5 2.3-8.1 2.3-6.2 0-11.5-4.2-13.4-9.9H2.5v6.2C6.5 42.5 14.7 48 24 48z"/>
          <path fill="#FBBC05" d="M10.6 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6v-6.2H2.5C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l8.1-6.2z"/>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.9 2.3 30.4 0 24 0 14.7 0 6.5 5.5 2.5 13.2l8.1 6.2C12.5 13.7 17.8 9.5 24 9.5z"/>
        </svg>
        {googlePending ? "Redirigiendo..." : "Continuar con Google"}
      </button>

      <p className="text-center text-sm text-midnight/60 font-body">
        ¿No tienes cuenta?{" "}
        <Link href={registroHref} className="font-semibold text-midnight hover:text-tangerine">
          Créala gratis
        </Link>
      </p>
    </form>
  );
}
