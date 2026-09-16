import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import { PawPrint, Plus, Dog as DogIcon, ShieldCheck } from "lucide-react";
import BackButton from "@/components/BackButton";
import EliminarMascota from "./EliminarMascota";

export const metadata: Metadata = { title: "Mis mascotas — Pawwi" };

const SIZE_LABEL: Record<number, string> = {
  1: "Pequeño",
  2: "Mediano",
  3: "Grande",
  4: "Extra grande",
};

export default async function MisMascotasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?modal=login&next=/mis-mascotas");

  const { data: dogs, error } = await supabase
    .from("dog")
    .select("id, name, breed, size, age, vaccine, photo_url, notes")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  // Un fallo aquí deja la lista vacía, indistinguible de «no tienes perros».
  // Hasta el 2026-09-15 esto fallaba SIEMPRE: `authenticated` no tenía permisos
  // sobre `dog` (mig 69) y el cliente veía un estado vacío que mentía.
  if (error) console.error("[Pawwi] mis-mascotas:", error.message, error.details);

  const total = dogs?.length ?? 0;

  return (
    <main className="relative px-6 py-10">
      <div className="relative max-w-xl mx-auto">

        {/* Cabecera de SUB-pantalla: se llega desde /mi-perfil, no es pestaña.
            Patrón del design system: volver + antetítulo + `h1 text-2xl font-black`. */}
        <header className="mb-8">
          <div className="mb-4"><BackButton fallback="/mi-perfil" /></div>
          <p className="eyebrow text-tangerine">Tu familia</p>
          <div className="flex items-end justify-between gap-3 mt-1.5">
            <div>
              <h1 className="text-2xl font-black text-midnight leading-none">Mis peludos</h1>
              <p className="text-sm text-midnight/50 mt-2">
                {total === 0
                  ? "Todavía ninguno registrado"
                  : `${total} perro${total !== 1 ? "s" : ""} registrado${total !== 1 ? "s" : ""}`}
              </p>
            </div>
            <span className="w-10 h-10 rounded-chip bg-midnight flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(18,10,43,0.15)]">
              <DogIcon size={18} />
            </span>
          </div>
        </header>

        {total === 0 ? (
          <div className="enter enter-1 bg-white rounded-card p-10 text-center shadow-card">
            <PawPrint size={40} className="mx-auto text-midnight/20 mb-3" />
            <p className="font-black text-midnight mb-1">Aún no tienes peludos</p>
            <p className="text-sm text-midnight/50 mb-6">
              Agrega tu perro para poder reservar más rápido.
            </p>
            <Link
              href="/mis-mascotas/nueva"
              className="inline-flex items-center gap-2 bg-tangerine text-white font-bold px-6 py-3.5 rounded-full text-sm shadow-[0_8px_20px_rgba(255,112,49,0.35)] active:scale-95 transition-transform"
            >
              <Plus size={16} /> Agregar mi primer perro
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3 enter enter-1">
              {dogs!.map((dog) => (
                <div
                  key={dog.id}
                  className="bg-white rounded-card shadow-card p-4 flex gap-4 items-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-cream border border-tangerine/15 shrink-0 overflow-hidden">
                    {dog.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={dog.photo_url} alt={dog.name as string} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🐶</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-midnight">{dog.name}</span>
                      {dog.vaccine && (
                        <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck size={10} /> Vacunado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-midnight/60">
                      {dog.breed}
                      {dog.age != null && ` · ${dog.age} año${dog.age !== 1 ? "s" : ""}`}
                      {dog.size ? ` · ${SIZE_LABEL[dog.size as number] ?? ""}` : ""}
                    </p>
                    {dog.notes && (
                      <p className="text-xs text-midnight/40 mt-0.5 truncate">{dog.notes as string}</p>
                    )}
                  </div>

                  {/* Solo eliminar.
                      EDITAR NO EXISTE, y el lápiz que había aquí era peor que su
                      ausencia: enlazaba a `nueva?edit=<id>`, pero esa pantalla no
                      lee `searchParams`, así que abría un formulario VACÍO y al
                      guardar **creaba un perro duplicado**. Un botón que corrompe
                      datos no se deja puesto porque parezca completo. Vuelve en
                      S4 · 4.2, con `actualizarMascota` y el Pasaporte. */}
                  <EliminarMascota dogId={dog.id as string} nombre={dog.name as string} />
                </div>
              ))}
            </div>

            <Link
              href="/mis-mascotas/nueva"
              className="enter enter-2 mt-4 w-full flex items-center justify-center gap-2 bg-white
                         border-2 border-dashed border-midnight/10 rounded-card py-4
                         font-bold text-sm text-midnight/60 hover:border-tangerine/40 hover:text-tangerine
                         transition-colors"
            >
              <Plus size={16} /> Agregar otro peludo
            </Link>

            <div className="mt-8 text-center enter enter-3">
              <Link
                href="/"
                className="text-sm font-semibold text-midnight/50 hover:text-midnight underline underline-offset-2"
              >
                Buscar un Pawwer
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
