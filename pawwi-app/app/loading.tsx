// La home pasó a resolverse en el servidor (sesión + Pawwers + favoritos), así
// que ahora hay un intervalo de servidor que cubrir. Sin esto sería pantalla en
// blanco — que es peor que el parpadeo que acabamos de quitar.
//
// La silueta imita el bloque de hogares, no una pantalla-tab: la home entra por
// el hero y lo primero que el usuario espera es la rejilla de tarjetas.
function Pulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[#120A2B]/10 rounded-full ${className}`} />;
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-cream font-sans">
      <div className="max-w-7xl mx-auto px-5 lg:px-12 pt-24">
        <Pulse className="h-3 w-40 mb-4" />
        <Pulse className="h-9 w-3/4 max-w-lg mb-3 rounded-2xl" />
        <Pulse className="h-3 w-52 mb-10" />

        <div className="flex gap-2 mb-8">
          {["w-16", "w-24", "w-28", "w-20"].map((w) => (
            <Pulse key={w} className={`h-9 ${w}`} />
          ))}
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-card p-3 shadow-card border border-white">
              <div className="h-44 w-full rounded-2xl bg-[#120A2B]/10 animate-pulse" />
              <div className="p-3 pt-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#120A2B]/10 animate-pulse shrink-0 -mt-8" />
                <div className="flex-1 space-y-2">
                  <Pulse className="h-3 w-2/3" />
                  <Pulse className="h-2.5 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
