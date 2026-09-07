import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que requieren sesión (defensa en profundidad; las páginas/layouts también
// se auto-gatean con getUser). El motivo PRINCIPAL del proxy es REFRESCAR la
// sesión de Supabase en cada navegación, como exige el patrón SSR: rota el token
// si expiró y, si la cookie está corrupta, la limpia sola (self-heal).
const clientProtected = [
  "/mis-reservas",
  "/mis-mascotas",
  "/mis-favoritos",
  "/mis-mensajes",
  "/mi-perfil",
];

const pawwerProtected = [
  "/pawwer/dashboard",
  "/pawwer/disponibilidad",
  "/pawwer/reservas",
  "/pawwer/reserva",
  "/pawwer/perfil",
  "/pawwer/servicios",
  "/pawwer/ingresos",
  "/pawwer/bienvenida",
  "/pawwer/inicio",
  "/pawwer/cuidados",
  "/pawwer/mensajes",
  "/pawwer/cuenta-cobro",
];

// Antes "middleware" — renombrado a "proxy" (Next 16 deprecó el convention).
export default async function proxy(req: NextRequest) {
  // IMPORTANTE (patrón SSR de Supabase): `res` debe seguir a las cookies que el
  // cliente reescriba al refrescar, y se devuelve SIEMPRE ese `res`.
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // NO poner código entre createServerClient y getUser. Esto refresca la sesión
  // en CADA request (rota el token, reescribe cookies, limpia cookies inválidas).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const matches = (r: string) => path === r || path.startsWith(r + "/");
  const isClientRoute = clientProtected.some(matches);
  const isPawwerRoute = pawwerProtected.some(matches);

  if (!user && (isClientRoute || isPawwerRoute)) {
    const url = req.nextUrl.clone();
    url.search = "";
    if (isPawwerRoute) {
      url.pathname = "/pawwer/login";
    } else {
      url.pathname = "/";
      url.searchParams.set("modal", "login");
      url.searchParams.set("next", path);
    }
    const redirect = NextResponse.redirect(url);
    // Conservar las cookies refrescadas al redirigir (si no, se pierden).
    res.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.svg$|.*\\.png$).*)"],
};
