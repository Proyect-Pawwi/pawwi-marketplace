"use client";

import { useActionState } from "react";
import Link from "next/link";
import { recuperarContrasena, type RecuperarState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RecuperarForm() {
  const [state, action, pending] = useActionState<RecuperarState, FormData>(
    recuperarContrasena,
    undefined
  );

  if (state?.success) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">📬</div>
        <h2 className="text-lg font-bold text-midnight font-heading">
          Revisa tu email
        </h2>
        <p className="text-sm text-midnight/60 font-body leading-relaxed">
          Si ese email está registrado en Pawwi, recibirás un link para crear
          una nueva contraseña.
        </p>
        <Link
          href="/?modal=login"
          className="block text-sm text-midnight/50 font-body hover:text-tangerine"
        >
          Volver al login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.message && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-body">
          {state.message}
        </div>
      )}

      <p className="text-sm text-midnight/60 font-body">
        Ingresa tu email y te enviamos un link para crear una nueva contraseña.
      </p>

      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="tu@email.com"
        autoComplete="email"
        autoFocus
      />

      <Button type="submit" loading={pending} className="w-full mt-1">
        {pending ? "Enviando..." : "Enviar link"}
      </Button>

      <p className="text-center text-sm text-midnight/60 font-body">
        <Link href="/?modal=login" className="font-semibold text-midnight hover:text-tangerine">
          Volver al login
        </Link>
      </p>
    </form>
  );
}
