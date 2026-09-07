import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/server";
import { cerrarSesionCliente } from "@/app/actions/auth";
import {
  Dog, CreditCard, FileText, LifeBuoy, ShieldCheck, LogOut,
  ChevronRight, User as UserIcon,
} from "lucide-react";

export const metadata: Metadata = { title: "Mi perfil — Pawwi" };

// Bloque 0 (esqueleto): hub "Centro de Control" del cliente, al estilo del
// PerfilHub del pawwer pero SIN lógica de negocio todavía. Las secciones de
// pago/facturación/pasaporte se cablean en fases siguientes. "Mis peludos"
// (donde vivirá el Pasaporte Pawwi) enlaza a la pantalla ya existente
// /mis-mascotas — por decisión de producto el Pasaporte vive dentro de Perfil.
export default async function MiPerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?modal=login&next=/mi-perfil");

  const { data: profile } = await supabase
    .from("profile")
    .select("name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.name ?? "Tu cuenta";
  const email = user.email ?? "";
  const avatar = profile?.avatar_url ?? null;

  return (
    <div className="min-h-screen bg-[#FFF1EB] relative overflow-hidden pb-32">
      {/* Blobs */}
      <div aria-hidden className="pointer-events-none absolute top-[-8%] left-[-8%] w-[280px] h-[280px] bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[80px] opacity-40" />
      <div aria-hidden className="pointer-events-none absolute bottom-[10%] right-[-5%] w-[220px] h-[220px] bg-[#FF7031] rounded-full mix-blend-multiply filter blur-[80px] opacity-15" />

      {/* Header */}
      <header className="relative z-10 max-w-xl mx-auto px-6 pt-12 pb-4">
        <p className="eyebrow text-[#FF7031]">Mi cuenta</p>
        <h1 className="text-3xl font-black text-[#120A2B] mt-1">Perfil</h1>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 pt-2 space-y-5">
        {/* Tarjeta de identidad */}
        <div className="bg-white rounded-[28px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.05)] p-5 flex items-center gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={name} className="w-16 h-16 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#120A2B] flex items-center justify-center text-white shrink-0">
              <UserIcon size={26} />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-extrabold text-[#120A2B] truncate">{name}</p>
            {email && <p className="text-sm text-[#120A2B]/45 truncate">{email}</p>}
          </div>
        </div>

        {/* Mis peludos (Pasaporte Pawwi vive aquí dentro) */}
        <Section title="Mis peludos">
          <RowLink href="/mis-mascotas" icon={<Dog size={18} />} title="Mis mascotas"
            subtitle="Ficha y Pasaporte de tu perro" />
        </Section>

        {/* Pagos y facturación — placeholders de fases futuras */}
        <Section title="Pagos">
          <RowSoon icon={<CreditCard size={18} />} title="Métodos de pago"
            subtitle="Tarjeta / Wompi" />
          <RowSoon icon={<FileText size={18} />} title="Facturación"
            subtitle="Historial de pagos" />
          <RowSoon icon={<ShieldCheck size={18} />} title="Identidad verificada"
            subtitle="Cédula y celular (KYC)" />
        </Section>

        {/* Cuenta */}
        <Section title="Cuenta">
          <RowLink href="/soporte" icon={<LifeBuoy size={18} />} title="Soporte" />
          <form action={cerrarSesionCliente}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-red-50/60 transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <LogOut size={18} />
              </span>
              <span className="flex-1 font-bold text-red-500 text-sm">Cerrar sesión</span>
            </button>
          </form>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="eyebrow text-[#120A2B]/40 px-2 mb-2">{title}</p>
      <div className="bg-white rounded-[24px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.05)] overflow-hidden divide-y divide-[#120A2B]/5">
        {children}
      </div>
    </section>
  );
}

function RowLink({
  href, icon, title, subtitle,
}: {
  href: string; icon: React.ReactNode; title: string; subtitle?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#FFF1EB]/60 transition-colors">
      <span className="w-9 h-9 rounded-xl bg-[#FFF1EB] text-[#FF7031] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[#120A2B] text-sm truncate">{title}</span>
        {subtitle && <span className="block text-xs text-[#120A2B]/40 truncate">{subtitle}</span>}
      </span>
      <ChevronRight size={16} className="text-[#120A2B]/20 shrink-0" />
    </Link>
  );
}

// Fila deshabilitada con sello "Pronto" — feature de una fase futura.
function RowSoon({
  icon, title, subtitle,
}: {
  icon: React.ReactNode; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 opacity-60">
      <span className="w-9 h-9 rounded-xl bg-[#120A2B]/5 text-[#120A2B]/40 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[#120A2B]/70 text-sm truncate">{title}</span>
        {subtitle && <span className="block text-xs text-[#120A2B]/35 truncate">{subtitle}</span>}
      </span>
      <span className="text-[10px] font-black uppercase tracking-widest text-[#120A2B]/30 shrink-0">Pronto</span>
    </div>
  );
}
