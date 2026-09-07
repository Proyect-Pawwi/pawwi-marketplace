"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Check, AlertCircle, Minus, Plus, Sparkles, Car } from "lucide-react";
import { updateServicePrice } from "@/app/actions/portal";
import { setServiceActive, updateServiceRules, setTransportPrice } from "@/app/actions/perfil";

export interface ServiceEdit {
  idService: number;
  name: string;
  price: number;
  isActive: boolean;
  maxAnimals: number;
  maxSize: number;
}

const SERVICE_DISPLAY: Record<string, string> = {
  DayCare: "Guardería (DayCare)",
  Night:   "Pernocta (NightCare)",
  Travel:  "Viaje (Travel)",
  Express: "Express",
};
const SIZE_OPTS = [
  { v: 1, label: "Pequeño" },
  { v: 2, label: "Mediano" },
  { v: 3, label: "Grande" },
];

function fmtCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

export default function TarifasClient({
  services: initial, rating, reviewsCount, transportPrice: initialTransport,
}: {
  services: ServiceEdit[];
  rating: number;
  reviewsCount: number;
  transportPrice: number;
}) {
  const [services, setServices] = useState<ServiceEdit[]>(initial);
  const [transport, setTransport] = useState<number>(initialTransport);
  // Baseline = último estado guardado. Se actualiza al guardar (y al togglear
  // activo, que persiste solo) para que la barra "Guardar" desaparezca.
  const [baseServices, setBaseServices] = useState<ServiceEdit[]>(initial);
  const [baseTransport, setBaseTransport] = useState<number>(initialTransport);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isElite = rating >= 4.8 && reviewsCount >= 15;
  const rate = isElite ? 0.20 : 0.25;
  const pct = Math.round(rate * 100);

  const dirty = useMemo(
    () => JSON.stringify(services) !== JSON.stringify(baseServices) || transport !== baseTransport,
    [services, baseServices, transport, baseTransport],
  );

  function patch(id: number, p: Partial<ServiceEdit>) {
    setServices((prev) => prev.map((s) => (s.idService === id ? { ...s, ...p } : s)));
  }

  function toggleActive(s: ServiceEdit) {
    const next = !s.isActive;
    patch(s.idService, { isActive: next });
    startSave(async () => {
      const res = await setServiceActive(s.idService, next);
      if (res.error) { patch(s.idService, { isActive: !next }); setError(res.error); }
      // Persiste al instante → mueve también el baseline para no marcar "dirty".
      else setBaseServices((b) => b.map((x) => (x.idService === s.idService ? { ...x, isActive: next } : x)));
    });
  }

  function saveAll() {
    setError(null);
    startSave(async () => {
      for (const s of services) {
        const orig = baseServices.find((o) => o.idService === s.idService) ?? s;
        if (orig.price !== s.price) {
          const r = await updateServicePrice(s.idService, s.price);
          if (r.error) { setError(r.error); return; }
        }
        if (orig.maxAnimals !== s.maxAnimals || orig.maxSize !== s.maxSize) {
          const r = await updateServiceRules(s.idService, s.maxAnimals, s.maxSize);
          if (r.error) { setError(r.error); return; }
        }
      }
      if (transport !== baseTransport) {
        const r = await setTransportPrice(transport);
        if (r.error) { setError(r.error); return; }
      }
      setBaseServices(services);
      setBaseTransport(transport);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
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
            <p className="eyebrow text-[#FF7031] ">Servicios</p>
            <h1 className="text-2xl font-black text-[#120A2B] leading-none mt-0.5">Tarifas y reglas</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-red-600">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {/* Banner de comisión / tier */}
        <div className={`rounded-[20px] px-4 py-3 flex items-center gap-2.5 ${isElite ? "bg-[#120A2B] text-white" : "bg-[#E0F2FE] text-[#0284C7]"}`}>
          <Sparkles size={16} className="shrink-0" />
          <p className="text-xs font-bold leading-relaxed">
            {isElite
              ? `Eres élite: Pawwi retiene solo ${pct}% de cada cuidado.`
              : `Pawwi retiene ${pct}%. Llega a 4.8★ con 15 reseñas para bajar a 20%.`}
          </p>
        </div>

        {services.length === 0 && (
          <div className="bg-white/70 rounded-[24px] border border-white p-8 text-center text-sm text-[#120A2B]/40">
            No tienes servicios configurados.
          </div>
        )}

        {services.map((s) => {
          const net = s.price - Math.round(s.price * rate);
          return (
            <div key={s.idService} className={`bg-white rounded-[24px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5 space-y-4 transition-opacity ${s.isActive ? "" : "opacity-60"}`}>
              {/* Header + toggle */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-[#120A2B]">{SERVICE_DISPLAY[s.name] ?? s.name}</p>
                <button onClick={() => toggleActive(s)} className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${s.isActive ? "bg-green-500" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${s.isActive ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>

              {/* Precio + calculadora */}
              <div>
                <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-1.5">Precio</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#120A2B]/40">$</span>
                  <input type="number" min={0} value={s.price}
                    onChange={(e) => patch(s.idService, { price: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                    className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-[#120A2B] focus:outline-none focus:border-gray-400" />
                </div>
                <div className="mt-2 bg-[#FFF1EB]/70 border border-[#FF7031]/10 rounded-xl px-3.5 py-2.5">
                  <p className="text-xs text-[#120A2B]/60 leading-relaxed">
                    Tú cobras <span className="font-black text-[#120A2B]">{fmtCOP(s.price)}</span> · Pawwi retiene {pct}% · Recibes{" "}
                    <span className="font-black text-green-600">{fmtCOP(net)}</span>
                  </p>
                </div>
              </div>

              {/* Reglas de mascotas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-2">Tamaño máx.</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SIZE_OPTS.map((o) => (
                      <button key={o.v} onClick={() => patch(s.idService, { maxSize: o.v })}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${s.maxSize === o.v ? "bg-[#120A2B] text-white border-[#120A2B]" : "bg-white text-[#120A2B]/60 border-gray-200"}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-2">Máx. a la vez</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => patch(s.idService, { maxAnimals: Math.max(1, s.maxAnimals - 1) })}
                      className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-[#120A2B] hover:border-[#120A2B]">
                      <Minus size={14} />
                    </button>
                    <span className="text-base font-black text-[#120A2B] w-6 text-center">{s.maxAnimals}</span>
                    <button onClick={() => patch(s.idService, { maxAnimals: Math.min(10, s.maxAnimals + 1) })}
                      className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-[#120A2B] hover:border-[#120A2B]">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Transporte (pawwer.transport_price) */}
        <div className="bg-white rounded-[24px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
              <Car size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-[#120A2B]">Transporte</p>
              <p className="text-xs text-[#120A2B]/45">Precio por trayecto (recoger o entregar)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#120A2B]/40">$</span>
            <input type="number" min={0} value={transport}
              onChange={(e) => setTransport(Math.max(0, parseInt(e.target.value || "0", 10)))}
              className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-[#120A2B] focus:outline-none focus:border-gray-400" />
          </div>
          <div className="bg-[#E0F2FE]/40 border border-[#0284C7]/10 rounded-xl px-3.5 py-2.5">
            <p className="text-xs text-[#120A2B]/60 leading-relaxed">
              {transport > 0
                ? <>Si tú haces el transporte recibes <span className="font-black text-[#0284C7]">{fmtCOP(transport - Math.round(transport * rate))}</span> por trayecto (Pawwi retiene {pct}%).</>
                : "Déjalo en $0 si no ofreces transporte."}
            </p>
          </div>
        </div>
      </main>

      {(dirty || saved) && (
        <div className="fixed inset-x-0 bottom-0 z-[60] bg-white/90 backdrop-blur-xl border-t border-white/60 shadow-[0_-4px_16px_rgba(18,10,43,0.06)] px-6 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}>
          <div className="max-w-xl mx-auto">
            <button onClick={saveAll} disabled={saving || !dirty}
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
