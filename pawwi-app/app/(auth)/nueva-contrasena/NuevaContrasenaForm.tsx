"use client";

import { useActionState, useEffect, useState } from "react";
import { actualizarContrasena, type NuevaContrasenaState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";

function getStrength(pwd: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pwd.length === 0) return { level: 0, label: "", color: "" };
  const long    = pwd.length >= 8;
  const hasNum  = /[0-9]/.test(pwd);
  const hasCap  = /[A-Z]/.test(pwd);
  const score   = [long, hasNum, hasCap].filter(Boolean).length;
  if (score === 1) return { level: 1, label: "Débil",   color: "bg-red-400" };
  if (score === 2) return { level: 2, label: "Regular", color: "bg-yellow-400" };
  return           { level: 3, label: "Segura",  color: "bg-green-500" };
}

export default function NuevaContrasenaForm() {
  const [state, action, pending] = useActionState<NuevaContrasenaState, FormData>(
    actualizarContrasena,
    undefined
  );
  const [pwd, setPwd] = useState("");
  const strength = getStrength(pwd);
  const done = !!state?.success;

  // Contraseña actualizada (sesión establecida por el recovery) → recarga dura al home.
  useEffect(() => {
    if (state?.success) window.location.assign("/");
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.message && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-body">
          {state.message}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-midnight font-body">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          autoFocus
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-midnight font-body outline-none focus:border-tangerine focus:ring-1 focus:ring-tangerine transition"
        />

        {/* Strength bar */}
        {pwd.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i <= strength.level ? strength.color : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <p className={`text-xs font-medium font-body ${
              strength.level === 1 ? "text-red-500"
              : strength.level === 2 ? "text-yellow-600"
              : "text-green-600"
            }`}>
              {strength.label}
            </p>
          </div>
        )}

        {state?.errors?.password && (
          <p className="text-xs text-red-500 font-body">{state.errors.password[0]}</p>
        )}

        <ul className="text-xs text-midnight/50 font-body space-y-0.5 mt-0.5">
          <li className={pwd.length >= 8 ? "text-green-600" : ""}>• Mínimo 8 caracteres</li>
          <li className={/[0-9]/.test(pwd) ? "text-green-600" : ""}>• Al menos un número</li>
          <li className={/[A-Z]/.test(pwd) ? "text-green-600" : ""}>• Al menos una mayúscula</li>
        </ul>
      </div>

      <Button
        type="submit"
        loading={pending || done}
        disabled={strength.level < 3}
        className="w-full mt-1"
      >
        {pending || done ? "Actualizando..." : "Actualizar contraseña"}
      </Button>
    </form>
  );
}
