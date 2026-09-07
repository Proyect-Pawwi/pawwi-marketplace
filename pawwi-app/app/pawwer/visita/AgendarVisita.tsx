"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { scheduleVisita, getVisitaSlots } from "@/app/actions/visita";
import { TIME_SLOTS, type TimeSlot } from "@/lib/visita";


const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface WeekRow {
  dates: Date[];
  disabled: boolean[];
}

function getWeeksToShow(): WeekRow[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // Find the Monday of the week that contains tomorrow
  const startMonday = new Date(tomorrow);
  const dow = startMonday.getDay(); // 0=Sun,1=Mon…6=Sat
  startMonday.setDate(startMonday.getDate() - (dow === 0 ? 6 : dow - 1));
  startMonday.setHours(0, 0, 0, 0);

  const rows: WeekRow[] = [];
  for (let w = 0; w < 4; w++) {
    const dates: Date[] = [];
    const disabled: boolean[] = [];
    for (let d = 0; d < 5; d++) {
      const day = new Date(startMonday);
      day.setDate(startMonday.getDate() + w * 7 + d);
      dates.push(day);
      disabled.push(day < tomorrow);
    }
    rows.push({ dates, disabled });
  }
  return rows;
}

function formatDisplayDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

interface ExistingVisita {
  scheduled_date: string;
  time_slot: string;
  status: string;
}

interface Props {
  name: string;
  existingVisita: ExistingVisita | null;
}

export default function AgendarVisita({ name, existingVisita }: Props) {
  const firstName = name.split(" ")[0] || "Pawwer";
  const weeks = getWeeksToShow();

  const [selectedDate, setSelectedDate]     = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot]     = useState<TimeSlot | null>(null);
  const [takenSlots, setTakenSlots]         = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [confirmed, setConfirmed]           = useState(!!existingVisita);
  const [confirmData, setConfirmData]       = useState<{ date: string; timeSlot: string } | null>(
    existingVisita
      ? { date: existingVisita.scheduled_date, timeSlot: existingVisita.time_slot }
      : null,
  );
  const [error, setError]            = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleDateSelect(iso: string) {
    setSelectedDate(iso);
    setSelectedSlot(null);
    setTakenSlots([]);
    setIsLoadingSlots(true);
    try {
      const taken = await getVisitaSlots(iso);
      setTakenSlots(taken);
    } finally {
      setIsLoadingSlots(false);
    }
  }

  function handleSubmit() {
    if (!selectedDate || !selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const res = await scheduleVisita(selectedDate, selectedSlot);
      if ("error" in res) {
        setError(res.error);
        // Refresh slot availability — another user may have taken the slot
        if (selectedDate) {
          getVisitaSlots(selectedDate).then(setTakenSlots).catch(() => {});
        }
      } else {
        setConfirmData({ date: res.date, timeSlot: res.timeSlot });
        setConfirmed(true);
      }
    });
  }

  // ── Confirmation screen ──────────────────────────────────────────────────
  if (confirmed && confirmData) {
    const displayDate = new Date(confirmData.date + "T12:00:00");
    return (
      <div className="min-h-screen bg-[#FFF1EB] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <Image
              src="/LogoPawwiCompleteOrange.svg"
              alt="Pawwi"
              width={120}
              height={40}
              style={{ width: "auto", height: "2rem" }}
            />
          </div>

          <div className="bg-white rounded-3xl border border-green-200 p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h1 className="text-xl font-extrabold text-[#120A2B]">
              Visita agendada
            </h1>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Luisa del equipo Pawwi te contactará para confirmar tu visita domiciliaria.
            </p>

            <div className="bg-[#FFF1EB] rounded-2xl p-4 space-y-2 text-left">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-[#FF7031] shrink-0" />
                <span className="text-sm font-semibold text-[#120A2B]">
                  {formatDisplayDate(displayDate)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-[#FF7031] shrink-0" />
                <span className="text-sm font-semibold text-[#120A2B]">
                  {confirmData.timeSlot}
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/pawwer/dashboard"
            className="block w-full text-center bg-[#120A2B] text-white font-extrabold text-sm py-4 rounded-2xl hover:bg-[#1e1145] transition-colors"
          >
            Volver a mi panel →
          </Link>

          <p className="text-xs text-center text-[#120A2B]/40">
            ¿Preguntas? Escríbenos a{" "}
            <a href="mailto:hola@pawwi.co" className="text-[#FF7031] underline">
              hola@pawwi.co
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ── Calendar screen ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FFF1EB] pb-36">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-white/50 shadow-sm px-4 py-3">
        <div className="max-w-lg mx-auto grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
          <Link
            href="/pawwer/dashboard"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex flex-col items-center gap-0.5">
            <Image
              src="/LogoPawwiCompleteOrange.svg"
              alt="Pawwi"
              width={80}
              height={26}
              style={{ width: "auto", height: "1.3rem" }}
            />
            <span className="text-[11px] text-[#120A2B]/50 font-semibold">
              Visita domiciliaria
            </span>
          </div>
          <div />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Intro */}
        <div>
          <h1 className="text-xl font-extrabold text-[#120A2B] mb-1">
            Agenda tu visita, {firstName}
          </h1>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            El equipo de Pawwi visitará tu hogar para tomar fotos y firmar los documentos. Elige el día y horario que mejor te quede.
          </p>
        </div>

        {/* Paso 1: Fecha */}
        <div>
          <p className="text-xs font-extrabold text-[#120A2B]/40 uppercase tracking-widest mb-3">
            1 — Elige el día
          </p>
          <div className="space-y-3">
            {weeks.map(({ dates, disabled }, wi) => (
              <div key={wi} className="bg-white rounded-2xl border border-gray-100 p-3 grid grid-cols-5 gap-2">
                {dates.map((d, di) => {
                  const iso        = formatDate(d);
                  const isSelected = selectedDate === iso;
                  const isDisabled = disabled[di]!;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleDateSelect(iso)}
                      className={[
                        "flex flex-col items-center py-2.5 px-1 rounded-xl transition-all text-center",
                        isDisabled
                          ? "opacity-30 cursor-not-allowed"
                          : isSelected
                          ? "bg-[#120A2B] text-white"
                          : "hover:bg-[#FFF1EB] text-[#120A2B]",
                      ].join(" ")}
                    >
                      <span className={`text-[10px] font-bold uppercase ${isSelected ? "text-white/60" : "text-[#9CA3AF]"}`}>
                        {DAY_NAMES[d.getDay()]}
                      </span>
                      <span className="text-base font-extrabold mt-0.5">
                        {d.getDate()}
                      </span>
                      <span className={`text-[9px] font-semibold ${isSelected ? "text-white/60" : "text-[#9CA3AF]"}`}>
                        {MONTH_NAMES[d.getMonth()]}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Paso 2: Horario */}
        {selectedDate && (
          <div>
            <p className="text-xs font-extrabold text-[#120A2B]/40 uppercase tracking-widest mb-3">
              2 — Elige el horario
            </p>

            {isLoadingSlots ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#120A2B]/40">
                <Loader2 size={16} className="animate-spin" />
                Consultando disponibilidad…
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {TIME_SLOTS.map((slot) => {
                  const isSelected = selectedSlot === slot;
                  const isTaken    = takenSlots.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isTaken}
                      onClick={() => setSelectedSlot(slot)}
                      className={[
                        "flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all",
                        isTaken
                          ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                          : isSelected
                          ? "border-[#120A2B] bg-[#120A2B] text-white"
                          : "border-gray-200 bg-white text-[#120A2B] hover:border-gray-300",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-2">
                        <Clock
                          size={14}
                          className={
                            isTaken    ? "text-gray-300" :
                            isSelected ? "text-white/70" :
                                         "text-[#9CA3AF]"
                          }
                        />
                        {slot}
                      </span>
                      {isTaken && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-300">
                          Ocupado
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Resumen */}
        {selectedDate && selectedSlot && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <p className="text-xs font-extrabold text-[#120A2B]/40 uppercase tracking-widest mb-3">
              Resumen
            </p>
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-[#FF7031] shrink-0" />
              <span className="text-sm font-semibold text-[#120A2B]">
                {formatDisplayDate(new Date(selectedDate + "T12:00:00"))}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-[#FF7031] shrink-0" />
              <span className="text-sm font-semibold text-[#120A2B]">{selectedSlot}</span>
            </div>
          </div>
        )}
      </main>

      {/* Bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-4 z-30 shadow-[0_-8px_24px_rgba(18,10,43,0.08)]"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))" }}
      >
        <div className="max-w-lg mx-auto space-y-2">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-600">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedDate || !selectedSlot || isPending}
            className={[
              "w-full py-4 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-2",
              selectedDate && selectedSlot && !isPending
                ? "bg-[#FF7031] text-white hover:bg-[#e6652c] shadow-md active:scale-95"
                : "bg-gray-100 text-gray-400 cursor-not-allowed",
            ].join(" ")}
          >
            {isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Agendando...</>
            ) : (
              "Confirmar visita →"
            )}
          </button>
          {!selectedDate && (
            <p className="text-xs text-center text-[#120A2B]/40">
              Selecciona un día para continuar.
            </p>
          )}
          {selectedDate && !selectedSlot && (
            <p className="text-xs text-center text-[#120A2B]/40">
              Selecciona un horario para confirmar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
