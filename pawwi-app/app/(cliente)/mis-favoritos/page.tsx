import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import { Heart, AlertCircle } from "lucide-react";
import { PAWWER_FIELDS, mapDbPawwer, type Pawwer } from "@/lib/pawwers";
import FavoritosLista from "./FavoritosLista";

export const metadata: Metadata = { title: "Favoritos — Pawwi" };

// Pantalla-tab: sin botón de volver, no hay pantalla padre a la que regresar.
export default async function MisFavoritosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?modal=login&next=/mis-favoritos");

  // El embed va SIN pista de llave foránea a propósito: `favourite` tiene una
  // sola hacia `pawwer`, así que no es ambiguo. Comprobado contra la base, no
  // supuesto — inventarse nombres de FK ya costó dos pantallas en blanco.
  const { data, error } = await supabase
    .from("favourite")
    .select(`*, pawwer ( ${PAWWER_FIELDS} )`);

  if (error) console.error("[Pawwi] favoritos · listar:", error.message, error.details);

  // `created_at` llega con la migración 72. Si aún no se corrió, no viene y la
  // lista sale en el orden que dé la base: los favoritos funcionan igual, solo
  // que sin «lo último que guardé, primero».
  const filas = [...(data ?? [])].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
  );

  const pawwers: Pawwer[] = filas
    .filter((f) => f.pawwer)
    .map((f, i) => mapDbPawwer(f.pawwer, i));

  return (
    <div className="relative">
      <header className="relative z-10 max-w-xl mx-auto px-6 pt-12 pb-4 enter enter-1">
        <p className="eyebrow text-tangerine">Guardados</p>
        <div className="flex items-end justify-between gap-3 mt-1">
          <div>
            <h1 className="text-3xl font-black text-midnight">Favoritos</h1>
            {pawwers.length > 0 && (
              <p className="text-sm text-midnight/45 mt-1">
                {pawwers.length === 1 ? "1 Pawwer guardado" : `${pawwers.length} Pawwers guardados`}
              </p>
            )}
          </div>
          <div className="w-11 h-11 rounded-2xl bg-white shadow-card flex items-center justify-center shrink-0">
            <Heart size={20} className="text-tangerine" />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 pt-6">
        {error ? (
          // Un fallo de lectura NO puede disfrazarse de «no tienes favoritos»:
          // sería la misma mentira que la pantalla anterior contaba siempre.
          <div className="bg-white rounded-card border border-white shadow-card p-10 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <p className="font-extrabold text-midnight mb-1">No pudimos cargar tus favoritos</p>
            <p className="text-sm text-midnight/45">Revisa tu conexión y vuelve a intentarlo.</p>
          </div>
        ) : (
          <FavoritosLista pawwers={pawwers} />
        )}
      </main>
    </div>
  );
}
