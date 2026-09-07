"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { registrarCliente, type RegistroState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegistroForm() {
  const [state, action, pending] = useActionState<RegistroState, FormData>(
    registrarCliente,
    undefined
  );
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const loginHref = `/?modal=login${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  return (
    <form action={action} className="flex flex-col gap-5">
      {next && <input type="hidden" name="next" value={next} />}

      {state?.message && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-body">
          {state.message}
        </div>
      )}

      <Input
        label="Nombre completo"
        name="nombre"
        placeholder="¿Cómo te llamas?"
        autoComplete="name"
        maxLength={60}
        error={state?.errors?.nombre?.[0]}
      />

      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="tu@email.com"
        autoComplete="email"
        error={state?.errors?.email?.[0]}
      />

      <Input
        label="Teléfono celular"
        name="telefono"
        type="tel"
        placeholder="3001234567 (sin +57)"
        autoComplete="tel"
        maxLength={10}
        error={state?.errors?.telefono?.[0]}
      />

      <Input
        label="Contraseña"
        name="password"
        type="password"
        placeholder="Mínimo 8 caracteres y 1 número"
        autoComplete="new-password"
        error={state?.errors?.password?.[0]}
      />

      {/* Términos */}
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="terminos"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-midnight/30 accent-tangerine"
          />
          <span className="text-sm text-midnight/70 font-body leading-relaxed">
            Acepto los{" "}
            <Link href="/terminos" className="text-midnight underline hover:text-tangerine">
              Términos de Servicio
            </Link>{" "}
            y la{" "}
            <Link href="/privacidad" className="text-midnight underline hover:text-tangerine">
              Política de Privacidad
            </Link>{" "}
            de Pawwi
          </span>
        </label>
        {state?.errors?.terminos && (
          <p className="text-sm text-red-500 font-body">{state.errors.terminos[0]}</p>
        )}
      </div>

      <Button type="submit" loading={pending} className="w-full mt-1">
        {pending ? "Creando tu cuenta..." : "Crear cuenta"}
      </Button>

      <div className="relative flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-midnight/10" />
        <span className="text-sm text-midnight/40 font-body">o</span>
        <div className="flex-1 h-px bg-midnight/10" />
      </div>

      <p className="text-center text-sm text-midnight/60 font-body">
        ¿Ya tienes cuenta?{" "}
        <Link href={loginHref} className="font-semibold text-midnight hover:text-tangerine">
          Ingresa aquí
        </Link>
      </p>
    </form>
  );
}
