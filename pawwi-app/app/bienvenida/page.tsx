import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";

export const metadata: Metadata = { title: "Bienvenido a Pawwi" };

export default async function BienvenidaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Si ya tiene mascotas, no mostrar bienvenida de nuevo
  const { count } = await supabase
    .from("dog")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if (count && count > 0) redirect("/mis-mascotas");

  return (
    <main className="relative min-h-screen bg-cream flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-plum/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-ice/30 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md text-center space-y-6 py-12">
        {/* Ilustración */}
        <div className="text-7xl mb-2">🐾</div>

        <div>
          <h1 className="text-3xl font-heading font-extrabold text-midnight leading-tight mb-2">
            ¡Bienvenido a Pawwi!
          </h1>
          <p className="text-midnight/60 font-body leading-relaxed">
            Antes de buscar a tu cuidador ideal,<br />
            cuéntanos sobre tu peludo.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-sm border border-white rounded-3xl p-6 shadow-sm text-left space-y-4">
          {[
            { icon: "📋", title: "Perfil personalizado", desc: "Tu Pawwer sabrá exactamente cómo cuidar a tu perro" },
            { icon: "💊", title: "Historial de vacunas", desc: "Garantiza que tu perro esté protegido" },
            { icon: "🏠", title: "Reservas más rápidas", desc: "No necesitas explicar lo mismo cada vez" },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="font-extrabold text-midnight text-sm">{title}</p>
                <p className="text-midnight/60 text-xs font-body">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/mis-mascotas/nueva"
          className="block w-full bg-[#FF7031] hover:bg-[#e6652c] text-white font-extrabold py-4 rounded-2xl text-base transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          Agregar mi perro
        </Link>

        <Link href="/" className="block text-sm text-midnight/40 font-body hover:text-midnight/60">
          Explorar Pawwers primero
        </Link>
      </div>
    </main>
  );
}
