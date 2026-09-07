"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2, Check, CalendarCheck, Lock, Unlock, Info, X } from "lucide-react";
import { createClient } from "@/lib/client";

const MESES      = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DIAS_SHORT = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];
const MAX_RANGE = 30;

interface Props {
  pawwerId:     string;
  initialAvail: Record<string, number>;
  rangeStart:   string;
  rangeEnd:     string;
}

function toISO(d: Date): string { return d.toISOString().split("T")[0]!; }
function fmtShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MESES_SHORT[d.getMonth()]}`;
}

export default function DisponibilidadCalendar({ pawwerId, initialAvail, rangeEnd }: Props) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const [avail, setAvail]     = useState<Record<string, number>>({ ...initialAvail });
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd]     = useState<string | null>(null);
  const [selNote, setSelNote]   = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const isOpen = useCallback((iso: string) => avail[iso] !== undefined && avail[iso]! > 0, [avail]);

  // Días del rango [selStart .. selEnd||selStart], solo futuros.
  const rangeDays = useMemo(() => {
    if (!selStart) return [] as string[];
    const start = new Date(selStart + "T00:00:00");
    const end   = new Date((selEnd ?? selStart) + "T00:00:00");
    const out: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const dd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()); dd.setHours(0, 0, 0, 0);
      if (dd >= today) out.push(toISO(dd));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [selStart, selEnd, today]);
  const rangeSet = useMemo(() => new Set(rangeDays), [rangeDays]);

  function handleDayTap(iso: string) {
    setSelNote(null);
    if (!selStart || selEnd) { setSelStart(iso); setSelEnd(null); return; }  // nuevo ancla
    if (iso < selStart)      { setSelStart(iso); setSelEnd(null); return; }  // reanclar antes
    if (iso === selStart)    { setSelEnd(iso); return; }                     // 1 día
    // iso > selStart → formar rango, cap 30 días
    const s = new Date(selStart + "T00:00:00");
    const e = new Date(iso + "T00:00:00");
    const diff = Math.round((e.getTime() - s.getTime()) / 86_400_000);
    if (diff > MAX_RANGE - 1) {
      const capped = new Date(s); capped.setDate(capped.getDate() + MAX_RANGE - 1);
      setSelEnd(toISO(new Date(capped.getFullYear(), capped.getMonth(), capped.getDate())));
      setSelNote(`Máximo ${MAX_RANGE} días por rango.`);
    } else {
      setSelEnd(iso);
    }
  }

  function clearSel() { setSelStart(null); setSelEnd(null); setSelNote(null); }

  function applyToRange(open: boolean) {
    if (rangeDays.length === 0) return;
    const next = { ...avail };
    const changed: string[] = [];
    for (const iso of rangeDays) {
      const dayOpen = next[iso] !== undefined && next[iso]! > 0;
      if (open && !dayOpen) { next[iso] = 1; changed.push(iso); }
      else if (!open && dayOpen) { delete next[iso]; changed.push(iso); }
    }
    setAvail(next);
    if (changed.length > 0) {
      setPending(prev => { const s = new Set(prev); changed.forEach(i => s.add(i)); return s; });
      setSaved(false);
    }
    clearSel();
  }

  function bulkMonth(open: boolean) {
    const total = new Date(viewYear, viewMonth + 1, 0).getDate();
    const next = { ...avail };
    const changed: string[] = [];
    for (let day = 1; day <= total; day++) {
      const d = new Date(viewYear, viewMonth, day); d.setHours(0, 0, 0, 0);
      if (d < today) continue;
      const iso = toISO(d);
      const dayOpen = next[iso] !== undefined && next[iso]! > 0;
      if (open && !dayOpen) { next[iso] = 1; changed.push(iso); }
      else if (!open && dayOpen) { delete next[iso]; changed.push(iso); }
    }
    if (changed.length === 0) return;
    setAvail(next);
    setPending(prev => { const s = new Set(prev); changed.forEach(i => s.add(i)); return s; });
    setSaved(false);
    clearSel();
  }

  async function handleSave() {
    if (pending.size === 0) return;
    setSaving(true);
    const supabase = createClient();
    await Promise.all(Array.from(pending).map(iso =>
      isOpen(iso)
        ? supabase.rpc("upsert_availability", { p_pawwer_id: pawwerId, p_date: iso, p_slots: avail[iso] })
        : supabase.rpc("delete_availability", { p_pawwer_id: pawwerId, p_date: iso }),
    ));
    setPending(new Set());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function prevMonth() {
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    const maxDate = new Date(rangeEnd);
    if (viewYear === maxDate.getFullYear() && viewMonth === maxDate.getMonth()) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
  type Cell = { key: string; empty: true } | { key: string; empty: false; date: Date; day: number; iso: string };
  const cells: Cell[] = [
    ...Array.from({ length: firstDay }, (_, i): Cell => ({ key: `e${i}`, empty: true })),
    ...Array.from({ length: totalDays }, (_, i): Cell => {
      const d = new Date(viewYear, viewMonth, i + 1); d.setHours(0, 0, 0, 0);
      return { key: `d${i}`, empty: false, date: d, day: i + 1, iso: toISO(d) };
    }),
  ];

  const openCount  = Object.values(avail).filter(v => v > 0).length;
  const atMinMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const n = rangeDays.length;

  return (
    <div className="select-none min-h-screen relative overflow-hidden bg-[#FFF1EB] font-sans pb-28">
      <div aria-hidden className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-6%] right-[-12%] w-80 h-80 bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[100px] opacity-35" />
        <div className="absolute bottom-[6%] left-[-14%] w-96 h-96 bg-[#92C0E9] rounded-full mix-blend-multiply filter blur-[100px] opacity-30" />
      </div>

      <header className="relative z-20 pt-12 pb-3">
        <div className="max-w-xl mx-auto px-6 flex items-center gap-4">
          <Link href="/pawwer/perfil" className="w-10 h-10 bg-white/80 backdrop-blur-md border border-white rounded-[14px] flex items-center justify-center text-[#120A2B] shadow-[0_8px_20px_rgba(18,10,43,0.05)] active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="eyebrow text-[#FF7031] ">Tu agenda</p>
            <h1 className="text-2xl font-black text-[#120A2B] leading-none mt-0.5">Mi disponibilidad</h1>
            <p className="text-[11px] text-[#120A2B]/50 mt-1">{openCount} días abiertos en los próximos 2 meses</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-4">
        <div className="flex items-start gap-2.5 bg-white rounded-[20px] border border-white shadow-[0_10px_30px_-12px_rgba(18,10,43,0.1)] px-4 py-3">
          <Info size={16} className="text-[#FF7031] shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-[#120A2B]/65 leading-relaxed">
            <span className="font-black text-green-600">Verde</span> = abierto para recibir cuidados.
            Toca el <span className="font-black">primer día</span> y luego el <span className="font-black">último</span> para elegir un rango (hasta {MAX_RANGE} días), y elige <span className="font-black">Habilitar</span> o <span className="font-black">Bloquear</span>.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs px-1">
          <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-md bg-green-500" /><span className="text-[#120A2B]/60 font-semibold">Abierto</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-md bg-gray-200" /><span className="text-[#120A2B]/60 font-semibold">Bloqueado</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-md bg-white ring-2 ring-[#FF7031]" /><span className="text-[#120A2B]/60 font-semibold">Rango</span></div>
        </div>

        {/* Barra de acción sobre el rango */}
        {n > 0 && (
          <div className="bg-white rounded-[20px] border border-[#FF7031]/20 shadow-[0_10px_30px_-12px_rgba(255,112,49,0.25)] p-3 animate-slide-up">
            <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
              <p className="text-xs font-black text-[#120A2B]">
                {n} día{n !== 1 ? "s" : ""}
                {selStart && <span className="font-semibold text-[#120A2B]/50"> · {fmtShort(selStart)}{selEnd && selEnd !== selStart ? ` – ${fmtShort(selEnd)}` : ""}</span>}
              </p>
              <button onClick={clearSel} className="flex items-center gap-1 text-[11px] font-bold text-[#120A2B]/45 hover:text-[#120A2B]">
                <X size={12} /> Limpiar
              </button>
            </div>
            {selNote && <p className="text-[11px] font-bold text-[#FF7031] px-1 mb-2">{selNote}</p>}
            <div className="flex gap-2">
              <button onClick={() => applyToRange(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-black text-white bg-green-500 hover:bg-green-600 active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(34,197,94,0.25)]">
                <Unlock size={15} /> Habilitar
              </button>
              <button onClick={() => applyToRange(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-black text-white bg-[#120A2B] hover:bg-[#1e1145] active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(18,10,43,0.25)]">
                <Lock size={15} /> Bloquear
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[28px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5">
          <div className="flex justify-between items-center mb-3">
            <button onClick={prevMonth} disabled={atMinMonth}
              className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 shadow-sm">
              <ChevronLeft size={16} />
            </button>
            <span className="font-black text-[#120A2B]">{MESES[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth}
              className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={() => bulkMonth(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold text-green-700 bg-green-50 border border-green-100 hover:bg-green-100 transition-colors">
              <Unlock size={13} /> Abrir todo el mes
            </button>
            <button onClick={() => bulkMonth(false)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold text-[#120A2B]/60 bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors">
              <Lock size={13} /> Bloquear todo el mes
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DIAS_SHORT.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-black text-[#120A2B]/30 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map(cell => {
              if (cell.empty) return <div key={cell.key} />;
              const past    = cell.date < today;
              const dayOpen = isOpen(cell.iso);
              const isSel   = rangeSet.has(cell.iso);
              const isPend  = pending.has(cell.iso);
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={past}
                  onClick={!past ? () => handleDayTap(cell.iso) : undefined}
                  className={[
                    "h-11 w-full rounded-xl text-sm font-bold flex items-center justify-center transition-all relative",
                    past    ? "text-gray-300 cursor-not-allowed line-through"
                    : dayOpen ? "bg-green-500 text-white shadow-sm hover:bg-green-600"
                    :          "bg-gray-100 text-gray-500 hover:bg-gray-200",
                    isSel && !past ? "ring-2 ring-[#FF7031] ring-offset-1" : "",
                  ].join(" ")}
                >
                  {cell.day}
                  {isPend && !isSel && !past && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#FF7031]" />}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {(pending.size > 0 || saved) && (
        <div className="fixed inset-x-0 bottom-0 z-[60] bg-white/90 backdrop-blur-xl border-t border-white/60 shadow-[0_-4px_16px_rgba(18,10,43,0.06)] px-6 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}>
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <p className="text-xs font-bold text-[#120A2B]/55 flex-1 min-w-0">
              {saved ? "Cambios guardados ✓" : `${pending.size} cambio${pending.size !== 1 ? "s" : ""} sin guardar`}
            </p>
            <button onClick={handleSave} disabled={saving || pending.size === 0}
              className="px-6 py-3 rounded-full font-black text-sm bg-[#120A2B] text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] shadow-[0_8px_20px_rgba(18,10,43,0.25)] transition-transform shrink-0">
              {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <CalendarCheck size={15} />}
              {saving ? "Guardando…" : saved ? "Guardado" : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
