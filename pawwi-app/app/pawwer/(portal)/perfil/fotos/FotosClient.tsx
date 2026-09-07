"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, ImagePlus, Trash2, ChevronUp, ChevronDown, Camera } from "lucide-react";
import { createClient } from "@/lib/client";
import { resizeImage } from "@/lib/image";

const MAX_PHOTOS = 8;

export default function FotosClient({ userId, initial }: { userId: string; initial: string[] }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (urls.length >= MAX_PHOTOS) { setError(`Máximo ${MAX_PHOTOS} fotos.`); return; }
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const blob = await resizeImage(file, 1440, 0.82);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("pawwer-images").upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("pawwer-images").getPublicUrl(path);
      const { error: rpcErr } = await supabase.rpc("add_pawwer_image", { p_url: publicUrl });
      if (rpcErr) throw rpcErr;
      setUrls((prev) => [...prev, publicUrl]);
    } catch (err) {
      console.error("Error subiendo foto del hogar:", err);
      setError("No se pudo subir la foto. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  function remove(url: string) {
    setError(null);
    const prev = urls;
    setUrls((u) => u.filter((x) => x !== url));
    startBusy(async () => {
      const supabase = createClient();
      const { error: rpcErr } = await supabase.rpc("delete_pawwer_image", { p_url: url });
      if (rpcErr) { setUrls(prev); setError("No se pudo eliminar la foto."); return; }
      // Best-effort: borrar el objeto del Storage (ruta tras /public/pawwer-images/)
      const marker = "/public/pawwer-images/";
      const idx = url.indexOf(marker);
      if (idx !== -1) await supabase.storage.from("pawwer-images").remove([url.slice(idx + marker.length)]);
    });
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= urls.length) return;
    const next = [...urls];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setUrls(next);
    startBusy(async () => {
      const supabase = createClient();
      const { error: rpcErr } = await supabase.rpc("reorder_pawwer_images", { p_urls: next });
      if (rpcErr) setError("No se pudo reordenar.");
    });
  }

  return (
    <div className="min-h-screen relative pb-10 font-sans">
      <header className="relative z-20 pt-12 pb-3">
        <div className="max-w-xl mx-auto px-6 flex items-center gap-4">
          <Link href="/pawwer/perfil" className="w-10 h-10 bg-white/80 backdrop-blur-md border border-white rounded-[14px] flex items-center justify-center text-[#120A2B] shadow-[0_8px_20px_rgba(18,10,43,0.05)] active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="eyebrow text-[#FF7031] ">Tu vitrina</p>
            <h1 className="text-2xl font-black text-[#120A2B] leading-none mt-0.5">Fotos del hogar</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-red-600">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="flex items-start gap-2.5 bg-[#FFF1EB]/70 border border-[#FF7031]/10 rounded-2xl px-4 py-3">
          <Camera size={16} className="text-[#FF7031] shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-[#120A2B]/60 leading-relaxed">
            Las fotos claras de dónde dormirá el perrito <span className="font-black text-[#120A2B]">aumentan tus reservas hasta un 40%</span>. La primera es la portada.
          </p>
        </div>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

        <div className="grid grid-cols-2 gap-3">
          {urls.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-[20px] overflow-hidden border border-white shadow-[0_10px_30px_-12px_rgba(18,10,43,0.15)] bg-gray-100 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-widest text-white bg-[#FF7031] px-2 py-1 rounded-full shadow">Portada</span>
              )}
              <button onClick={() => remove(url)} disabled={busy}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-500 transition-colors disabled:opacity-50">
                <Trash2 size={14} />
              </button>
              <div className="absolute bottom-2 right-2 flex gap-1">
                <button onClick={() => move(i, -1)} disabled={busy || i === 0}
                  className="w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm text-[#120A2B] flex items-center justify-center disabled:opacity-30 shadow">
                  <ChevronUp size={15} />
                </button>
                <button onClick={() => move(i, 1)} disabled={busy || i === urls.length - 1}
                  className="w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm text-[#120A2B] flex items-center justify-center disabled:opacity-30 shadow">
                  <ChevronDown size={15} />
                </button>
              </div>
            </div>
          ))}

          {urls.length < MAX_PHOTOS && (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="aspect-square rounded-[20px] border-2 border-dashed border-[#FF7031]/30 bg-white/60 flex flex-col items-center justify-center gap-2 text-[#FF7031] hover:bg-white transition-colors disabled:opacity-60">
              {uploading ? <Loader2 size={26} className="animate-spin" /> : <ImagePlus size={26} />}
              <span className="text-xs font-bold">{uploading ? "Subiendo…" : "Agregar foto"}</span>
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-[#120A2B]/35">{urls.length}/{MAX_PHOTOS} fotos · usa las flechas para reordenar</p>
      </main>
    </div>
  );
}
