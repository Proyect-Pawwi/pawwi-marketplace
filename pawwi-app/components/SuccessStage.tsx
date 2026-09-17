import type { ReactNode } from "react";

/**
 * El «escenario curvo» de las pantallas de éxito del cliente.
 *
 * Viene de los diseños de Nicolás (`13_success_pet`, `17_success_payment`), que
 * repetían la misma estructura: fondo cream arriba, un panel blanco con la
 * curva grande abajo, el sello con anillos de pulso, el texto y un CTA.
 *
 * Decisiones tomadas al traducirlo:
 *  · **El confeti cae UNA vez.** Los diseños alternaban `infinite` y
 *    `forwards`; se queda el segundo. Un bucle infinito es lo que encarecía los
 *    blobs y aquí además no aporta: se celebra una vez y se sigue.
 *  · **El tangerine no se usa aquí.** Criterio del 2026-09-16: lo celebratorio
 *    va en plum/rosa; el tangerine se reserva para lo interactivo y urgente.
 *  · `prefers-reduced-motion` lo cubre la regla global de `globals.css`.
 */

const CONFETTI = [
  { left: "14%", color: "bg-star",      delay: "0.45s" },
  { left: "34%", color: "bg-plum",      delay: "0.15s" },
  { left: "63%", color: "bg-success",   delay: "0.65s" },
  { left: "84%", color: "bg-rose",      delay: "0.35s" },
];

/**
 * El confeti, suelto, para pantallas que celebran sin ser un `SuccessStage`
 * entero (el detalle de una reserva ya pagada, por ejemplo). El contenedor debe
 * ser `relative` y, normalmente, `overflow-hidden`.
 */
export function Confetti() {
  return (
    <>
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className={`confetti-fall absolute top-0 w-2 h-2 rounded-[2px] ${c.color} z-20`}
          style={{ left: c.left, animationDelay: c.delay }}
        />
      ))}
    </>
  );
}

export function PulseRings({ className = "border-plum" }: { className?: string }) {
  return (
    <>
      <span
        aria-hidden
        className={`pulse-wave absolute top-1/2 left-1/2 w-full h-full rounded-full border-[3px] ${className}`}
      />
      <span
        aria-hidden
        className={`pulse-wave pulse-wave-2 absolute top-1/2 left-1/2 w-full h-full rounded-full border-[3px] ${className}`}
      />
    </>
  );
}

export default function SuccessStage({
  icon,
  title,
  description,
  children,
  confetti = true,
}: {
  icon: ReactNode;
  /** Admite saltos de línea con `<br />` desde el llamador. */
  title: ReactNode;
  description?: ReactNode;
  /** El CTA (o los que sean). Se pintan al pie del escenario. */
  children?: ReactNode;
  confetti?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col justify-end relative overflow-hidden">
      {confetti &&
        CONFETTI.map((c, i) => (
          <span
            key={i}
            aria-hidden
            className={`confetti-fall absolute top-0 w-2 h-2 rounded-[2px] ${c.color} z-20`}
            style={{ left: c.left, animationDelay: c.delay }}
          />
        ))}

      {/* El escenario. La curva es la firma de estas pantallas: un radio
          elíptico enorme arriba que convierte el panel en un «telón». */}
      <div
        className="enter enter-1 relative z-10 w-full bg-white px-8 pb-12 pt-16 text-center
                   flex flex-col items-center justify-center
                   shadow-[0_-20px_60px_rgba(18,10,43,0.06)]"
        style={{ borderRadius: "100% 100% 0 0 / 120px 120px 0 0", minHeight: "72vh" }}
      >
        <div className="pop-in relative w-[132px] h-[132px] flex items-center justify-center mb-8">
          <PulseRings />
          <div
            className="relative z-10 w-[104px] h-[104px] rounded-full bg-midnight
                       flex items-center justify-center text-plum
                       border-4 border-white shadow-[0_20px_50px_rgba(18,10,43,0.18)]"
          >
            {icon}
          </div>
        </div>

        <div className="enter enter-3">
          <h1 className="text-3xl font-black text-midnight leading-tight mb-4 text-balance">
            {title}
          </h1>
          {description && (
            <p className="text-base text-gray-500 font-medium leading-relaxed max-w-[19rem] mx-auto">
              {description}
            </p>
          )}
        </div>

        {children && <div className="enter enter-5 w-full mt-12 space-y-3">{children}</div>}
      </div>
    </div>
  );
}
