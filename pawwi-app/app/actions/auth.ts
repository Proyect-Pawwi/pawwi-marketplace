"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/server";
import { safeNext } from "@/lib/safe-redirect";

// Borra TODAS las cookies de Supabase (sb-*) del navegador. Es el cierre de
// sesión "a prueba de balas": no depende de que supabase.auth.signOut() logre
// parsear una sesión corrupta ni de que limpie todos los chunks
// (sb-...-auth-token.0/.1). Sin esto, la sesión se quedaba pegada y el navegador
// seguía mandando un token inválido → fetches rotos (pawwers no cargaban).
async function purgeSupabaseCookies() {
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (c.name.startsWith("sb-")) jar.delete(c.name);
  }
}

const RegistroSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").trim(),
  email: z.string().email("Ingresa un email válido").trim(),
  telefono: z
    .string()
    .regex(/^[0-9]{10}$/, "El teléfono debe tener 10 dígitos (sin +57)")
    .trim(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[0-9]/, "La contraseña debe tener al menos un número")
    .regex(/[A-Z]/, "La contraseña debe tener al menos una mayúscula"),
  terminos: z.literal("on", { error: "Debes aceptar los términos" }),
});

export type RegistroState = {
  errors?: {
    nombre?: string[];
    email?: string[];
    telefono?: string[];
    password?: string[];
    terminos?: string[];
  };
  message?: string;
} | undefined;

export async function registrarCliente(
  _state: RegistroState,
  formData: FormData
): Promise<RegistroState> {
  const raw = {
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    telefono: formData.get("telefono"),
    password: formData.get("password"),
    terminos: formData.get("terminos"),
  };

  const validated = RegistroSchema.safeParse(raw);

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { nombre, email, telefono, password } = validated.data;
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: nombre,
        phone: telefono,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`,
    },
  });

  if (error) return errorDeRegistro(error, "cliente");

  // Si la confirmación por correo está desactivada en Supabase, `signUp` ya
  // devuelve sesión: mandar a «revisa tu correo» sería dejar al cliente
  // esperando un correo que nunca llega.
  redirect(data.session ? next : "/registro/confirmar");
}

/**
 * Traduce el error de `signUp` a algo que el usuario pueda accionar, y **lo deja
 * en el log**. Antes devolvía «Ocurrió un error. Intenta de nuevo» para todo y no
 * registraba nada: un registro que fallaba por teléfono repetido era indistinguible
 * de una caída de Supabase, y reintentar no servía de nada.
 */
function errorDeRegistro(
  error: { code?: string; message?: string; status?: number },
  lado: "cliente" | "pawwer",
): RegistroState {
  console.error(`[Pawwi registro ${lado}]`, error.status, error.code, error.message);

  if (error.code === "user_already_exists") {
    return { errors: { email: ["Ya tienes una cuenta con este email. Ingresa aquí."] } };
  }
  // El trigger handle_new_user escribe en profile, donde phone es UNIQUE.
  if (error.message?.includes("profile_phone_key")) {
    return { errors: { telefono: ["Ese celular ya está registrado en otra cuenta."] } };
  }
  if (error.code === "weak_password") {
    return { errors: { password: ["Esa contraseña es demasiado débil. Usa al menos 8 caracteres y un número."] } };
  }
  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return { message: "Demasiados intentos seguidos. Espera un minuto y vuelve a intentar." };
  }
  return { message: "Ocurrió un error al crear tu cuenta. Intenta de nuevo." };
}

// ── Login ──────────────────────────────────────────────────────────────────

const LoginSchema = z.object({
  email: z.string().email("Ingresa un email válido").trim(),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginState = {
  errors?: {
    email?: string[];
    password?: string[];
  };
  message?: string;
  // En éxito devolvemos `next` en vez de redirigir: el form hace una recarga
  // DURA (window.location.assign) para que el home y el proxy relean la sesión
  // recién creada. Con un redirect RSC la sesión quedaba a medias (el cliente
  // seguía en su estado viejo → "logueado pero sin pawwers").
  success?: boolean;
  next?: string;
} | undefined;

export async function iniciarSesion(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const validated = LoginSchema.safeParse(raw);

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "invalid_credentials") {
      return { message: "Email o contraseña incorrectos." };
    }
    if (error.code === "email_not_confirmed") {
      return { message: "Aún no confirmaste tu email. Revisa tu bandeja de entrada." };
    }
    return { message: "Ocurrió un error al ingresar. Intenta de nuevo." };
  }

  // Sesión creada (cookies escritas por el server client). Recarga dura en el form.
  return { success: true, next: safeNext(formData.get("next")) };
}

// ── Recuperar contraseña ───────────────────────────────────────────────────

const RecuperarSchema = z.object({
  email: z.string().email("Ingresa un email válido").trim(),
});

export type RecuperarState = { message?: string; success?: boolean } | undefined;

export async function recuperarContrasena(
  _state: RecuperarState,
  formData: FormData
): Promise<RecuperarState> {
  const result = RecuperarSchema.safeParse({ email: formData.get("email") });
  if (!result.success) return { message: "Ingresa un email válido." };

  const supabase = await createClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm?type=recovery&next=/nueva-contrasena`;

  await supabase.auth.resetPasswordForEmail(result.data.email, { redirectTo });
  // Siempre mostrar éxito — no revelar si el email existe
  return { success: true };
}

// ── Nueva contraseña ───────────────────────────────────────────────────────

const NuevaContrasenaSchema = z.object({
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[0-9]/, "Debe tener al menos un número")
    .regex(/[A-Z]/, "Debe tener al menos una mayúscula"),
});

export type NuevaContrasenaState = { message?: string; errors?: { password?: string[] }; success?: boolean } | undefined;

export async function actualizarContrasena(
  _state: NuevaContrasenaState,
  formData: FormData
): Promise<NuevaContrasenaState> {
  const result = NuevaContrasenaSchema.safeParse({ password: formData.get("password") });
  if (!result.success) return { errors: result.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: result.data.password });

  if (error) return { message: "No se pudo actualizar la contraseña. El link puede haber expirado." };

  // Sesión establecida por el recovery; recarga dura al home desde el form.
  return { success: true };
}

// ── Cerrar sesión ──────────────────────────────────────────────────────────

export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  // scope:"local" limpia la sesión sin depender de la red / de un token válido.
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* limpiamos abajo */ }
  await purgeSupabaseCookies();
  redirect("/pawwer/login");
}

// Logout del lado cliente → vuelve al marketplace (no al login del pawwer).
export async function cerrarSesionCliente(): Promise<void> {
  const supabase = await createClient();
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* limpiamos abajo */ }
  await purgeSupabaseCookies();
  redirect("/");
}

// Igual que cerrarSesionCliente pero SIN redirect: para invocarla desde un
// handler de cliente y luego hacer una recarga dura (window.location.assign).
// Así se limpian las cookies server-side de forma explícita antes del reload.
export async function purgeSesionCliente(): Promise<void> {
  const supabase = await createClient();
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* limpiamos abajo */ }
  await purgeSupabaseCookies();
}

// ── Login Pawwer ───────────────────────────────────────────────────────────

export type LoginPawwerState = {
  errors?: { email?: string[]; password?: string[] };
  message?: string;
} | undefined;

export async function iniciarSesionPawwer(
  _state: LoginPawwerState,
  formData: FormData
): Promise<LoginPawwerState> {
  const result = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!result.success) return { errors: result.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(result.data);

  if (error) return { message: "Email o contraseña incorrectos." };

  // Verificar que el usuario tiene rol pawwer
  const { data: profile } = await supabase
    .from("profile")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role !== "pawwer") {
    await supabase.auth.signOut();
    return { message: "Esta cuenta no tiene acceso al panel de Pawwers. ¿Quieres ingresar como cliente?" };
  }

  // Verificar si el pawwer completó el onboarding
  const { data: pawwer } = await supabase
    .from("pawwer")
    .select("id")
    .eq("id", data.user.id)
    .single();

  // Si no tiene registro en pawwer table → onboarding pendiente
  redirect(pawwer ? "/pawwer/dashboard" : "/pawwer/bienvenida");
}

// ── Registro Pawwer ────────────────────────────────────────────────────────

const RegistroPawwerSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").trim(),
  email: z.string().email("Ingresa un email válido").trim(),
  telefono: z
    .string()
    .regex(/^[0-9]{10}$/, "El teléfono debe tener 10 dígitos (sin +57)")
    .trim(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[0-9]/, "La contraseña debe tener al menos un número")
    .regex(/[A-Z]/, "La contraseña debe tener al menos una mayúscula"),
  terminos: z.literal("on", { error: "Debes aceptar los términos" }),
});

export type RegistroPawwerState = {
  errors?: {
    nombre?: string[];
    email?: string[];
    telefono?: string[];
    password?: string[];
    terminos?: string[];
  };
  message?: string;
} | undefined;

export async function registrarPawwer(
  _state: RegistroPawwerState,
  formData: FormData
): Promise<RegistroPawwerState> {
  const raw = {
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    telefono: formData.get("telefono"),
    password: formData.get("password"),
    terminos: formData.get("terminos"),
  };

  const validated = RegistroPawwerSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { nombre, email, telefono, password } = validated.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: nombre,
        phone: telefono,
        role: "pawwer",
      },
      // El trigger handle_new_user lee raw_user_meta_data->>'role' y lo persiste en profile.
      // Al confirmar email, el Pawwer aterriza directo en el onboarding wizard.
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm?next=${encodeURIComponent("/pawwer/bienvenida")}`,
    },
  });

  if (error) return errorDeRegistro(error, "pawwer");

  // Con la confirmación desactivada entra directo al embudo, que es donde
  // apuntaba el correo de confirmación.
  redirect(data.session ? "/pawwer/bienvenida" : "/registro/confirmar");
}
