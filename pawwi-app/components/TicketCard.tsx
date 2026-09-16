import type { ReactNode } from "react";

/**
 * La tarjeta-billete de los diseños de Nicolás (`21_ready_ticket`).
 *
 * La metáfora funciona: una reserva confirmada ES un billete —tiene un titular,
 * un trayecto, una hora y un importe— y las muescas laterales con el separador
 * punteado lo dicen sin una palabra.
 *
 * Cómo está hecha la muesca: un círculo del color del FONDO (cream), medio
 * fuera de la tarjeta, sobre el separador punteado. Por eso este componente
 * **asume fondo cream**, que es lo que dan los layouts del cliente. Sobre otro
 * fondo la muesca se notaría; si algún día hace falta, se cambia por una
 * máscara con `radial-gradient`.
 */

function Separator() {
  return (
    <div className="relative h-px w-full border-b-2 border-dashed border-gray-100">
      <span aria-hidden className="absolute -left-[11px] -top-[10px] w-5 h-5 rounded-full bg-cream" />
      <span aria-hidden className="absolute -right-[11px] -top-[10px] w-5 h-5 rounded-full bg-cream" />
    </div>
  );
}

export default function TicketCard({
  header,
  children,
  footerLabel,
  footerValue,
}: {
  /** La zona de identidad: quién presta el servicio, su nivel, el servicio. */
  header: ReactNode;
  /** El cuerpo: dirección, fechas, mascotas… lo que aplique. */
  children: ReactNode;
  /** Pie del billete. Si no se pasa `footerValue`, el pie no se pinta. */
  footerLabel?: string;
  footerValue?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden relative">
      <div className="p-5">{header}</div>

      <Separator />

      <div className="px-5 py-6">{children}</div>

      {footerValue != null && (
        <>
          <Separator />
          <div className="px-5 py-5 bg-gray-50/80 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-500">{footerLabel}</span>
            <span className="text-2xl font-black text-midnight">{footerValue}</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Fila de dato del cuerpo del billete: ícono en caja de color + etiqueta +
 * valor, y un enlace opcional (p. ej. «Ver en mapa»).
 */
export function TicketRow({
  icon,
  label,
  children,
  action,
  tone = "rose",
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  action?: ReactNode;
  tone?: "rose" | "blue" | "plum";
}) {
  const tones = {
    rose: "bg-rose-soft text-rose",
    blue: "bg-[#E0F2FE] text-[#0284C7]",
    plum: "bg-plum/25 text-[#7B2D8E]",
  } as const;

  return (
    <div className="flex gap-3 bg-gray-50/80 p-3 rounded-2xl">
      <div className={`w-10 h-10 rounded-chip shrink-0 flex items-center justify-center ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-gray-400">{label}</p>
        <p className="text-[0.95rem] font-semibold leading-snug mt-0.5">{children}</p>
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}

/** Rejilla de dos columnas para los datos cortos: fecha, mascotas, horas. */
export function TicketGrid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 gap-y-5">
      {items.map((it) => (
        <div key={it.label}>
          <p className="text-xs text-gray-500 mb-1">{it.label}</p>
          <strong className="text-base font-bold text-midnight">{it.value}</strong>
        </div>
      ))}
    </div>
  );
}
