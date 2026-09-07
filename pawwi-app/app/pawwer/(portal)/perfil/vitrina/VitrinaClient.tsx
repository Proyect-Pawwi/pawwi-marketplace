"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Check, AlertCircle, Plus, X, Baby, Minus, Sparkles } from "lucide-react";
import { updateVitrina, type VitrinaInput } from "@/app/actions/perfil";

const TIPO_INMUEBLE_OPTS    = ["Casa", "Apartamento", "Finca / Casa de campo", "Otro"];
const AREAS_EXTERNAS_OPTS   = ["Patio trasero", "Balcón", "Jardín", "Terraza", "Ninguna"];
const ANIMALES_EN_CASA_OPTS = ["Perros", "Gatos", "Aves / Loros", "Otros animales", "Sin animales"];
const RESPONSE_OPTS         = ["< 1 hora", "< 2 horas", "< 6 horas", "El mismo día"];
// Chips de confianza (se guardan en experience[]) — bajan la fricción vs texto libre.
const EXP_CHIPS = [
  "Cachorros", "Perros senior", "Medicamentos", "Razas grandes",
  "Perros ansiosos", "Rescatados", "Primeros auxilios", "Paseos diarios",
  "Perros pequeños", "Alimentación especial",
];

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-all ${active ? "bg-[#120A2B] text-white border-[#120A2B]" : "bg-white text-[#120A2B]/60 border-gray-200 hover:border-gray-300"}`}>
      {label}
    </button>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[24px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5 space-y-3">
      <div>
        <p className="text-[11px] font-black tracking-widest text-[#120A2B]/40 uppercase">{title}</p>
        {hint && <p className="text-xs text-[#120A2B]/45 mt-1 leading-relaxed">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function VitrinaClient({ initial }: { initial: VitrinaInput }) {
  const [v, setV] = useState<VitrinaInput>(initial);
  const [baseline, setBaseline] = useState<VitrinaInput>(initial); // último estado guardado
  const [customExp, setCustomExp] = useState("");
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(v) !== JSON.stringify(baseline), [v, baseline]);

  // Medidor de completitud
  const pct = useMemo(() => {
    const flags = [
      v.profession.trim() !== "",
      v.bio.trim().length >= 20,
      v.yearsExperience > 0,
      v.responseTime !== "",
      v.experience.length > 0,
      v.tipoInmueble !== "",
      v.areasExternas.length > 0,
      v.animalesEnCasa.length > 0,
      v.miEspacio.trim() !== "",
    ];
    return Math.round((flags.filter(Boolean).length / flags.length) * 100);
  }, [v]);

  const customItems = v.experience.filter((e) => !EXP_CHIPS.includes(e));

  function set<K extends keyof VitrinaInput>(k: K, val: VitrinaInput[K]) {
    setV((prev) => ({ ...prev, [k]: val }));
  }
  function toggleArr(k: "animalesEnCasa" | "areasExternas", opt: string) {
    setV((prev) => {
      const arr = prev[k];
      return { ...prev, [k]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
    });
  }
  function toggleExp(chip: string) {
    set("experience", v.experience.includes(chip) ? v.experience.filter((x) => x !== chip) : [...v.experience, chip]);
  }
  function addCustomExp() {
    const t = customExp.trim();
    if (!t || v.experience.includes(t)) { setCustomExp(""); return; }
    set("experience", [...v.experience, t]);
    setCustomExp("");
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await updateVitrina(v);
      if (res.error) setError(res.error);
      else { setBaseline(v); setSaved(true); setTimeout(() => setSaved(false), 2500); }
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
            <h1 className="text-2xl font-black text-[#120A2B] leading-none mt-0.5">Presentación</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-red-600">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {/* Medidor de completitud */}
        <div className="bg-white rounded-[20px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-[#120A2B] flex items-center gap-1.5">
              <Sparkles size={13} className="text-[#FF7031]" /> Perfil {pct}% completo
            </p>
            <span className="text-[11px] font-bold text-[#120A2B]/40">Más completo = más reservas</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-[#FF7031] transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Lo esencial */}
        <Card title="Lo esencial">
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-1.5">Profesión</label>
            <input value={v.profession} onChange={(e) => set("profession", e.target.value)} maxLength={60}
              placeholder="Ej: Veterinaria, Estudiante, Diseñadora…"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-[#120A2B] focus:outline-none focus:border-gray-400 bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-2">Años de experiencia</label>
              <div className="flex items-center gap-2">
                <button onClick={() => set("yearsExperience", Math.max(0, v.yearsExperience - 1))}
                  className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-[#120A2B] hover:border-[#120A2B]"><Minus size={14} /></button>
                <span className="text-base font-black text-[#120A2B] w-8 text-center tabular-nums">{v.yearsExperience}</span>
                <button onClick={() => set("yearsExperience", Math.min(40, v.yearsExperience + 1))}
                  className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-[#120A2B] hover:border-[#120A2B]"><Plus size={14} /></button>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-2">Tiempo de respuesta</label>
            <div className="flex flex-wrap gap-2">
              {RESPONSE_OPTS.map((o) => <Chip key={o} label={o} active={v.responseTime === o} onClick={() => set("responseTime", o)} />)}
            </div>
          </div>
        </Card>

        {/* Tu historia */}
        <Card title="Tu historia" hint="Un párrafo corto y cálido genera confianza. Ej: quién eres, por qué amas los perros y qué hace especial tu cuidado.">
          <textarea value={v.bio} onChange={(e) => set("bio", e.target.value)} rows={4} maxLength={500}
            placeholder="Ej: Soy Ana, veterinaria y mamá de dos labradores. Llevo 6 años cuidando perros como si fueran míos: paseos diarios, mucho cariño y un patio seguro para que jueguen…"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-[#120A2B] focus:outline-none focus:border-gray-400 resize-none bg-white" />
          <p className="text-[10px] text-[#120A2B]/35 text-right">{v.bio.length}/500</p>
        </Card>

        {/* Experiencia con mascotas (chips) */}
        <Card title="Experiencia con mascotas" hint="Marca en qué tienes experiencia. Los clientes lo ven como sellos de confianza.">
          <div className="flex flex-wrap gap-2">
            {EXP_CHIPS.map((c) => <Chip key={c} label={c} active={v.experience.includes(c)} onClick={() => toggleExp(c)} />)}
          </div>
          {customItems.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {customItems.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#120A2B] text-white">
                  {c}
                  <button onClick={() => set("experience", v.experience.filter((x) => x !== c))}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <input value={customExp} onChange={(e) => setCustomExp(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomExp(); } }}
              placeholder="Agregar otra…" maxLength={40}
              className="flex-1 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-[#120A2B] focus:outline-none focus:border-gray-400 bg-white" />
            <button onClick={addCustomExp} className="w-10 h-10 rounded-full bg-[#120A2B] text-white flex items-center justify-center shrink-0"><Plus size={18} /></button>
          </div>
        </Card>

        {/* Tu hogar */}
        <Card title="Tu hogar" hint="Ayuda al cliente a imaginar dónde estará su perrito.">
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-2">Tipo de hogar</label>
            <div className="flex flex-wrap gap-2">
              {TIPO_INMUEBLE_OPTS.map((o) => <Chip key={o} label={o} active={v.tipoInmueble === o} onClick={() => set("tipoInmueble", o)} />)}
            </div>
          </div>
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-2">Áreas externas</label>
            <div className="flex flex-wrap gap-2">
              {AREAS_EXTERNAS_OPTS.map((o) => <Chip key={o} label={o} active={v.areasExternas.includes(o)} onClick={() => toggleArr("areasExternas", o)} />)}
            </div>
          </div>
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-2">Animales en casa</label>
            <div className="flex flex-wrap gap-2">
              {ANIMALES_EN_CASA_OPTS.map((o) => <Chip key={o} label={o} active={v.animalesEnCasa.includes(o)} onClick={() => toggleArr("animalesEnCasa", o)} />)}
            </div>
          </div>
          <button onClick={() => set("ninosPequenos", !v.ninosPequenos)}
            className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
            <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center text-[#FF7031] shrink-0"><Baby size={16} /></div>
            <span className="flex-1 text-sm font-bold text-[#120A2B] text-left">Hay niños pequeños en casa</span>
            <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${v.ninosPequenos ? "bg-green-500" : "bg-gray-300"}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${v.ninosPequenos ? "left-[22px]" : "left-0.5"}`} />
            </span>
          </button>
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-1.5">Tu espacio y seguridad</label>
            <textarea value={v.miEspacio} onChange={(e) => set("miEspacio", e.target.value)} rows={2} maxLength={400}
              placeholder="Describe tu espacio y las medidas de seguridad para las mascotas…"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-[#120A2B] focus:outline-none focus:border-gray-400 resize-none bg-white" />
          </div>
        </Card>
      </main>

      {(dirty || saved) && (
        <div className="fixed inset-x-0 bottom-0 z-[60] bg-white/90 backdrop-blur-xl border-t border-white/60 shadow-[0_-4px_16px_rgba(18,10,43,0.06)] px-6 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}>
          <div className="max-w-xl mx-auto">
            <button onClick={save} disabled={saving || !dirty}
              className="w-full py-3.5 rounded-full font-black text-sm bg-[#120A2B] text-white flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] shadow-[0_8px_20px_rgba(18,10,43,0.25)] transition-transform">
              {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
              {saving ? "Guardando…" : saved ? "Guardado" : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
