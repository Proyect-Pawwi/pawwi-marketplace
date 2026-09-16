/**
 * Shell compartido del portal del cliente.
 *
 * Existe por el mismo motivo que `app/pawwer/(portal)/layout.tsx`: antes de
 * esto, cada pantalla del cliente improvisaba su propio marco y salían cuatro
 * variantes del MISMO fondo —`bg-[#FFF1EB]`, `bg-cream`, con y sin `pb-32`, y
 * una que no lo declaraba—. Peor: solo 1 de 11 pantallas ponía `font-sans`, y
 * como el `body` por defecto es Montserrat, **diez pantallas del cliente
 * renderizaban en otra tipografía que el portal del Pawwer**. Eso, y no el
 * espaciado, era la razón principal de que pareciesen dos productos distintos.
 *
 * Aquí se resuelve de una vez: tipografía, fondo, atmósfera y el hueco del nav.
 *
 * Lo que este layout NO hace, a propósito:
 *  · No gatea la sesión. Cada pantalla se auto-gatea con `getUser()` y algunas
 *    son públicas; el gate del portal del Pawwer existe porque allí TODO exige
 *    `status = 'approved'`.
 *  · No monta `ClientNav`. Vive en `app/layout.tsx` porque la home (`/`) también
 *    es una pestaña y está fuera de este grupo, con su propio hero.
 */
export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream font-sans text-midnight relative overflow-x-hidden pb-32">
      {/* Atmósfera. ESTÁTICOS a propósito: animar un `blur-[90px]` en bucle era
          caro en móvil y el look no cambia (misma decisión que el portal). */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-[-10%] left-[-10%] w-[400px] h-[400px] bg-plum rounded-full mix-blend-multiply blur-[90px] opacity-40 z-0"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed top-[20%] right-[-20%] w-[300px] h-[300px] bg-tangerine rounded-full mix-blend-multiply blur-[90px] opacity-20 z-0"
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
