"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Search, X, AlertCircle } from "lucide-react";
import PawwerCard from "@/components/PawwerCard";
import { toggleFavorito } from "@/app/actions/favoritos";
import type { Pawwer } from "@/lib/pawwers";

/**
 * La lista de favoritos, con el quitar en la propia tarjeta.
 *
 * El quitar es OPTIMISTA: la tarjeta se va en el momento del toque y la
 * escritura va detrás. Si la escritura falla, la tarjeta vuelve y se dice por
 * qué. Lo que no puede pasar es lo de antes —que el corazón se pintara y no
 * guardara nada—, así que el fallo se muestra en vez de tragarse.
 */
export default function FavoritosLista({ pawwers }: { pawwers: Pawwer[] }) {
  const [quitados, setQuitados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const visibles = pawwers.filter((p) => !quitados.has(p.id));

  async function quitar(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setQuitados((prev) => new Set(prev).add(id));

    const res = await toggleFavorito(id);
    // `favorito: true` significa que NO borró sino que volvió a guardar: la
    // tarjeta tiene que volver, igual que si hubiera fallado.
    if (!res.ok || res.favorito) {
      setQuitados((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setError(
        !res.ok && res.error === "sin-sesion"
          ? "Se cerró tu sesión. Vuelve a entrar para cambiar tus favoritos."
          : "No se pudo quitar de favoritos. Intenta de nuevo."
      );
    }
  }

  if (visibles.length === 0) {
    return (
      <div className="enter enter-2 bg-white rounded-card border border-white shadow-card p-10 text-center">
        <div className="w-20 h-20 bg-cream rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart size={34} className="text-tangerine/40" />
        </div>
        <p className="font-extrabold text-midnight mb-1">Aún no guardas favoritos</p>
        <p className="text-sm text-midnight/45 mb-6">
          Toca el corazón en un Pawwer para guardarlo aquí y encontrarlo rápido.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-tangerine text-white font-bold px-6 py-3 rounded-full text-sm hover:bg-[#e6652c] transition-colors shadow-[0_4px_12px_rgba(255,112,49,0.3)]"
        >
          <Search size={15} /> Explorar Pawwers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 rounded-chip px-4 py-3 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {visibles.map((p, i) => (
          <PawwerCard
            key={p.id}
            pawwer={p}
            className={`enter enter-${Math.min(i + 1, 6)}`}
            accion={
              <button
                type="button"
                onClick={(e) => quitar(p.id, e)}
                aria-label={`Quitar a ${p.name} de favoritos`}
                className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center
                           text-tangerine hover:bg-white hover:text-red-500 active:scale-90 transition-all shadow-sm"
              >
                <X size={16} strokeWidth={3} />
              </button>
            }
          />
        ))}
      </div>
    </div>
  );
}
