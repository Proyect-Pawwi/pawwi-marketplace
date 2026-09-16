/**
 * Shell de las pantallas de entrada: login, registro, recuperar contraseña,
 * nueva contraseña y bienvenida.
 *
 * Existía ya, pero copiado a mano: las CINCO repetían literalmente
 * `min-h-screen bg-cream flex items-center justify-center px-4 py-12
 * overflow-hidden`. Un layout que ya estaba escrito cinco veces es un layout
 * que pide existir — y así ninguna vuelve a desviarse (ni a quedarse sin
 * `font-sans`, que era el defecto real: el `body` por defecto es Montserrat).
 *
 * Aquí no hay nav ni `pb-32`: son pantallas de una sola tarea, centradas.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream font-sans text-midnight flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Atmósfera estática, como en el resto del producto */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-15%] left-[-15%] w-[360px] h-[360px] bg-plum rounded-full mix-blend-multiply blur-[90px] opacity-40 z-0"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-10%] right-[-15%] w-[280px] h-[280px] bg-tangerine rounded-full mix-blend-multiply blur-[90px] opacity-20 z-0"
      />

      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
