import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import { eliminarMascota } from "@/app/actions/dogs";
import { PawPrint, Plus, Pencil, Trash2 } from "lucide-react";

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
  if (!user) redirect("/login");

  const { data: dogs } = await supabase
    .from("dog")
    .select("id, name, breed, size, age, vaccine, photo_url, notes")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <main className="relative min-h-screen bg-cream px-4 py-8 overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-plum/25 blur-3xl pointer-events-none" />

      <div className="relative max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-extrabold text-midnight">Mis mascotas</h1>
            <p className="text-sm text-midnight/50 font-body mt-0.5">
              {dogs?.length ?? 0} perro{(dogs?.length ?? 0) !== 1 ? "s" : ""} registrado{(dogs?.length ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/mis-mascotas/nueva"
            className="flex items-center gap-2 bg-[#FF7031] hover:bg-[#e6652c] text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
          >
            <Plus size={15} /> Agregar
          </Link>
        </div>

        {/* Lista vacía */}
        {(!dogs || dogs.length === 0) && (
          <div className="bg-white/70 border border-white rounded-3xl p-10 text-center shadow-sm">
            <PawPrint size={40} className="mx-auto text-midnight/20 mb-3" />
            <p className="font-bold text-midnight mb-1">Aún no tienes mascotas</p>
            <p className="text-sm text-midnight/50 font-body mb-6">
              Agrega tu perro para poder hacer reservas más rápido.
            </p>
            <Link
              href="/mis-mascotas/nueva"
              className="inline-flex items-center gap-2 bg-[#FF7031] text-white font-bold px-6 py-3 rounded-xl text-sm"
            >
              <Plus size={15} /> Agregar mi primer perro
            </Link>
          </div>
        )}

        {/* Cards */}
        <div className="space-y-3">
          {dogs?.map((dog) => (
            <div
              key={dog.id}
              className="bg-white/80 backdrop-blur-sm border border-white rounded-2xl p-4 shadow-sm flex gap-4 items-start"
            >
              {/* Foto o placeholder */}
              <div className="w-16 h-16 rounded-2xl bg-[#FFF1EB] border border-[#FF7031]/20 flex-shrink-0 overflow-hidden">
                {dog.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dog.photo_url} alt={dog.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🐶</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-midnight">{dog.name}</span>
                  {dog.vaccine && (
                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Vacunado
                    </span>
                  )}
                </div>
                <p className="text-sm text-midnight/60 font-body">
                  {dog.breed}
                  {dog.age != null && ` · ${dog.age} año${dog.age !== 1 ? "s" : ""}`}
                  {dog.size && ` · ${SIZE_LABEL[dog.size as number] ?? ""}`}
                </p>
                {dog.notes && (
                  <p className="text-xs text-midnight/40 font-body mt-0.5 truncate">{dog.notes}</p>
                )}
              </div>

              {/* Acciones */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <Link
                  href={`/mis-mascotas/nueva?edit=${dog.id}`}
                  className="w-8 h-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
                  title="Editar"
                >
                  <Pencil size={13} className="text-gray-500" />
                </Link>
                <form action={eliminarMascota.bind(null, dog.id)}>
                  <button
                    type="submit"
                    className="w-8 h-8 rounded-xl border border-red-100 bg-white flex items-center justify-center hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>

        {/* CTA para volver al marketplace */}
        {dogs && dogs.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-sm font-semibold text-midnight/60 hover:text-midnight font-body underline"
            >
              Buscar un Pawwer
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
