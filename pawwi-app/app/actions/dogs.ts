"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";

const DogSchema = z.object({
  name:      z.string().min(1, "El nombre es requerido").max(40).trim(),
  breed:     z.string().min(1, "La raza es requerida").max(60).trim(),
  size:      z.coerce.number().int().min(1).max(4),
  age:       z.coerce.number().int().min(0).max(30).optional(),
  weight_kg: z.coerce.number().min(0.5, "Peso inválido").max(120, "Peso inválido").optional(),
  sex:       z.enum(["macho", "hembra"]).optional(),
  vaccine:   z.enum(["on", "off"]).transform(v => v === "on"),
  notes:     z.string().max(300).trim().optional(),
  photo_url: z.string().url().optional().or(z.literal("")),
});

export type DogState = {
  errors?: {
    name?: string[];
    breed?: string[];
    size?: string[];
    age?: string[];
    weight_kg?: string[];
    sex?: string[];
    vaccine?: string[];
    notes?: string[];
  };
  message?: string;
} | undefined;

export async function crearMascota(
  _state: DogState,
  formData: FormData
): Promise<DogState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Debes iniciar sesión para agregar una mascota." };

  const raw = {
    name:      formData.get("name"),
    breed:     formData.get("breed"),
    size:      formData.get("size"),
    age:       formData.get("age") || undefined,
    weight_kg: formData.get("weight_kg") || undefined,
    sex:       formData.get("sex") || undefined,
    vaccine:   formData.get("vaccine") ?? "off",
    notes:     formData.get("notes") || undefined,
    photo_url: formData.get("photo_url") || undefined,
  };

  const validated = DogSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, breed, size, age, weight_kg, sex, vaccine, notes, photo_url } = validated.data;

  const { error } = await supabase.from("dog").insert({
    owner_id:  user.id,
    name,
    breed,
    size,
    age:       age ?? null,
    weight_kg: weight_kg ?? null,
    sex:       sex ?? null,
    vaccine,
    notes:     notes ?? null,
    photo_url: photo_url || null,
  });

  if (error) {
    console.error("[Pawwi] crearMascota:", error.message);
    return { message: "No se pudo guardar la mascota. Intenta de nuevo." };
  }

  redirect("/mis-mascotas");
}

export async function eliminarMascota(dogId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("dog").delete().eq("id", dogId).eq("owner_id", user.id);
  redirect("/mis-mascotas");
}
