"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Botón de volver, en todas las pantallas del cliente.
 *
 * Decisión de Nicolás (2026-09-16): **siempre hay una salida visible.** El
 * design system decía que las pantallas-pestaña no llevan «volver» porque el
 * nav inferior ya navega, y eso es cierto en el portal del Pawwer, donde el
 * `BottomNav` se renderiza en el servidor y está desde el primer píxel. En el
 * cliente NO se cumple:
 *
 *  · `ClientNav` es un componente de cliente que devuelve `null` hasta que
 *    resuelve el rol con una consulta, así que **no está en el HTML inicial**:
 *    hay un instante sin ninguna salida.
 *  · `/mis-mascotas` y `/mis-mascotas/nueva` no están en `CLIENT_TAB_ROOTS`,
 *    así que **nunca** tienen nav. `docs/07` ya las llamaba «callejón sin
 *    salida» y seguían así.
 *
 * `router.back()` respeta de dónde vino el usuario, que es lo que espera. Si no
 * hay historial —entró por un enlace de correo, o abrió pestaña nueva— cae al
 * `fallback`, porque un botón de volver que no hace nada es peor que no tenerlo.
 */
export default function BackButton({
  fallback = "/",
  label = "Volver",
}: {
  fallback?: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="w-10 h-10 rounded-chip bg-white/80 backdrop-blur-md border border-white
                 flex items-center justify-center text-midnight shrink-0
                 shadow-card hover:bg-white active:scale-95 transition-all"
    >
      <ArrowLeft size={18} />
    </button>
  );
}
