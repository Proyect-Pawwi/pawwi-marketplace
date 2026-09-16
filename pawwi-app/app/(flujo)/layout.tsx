/**
 * Shell del flujo de reserva: el asistente de cuatro pasos y el detalle de la
 * reserva (donde se paga).
 *
 * Son pantallas PROFUNDAS, no pestañas: traen su propia cabecera con «volver»
 * y su propio pie fijo con el CTA. Por eso este shell se parece al del grupo
 * `(cliente)` pero **sin `pb-32`** — el hueco del nav inferior sobra aquí y
 * dejaba un vacío al final del asistente.
 *
 * Lo que aporta es lo que faltaba en las dos: `font-sans` —sin él el texto
 * salía en Montserrat, no en Jakarta— y un fondo declarado una sola vez.
 * `booking/nuevo` directamente no declaraba fondo.
 */
export default function FlujoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream font-sans text-midnight relative overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed top-[-10%] right-[-15%] w-[340px] h-[340px] bg-plum rounded-full mix-blend-multiply blur-[90px] opacity-35 z-0"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-[5%] left-[-15%] w-[260px] h-[260px] bg-tangerine rounded-full mix-blend-multiply blur-[90px] opacity-15 z-0"
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
