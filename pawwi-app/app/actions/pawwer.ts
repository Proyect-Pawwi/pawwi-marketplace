"use server";

import { z } from "zod";
import { createClient } from "@/lib/server";

const WeekPatternSchema = z.object({
  Mon: z.boolean(), Tue: z.boolean(), Wed: z.boolean(), Thu: z.boolean(),
  Fri: z.boolean(), Sat: z.boolean(), Sun: z.boolean(),
});

const ServiceInputSchema = z.object({
  service_id: z.number().int().min(1).max(4),
  price:      z.number().int().min(1000, "El precio debe ser de al menos $1.000"),
});

function jsonField<T extends z.ZodTypeAny>(schema: T) {
  return z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "Formato inválido" });
      return z.NEVER;
    }
  }).pipe(schema);
}

const OnboardingSchema = z.object({
  bio:              z.string().min(20, "Cuéntanos un poco más sobre ti (mínimo 20 caracteres)").max(600),
  mi_espacio:       z.string().max(400).optional(),
  valores:          z.string().max(400).optional(),
  profession:       z.string().max(80).trim().optional(),
  neighborhood:     z.string().min(1, "Selecciona una dirección"),
  lat:              z.string().transform(Number).pipe(z.number().finite()),
  lng:              z.string().transform(Number).pipe(z.number().finite()),
  week_pattern:     jsonField(WeekPatternSchema),
  services:         jsonField(z.array(ServiceInputSchema).min(1, "Selecciona al menos un servicio")),
  cedula:           z.string().regex(/^[0-9]{6,12}$/, "Ingresa un número de cédula válido"),
  fecha_nacimiento: z.string().optional(),
  transport_price:  z.string().transform(Number).pipe(
    z.number().int().refine((v) => v === 0 || v > 15000, "El transporte debe ser mayor a $15.000 por trayecto"),
  ),
  experiencia:      z.string().min(1, "Indica tu experiencia con perros"),
  animales_en_casa: z.string().transform((s) => s.length > 0 ? s.split(",").filter(Boolean) : []),
  tipo_inmueble:    z.string().min(1, "Indica el tipo de inmueble"),
  areas_externas:   z.string().transform((s) => s.length > 0 ? s.split(",").filter(Boolean) : []),
  ninos_pequenos:   z.string().transform((s) => s === "true"),
});

export type OnboardingResult = { error: string } | { ok: true };

export async function completarOnboardingPawwer(formData: FormData): Promise<OnboardingResult> {
  const supabase  = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const cedulaFrontPath = (formData.get("cedula_front_path") as string) || "";
  const cedulaBackPath  = (formData.get("cedula_back_path")  as string) || "";

  const raw = {
    bio:              formData.get("bio"),
    mi_espacio:       formData.get("mi_espacio") || undefined,
    valores:          formData.get("valores") || undefined,
    profession:       formData.get("profession") || undefined,
    neighborhood:     formData.get("neighborhood"),
    lat:              formData.get("lat"),
    lng:              formData.get("lng"),
    week_pattern:     formData.get("week_pattern"),
    services:         formData.get("services"),
    cedula:           formData.get("cedula"),
    fecha_nacimiento: formData.get("fecha_nacimiento") || undefined,
    transport_price:  formData.get("transport_price") ?? "0",
    experiencia:      formData.get("experiencia"),
    animales_en_casa: formData.get("animales_en_casa") ?? "",
    tipo_inmueble:    formData.get("tipo_inmueble"),
    areas_externas:   formData.get("areas_externas") ?? "",
    ninos_pequenos:   formData.get("ninos_pequenos") ?? "false",
  };

  const validated = OnboardingSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const {
    bio, mi_espacio, valores, profession, neighborhood, lat, lng,
    week_pattern, services, cedula, fecha_nacimiento, transport_price,
    experiencia, animales_en_casa, tipo_inmueble, areas_externas, ninos_pequenos,
  } = validated.data;

  const { error } = await supabase.rpc("complete_pawwer_onboarding", {
    p_bio:              bio,
    p_profession:       profession ?? null,
    p_neighborhood:     neighborhood,
    p_lat:              lat,
    p_lng:              lng,
    p_week_pattern:     week_pattern,
    p_services:         services,
    p_cedula:           cedula,
    p_transport_price:  transport_price,
    p_experiencia:      experiencia,
    p_animales_en_casa: animales_en_casa,
    p_tipo_inmueble:    tipo_inmueble,
    p_areas_externas:   areas_externas,
    p_fecha_nacimiento: fecha_nacimiento ?? null,
    p_ninos_pequenos:   ninos_pequenos,
    p_mi_espacio:       mi_espacio ?? "",
    p_valores:          valores ?? "",
  });

  if (error) {
    console.error("[Pawwi] completarOnboardingPawwer RPC:", error.message);
    return { error: "No se pudo guardar tu perfil. Intenta de nuevo." };
  }

  // Guardar rutas de fotos de cédula (columnas separadas del RPC)
  if (cedulaFrontPath || cedulaBackPath) {
    await supabase
      .from("pawwer")
      .update({ cedula_front_url: cedulaFrontPath, cedula_back_url: cedulaBackPath })
      .eq("id", user.id);
  }

  return { ok: true };
}
