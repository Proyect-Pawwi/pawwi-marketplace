"use client";

import { useActionState, useState, useRef } from "react";
import { crearMascota, type DogState } from "@/app/actions/dogs";
import { createClient } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Camera, Loader2 } from "lucide-react";

const DOG_SIZES = [
  { id: 1, label: "Pequeño",     emoji: "🐩", desc: "< 10 kg" },
  { id: 2, label: "Mediano",     emoji: "🐕", desc: "10–25 kg" },
  { id: 3, label: "Grande",      emoji: "🦮", desc: "25–45 kg" },
  { id: 4, label: "Extra grande",emoji: "🐕‍🦺", desc: "> 45 kg" },
];

export default function DogForm() {
  const [state, action, pending] = useActionState<DogState, FormData>(crearMascota, undefined);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [selectedSex, setSelectedSex]   = useState<"macho" | "hembra" | null>(null);
  const [photoUrl, setPhotoUrl]         = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("La foto no puede superar 5 MB");
      return;
    }

    setUploading(true);
    setUploadError(null);

    // Preview local inmediato
    setPhotoPreview(URL.createObjectURL(file));

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("dog-photos")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (error) {
      setUploadError("No se pudo subir la foto. Continúa sin foto.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("dog-photos").getPublicUrl(path);
    setPhotoUrl(urlData.publicUrl);
    setUploading(false);
  }

  return (
    <form action={action} className="space-y-5">
      {state?.message && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-body">
          {state.message}
        </div>
      )}

      {/* Foto */}
      <div className="flex flex-col items-center gap-3 pb-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative w-24 h-24 rounded-2xl bg-[#FFF1EB] border-2 border-dashed border-[#FF7031]/40 flex items-center justify-center overflow-hidden hover:border-[#FF7031] transition-colors"
        >
          {uploading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-[#FF7031]" />
            </div>
          )}
          {photoPreview
            ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
            : <Camera size={24} className="text-[#FF7031]/60" />
          }
        </button>
        <span className="text-xs text-midnight/50 font-body">
          {uploading ? "Subiendo foto..." : "Foto de tu perro (opcional)"}
        </span>
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handlePhoto} />
        <input type="hidden" name="photo_url" value={photoUrl} />
      </div>

      <Input
        label="Nombre del perro"
        name="name"
        placeholder="¿Cómo se llama?"
        maxLength={40}
        error={state?.errors?.name?.[0]}
      />

      <Input
        label="Raza"
        name="breed"
        placeholder="Ej: Golden Retriever, Labrador..."
        maxLength={60}
        error={state?.errors?.breed?.[0]}
      />

      {/* Tamaño */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-midnight font-body">Tamaño</span>
        <div className="grid grid-cols-2 gap-2">
          {DOG_SIZES.map((s) => (
            <label
              key={s.id}
              className={[
                "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all",
                selectedSize === s.id
                  ? "bg-[#120A2B] border-[#120A2B] text-white"
                  : "bg-white border-gray-200 hover:border-gray-300",
              ].join(" ")}
            >
              <input
                type="radio"
                name="size"
                value={s.id}
                className="sr-only"
                checked={selectedSize === s.id}
                onChange={() => setSelectedSize(s.id)}
              />
              <span className="text-xl">{s.emoji}</span>
              <div>
                <p className={`text-xs font-extrabold ${selectedSize === s.id ? "text-white" : "text-midnight"}`}>
                  {s.label}
                </p>
                <p className={`text-[10px] ${selectedSize === s.id ? "text-white/70" : "text-gray-400"}`}>
                  {s.desc}
                </p>
              </div>
            </label>
          ))}
        </div>
        {state?.errors?.size && (
          <p className="text-sm text-red-500 font-body">{state.errors.size[0]}</p>
        )}
      </div>

      {/* Edad + Peso */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Edad (años)"
          name="age"
          type="number"
          placeholder="Ej: 3"
          min={0}
          max={30}
          error={state?.errors?.age?.[0]}
        />
        <Input
          label="Peso (kg)"
          name="weight_kg"
          type="number"
          step="0.5"
          placeholder="Ej: 15"
          min={0.5}
          max={120}
          error={state?.errors?.weight_kg?.[0]}
        />
      </div>

      {/* Sexo */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-midnight font-body">
          Sexo <span className="text-gray-400 font-normal">(opcional)</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: "macho",  label: "Macho",  emoji: "♂️" },
            { value: "hembra", label: "Hembra", emoji: "♀️" },
          ] as const).map((s) => (
            <label
              key={s.value}
              className={[
                "flex items-center justify-center gap-2 p-3 rounded-2xl border cursor-pointer transition-all text-sm font-extrabold",
                selectedSex === s.value
                  ? "bg-[#120A2B] border-[#120A2B] text-white"
                  : "bg-white border-gray-200 text-midnight hover:border-gray-300",
              ].join(" ")}
            >
              <input
                type="radio"
                name="sex"
                value={s.value}
                className="sr-only"
                checked={selectedSex === s.value}
                onChange={() => setSelectedSex(s.value)}
              />
              <span>{s.emoji}</span>
              {s.label}
            </label>
          ))}
        </div>
      </div>

      {/* Vacunas */}
      <label className="flex items-start gap-3 cursor-pointer bg-white/70 border border-white rounded-2xl p-4">
        <input
          type="checkbox"
          name="vaccine"
          defaultChecked
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#FF7031]"
        />
        <div>
          <p className="text-sm font-extrabold text-midnight">Vacunas al día</p>
          <p className="text-xs text-midnight/50 font-body">
            Triple viral, rabia y demás vacunas recomendadas
          </p>
        </div>
      </label>

      {/* Notas */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-midnight font-body" htmlFor="notes">
          Notas adicionales <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={300}
          placeholder="Alergias, medicamentos, comportamiento con otros perros..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-midnight font-body outline-none focus:border-[#FF7031] focus:ring-1 focus:ring-[#FF7031]/30 transition resize-none"
        />
      </div>

      <Button
        type="submit"
        loading={pending || uploading}
        className="w-full mt-2"
      >
        {pending ? "Guardando..." : "Guardar mascota"}
      </Button>
    </form>
  );
}
