// Skeletons de navegación del portal. Sin "use client" (solo CSS `animate-pulse`)
// → los loading.tsx los streamean al instante mientras carga el server component.
// El layout del portal (blobs + BottomNav) ya envuelve estos skeletons.

function Pulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[#120A2B]/10 rounded-full ${className}`} />;
}

// Tarjeta silueta: chip + título + N líneas.
export function SkeletonCard({ className = "", lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={`bg-white rounded-[28px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl bg-[#120A2B]/10 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-3 w-1/2" />
          <Pulse className="h-2.5 w-1/3" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Pulse key={i} className={`h-2.5 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

// Header estilo pantalla-tab: micro-label + título + chip de ícono (sin "volver").
export function PortalTabHeaderSkeleton({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <header className="relative z-20 pt-12 pb-4">
      <div className="max-w-xl mx-auto px-6">
        <Pulse className="h-2.5 w-24 mb-3" />
        <div className="flex items-end justify-between gap-3">
          <Pulse className="h-8 w-40 rounded-2xl" />
          <div className="w-11 h-11 rounded-2xl bg-[#120A2B]/10 animate-pulse shrink-0" />
        </div>
        {subtitle && <Pulse className="h-3 w-3/5 mt-3" />}
      </div>
    </header>
  );
}

// Pantalla-tab completa: header + N tarjetas.
export default function PortalSkeleton({ cards = 3, subtitle = false }: { cards?: number; subtitle?: boolean }) {
  return (
    <div className="min-h-screen relative font-sans">
      <PortalTabHeaderSkeleton subtitle={subtitle} />
      <main className="relative z-10 max-w-xl mx-auto px-6 pb-10 space-y-4">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} lines={i === 0 ? 2 : 3} />
        ))}
      </main>
    </div>
  );
}
