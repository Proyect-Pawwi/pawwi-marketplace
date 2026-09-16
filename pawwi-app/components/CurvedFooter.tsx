import type { ReactNode } from "react";

/**
 * Pie curvo con el CTA, de los diseños de Nicolás (`15_summary`,
 * `21_ready_ticket`). La curva suave arriba separa la acción del contenido sin
 * necesidad de una línea ni una sombra dura.
 *
 * Va DENTRO del flujo, no fijo: en el asistente de reserva y en el resumen el
 * contenido se desplaza y la acción cierra la página. Para una barra realmente
 * fija —como la del perfil público en móvil— eso ya existe en su pantalla y no
 * necesita este componente.
 */
export default function CurvedFooter({ children }: { children: ReactNode }) {
  return (
    <div
      className="bg-white px-6 pt-8 pb-10 mt-auto relative z-10 flex flex-col gap-3
                 shadow-[0_-10px_30px_rgba(18,10,43,0.03)]"
      style={{ borderRadius: "50% 50% 0 0 / 35px 35px 0 0" }}
    >
      {children}
    </div>
  );
}
