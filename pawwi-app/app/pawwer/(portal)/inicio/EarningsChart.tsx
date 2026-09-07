"use client";

import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ChartPoint } from "@/app/actions/portal";

// Aislado en su propio módulo para cargar `recharts` con next/dynamic (lazy):
// así sale del bundle inicial del home y baja el TTI.

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function fmtAxisLabel(iso: string, totalPoints: number): string {
  const d = new Date(iso + "T12:00:00");
  const days = ["D", "L", "M", "X", "J", "V", "S"];
  if (totalPoints <= 7) return days[d.getDay()]!;
  if (totalPoints <= 15) return `${d.getDate()}`;
  return d.getDate() === 1 ? MONTHS[d.getMonth()]! : `${d.getDate()}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const earnings = payload[0]?.value ?? 0;
  const d = new Date((label ?? "") + "T12:00:00");
  return (
    <div className="bg-[#120A2B] text-white text-xs font-bold px-3 py-2 rounded-[14px] shadow-xl">
      <p className="text-white/50 text-[10px] mb-0.5">{d.getDate()} {MONTHS[d.getMonth()]}</p>
      <p>{earnings > 0 ? fmtCOP(earnings) : "Sin ingresos"}</p>
    </div>
  );
}

export default function EarningsChart({ data, gradientId }: { data: ChartPoint[]; gradientId: string }) {
  const tickInterval = Math.max(0, Math.floor(data.length / 6) - 1);
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#120A2B" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#120A2B" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(v) => fmtAxisLabel(v, data.length)}
          tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }}
          tickLine={false}
          axisLine={false}
          interval={tickInterval}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(18,10,43,0.05)", strokeWidth: 2 }} />
        <Area
          type="monotone"
          dataKey="earnings"
          stroke="#120A2B"
          strokeWidth={3}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 5, fill: "#120A2B", strokeWidth: 3, stroke: "#FFFFFF" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
