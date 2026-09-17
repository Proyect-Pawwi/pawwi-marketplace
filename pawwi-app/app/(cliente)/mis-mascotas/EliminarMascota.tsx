"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { eliminarMascota } from "@/app/actions/dogs";

/**
 * Borrar una mascota pedía UN clic, sin confirmación de ningún tipo. Un perro
 * registrado lleva su historial de reservas detrás y el dueño le tiene cariño
 * al dato — un roce con el pulgar no debería borrarlo.
 *
 * Se llama la acción desde un `useTransition` y no desde `<form action={…}>`
 * con `onSubmit`+`preventDefault`: ahí el `confirm` y el manejo de envío de
 * React se pisaban, y el borrado no llegaba a salir. Así es explícito —
 * confirmar, luego llamar— y además da estado de «borrando», que antes no
 * existía: el botón no daba ninguna señal de haber sido pulsado.
 *
 * Se queda en un `confirm` del navegador a propósito, y no en una hoja inferior
 * con «escribe ELIMINAR» como la de cerrar la cuenta del Pawwer: aquí el daño
 * es recuperable —se vuelve a agregar— y la fricción debe ser proporcional.
 */
export default function EliminarMascota({ dogId, nombre }: { dogId: string; nombre: string }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={pendiente}
      aria-label={`Eliminar a ${nombre}`}
      onClick={() => {
        if (!window.confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;
        iniciar(async () => {
          try {
            await eliminarMascota(dogId);
          } catch (e) {
            // Un `redirect()` del servidor llega aquí como excepción y Next lo
            // maneja; cualquier OTRA cosa es un fallo real y no se traga.
            if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
            console.error("[Pawwi] eliminarMascota:", e);
          }
        });
      }}
      className="w-9 h-9 rounded-chip border border-red-100 bg-white flex items-center justify-center
                 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50"
    >
      {pendiente
        ? <Loader2 size={14} className="text-red-400 animate-spin" />
        : <Trash2 size={14} className="text-red-400" />}
    </button>
  );
}
