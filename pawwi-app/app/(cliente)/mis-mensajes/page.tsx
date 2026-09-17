import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import { MessageCircle, Search } from "lucide-react";

export const metadata: Metadata = { title: "Mensajes — Pawwi" };

// Bloque 0 (esqueleto): shell de la lista de conversaciones + empty-state.
// TODO (Fase D): chat del cliente. Reutilizar el patrón de ChatRoom del pawwer
// (Supabase Realtime, send_message, mark_messages_seen, fotos, moderación,
// "Resumen del cuidado"). Ver docs/PENDIENTES-PORTAL-CLIENTE.md.
export default async function MisMensajesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?modal=login&next=/mis-mensajes");

  return (
    <div className="relative">

      {/* Header (pantalla-tab: sin "volver") */}
      <header className="enter enter-1 relative z-10 max-w-xl mx-auto px-6 pt-12 pb-4">
        <p className="eyebrow text-tangerine">Conversaciones</p>
        <div className="flex items-end justify-between gap-3 mt-1">
          <h1 className="text-3xl font-black text-midnight">Mensajes</h1>
          <div className="w-11 h-11 rounded-2xl bg-white shadow-card flex items-center justify-center shrink-0">
            <MessageCircle size={20} className="text-tangerine" />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 pt-6">
        <div className="enter enter-2 bg-white rounded-card border border-white shadow-card p-10 text-center">
          <div className="w-20 h-20 bg-cream rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={34} className="text-tangerine/40" />
          </div>
          <p className="font-extrabold text-midnight mb-1">Aún no tienes conversaciones</p>
          <p className="text-sm text-midnight/45 mb-6">
            Cuando reserves un cuidado, aquí podrás chatear con tu Pawwer y ver cómo está tu peludo.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-tangerine text-white font-bold px-6 py-3 rounded-full text-sm hover:bg-[#e6652c] transition-colors shadow-[0_4px_12px_rgba(255,112,49,0.3)]"
          >
            <Search size={15} /> Explorar Pawwers
          </Link>
        </div>
      </main>
    </div>
  );
}
