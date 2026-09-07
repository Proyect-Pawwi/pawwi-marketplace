"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Heart, Calendar, MessageCircle, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/client";

// El nav del cliente NO puede vivir en un route-group (su tab "Explorar" es la
// raíz `/`, que también sirve páginas públicas, el onboarding del pawwer y las
// legales). Por eso es un Client Component que se monta una sola vez en el
// layout raíz y se auto-gatea:
//   1. pathname exacto contra este allowlist (las sub-rutas y flujos profundos
//      —/booking, /pawwer, auth, legales, /mis-mascotas— quedan fuera solos).
//   2. sesión con role='client' (a un pawwer navegando `/` no se le muestra).
// Se lee la sesión en cliente (no en el layout server-side) para no forzar
// render dinámico en las páginas estáticas.
const CLIENT_TAB_ROOTS = [
  "/",
  "/mis-favoritos",
  "/mis-reservas",
  "/mis-mensajes",
  "/mi-perfil",
];

function NavTab({
  href,
  label,
  Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex flex-col items-center gap-1.5 transition-all flex-1 py-1 px-1",
        active ? "text-[#FF7031]" : "text-gray-400 hover:text-white",
      ].join(" ")}
    >
      <div className="relative">
        <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
        {!!badge && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 leading-none pointer-events-none">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest leading-none">
        {label}
      </span>
    </Link>
  );
}

export default function ClientNav() {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const onTab = CLIENT_TAB_ROOTS.includes(pathname);

  useEffect(() => {
    // Solo consultamos sesión/rol en las pantallas-tab; en el resto no hacemos nada.
    if (!onTab) return;
    const supabase = createClient();
    let alive = true;

    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (alive) setIsClient(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profile")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      // Cualquier sesión que NO sea pawwer se trata como cliente — así también
      // cubrimos cuentas viejas con role null/'' (el default 'client' del trigger
      // solo aplica a registros post-mig 27). Mismo criterio que auth.ts.
      if (alive) setIsClient(profile?.role !== "pawwer");
    }

    check();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => check());

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [onTab, pathname]);

  // Solo en pantallas-tab y con sesión de cliente.
  if (!onTab || !isClient) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-5"
      style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-xl mx-auto">
        <nav className="bg-[#120A2B] text-white rounded-[32px] px-4 flex items-center shadow-[0_12px_30px_-6px_rgba(18,10,43,0.45)] border border-white/5 h-[64px]">

          {/* Izquierda: Favoritos + Reservas */}
          <div className="flex flex-1 items-center justify-around h-full">
            <NavTab
              href="/mis-favoritos"
              label="Favoritos"
              Icon={Heart}
              active={pathname === "/mis-favoritos"}
            />
            <NavTab
              href="/mis-reservas"
              label="Reservas"
              Icon={Calendar}
              active={pathname === "/mis-reservas"}
            />
          </div>

          {/* Centro: Explorar FAB — siempre sólido (es el loop principal) */}
          <Link
            href="/"
            className="w-12 h-12 rounded-[18px] bg-[#FF7031] flex items-center justify-center mx-2 -translate-y-4 transition-transform active:scale-95 shadow-[0_10px_28px_rgba(255,112,49,0.45)] shrink-0"
          >
            <Search size={22} strokeWidth={2.5} className="text-white" />
          </Link>

          {/* Derecha: Mensajes + Perfil */}
          <div className="flex flex-1 items-center justify-around h-full">
            <NavTab
              href="/mis-mensajes"
              label="Mensajes"
              Icon={MessageCircle}
              active={pathname === "/mis-mensajes"}
            />
            <NavTab
              href="/mi-perfil"
              label="Perfil"
              Icon={User}
              active={pathname === "/mi-perfil"}
            />
          </div>

        </nav>
      </div>
    </div>
  );
}
