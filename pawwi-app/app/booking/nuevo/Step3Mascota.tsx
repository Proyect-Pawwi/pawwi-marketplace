"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PawPrint, Plus, AlertCircle } from "lucide-react";
import { APIProvider } from "@vis.gl/react-google-maps";
import BookingHeader from "./BookingHeader";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { crearReserva } from "@/app/actions/booking";

const SIZE_LABEL: Record<number, string> = { 1: "Pequeño", 2: "Mediano", 3: "Grande", 4: "Extra grande" };
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

interface Dog {
  id: string;
  name: string;
  breed: string;
  size: number;
  photo_url: string | null;
  vaccine: boolean;
}

interface Pawwer {
  id: string;
  profile: { name: string; avatar_url: string | null } | null;
}

interface Props {
  pawwer:         Pawwer;
  dogs:           Dog[];
  serviceId:      number;
  serviceName:    string;
  servicePrice:   number;
  transportPrice: number;
  start:          string;
  end:            string;
  hours:          number | null;
  startTime:      string | null;
  endTime:        string | null;
}

const TRANSPORT_OPTS = [
  { v: 0, label: "No, gracias" },
  { v: 1, label: "Solo ida" },
  { v: 2, label: "Ida y vuelta" },
] as const;

const SERVICE_LABELS: Record<number, string> = { 1: "DayCare", 2: "Nightcare", 3: "Travel", 4: "Express" };

function fmtCOP(n: number) { return `$${Math.round(n / 1000)}k`; }

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
function fmtDate(s: string) {
  const d = parseDate(s);
  return `${d.getDate()} ${MESES[d.getMonth()]!.slice(0, 3)}`;
}

function calcTotal(serviceId: number, price: number, start: string, end: string, hours: number | null): number {
  if (serviceId === 4) return price * (hours ?? 1);
  const days = Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86400000) + 1;
  return price * Math.max(serviceId === 3 ? 2 : 1, days);
}

export default function Step3Mascota({ pawwer, dogs, serviceId, serviceName, servicePrice, transportPrice, start, end, hours, startTime, endTime }: Props) {
  const [selectedDogs, setSelectedDogs] = useState<Set<string>>(new Set());
  const [notes, setNotes]               = useState("");
  const [transportLegs, setTransportLegs] = useState(0);
  const [address, setAddress]           = useState("");
  const [addrCoords, setAddrCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [addrHood, setAddrHood]         = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [isPending, startTransition]    = useTransition();

  const offersTransport = transportPrice > 0;
  const cuidado        = calcTotal(serviceId, servicePrice, start, end, hours);
  const transportTotal = transportLegs * transportPrice;
  const total          = cuidado + transportTotal;

  function toggleDog(id: string) {
    setSelectedDogs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (selectedDogs.size === 0) { setError("Selecciona al menos una mascota."); return; }
    if (transportLegs > 0 && address.trim() === "") {
      setError("Ingresa la dirección donde el Pawwer recoge a tu peludito.");
      return;
    }
    setError(null);

    const fd = new FormData();
    fd.set("pawwer_id",       pawwer.id);
    fd.set("start_date",      start);
    fd.set("end_date",        end);
    fd.set("service_type_id", String(serviceId));
    fd.set("dog_ids",         Array.from(selectedDogs).join(","));
    fd.set("notes",           notes);
    if (hours) fd.set("hours_count", String(hours));
    if (startTime) fd.set("start_time", startTime);
    if (endTime)   fd.set("end_time",   endTime);
    fd.set("transport_legs",  String(transportLegs));
    if (address.trim())     fd.set("address",      address.trim());
    if (addrCoords)         { fd.set("client_lat", String(addrCoords.lat)); fd.set("client_lng", String(addrCoords.lng)); }
    if (addrHood.trim())    fd.set("neighborhood", addrHood.trim());

    startTransition(() => crearReserva(fd).then(result => {
      if ("error" in result) setError(result.error);
    }));
  }

  const backParams = new URLSearchParams({
    pawwer_id:  pawwer.id,
    step:       "2",
    service_id: String(serviceId),
    start,
    end,
  });
  if (hours) backParams.set("hours", String(hours));

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
    <div className="min-h-screen bg-cream pb-36">
      <BookingHeader
        step={3}
        backHref={`/booking/nuevo?${backParams.toString()}`}
        pawwerName={pawwer.profile?.name ?? "Pawwer"}
        pawwerAvatar={pawwer.profile?.avatar_url ?? null}
      />

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-heading font-extrabold text-midnight mb-1">¿Quién va con el Pawwer?</h1>
          <p className="text-sm text-midnight/50 font-body">Selecciona las mascotas que incluirás en esta reserva.</p>
        </div>

        {/* Sin mascotas */}
        {dogs.length === 0 && (
          <div className="bg-white/70 border border-white rounded-2xl p-6 text-center">
            <PawPrint size={32} className="mx-auto text-midnight/20 mb-2" />
            <p className="font-bold text-midnight text-sm mb-1">No tienes mascotas registradas</p>
            <p className="text-xs text-midnight/50 font-body mb-4">Agrega tu perro para continuar con la reserva.</p>
            <Link
              href={`/mis-mascotas/nueva?back=${encodeURIComponent(`/booking/nuevo?pawwer_id=${pawwer.id}&step=3&service_id=${serviceId}&start=${start}&end=${end}${hours ? `&hours=${hours}` : ""}`)}`}
              className="inline-flex items-center gap-2 bg-[#FF7031] text-white font-bold px-5 py-2.5 rounded-xl text-sm"
            >
              <Plus size={14} /> Agregar mascota
            </Link>
          </div>
        )}

        {/* Lista de mascotas */}
        {dogs.length > 0 && (
          <div className="space-y-2.5">
            {dogs.map(dog => {
              const isSel = selectedDogs.has(dog.id);
              return (
                <button
                  key={dog.id}
                  type="button"
                  onClick={() => toggleDog(dog.id)}
                  className={[
                    "w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all",
                    isSel
                      ? "bg-[#120A2B] border-[#120A2B] shadow-md"
                      : "bg-white/80 border-white hover:border-gray-200",
                  ].join(" ")}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#FFF1EB]">
                    {dog.photo_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={dog.photo_url} alt={dog.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">🐶</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-extrabold text-sm ${isSel ? "text-white" : "text-midnight"}`}>{dog.name}</p>
                    <p className={`text-xs font-body ${isSel ? "text-white/60" : "text-gray-500"}`}>
                      {dog.breed} · {SIZE_LABEL[dog.size] ?? ""}
                      {dog.vaccine && " · 💉 Vacunado"}
                    </p>
                  </div>
                  <div className={[
                    "w-5 h-5 rounded-full border-2 shrink-0",
                    isSel ? "bg-[#FF7031] border-[#FF7031]" : "border-gray-300 bg-white",
                  ].join(" ")}>
                    {isSel && <div className="w-full h-full rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Dirección del cuidado */}
        <div>
          <label className="text-sm font-semibold text-midnight font-body block mb-1.5">
            ¿Dónde será el cuidado?{" "}
            {transportLegs > 0
              ? <span className="text-[#FF7031] font-normal">requerido para el transporte</span>
              : <span className="text-gray-400 font-normal">(recomendado)</span>}
          </label>
          <AddressAutocomplete
            value={address}
            onChange={(v) => { setAddress(v); setAddrCoords(null); }}
            onSelect={(coords, label, neighborhood) => {
              setAddress(label);
              setAddrCoords(coords);
              setAddrHood(neighborhood ?? "");
            }}
            placeholder="Ej. Calle 116 # 12-34, Bogotá"
          />
          <p className="text-xs text-midnight/40 font-body mt-1.5">
            El Pawwer verá tu dirección para calcular distancia y coordinar el transporte.
          </p>
        </div>

        {/* Notas */}
        <div>
          <label className="text-sm font-semibold text-midnight font-body block mb-1.5">
            Notas para el Pawwer <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={300}
            placeholder="Medicamentos, horarios especiales, cosas importantes sobre tu perro..."
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-midnight font-body outline-none focus:border-[#FF7031] focus:ring-1 focus:ring-[#FF7031]/30 transition resize-none"
          />
        </div>

        {/* Transporte del peludito */}
        {offersTransport && (
          <div>
            <label className="text-sm font-semibold text-midnight font-body block mb-1.5">
              ¿Transporte del peludito? <span className="text-gray-400 font-normal">({fmtCOP(transportPrice)}/trayecto)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TRANSPORT_OPTS.map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setTransportLegs(opt.v)}
                  className={[
                    "py-3 rounded-xl border text-xs font-bold transition-all",
                    transportLegs === opt.v
                      ? "bg-[#120A2B] border-[#120A2B] text-white"
                      : "bg-white/80 border-gray-200 text-midnight hover:border-gray-300",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-midnight/40 font-body mt-1.5">El Pawwer recoge y/o entrega a tu peludito en tu dirección.</p>
          </div>
        )}

        {/* Resumen */}
        <div className="bg-white/80 border border-white rounded-2xl p-4 space-y-2">
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-3">Resumen de reserva</p>
          <div className="flex justify-between text-sm text-midnight/70">
            <span>{SERVICE_LABELS[serviceId]}</span>
            <span>{serviceId === 4 ? `${hours}h` : `${fmtDate(start)}${start !== end ? ` → ${fmtDate(end)}` : ""}`}</span>
          </div>
          <div className="flex justify-between text-sm text-midnight/70">
            <span>Pawwer</span>
            <span>{pawwer.profile?.name}</span>
          </div>
          {transportLegs > 0 && (
            <div className="flex justify-between text-sm text-midnight/70">
              <span>Transporte ({transportLegs === 1 ? "ida" : "ida y vuelta"})</span>
              <span>+{fmtCOP(transportTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-extrabold text-midnight pt-2 border-t border-gray-100">
            <span>Total estimado</span>
            <span className="text-[#FF7031]">{fmtCOP(total)}</span>
          </div>
          <p className="text-[10px] text-gray-400 font-body text-center">No se cobrará nada aún · pago en el siguiente paso</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}
      </main>

      {/* Bottom bar fija */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-4 z-30 shadow-[0_-8px_24px_rgba(18,10,43,0.08)]"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))" }}
      >
        <button
          onClick={handleSubmit}
          disabled={isPending || dogs.length === 0}
          className={[
            "w-full py-4 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-2",
            !isPending && dogs.length > 0 && selectedDogs.size > 0
              ? "bg-[#FF7031] text-white hover:bg-[#e6652c] shadow-md active:scale-95"
              : "bg-gray-100 text-gray-400 cursor-not-allowed",
          ].join(" ")}
        >
          {isPending
            ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creando reserva...</>
            : `Ir a pagar ${fmtCOP(total)}`
          }
        </button>
      </div>
    </div>
    </APIProvider>
  );
}
