"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dog, Heart, Calendar, MessageCircle, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/client";

// El nav del cliente NO puede vivir en un route-group (su tab "Explorar" es la
// raíz `/`, que también sirve páginas públicas, el onboarding del pawwer y las
// legales). Por eso se monta una sola vez en el layout raíz y se auto-gatea por
// pathname exacto contra este allowlist (las sub-rutas y flujos profundos
// —/booking, /pawwer, auth, legales, /mis-mascotas— quedan fuera solos).
//
// El ROL ya no se resuelve aquí: llega por props desde el layout raíz, que lo
// lee en el servidor (`lib/session.ts`).
//
// Antes se leía en cliente «para no forzar render dinámico en las páginas
// estáticas». El razonamiento era correcto y el precio, inaceptable: eran DOS
// consultas en serie —`getUser()` y luego el rol, que no puede empezar hasta que
// vuelve la primera— y mientras tanto el componente devolvía `null`. En un móvil
// eso son segundos con la pantalla sin nav. Peor: `isClient` era un booleano, así
// que «todavía no sé» y «no eres cliente» eran el MISMO valor, y el HTML inicial
// salía siempre sin nav para todo el mundo. Se cambió el ahorro de siete páginas
// estáticas triviales por un nav que está desde el primer píxel (2026-09-17).
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
        "flex flex-col items-center gap-1 transition-all flex-1 py-1 px-1",
        active ? "text-[#FF7031]" : "text-gray-400 hover:text-white",
      ].join(" ")}
    >
      <div className="relative">
        <Icon size={25} strokeWidth={active ? 2.4 : 1.7} />
        {!!badge && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 leading-none pointer-events-none">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>
      <span className="text-[9px] font-medium tracking-normal leading-none">
        {label}
      </span>
    </Link>
  );
}

export default function ClientNav({ esCliente }: { esCliente: boolean }) {
  const pathname = usePathname();
  // Arranca con lo que dijo el SERVIDOR, no en `false`. Esa única diferencia es
  // la que pone el nav en el HTML inicial.
  const [visible, setVisible] = useState(esCliente);
  const onTab = CLIENT_TAB_ROOTS.includes(pathname);

  // El servidor manda: si una navegación trae un valor nuevo (cerraste sesión y
  // el layout se volvió a renderizar), se adopta.
  useEffect(() => { setVisible(esCliente); }, [esCliente]);

  useEffect(() => {
    if (!onTab) return;
    const supabase = createClient();

    // 🔒 NUNCA llamar a supabase.* dentro de este callback.
    //
    // Supabase avisa a los suscriptores *con el candado de sesión tomado*, y
    // espera a que cada uno termine. Cualquier llamada de aquí dentro —incluida
    // una consulta normal, que internamente pide la sesión— vuelve a pedir ese
    // mismo candado y se queda esperando a que lo suelte quien la está
    // esperando a ella. Abrazo mortal: el candado no se libera nunca y TODAS
    // las consultas del navegador se cuelgan para siempre, sin error y sin
    // llegar a hacer una sola petición. Eso es lo que dejaba el marketplace
    // vacío al iniciar sesión (2026-09-15).
    //
    // Ahora ni siquiera hace falta consultar: solo se RETIRA el nav al cerrar
    // sesión (en otra pestaña, o si el token caduca). Encenderlo es cosa del
    // servidor — entrar hace recarga dura, así que el layout se vuelve a
    // renderizar con la sesión puesta.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setVisible(false);
    });

    return () => subscription.unsubscribe();
  }, [onTab]);

  // Solo en pantallas-tab y con sesión de cliente.
  if (!onTab || !visible) return null;

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

          {/* Centro: Explorar FAB — siempre sólido (es el loop principal).
              Era una LUPA con un halo naranja `shadow-[…rgba(255,112,49,0.45)]`
              que se leía como un degradado en el contorno. Ahora: perrito, y
              sombra neutra que eleva sin teñir.
              El corazón se descartó porque ya es «Favoritos» en este mismo nav
              —reusarlo duplicaría el símbolo—. El perrito cede algo de
              literalidad («buscar») a cambio de ser el símbolo de la marca. */}
          <Link
            href="/"
            className="w-[52px] h-[52px] rounded-[18px] bg-tangerine flex items-center justify-center mx-2 -translate-y-4 transition-transform active:scale-95 shadow-[0_6px_16px_rgba(18,10,43,0.3)] shrink-0"
          >
            <Dog size={27} strokeWidth={2.2} className="text-white" />
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
