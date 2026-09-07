"use client";

import { useActionState } from "react";
import Link from "next/link";
import { iniciarSesionPawwer, type LoginPawwerState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPawwerForm() {
  const [state, action, pending] = useActionState<LoginPawwerState, FormData>(
    iniciarSesionPawwer,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.message && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-body">
          {state.message}{" "}
          {state.message.includes("cliente") && (
            <Link href="/login" className="underline font-semibold">
              Ingresar aquí
            </Link>
          )}
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
            href="/recuperar"
            className="text-xs text-midnight/50 font-body hover:text-tangerine"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>

      <Button type="submit" loading={pending} className="w-full mt-1">
        {pending ? "Ingresando..." : "Ingresar al panel"}
      </Button>

      <p className="text-center text-xs text-midnight/50 font-body">
        ¿Eres cliente?{" "}
        <Link href="/login" className="font-semibold text-midnight hover:text-tangerine">
          Ingresa aquí
        </Link>
      </p>
    </form>
  );
}
