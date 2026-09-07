"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Check, AlertCircle, Plus, Trash2, HelpCircle } from "lucide-react";
import { updateFaqs, type FaqItem } from "@/app/actions/perfil";

export default function FaqClient({ initial }: { initial: FaqItem[] }) {
  const [faqs, setFaqs] = useState<FaqItem[]>(initial);
  const [baseline, setBaseline] = useState<FaqItem[]>(initial); // último estado guardado
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(faqs) !== JSON.stringify(baseline), [faqs, baseline]);

  function patch(i: number, p: Partial<FaqItem>) {
    setFaqs((prev) => prev.map((f, j) => (j === i ? { ...f, ...p } : f)));
  }
  function add() {
    if (faqs.length >= 12) return;
    setFaqs((prev) => [...prev, { q: "", a: "" }]);
  }
  function remove(i: number) {
    setFaqs((prev) => prev.filter((_, j) => j !== i));
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await updateFaqs(faqs);
      if (res.error) setError(res.error);
      else {
        const cleaned = faqs.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q && f.a);
        setFaqs(cleaned);
        setBaseline(cleaned);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  return (
    <div className="min-h-screen relative pb-28 font-sans">
      <header className="relative z-20 pt-12 pb-3">
        <div className="max-w-xl mx-auto px-6 flex items-center gap-4">
          <Link href="/pawwer/perfil" className="w-10 h-10 bg-white/80 backdrop-blur-md border border-white rounded-[14px] flex items-center justify-center text-[#120A2B] shadow-[0_8px_20px_rgba(18,10,43,0.05)] active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="eyebrow text-[#FF7031] ">Tu vitrina</p>
            <h1 className="text-2xl font-black text-[#120A2B] leading-none mt-0.5">Preguntas frecuentes</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-3">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-red-600">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <p className="text-xs text-[#120A2B]/50 leading-relaxed px-1">
          Responde de antemano las dudas típicas de tus clientes (ej: &quot;¿Aceptas perros grandes?&quot;). Aparecen en tu perfil público.
        </p>

        {faqs.length === 0 && (
          <div className="bg-white/70 backdrop-blur-sm rounded-[28px] border border-white/80 p-10 text-center shadow-[0_12px_30px_rgba(18,10,43,0.03)]">
            <div className="w-14 h-14 rounded-full bg-[#FFF1EB] flex items-center justify-center mx-auto mb-3">
              <HelpCircle size={24} className="text-[#FF7031]" />
            </div>
            <p className="text-sm font-black text-[#120A2B]">Sin preguntas aún</p>
            <p className="text-xs text-[#120A2B]/45 mt-1.5">Agrega tu primera pregunta frecuente.</p>
          </div>
        )}

        {faqs.map((f, i) => (
          <div key={i} className="bg-white rounded-[22px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow text-[#120A2B]/35 tracking-widest">Pregunta {i + 1}</span>
              <button onClick={() => remove(i)} className="text-[#120A2B]/30 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
            <input value={f.q} onChange={(e) => patch(i, { q: e.target.value })} maxLength={120}
              placeholder="¿Cuál es la pregunta?"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-bold text-[#120A2B] focus:outline-none focus:border-gray-400 bg-white" />
            <textarea value={f.a} onChange={(e) => patch(i, { a: e.target.value })} rows={2} maxLength={400}
              placeholder="Tu respuesta…"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-[#120A2B] focus:outline-none focus:border-gray-400 resize-none bg-white" />
          </div>
        ))}

        {faqs.length < 12 && (
          <button onClick={add}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-[#120A2B] bg-white/70 border border-dashed border-[#FF7031]/30 hover:bg-white transition-colors">
            <Plus size={16} className="text-[#FF7031]" /> Agregar pregunta
          </button>
        )}
      </main>

      {(dirty || saved) && (
        <div className="fixed inset-x-0 bottom-0 z-[60] bg-white/90 backdrop-blur-xl border-t border-white/60 shadow-[0_-4px_16px_rgba(18,10,43,0.06)] px-6 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}>
          <div className="max-w-xl mx-auto">
            <button onClick={save} disabled={saving || !dirty}
              className="w-full py-3.5 rounded-full font-black text-sm bg-[#120A2B] text-white flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] shadow-[0_8px_20px_rgba(18,10,43,0.25)] transition-transform">
              {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
              {saving ? "Guardando…" : saved ? "Guardado" : "Guardar preguntas"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
