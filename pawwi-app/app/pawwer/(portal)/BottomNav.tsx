"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, MessageCircle, TrendingUp, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNotifications } from "./NotificationsProvider";

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

// El nav vive en el layout del portal, así que aparece en TODAS las rutas del
// grupo. Solo debe verse en las 5 pantallas-tab: en sub-pantallas (editores de
// perfil con barra "Guardar", disponibilidad, detalle de cuidado, chat) se
// oculta — tienen botón "volver" y a veces su propia barra inferior, que antes
// chocaba con el nav (quedaba tapado por "Guardar cambios").
const TAB_ROOTS = [
  "/pawwer/inicio",
  "/pawwer/cuidados",
  "/pawwer/mensajes",
  "/pawwer/ingresos",
  "/pawwer/perfil",
];

export default function BottomNav() {
  const pathname = usePathname();
  const { counts } = useNotifications();

  // Solo en pantallas-tab (coincidencia exacta; las sub-rutas no lo muestran).
  if (!TAB_ROOTS.includes(pathname)) return null;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-5"
      style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-xl mx-auto">
        <nav className="bg-[#120A2B] text-white rounded-[32px] px-4 flex items-center shadow-[0_12px_30px_-6px_rgba(18,10,43,0.45)] border border-white/5 h-[64px]">

          {/* Izquierda: Cuidados + Chat */}
          <div className="flex flex-1 items-center justify-around h-full">
            <NavTab
              href="/pawwer/cuidados"
              label="Cuidados"
              Icon={ClipboardList}
              active={isActive("/pawwer/cuidados")}
              badge={counts.cuidado}
            />
            <NavTab
              href="/pawwer/mensajes"
              label="Chat"
              Icon={MessageCircle}
              active={isActive("/pawwer/mensajes")}
              badge={counts.mensaje}
            />
          </div>

          {/* Centro: Inicio FAB — siempre sólido */}
          <Link
            href="/pawwer/inicio"
            className="w-12 h-12 rounded-[18px] bg-[#FF7031] flex items-center justify-center mx-2 -translate-y-4 transition-transform active:scale-95 shadow-[0_10px_28px_rgba(255,112,49,0.45)] shrink-0"
          >
            <Home size={22} strokeWidth={2.5} className="text-white" />
          </Link>

          {/* Derecha: Ganancias + Perfil */}
          <div className="flex flex-1 items-center justify-around h-full">
            <NavTab
              href="/pawwer/ingresos"
              label="Ganancias"
              Icon={TrendingUp}
              active={isActive("/pawwer/ingresos")}
            />
            <NavTab
              href="/pawwer/perfil"
              label="Perfil"
              Icon={User}
              active={isActive("/pawwer/perfil")}
            />
          </div>

        </nav>
      </div>
    </div>
  );
}
