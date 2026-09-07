"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

interface Props {
  step:        1 | 2 | 3 | 4;
  backHref:    string;
  pawwerName:  string;
  pawwerAvatar: string | null;
}

const STEPS = [
  { n: 1, label: "Servicio" },
  { n: 2, label: "Fechas" },
  { n: 3, label: "Mascota" },
];

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=80&auto=format&fit=crop";

export default function BookingHeader({ step, backHref, pawwerName, pawwerAvatar }: Props) {
  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-white/50 sticky top-0 z-50 px-4 py-3 shadow-sm">
      <div className="max-w-xl mx-auto flex items-center gap-3">
        <Link
          href={backHref}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
        </Link>

        {/* Progress */}
        <div className="flex items-center gap-1.5 flex-1">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1.5">
              <div
                className={[
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-extrabold transition-all",
                  step > s.n
                    ? "bg-green-500 text-white"
                    : step === s.n
                    ? "bg-[#120A2B] text-white"
                    : "bg-gray-100 text-gray-400",
                ].join(" ")}
              >
                {step > s.n ? "✓" : s.n}
              </div>
              <span
                className={`text-xs font-bold hidden sm:block ${
                  step === s.n ? "text-midnight" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-6 rounded-full ${step > s.n ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Pawwer mini-chip */}
        <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-full px-3 py-1.5 shadow-sm shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pawwerAvatar ?? FALLBACK_AVATAR}
            alt={pawwerName}
            className="w-5 h-5 rounded-full object-cover"
          />
          <span className="text-xs font-bold text-midnight hidden sm:block max-w-[80px] truncate">
            {pawwerName}
          </span>
          <ShieldCheck size={11} className="text-[#FF7031] shrink-0" />
        </div>
      </div>
    </header>
  );
}
