import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import { Heart, Search } from "lucide-react";

export const metadata: Metadata = { title: "Favoritos — Pawwi" };

// Bloque 0 (esqueleto): pantalla-tab con su gate de sesión y empty-state.
// TODO (Fase B): persistir de verdad. Hoy el corazón del home es solo estado
// local (app/page.tsx toggleFavorite → setFavorites), NO escribe en la tabla
// `favourite`. Cuando eso se arregle, aquí se leen los favoritos del cliente y
// se renderizan las tarjetas de pawwer.
export default async function MisFavoritosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?modal=login&next=/mis-favoritos");

  return (
    <div className="min-h-screen bg-[#FFF1EB] relative overflow-hidden pb-32">
      {/* Blobs */}
      <div aria-hidden className="pointer-events-none absolute top-[-8%] left-[-8%] w-[280px] h-[280px] bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[80px] opacity-40" />
      <div aria-hidden className="pointer-events-none absolute bottom-[10%] right-[-5%] w-[220px] h-[220px] bg-[#FF7031] rounded-full mix-blend-multiply filter blur-[80px] opacity-15" />

      {/* Header (pantalla-tab: sin "volver") */}
      <header className="relative z-10 max-w-xl mx-auto px-6 pt-12 pb-4">
        <p className="eyebrow text-[#FF7031]">Guardados</p>
        <div className="flex items-end justify-between gap-3 mt-1">
          <h1 className="text-3xl font-black text-[#120A2B]">Favoritos</h1>
          <div className="w-11 h-11 rounded-2xl bg-white shadow-[0_8px_24px_rgba(18,10,43,0.06)] flex items-center justify-center shrink-0">
            <Heart size={20} className="text-[#FF7031]" />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 pt-6">
        <div className="bg-white rounded-[28px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.05)] p-10 text-center">
          <div className="w-20 h-20 bg-[#FFF1EB] rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart size={34} className="text-[#FF7031]/40" />
          </div>
          <p className="font-extrabold text-[#120A2B] mb-1">Aún no guardas favoritos</p>
          <p className="text-sm text-[#120A2B]/45 mb-6">
            Toca el corazón en un Pawwer para guardarlo aquí y encontrarlo rápido.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#FF7031] text-white font-bold px-6 py-3 rounded-full text-sm hover:bg-[#e6652c] transition-colors shadow-[0_4px_12px_rgba(255,112,49,0.3)]"
          >
            <Search size={15} /> Explorar Pawwers
          </Link>
        </div>
      </main>
    </div>
  );
}
