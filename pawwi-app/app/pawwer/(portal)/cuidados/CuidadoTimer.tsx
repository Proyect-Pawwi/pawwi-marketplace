"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

// Momento absoluto en hora de Bogotá (UTC-5, sin DST).
function bogota(dateStr: string, timeStr: string | null, fallback: string): number {
  const d = dateStr.slice(0, 10);
  const t = (timeStr ?? fallback).slice(0, 5);
  return new Date(`${d}T${t}:00-05:00`).getTime();
}

function fmt(ms: number): string {
  if (ms <= 0) return "ya";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

// Banner de urgencia para cuidados confirmados (cuenta hasta el inicio) y en
// curso (cuenta hasta el fin). Overnight: si es el mismo día y la hora de fin
// es ≤ la de inicio (NightCare), el fin es al día siguiente.
export default function CuidadoTimer({
  statusId,
  startDate,
  endDate,
  startTime,
  endTime,
}: {
  statusId: number;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMoment = bogota(startDate, startTime, "00:00");
  let endMoment = bogota(endDate, endTime, "23:59");
  const sameDay = startDate.slice(0, 10) === endDate.slice(0, 10);
  if (sameDay && startTime && endTime && endTime <= startTime) endMoment += 86_400_000; // overnight

  const isConfirmed = statusId === 2;
  const target = isConfirmed ? startMoment : endMoment;
  const label = isConfirmed ? "Tu cuidado comienza en" : "Termina en";
  const diff = now === null ? null : target - now;

  // Urgencia: confirmado < 3h para arrancar; en curso < 1h para terminar.
  const urgent = diff !== null && diff > 0 && diff < (isConfirmed ? 3 : 1) * 3_600_000;

  const cls = urgent
    ? "bg-red-50 text-red-600 animate-pulse"
    : isConfirmed
      ? "bg-[#E0F2FE] text-[#0284C7]"
      : "bg-green-50 text-green-600";

  return (
    <div className={`px-5 pt-3 pb-2 flex items-center justify-between ${cls}`}>
      <span className="eyebrow ">{label}</span>
      <span className="flex items-center gap-1 text-[11px] font-black tabular-nums">
        <Clock size={11} />
        {diff === null ? "··:··" : diff <= 0 ? (isConfirmed ? "arrancando" : "finalizando") : fmt(diff)}
      </span>
    </div>
  );
}
