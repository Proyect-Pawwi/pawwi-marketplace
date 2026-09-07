"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sun, Moon, Plane, Clock } from "lucide-react";
import BookingHeader from "./BookingHeader";

interface Service {
  id_service: number;
  price: number;
  max_animals: number;
  is_active: boolean;
  service_type: { id: number; name: string } | null;
}

interface Pawwer {
  id: string;
  badge: string;
  neighborhood: string;
  profile: { name: string; avatar_url: string | null } | null;
  services: Service[];
}

interface Props {
  pawwer:               Pawwer;
  preSelectedServiceId: number | null;
  preStart:             string | null;
  preEnd:               string | null;
  preHours:             number | null;
}

const SERVICE_META: Record<string, { icon: React.ReactNode; unit: string; desc: string; color: string }> = {
  DayCare: {
    icon:  <Sun size={22} />,
    unit:  "/ día",
    desc:  "Tu perro pasa el día en casa del Pawwer con atención continua.",
    color: "bg-[#FFF1EB] text-[#FF7031]",
  },
  Night: {
    icon:  <Moon size={22} />,
    unit:  "/ noche",
    desc:  "Tu perro duerme en casa del Pawwer. Pickup en la mañana.",
    color: "bg-[#120A2B]/8 text-[#120A2B]",
  },
  Travel: {
    icon:  <Plane size={22} />,
    unit:  "/ día",
    desc:  "El Pawwer cuida a tu perro mientras estás de viaje (mín. 2 días).",
    color: "bg-[#92C0E9]/20 text-[#1a6fa8]",
  },
  Express: {
    icon:  <Clock size={22} />,
    unit:  "/ hora",
    desc:  "Servicio express por horas. El Pawwer va a tu casa o tú llevas.",
    color: "bg-[#F7AEF1]/40 text-[#7c3aed]",
  },
};

function fmtCOP(n: number) {
  return `$${Math.round(n / 1000)}k`;
}

export default function Step1Servicios({ pawwer, preSelectedServiceId, preStart, preEnd, preHours }: Props) {
  const router = useRouter();
  const active = pawwer.services.filter(s => s.is_active && s.service_type);
  const [selected, setSelected] = useState<Service | null>(
    preSelectedServiceId ? active.find(s => s.id_service === preSelectedServiceId) ?? null : null
  );

  const pawwerName   = pawwer.profile?.name ?? "Pawwer";
  const pawwerAvatar = pawwer.profile?.avatar_url ?? null;

  function handleContinue() {
    if (!selected) return;
    const params = new URLSearchParams({
      pawwer_id:  pawwer.id,
      step:       "2",
      service_id: String(selected.id_service),
    });
    if (preStart) params.set("start", preStart);
    if (preEnd)   params.set("end", preEnd);
    if (preHours) params.set("hours", String(preHours));
    router.push(`/booking/nuevo?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-cream">
      <BookingHeader
        step={1}
        backHref={`/pawwer/${pawwer.id}`}
        pawwerName={pawwerName}
        pawwerAvatar={pawwerAvatar}
      />

      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-heading font-extrabold text-midnight mb-1">
            ¿Qué servicio necesitas?
          </h1>
          <p className="text-sm text-midnight/50 font-body">
            Selecciona el tipo de cuidado para tu perro.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {active.map((svc) => {
            const name = svc.service_type!.name;
            const meta = SERVICE_META[name];
            if (!meta) return null;
            const isSelected = selected?.id_service === svc.id_service;

            return (
              <button
                key={svc.id_service}
                onClick={() => setSelected(svc)}
                className={[
                  "w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all",
                  isSelected
                    ? "bg-[#120A2B] border-[#120A2B] shadow-md"
                    : "bg-white/80 border-white hover:border-gray-200 hover:shadow-sm",
                ].join(" ")}
              >
                <div className={`p-2.5 rounded-xl ${isSelected ? "bg-white/15" : meta.color}`}>
                  <span className={isSelected ? "text-white" : ""}>{meta.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-extrabold text-base ${isSelected ? "text-white" : "text-midnight"}`}>
                      {name === "DayCare" ? "Daycare" : name === "Night" ? "Nightcare" : name}
                    </span>
                    <span className={`font-extrabold text-base ${isSelected ? "text-[#FF7031]" : "text-midnight"}`}>
                      {fmtCOP(svc.price)}
                      <span className={`text-xs font-medium ml-0.5 ${isSelected ? "text-white/60" : "text-gray-400"}`}>
                        {meta.unit}
                      </span>
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 font-body leading-relaxed ${isSelected ? "text-white/70" : "text-gray-500"}`}>
                    {meta.desc}
                  </p>
                  <p className={`text-[10px] mt-1 font-bold ${isSelected ? "text-white/50" : "text-gray-400"}`}>
                    Máx. {svc.max_animals} perro{svc.max_animals !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className={[
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                  isSelected ? "bg-[#FF7031] border-[#FF7031]" : "bg-white border-gray-300",
                ].join(" ")}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Trust pill */}
        <div className="flex items-center justify-center gap-2 text-xs text-midnight/50 font-body mb-8">
          <span>🛡️</span>
          <span>PawwiProtect™ incluido en todas las reservas</span>
        </div>

        <button
          onClick={handleContinue}
          disabled={!selected}
          className={[
            "w-full py-4 rounded-2xl font-extrabold text-base transition-all",
            selected
              ? "bg-[#FF7031] text-white hover:bg-[#e6652c] shadow-md hover:shadow-lg active:scale-95"
              : "bg-gray-100 text-gray-400 cursor-not-allowed",
          ].join(" ")}
        >
          Continuar {selected ? `→ ${selected.service_type!.name === "DayCare" ? "Daycare" : selected.service_type!.name}` : ""}
        </button>
      </main>
    </div>
  );
}
