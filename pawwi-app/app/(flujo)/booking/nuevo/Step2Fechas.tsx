"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Clock } from "lucide-react";
import BookingHeader from "./BookingHeader";

// Horas por defecto por servicio (el cliente las puede cambiar).
// NightCare es overnight: recogida al día siguiente (end <= start).
const TIME_DEFAULTS: Record<number, { start: string; end: string }> = {
  1: { start: "08:00", end: "18:00" }, // DayCare (mismo día)
  2: { start: "19:00", end: "08:00" }, // NightCare (overnight)
  3: { start: "09:00", end: "18:00" }, // Travel (día 1 → día N)
  4: { start: "09:00", end: "12:00" }, // Express (fin = inicio + horas)
};

// "09:00" + n horas → "HH:MM" (tope 23:59 el mismo día)
function addHours(hhmm: string, n: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min((h! * 60 + m!) + n * 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const MESES     = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SHORT = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];

interface Pawwer {
  id: string;
  week_pattern: Record<string, boolean> | null;
  profile: { name: string; avatar_url: string | null } | null;
}

interface Props {
  pawwer:         Pawwer;
  serviceId:      number;
  availableDates: string[];
  /** ISO → peludos YA reservados ese día (todos los servicios). */
  ocupacion:      Record<string, number>;
  preStart:       string | null;
  preEnd:         string | null;
  preHours:       number | null;
  preStartTime:   string | null;
  preEndTime:     string | null;
}

const SERVICE_LABELS: Record<number, string> = { 1: "DayCare", 2: "Nightcare", 3: "Travel", 4: "Express" };
const WEEK_KEYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toISO(d: Date) {
  return d.toISOString().split("T")[0]!;
}
function parseISO(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y!, m! - 1, day!);
}

function fmtDate(d: Date) {
  return `${d.getDate()} ${MESES[d.getMonth()]!.slice(0, 3)}`;
}

export default function Step2Fechas({ pawwer, serviceId, availableDates, ocupacion, preStart, preEnd, preHours, preStartTime, preEndTime }: Props) {
  const router   = useRouter();
  const isTravel  = serviceId === 3;
  const isExpress = serviceId === 4;
  const isNight   = serviceId === 2;
  const isDayCare = serviceId === 1;
  const defs      = TIME_DEFAULTS[serviceId] ?? TIME_DEFAULTS[1]!;

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [start,     setStart]     = useState<Date | null>(preStart ? parseISO(preStart) : null);
  const [end,       setEnd]       = useState<Date | null>(preEnd ? parseISO(preEnd) : null);
  const [hours,     setHours]     = useState(preHours ?? 2);
  const [startTime, setStartTime] = useState(preStartTime ?? defs.start);
  const [endTime,   setEndTime]   = useState(preEndTime ?? defs.end);

  // Express: la hora de fin se deriva (inicio + horas). DayCare: fin > inicio.
  const expressEnd  = addHours(startTime, hours);
  const finalEndTime = isExpress ? expressEnd : endTime;
  const timeValid   = isDayCare ? endTime > startTime : true; // Night=overnight, Travel=distinto día

  // Derive blocked days-of-week from week_pattern
  const wp = pawwer.week_pattern ?? {};
  const blockedDow: number[] = WEEK_KEYS.map((k, i) => (!wp[k] ? i : -1)).filter(n => n !== -1);

  // Cuando el Pawwer ya cargó agenda, ESA manda. `availability` es lo que abrió
  // de verdad —y lo único que valida `create_booking`—; `week_pattern` es solo la
  // plantilla con la que esa agenda se genera al crear el perfil (mig 08).
  // Filtrar además por el patrón escondía días que el Pawwer había abierto a
  // propósito y que el backend sí habría aceptado: reservas perdidas en silencio.
  const usaPatron = availableDates.length === 0;

  function isUnavail(d: Date): boolean {
    if (d < today) return true;
    if (usaPatron) return blockedDow.includes(d.getDay());
    return !availableDates.includes(toISO(d));
  }

  function handleDay(d: Date) {
    if (isUnavail(d)) return;
    if (!isTravel) {
      setStart(d); setEnd(d);
    } else {
      if (!start || (start && end)) { setStart(d); setEnd(null); }
      else if (d < start)           { setEnd(start); setStart(d); }
      else if (d.getTime() === start.getTime()) { setStart(null); setEnd(null); }
      else                           { setEnd(d); }
    }
  }

  function prevMonth() {
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const totalDays  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay   = new Date(viewYear, viewMonth, 1).getDay();
  type Cell = { key: string; empty: true } | { key: string; empty: false; date: Date; day: number };
  const cells: Cell[] = [
    ...Array.from({ length: firstDay }, (_, i): Cell => ({ key: `e${i}`, empty: true })),
    ...Array.from({ length: totalDays }, (_, i): Cell => {
      const d = new Date(viewYear, viewMonth, i + 1); d.setHours(0, 0, 0, 0);
      return { key: `d${i}`, empty: false, date: d, day: i + 1 };
    }),
  ];

  function isSel(d: Date) {
    return start?.getTime() === d.getTime() || end?.getTime() === d.getTime();
  }
  function inRange(d: Date) {
    if (!isTravel || !start || !end) return false;
    return d > start && d < end;
  }

  // Express se cobra por horas, pero ocurre un DÍA CONCRETO como cualquier otro
  // servicio: también exige fecha. Antes era `isExpress ? true`, y como el
  // calendario tampoco se mostraba, quien entraba sin fecha previa reservaba HOY
  // sin enterarse — el `start ?? today` de handleContinue lo hacía en silencio.
  const datesReady   = isTravel ? !!(start && end) : !!start;
  const hasSelection = datesReady && timeValid;

  // La leyenda de los puntos solo aparece si hay algo que explicar.
  const hayOcupacion = Object.values(ocupacion).some((n) => n > 0);

  const nightsOrDays = start && end
    ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + (isTravel ? 1 : 0))
    : 1;

  function handleContinue() {
    if (!hasSelection) return;
    const params = new URLSearchParams({
      pawwer_id:  pawwer.id,
      step:       "3",
      service_id: String(serviceId),
      // `hasSelection` ya garantiza que hay fecha; el respaldo a `today` que
      // había aquí es justo lo que reservaba hoy sin que nadie lo pidiera.
      start:      toISO(start!),
      end:        toISO(end ?? start!),
    });
    if (isExpress) params.set("hours", String(hours));
    params.set("start_time", startTime);
    params.set("end_time",   finalEndTime);
    router.push(`/booking/nuevo?${params.toString()}`);
  }

  // Las etiquetas del horario dicen el DÍA REAL elegido. Decían «(hoy)» y
  // «(mañana)» fijos: con el 30 seleccionado, la pantalla seguía diciendo «hoy».
  const diaSiguiente = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() + 1); return x; };
  const etiquetaEntrega = isNight
    ? `Entrega${start ? ` (${fmtDate(start)})` : ""}`
    : isTravel
    ? `Salida${start ? ` (${fmtDate(start)})` : ""}`
    : "Entrega";
  const etiquetaRecogida = isNight
    ? `Recogida${start ? ` (${fmtDate(diaSiguiente(start))})` : ""}`
    : isTravel
    ? `Regreso${end ? ` (${fmtDate(end)})` : ""}`
    : "Recogida";

  // La etiqueta dice la fecha REAL de la reserva. Antes decía «hoy» fijo, y como
  // la fecha sí viajaba desde el calendario del perfil del Pawwer, la pantalla
  // afirmaba «hoy» mientras reservaba otro día.
  const selLabel = isExpress
    ? `${hours} hora${hours !== 1 ? "s" : ""}${start ? ` · ${fmtDate(start)}` : ""}`
    : isTravel && start && end
    ? `${fmtDate(start)} → ${fmtDate(end)} (${nightsOrDays} días)`
    : start
    ? fmtDate(start)
    : "Selecciona una fecha";

  return (
    <div className="min-h-screen bg-cream">
      <BookingHeader
        step={2}
        backHref={`/booking/nuevo?pawwer_id=${pawwer.id}&step=1&service_id=${serviceId}`}
        pawwerName={pawwer.profile?.name ?? "Pawwer"}
        pawwerAvatar={pawwer.profile?.avatar_url ?? null}
      />

      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="mb-5">
          <h1 className="text-xl font-heading font-extrabold text-midnight mb-1">
            {isExpress ? "¿Cuántas horas y qué día?" : isTravel ? "¿Cuándo viajes?" : "¿Qué día?"}
          </h1>
          <p className="text-sm text-midnight/50 font-body">
            {SERVICE_LABELS[serviceId]} · {pawwer.profile?.name}
          </p>
        </div>

        {/* Express: selector de horas */}
        {isExpress && (
          <div className="bg-white/80 border border-white rounded-2xl p-5 mb-5 flex items-center justify-between">
            <span className="font-extrabold text-midnight">Horas de servicio</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHours(h => Math.max(1, h - 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-midnight transition-colors"
              >
                <Minus size={16} />
              </button>
              <span className="text-2xl font-extrabold text-midnight w-8 text-center">{hours}</span>
              <button
                type="button"
                onClick={() => setHours(h => Math.min(12, h + 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-midnight transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Calendario — también en Express: se cobra por horas, pero hay que
            elegir el día. Sin él, la única fecha posible era la de la URL (o hoy). */}
        <div className="bg-white/80 backdrop-blur-md border border-white rounded-2xl p-4 shadow-sm mb-5">
          {/* Nav */}
          <div className="flex justify-between items-center mb-3">
            <button
              onClick={prevMonth}
              disabled={viewYear === today.getFullYear() && viewMonth === today.getMonth()}
              className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 shadow-sm transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-extrabold text-midnight">
              {MESES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Header días */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS_SHORT.map((d, i) => (
              // Solo se apaga la columna si el patrón semanal es quien decide;
              // con agenda cargada, el patrón ya no manda y apagarla mentiría.
              <div key={i} className={`text-center text-[10px] font-extrabold py-1 ${
                usaPatron && blockedDow.includes(i) ? "text-gray-300" : "text-gray-400"
              }`}>{d}</div>
            ))}
          </div>

          {/* Grid días */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map(cell => {
              if (cell.empty) return <div key={cell.key} />;
              const d      = cell.date;
              const unavail = isUnavail(d);
              const sel     = isSel(d);
              const mid     = inRange(d);
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={unavail}
                  onClick={() => handleDay(d)}
                  className={[
                    "h-10 w-full rounded-xl text-sm font-bold flex items-center justify-center transition-colors relative",
                    unavail ? "text-gray-300 cursor-not-allowed line-through"
                    : sel    ? "bg-[#120A2B] text-white shadow-md z-10"
                    : mid    ? "bg-[#F7AEF1]/30 text-midnight"
                    : "text-midnight hover:bg-white hover:border hover:border-gray-200 cursor-pointer",
                  ].join(" ")}
                >
                  {mid && <div className="absolute inset-0 bg-[#F7AEF1]/20 -z-10 w-[115%] -ml-[7.5%]" />}
                  {cell.day}
                  {/* Ocupación: un punto por peludo ya reservado ese día. Lo que
                      ayuda a decidir no es el máximo del Pawwer, sino con cuántos
                      perros estará el suyo (docs/06 § Capacidad y precio). */}
                  {!unavail && (ocupacion[toISO(d)] ?? 0) > 0 && (
                    <span className="absolute bottom-1 left-0 right-0 flex justify-center gap-[2px]">
                      {Array.from({ length: Math.min(ocupacion[toISO(d)] ?? 0, 5) }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-1 h-1 rounded-full ${sel ? "bg-white/70" : "bg-[#FF7031]"}`}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {isTravel && (
            <p className="text-[10px] text-center text-gray-400 mt-2 font-body">
              {!start ? "Toca el día de llegada" : !end ? "Ahora toca el día de regreso" : `${nightsOrDays} noches seleccionadas`}
            </p>
          )}

          {hayOcupacion && (
            <p className="text-[10px] text-center text-gray-400 mt-2 font-body flex items-center justify-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[#FF7031] inline-block" />
              cada punto es un peludo ya reservado ese día
            </p>
          )}
        </div>

        {/* Horario — el cliente elige entrega/recogida */}
        {datesReady && (
          <div className="bg-white/80 backdrop-blur-md border border-white rounded-2xl p-4 shadow-sm mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-[#FF7031]" />
              <span className="font-extrabold text-midnight text-sm">Horario</span>
            </div>

            {isExpress ? (
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-midnight/70">Hora de inicio</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-midnight outline-none focus:border-[#FF7031]"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-midnight/50 block mb-1">
                    {etiquetaEntrega}
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-midnight outline-none focus:border-[#FF7031]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-midnight/50 block mb-1">
                    {etiquetaRecogida}
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-midnight outline-none focus:border-[#FF7031]"
                  />
                </div>
              </div>
            )}

            {isExpress && (
              <p className="text-[11px] text-midnight/40 mt-2">Termina a las {finalEndTime} · {hours}h</p>
            )}
            {isNight && (
              <p className="text-[11px] text-midnight/40 mt-2">🌙 Pernocta: la recogida es al día siguiente.</p>
            )}
            {isDayCare && !timeValid && (
              <p className="text-[11px] text-red-500 mt-2">La recogida debe ser después de la entrega.</p>
            )}
          </div>
        )}

        {/* Resumen selección */}
        <div className={[
          "rounded-2xl px-4 py-3 mb-6 flex items-center gap-2 text-sm font-bold transition-all",
          hasSelection ? "bg-[#120A2B]/5 text-midnight" : "bg-gray-100 text-gray-400",
        ].join(" ")}>
          <span className="text-base">📅</span>
          {selLabel}
        </div>

        <button
          onClick={handleContinue}
          disabled={!hasSelection}
          className={[
            "w-full py-4 rounded-2xl font-extrabold text-base transition-all",
            hasSelection
              ? "bg-[#FF7031] text-white hover:bg-[#e6652c] shadow-md hover:shadow-lg active:scale-95"
              : "bg-gray-100 text-gray-400 cursor-not-allowed",
          ].join(" ")}
        >
          Continuar → Mascota
        </button>
      </main>
    </div>
  );
}
