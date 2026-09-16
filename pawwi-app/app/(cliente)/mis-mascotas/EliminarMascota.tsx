"use client";

import { Trash2 } from "lucide-react";
import { eliminarMascota } from "@/app/actions/dogs";

/**
 * Borrar una mascota pedía UN clic, sin confirmación de ningún tipo: el
 * formulario enviaba la acción directamente. Un perro registrado lleva su
 * historial de reservas detrás y el dueño le tiene cariño al dato — un roce con
 * el pulgar no debería borrarlo.
 *
 * Se queda en un `confirm` del navegador a propósito, y no en una hoja inferior
 * con «escribe ELIMINAR» como la de cerrar la cuenta del Pawwer: aquí el daño es
 * recuperable —se vuelve a agregar— y la fricción tiene que ser proporcional.
 */
export default function EliminarMascota({ dogId, nombre }: { dogId: string; nombre: string }) {
  return (
    <form
      action={eliminarMascota.bind(null, dogId)}
      onSubmit={(e) => {
        if (!window.confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        aria-label={`Eliminar a ${nombre}`}
        className="w-9 h-9 rounded-chip border border-red-100 bg-white flex items-center justify-center
                   hover:bg-red-50 active:scale-95 transition-all"
      >
        <Trash2 size={14} className="text-red-400" />
      </button>
    </form>
  );
}
