"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Wallet, ChevronDown, FileText, Star, Sparkles,
  Zap, TrendingUp, CheckCircle2, CalendarX2, Clock,
} from "lucide-react";
import type { BookingRow, PayoutSummary } from "@/app/actions/portal";
import { SERVICE_LABEL as SERVICE_DISPLAY } from "@/lib/services";

const MONTHS      = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MONTHS_LONG = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// ── Helpers (formateo determinístico, sin toLocale* → sin desfases de TZ) ────
function fmtCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}
function fmtCOPk(n: number): string {
  // Compacto para ejes/barras: $180k
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}
function parseDate(iso: string): Date {
  return new Date(iso.slice(0, 10) + "T12:00:00");
}
function fmtDayMonth(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function fmtLongDate(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}
function isoOf(year: number, monthIdx: number, day: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Filtros de período (calculados desde `today`, prop fija → sin hydration) ──
type RangeKey = "mes" | "mesPasado" | "anio" | "todo";
const RANGE_LABELS: Record<RangeKey, string> = {
  mes: "Este mes", mesPasado: "Mes pasado", anio: "Este año", todo: "Todo",
};

function rangeFor(key: RangeKey, today: string): { start: string; end: string } | null {
  const t = parseDate(today);
  const y = t.getFullYear();
  const m = t.getMonth();
  if (key === "mes")       return { start: isoOf(y, m, 1),     end: isoOf(y, m + 1, 0) };
  if (key === "mesPasado") return { start: isoOf(y, m - 1, 1), end: isoOf(y, m, 0) };
  if (key === "anio")      return { start: isoOf(y, 0, 1),     end: isoOf(y, 11, 31) };
  return null; // "todo"
}

interface Props {
  payout: PayoutSummary | null;
  completed: BookingRow[];
  cancelled: BookingRow[];
  today: string;
  rating: number;
  reviewsCount: number;
}

export default function GananciasClient({ payout, completed, cancelled, today, rating, reviewsCount }: Props) {
  const [range, setRange] = useState<RangeKey>("mes");
  const [showDetail, setShowDetail] = useState(false);
  const [tab, setTab] = useState<"pagados" | "pendientes" | "cancelados">("pendientes");

  const nextAmount = payout?.next_payout_amount ?? 0;
  const pendingCount = payout?.pending_count ?? 0;

  // ── Métricas del período seleccionado (client-side desde completed) ────────
  const metrics = useMemo(() => {
    const r = rangeFor(range, today);
    const list = r
      ? completed.filter((b) => {
          const d = b.start_date.slice(0, 10);
          return d >= r.start && d <= r.end;
        })
      : completed;
    const net = list.reduce((s, b) => s + (b.pawwer_payout ?? 0), 0);
    return { net, count: list.length };
  }, [range, today, completed]);

  // ── Barras últimos 6 meses (motivacional, fijo) ────────────────────────────
  const bars = useMemo(() => {
    const t = parseDate(today);
    const out: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
      const y = d.getFullYear();
      const mi = d.getMonth();
      const start = isoOf(y, mi, 1);
      const end = isoOf(y, mi + 1, 0);
      const value = completed
        .filter((b) => { const x = b.start_date.slice(0, 10); return x >= start && x <= end; })
        .reduce((s, b) => s + (b.pawwer_payout ?? 0), 0);
      out.push({ label: MONTHS[mi]!, value });
    }
    return out;
  }, [today, completed]);
  const maxBar = Math.max(1, ...bars.map((b) => b.value));

  // ── Historial: pagado/pendiente sale del ledger real (paid_at) ─────────────
  const paid    = useMemo(() => completed.filter((b) => b.paid_at != null), [completed]);
  const pending = useMemo(() => completed.filter((b) => b.paid_at == null), [completed]);
  // Cancelados: solo cuidados que REALMENTE aceptaste (accepted_at), no
  // solicitudes directas canceladas antes de que las tomaras.
  const cancelledReal = useMemo(() => cancelled.filter((b) => b.accepted_at != null), [cancelled]);

  const isElite = rating >= 4.8 && reviewsCount >= 15;
  const ratingPct  = Math.min(100, Math.round((rating / 4.8) * 100));
  const reviewsPct = Math.min(100, Math.round((reviewsCount / 15) * 100));

  const txList = tab === "pagados" ? paid : tab === "pendientes" ? pending : cancelledReal;

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#FFF1EB] font-sans pb-10">

      {/* ── ATMÓSFERA (Fija) ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-5%] right-[-10%] w-80 h-80 bg-[#F7AEF1] rounded-full mix-blend-multiply filter blur-[100px] opacity-40"></div>
        <div className="absolute top-[30%] left-[-15%] w-96 h-96 bg-[#E0F2FE] rounded-full mix-blend-multiply filter blur-[100px] opacity-50"></div>
        <div className="absolute bottom-[0%] right-[-10%] w-80 h-80 bg-[#FFD1BA] rounded-full mix-blend-multiply filter blur-[100px] opacity-40"></div>
      </div>

      {/* ── HEADER NAV ── */}
      <header className="relative z-20 pt-12 pb-4">
        <div className="max-w-xl mx-auto px-6">
          <p className="eyebrow text-[#FF7031] ">Tu dinero</p>
          <div className="flex items-end justify-between gap-3 mt-1.5">
            <h1 className="text-3xl font-black text-[#120A2B] leading-none">Ganancias</h1>
            <span className="w-10 h-10 rounded-[14px] bg-[#120A2B] flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(18,10,43,0.15)]">
              <Wallet size={18} />
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-6 enter enter-1">

        {/* ── CAPA 1 · PRÓXIMO PAGO AUTOMÁTICO (TICKET SKEUOMORPHIC) ── */}
        <div className="bg-white rounded-[32px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="eyebrow text-gray-400 ">Próximo pago automático</p>
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[#FF7031] bg-[#FFF1EB] border border-[#FF7031]/20 px-2 py-1 rounded-full">
                <Zap size={10} className="fill-[#FF7031]" /> Auto
              </span>
            </div>

            {nextAmount > 0 ? (
              <>
                <p className="text-[40px] leading-none font-black text-[#120A2B] tracking-tight tabular-nums">
                  {fmtCOP(nextAmount)}
                </p>
                {payout && (
                  <p className="text-sm text-[#120A2B]/60 font-semibold mt-2">
                    Depósito: <span className="font-black text-[#120A2B]">viernes {fmtLongDate(payout.next_payout_date)}</span>.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-[28px] leading-none font-black text-[#120A2B]/30 mt-2">Sin pagos en camino</p>
                <p className="text-sm text-gray-400 font-semibold mt-2 leading-relaxed">
                  Completa cuidados y aquí verás tu próximo pago automático de los viernes. 🐾
                </p>
              </>
            )}
          </div>

          {/* Ticket Perforation */}
          <div className="relative h-px mx-0">
            <div className="absolute inset-x-0 top-0 border-t-2 border-dashed border-gray-100" />
            <div className="absolute left-[-12px] top-[-12px] w-6 h-6 rounded-full bg-[#FFF1EB] shadow-[inset_-2px_0_4px_rgba(18,10,43,0.02)]" />
            <div className="absolute right-[-12px] top-[-12px] w-6 h-6 rounded-full bg-[#FFF1EB] shadow-[inset_2px_0_4px_rgba(18,10,43,0.02)]" />
          </div>

          <div className="bg-gray-50/50 px-6 py-4">
            {nextAmount > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => setShowDetail((v) => !v)}
                  className="flex items-center justify-between w-full text-xs font-bold text-[#120A2B] bg-white border border-gray-200 px-4 py-3 rounded-[16px] shadow-sm active:scale-95 transition-all"
                >
                  <span>Incluye {pendingCount} cuidado{pendingCount !== 1 ? "s" : ""}</span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${showDetail ? "rotate-180" : ""}`} />
                </button>
                {showDetail && (
                  <div className="mt-2 bg-white border border-gray-100 rounded-[16px] px-4 py-3 animate-slide-up">
                    <p className="text-xs font-semibold text-gray-500 leading-relaxed">
                      Son <span className="font-black text-[#120A2B]">{pendingCount} cuidado{pendingCount !== 1 ? "s" : ""}</span> ya completado{pendingCount !== 1 ? "s" : ""} que aún no se han pagado. Se depositan juntos en tu próximo pago.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Soporte legal → cuenta de cobro imprimible */}
            <Link
              href="/pawwer/cuenta-cobro"
              className="flex items-center gap-2 text-[11px] font-bold text-gray-400 hover:text-[#120A2B] transition-colors uppercase tracking-widest"
            >
              <FileText size={14} /> Ver cuenta de cobro
            </Link>
          </div>
        </div>

        {/* ── CAPA 2 · RENDIMIENTO FINANCIERO ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-[#120A2B]" />
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Desempeño</h2>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                className={[
                  "flex-none px-4 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border",
                  range === k
                    ? "bg-[#120A2B] text-white border-[#120A2B] shadow-[0_8px_20px_rgba(18,10,43,0.2)]"
                    : "bg-white/80 text-gray-500 border-white hover:bg-white",
                ].join(" ")}
              >
                {RANGE_LABELS[k]}
              </button>
            ))}
          </div>

          {/* Grilla de métricas */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-white rounded-[28px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5">
              <p className="eyebrow text-gray-400 ">Ingreso Neto</p>
              <p className="text-2xl font-black text-[#120A2B] mt-1.5 leading-none tabular-nums">{fmtCOP(metrics.net)}</p>
            </div>
            <div className="bg-white rounded-[28px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5">
              <p className="eyebrow text-gray-400 ">Cuidados</p>
              <p className="text-2xl font-black text-[#120A2B] mt-1.5 leading-none tabular-nums">{metrics.count}</p>
            </div>
          </div>

          {/* Barras últimos 6 meses */}
          <div className="bg-white rounded-[28px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-6 mt-3">
            <p className="eyebrow text-gray-400 mb-6">Últimos 6 meses</p>
            <div className="flex items-end justify-between gap-2 h-32">
              {bars.map((b, i) => {
                const h = Math.round((b.value / maxBar) * 100);
                const isLast = i === bars.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className={`text-[9px] font-bold tabular-nums transition-opacity ${b.value > 0 ? "text-gray-400 group-hover:text-[#120A2B]" : "text-transparent"}`}>
                      {fmtCOPk(b.value)}
                    </span>
                    <div
                      className={`w-full rounded-[6px] transition-all duration-500 ease-out ${isLast ? "bg-[#120A2B] shadow-[0_4px_10px_rgba(18,10,43,0.2)]" : "bg-gray-100 group-hover:bg-gray-200"}`}
                      style={{ height: `${Math.max(b.value > 0 ? 8 : 4, h)}%` }}
                    />
                    <span className={`eyebrow ${isLast ? "text-[#120A2B]" : "text-gray-400"}`}>{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CAPA 3 · HISTORIAL DE TRANSACCIONES ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Transacciones</h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 bg-white/50 p-1.5 rounded-full border border-white">
            {([
              { k: "pendientes", label: "Pendientes", n: pending.length },
              { k: "pagados",    label: "Pagados",    n: paid.length },
              { k: "cancelados", label: "Cancelados", n: cancelledReal.length },
            ] as const).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={[
                  "flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide transition-all",
                  tab === t.k
                    ? "bg-[#120A2B] text-white shadow-[0_4px_12px_rgba(18,10,43,0.15)]"
                    : "text-gray-500 hover:bg-white/80",
                ].join(" ")}
              >
                {t.label}{t.n > 0 ? ` (${t.n})` : ""}
              </button>
            ))}
          </div>

          {txList.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-sm rounded-[32px] border border-white/80 p-10 text-center shadow-[0_12px_30px_rgba(18,10,43,0.03)]">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 border border-white">
                {tab === "pendientes" ? <Clock size={28} className="text-gray-300" /> : <CalendarX2 size={28} className="text-gray-300" />}
              </div>
              <p className="text-sm font-black text-[#120A2B]">
                {tab === "pendientes" ? "Al día" : tab === "pagados" ? "Aún no tienes pagos" : "Sin cancelaciones"}
              </p>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                {tab === "pendientes"
                  ? "Las ganancias pendientes aparecerán aquí."
                  : tab === "pagados"
                    ? "Tus pagos depositados se listarán aquí."
                    : "Los cuidados cancelados quedarán registrados aquí."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {txList.map((b) => {
                const dog = b.dogs[0];
                const dogNames = b.dogs.map((d) => d.name).join(", ") || "Mascota";
                const svc = SERVICE_DISPLAY[b.service_type] ?? b.service_type;
                const isCancelled = tab === "cancelados";
                const dateLabel = b.start_date.slice(0, 10) === b.end_date.slice(0, 10)
                  ? fmtDayMonth(b.start_date)
                  : `${fmtDayMonth(b.start_date)} – ${fmtDayMonth(b.end_date)}`;
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-4 bg-white rounded-[24px] border border-white shadow-[0_8px_20px_rgba(18,10,43,0.03)] p-4"
                  >
                    {dog?.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={dog.photo_url} alt={dog.name} className="w-12 h-12 rounded-[14px] object-cover border border-gray-50 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-[14px] bg-[#FFF1EB] flex items-center justify-center text-xl shrink-0">🐾</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-[#120A2B] truncate leading-tight">
                        {dogNames}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1 truncate">
                        {svc} · {dateLabel}
                      </p>
                      {tab === "pendientes" && <p className="text-[9px] font-black text-[#FF7031] uppercase tracking-widest mt-1">Para el viernes</p>}
                    </div>
                    <span className={`text-base font-black shrink-0 tabular-nums ${
                      isCancelled ? "text-gray-300 line-through" : "text-[#120A2B]"
                    }`}>
                      {isCancelled ? "" : "+ "}{fmtCOP(b.pawwer_payout)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── CAPA 4 · GROWTH / LEALTAD (GAMIFICACIÓN) ── */}
        <section className="pt-2">
          {isElite ? (
            <div className="bg-[#120A2B] rounded-[32px] p-6 shadow-[0_16px_40px_rgba(18,10,43,0.2)] relative overflow-hidden">
              <div aria-hidden className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-[#F7AEF1] rounded-full blur-[40px] opacity-30 pointer-events-none" />
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-[16px] bg-[#FF7031] flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(255,112,49,0.4)]">
                  <Sparkles size={24} />
                </div>
                <div>
                  <p className="text-base font-black text-white">¡Eres Pawwer Élite! 🎉</p>
                  <p className="text-xs text-white/70 mt-1 font-semibold leading-relaxed">Comisión preferencial del 20%. Ganas más en cada cuidado.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[32px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-6 relative overflow-hidden">
              <div aria-hidden className="absolute top-[-40%] right-[-20%] w-48 h-48 bg-[#FFF1EB] rounded-full blur-[40px] opacity-60 pointer-events-none" />

              <div className="relative flex items-start gap-4">
                <div className="w-12 h-12 rounded-[16px] bg-[#FFF1EB] flex items-center justify-center text-[#FF7031] shrink-0">
                  <TrendingUp size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-black text-[#120A2B] leading-tight">Gana un 5% extra</p>
                  <p className="text-xs text-gray-500 mt-1 font-semibold leading-relaxed">
                    Alcanza <span className="font-black text-[#120A2B]">4.8★ con 15 reseñas</span> para bajar tu comisión al 20%.
                  </p>
                </div>
              </div>

              {/* Progreso */}
              <div className="grid grid-cols-2 gap-4 mt-5">
                <div className="bg-gray-50 rounded-[16px] p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1 eyebrow text-gray-400 tracking-wide">
                      <Star size={11} className="text-amber-400 fill-amber-400" /> Rating
                    </span>
                    <span className="text-[11px] font-black text-[#120A2B] tabular-nums">{rating.toFixed(1)}/4.8</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${ratingPct}%` }} />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-[16px] p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1 eyebrow text-gray-400 tracking-wide">
                      <CheckCircle2 size={11} className="text-[#FF7031]" /> Reseñas
                    </span>
                    <span className="text-[11px] font-black text-[#120A2B] tabular-nums">{reviewsCount}/15</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full bg-[#FF7031]" style={{ width: `${reviewsPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sello de confianza footer */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-4 mt-2">
            <CheckCircle2 size={14} className="text-green-500" />
            Pagos 100% automáticos · sin trámites
          </div>
        </section>

      </main>
    </div>
  );
}
