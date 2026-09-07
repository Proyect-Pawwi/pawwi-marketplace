"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";

// ── Vitrina (perfil público editable) ───────────────────────────────────────
export interface VitrinaInput {
  profession: string;
  bio: string;
  experience: string[];
  responseTime: string;
  neighborhood: string;
  animalesEnCasa: string[];
  tipoInmueble: string;
  areasExternas: string[];
  ninosPequenos: boolean;
  miEspacio: string;
  valores: string;
  yearsExperience: number;
}

export async function updateVitrina(v: VitrinaInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_pawwer_vitrina", {
    p_profession: v.profession,
    p_bio: v.bio,
    p_experience: v.experience,
    p_response_time: v.responseTime,
    p_neighborhood: v.neighborhood,
    p_animales_en_casa: v.animalesEnCasa,
    p_tipo_inmueble: v.tipoInmueble,
    p_areas_externas: v.areasExternas,
    p_ninos_pequenos: v.ninosPequenos,
    p_mi_espacio: v.miEspacio,
    p_valores: v.valores,
    p_years: v.yearsExperience,
  });
  if (error) return { error: error.message || "No se pudo guardar la vitrina." };
  revalidatePath("/pawwer/perfil");
  return {};
}

// ── FAQ (columna jsonb pawwer.faqs) ─────────────────────────────────────────
export interface FaqItem { q: string; a: string; }

export async function updateFaqs(faqs: FaqItem[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const clean = faqs
    .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
    .filter((f) => f.q && f.a);
  const { error } = await supabase.rpc("update_pawwer_faqs", { p_faqs: clean });
  if (error) return { error: error.message || "No se pudieron guardar las preguntas." };
  revalidatePath("/pawwer/perfil");
  return {};
}

// ── Estado global: pausar perfil / horarios ─────────────────────────────────
export async function setAcceptingBookings(on: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_accepting_bookings", { p_on: on });
  if (error) return { error: "No se pudo actualizar el estado del perfil." };
  revalidatePath("/pawwer/perfil");
  return {};
}

export async function setRecepcionHorario(
  desde: string | null,
  hasta: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_recepcion_horario", { p_desde: desde, p_hasta: hasta });
  if (error) return { error: "No se pudo guardar el horario." };
  revalidatePath("/pawwer/perfil");
  return {};
}

// ── Datos de pago (write-only) ──────────────────────────────────────────────
export interface PagoInput {
  banco: string;
  tipo: string;
  numero: string;   // vacío = conservar el existente
  titular: string;
  documento: string;
  llaveTipo: string;
  llaveValor: string;
  certPath: string; // vacío = conservar el existente
}

export async function updatePago(p: PagoInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_pawwer_pago", {
    p_banco: p.banco,
    p_tipo: p.tipo,
    p_numero: p.numero,
    p_titular: p.titular,
    p_documento: p.documento,
    p_llave_tipo: p.llaveTipo,
    p_llave_valor: p.llaveValor,
    p_cert_path: p.certPath,
  });
  // El RPC valida cert obligatorio y método → propagamos su mensaje.
  if (error) return { error: error.message || "No se pudieron guardar los datos de pago." };
  revalidatePath("/pawwer/perfil");
  return {};
}

// ── Servicios: activar/desactivar + reglas ──────────────────────────────────
export async function setServiceActive(idService: number, on: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_service_active", { p_id_service: idService, p_on: on });
  if (error) return { error: "No se pudo actualizar el servicio." };
  revalidatePath("/pawwer/perfil");
  return {};
}

export async function updateServiceRules(
  idService: number,
  maxAnimals: number,
  maxSize: number,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_service_rules", {
    p_id_service: idService,
    p_max_animals: maxAnimals,
    p_max_size: maxSize,
  });
  if (error) return { error: error.message || "No se pudieron guardar las reglas." };
  revalidatePath("/pawwer/perfil");
  return {};
}

// Precio del transporte por trayecto (pawwer.transport_price).
export async function setTransportPrice(price: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_transport_price", { p_price: price });
  if (error) return { error: error.message || "No se pudo guardar el transporte." };
  revalidatePath("/pawwer/perfil");
  return {};
}

// ── Desactivar cuenta (soft-delete) ─────────────────────────────────────────
export async function deactivateAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_pawwer_account");
  if (error) return { error: "No se pudo desactivar la cuenta." };
  await supabase.auth.signOut();
  return {};
}
