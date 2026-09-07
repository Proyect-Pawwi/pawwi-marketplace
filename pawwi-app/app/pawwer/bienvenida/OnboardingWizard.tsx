"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Sun, Moon, Plane, Clock, Camera, Loader2,
  AlertCircle, Check, ArrowLeft, ShieldCheck,
} from "lucide-react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { createClient } from "@/lib/client";
import { completarOnboardingPawwer } from "@/app/actions/pawwer";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Input } from "@/components/ui/Input";

const WEEK_KEYS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop";

const SERVICE_META: Record<number, { name: string; unit: string; icon: React.ReactNode; desc: string }> = {
  1: { name: "Daycare",   unit: "día",   icon: <Sun size={18} />,   desc: "Cuidas al perro durante el día, hasta 10 horas." },
  2: { name: "Nightcare", unit: "noche", icon: <Moon size={18} />,  desc: "El perro duerme en tu casa, hasta 12 horas." },
  3: { name: "Travel",    unit: "día",   icon: <Plane size={18} />, desc: "Cuidado mientras el dueño viaja (mínimo 2 noches)." },
  4: { name: "Express",   unit: "hora",  icon: <Clock size={18} />, desc: "Visitas cortas de 1-2 horas." },
};

const SERVICE_SUGGESTED: Record<number, number> = {
  1: 60000,
  2: 70000,
  3: 70000,
  4: 10000,
};

const TIPO_INMUEBLE_OPTS    = ["Casa", "Apartamento", "Finca / Casa de campo", "Otro"];
const AREAS_EXTERNAS_OPTS   = ["Patio trasero", "Balcón", "Jardín", "Terraza", "Ninguna"];
const ANIMALES_EN_CASA_OPTS = ["Perros", "Gatos", "Aves / Loros", "Otros animales", "Sin animales"];
const EXPERIENCIA_OPTS      = ["Soy nuevo/a", "1 a 2 años", "3 a 5 años", "Más de 5 años"];

type ServiceState = Record<number, { active: boolean; price: string }>;

interface Props {
  name: string;
  avatarUrl: string | null;
  phone: string;
}

function fmtCOP(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

function getMaxBirthDate(): string {
  return new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().split("T")[0]!;
}

function calcularEdad(fecha: string): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  const nac = new Date(fecha);
  const edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) return edad - 1;
  return edad;
}

export default function OnboardingWizard({ name, avatarUrl: initialAvatarUrl, phone }: Props) {
  const firstName = name.split(" ")[0] || "Pawwer";
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Step 1: datos personales ─────────────────────────────────────────────
  const [address, setAddress]               = useState("");
  const [lat, setLat]                       = useState<number | null>(null);
  const [lng, setLng]                       = useState<number | null>(null);
  const [neighborhood, setNeighborhood]     = useState("");
  const [cedula, setCedula]                 = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [weekPattern, setWeekPattern]       = useState<Record<string, boolean>>(
    Object.fromEntries(WEEK_KEYS.map((k) => [k, false])) as Record<string, boolean>,
  );

  // Fotos de cédula
  const [cedulaFrontPreview, setCedulaFrontPreview] = useState<string | null>(null);
  const [cedulaBackPreview,  setCedulaBackPreview]  = useState<string | null>(null);
  const [cedulaFrontPath,    setCedulaFrontPath]    = useState<string | null>(null);
  const [cedulaBackPath,     setCedulaBackPath]     = useState<string | null>(null);
  const [cedulaUploading,    setCedulaUploading]    = useState(false);
  const cedulaFrontRef = useRef<HTMLInputElement>(null);
  const cedulaBackRef  = useRef<HTMLInputElement>(null);

  // ── Step 2: hogar y perfil ───────────────────────────────────────────────
  const [, setAvatarUrl]              = useState(initialAvatarUrl ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl ?? null);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bio, setBio]                 = useState("");
  const [miEspacio, setMiEspacio]     = useState("");
  const [valores, setValores]         = useState("");
  const [profession, setProfession]   = useState("");
  const [experiencia, setExperiencia] = useState("");
  const [tipoInmueble, setTipoInmueble]     = useState("");
  const [areasExternas, setAreasExternas]   = useState<string[]>([]);
  const [animalesEnCasa, setAnimalesEnCasa] = useState<string[]>([]);
  const [ninosPequenos, setNinosPequenos]   = useState(false);
  const [transportPrice, setTransportPrice] = useState("");
  const [services, setServices] = useState<ServiceState>({
    1: { active: false, price: "" },
    2: { active: false, price: "" },
    3: { active: false, price: "" },
    4: { active: false, price: "" },
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 3 ───────────────────────────────────────────────────────────────
  const [error, setError]            = useState<string | null>(null);
  const [submitted, setSubmitted]    = useState(false);
  const [isPending, startTransition] = useTransition();

  const edad      = calcularEdad(fechaNacimiento);
  const edadValida = edad !== null && edad >= 18;

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleAddressChange(value: string) {
    setAddress(value);
    if (lat !== null) { setLat(null); setLng(null); setNeighborhood(""); }
  }

  function handleAddressSelect(coords: { lat: number; lng: number }, _label: string, hood?: string) {
    setLat(coords.lat);
    setLng(coords.lng);
    setNeighborhood(hood ?? "");
  }

  function toggleDay(key: string) {
    setWeekPattern((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleService(id: number) {
    setServices((prev) => {
      const svc = prev[id]!;
      const nextActive = !svc.active;
      return {
        ...prev,
        [id]: {
          active: nextActive,
          price: nextActive && svc.price === "" ? String(SERVICE_SUGGESTED[id] ?? "") : svc.price,
        },
      };
    });
  }

  function setServicePrice(id: number, price: string) {
    setServices((prev) => ({ ...prev, [id]: { ...prev[id]!, price } }));
  }

  function toggleArea(area: string) {
    setAreasExternas((prev) => {
      if (area === "Ninguna") return ["Ninguna"];
      const without = prev.filter((a) => a !== "Ninguna");
      return without.includes(area) ? without.filter((a) => a !== area) : [...without, area];
    });
  }

  function toggleAnimal(animal: string) {
    setAnimalesEnCasa((prev) => {
      if (animal === "Sin animales") return ["Sin animales"];
      const without = prev.filter((a) => a !== "Sin animales");
      return without.includes(animal) ? without.filter((a) => a !== animal) : [...without, animal];
    });
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError("La foto no puede superar 5 MB"); return; }

    setUploading(true);
    setUploadError(null);
    setAvatarPreview(URL.createObjectURL(file));

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("pawwer-avatars")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (upErr) { setUploadError("No se pudo subir la foto. Continúa sin foto."); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("pawwer-avatars").getPublicUrl(path);
    await supabase.from("profile").update({ avatar_url: urlData.publicUrl }).eq("id", user.id);
    setAvatarUrl(urlData.publicUrl);
    setUploading(false);
  }

  async function handleCedulaPhoto(e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back") {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setUploadError("La foto no puede superar 10 MB"); return; }

    setCedulaUploading(true);
    setUploadError(null);
    const localPreview = URL.createObjectURL(file);
    if (side === "front") setCedulaFrontPreview(localPreview);
    else setCedulaBackPreview(localPreview);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCedulaUploading(false); return; }

    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${side}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("cedula-docs")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (upErr) {
      setUploadError("No se pudo subir la foto. Intenta de nuevo.");
      if (side === "front") { setCedulaFrontPreview(null); }
      else { setCedulaBackPreview(null); }
      setCedulaUploading(false);
      return;
    }

    if (side === "front") setCedulaFrontPath(path);
    else setCedulaBackPath(path);
    setCedulaUploading(false);
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const activeServices = Object.entries(services)
    .filter(([, s]) => s.active && Number(s.price) >= 1000)
    .map(([id, s]) => ({ id: Number(id), price: Number(s.price) }));

  const canStep1 =
    lat !== null &&
    /^[0-9]{6,12}$/.test(cedula) &&
    cedulaFrontPath !== null &&
    cedulaBackPath !== null &&
    edadValida &&
    Object.values(weekPattern).some(Boolean);

  const canStep2 =
    bio.trim().length >= 20 &&
    activeServices.length > 0 &&
    tipoInmueble !== "" &&
    experiencia !== "";

  function handleSubmit() {
    setError(null);
    if (lat === null || lng === null) { setError("Selecciona una dirección válida."); return; }
    if (activeServices.length === 0) { setError("Selecciona al menos un servicio."); return; }

    const fd = new FormData();
    fd.set("bio",              bio.trim());
    fd.set("mi_espacio",       miEspacio.trim());
    fd.set("valores",          valores.trim());
    fd.set("profession",       profession.trim());
    fd.set("neighborhood",     neighborhood);
    fd.set("lat",              String(lat));
    fd.set("lng",              String(lng));
    fd.set("week_pattern",     JSON.stringify(weekPattern));
    fd.set("services",         JSON.stringify(activeServices.map((s) => ({ service_id: s.id, price: s.price }))));
    fd.set("cedula",           cedula.trim());
    fd.set("fecha_nacimiento", fechaNacimiento);
    fd.set("transport_price",  transportPrice || "0");
    fd.set("experiencia",      experiencia);
    fd.set("animales_en_casa", animalesEnCasa.join(","));
    fd.set("tipo_inmueble",    tipoInmueble);
    fd.set("areas_externas",   areasExternas.join(","));
    fd.set("ninos_pequenos",   String(ninosPequenos));
    fd.set("cedula_front_path", cedulaFrontPath ?? "");
    fd.set("cedula_back_path",  cedulaBackPath  ?? "");

    startTransition(async () => {
      const result = await completarOnboardingPawwer(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    });
  }

  const STEPS = [
    { n: 1, label: "Tus datos" },
    { n: 2, label: "Tu hogar" },
    { n: 3, label: "Publicar" },
  ] as const;

  // ── Pantalla de éxito ─────────────────────────────────────────────────────
  if (submitted) {
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

          <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center shadow-sm">
            <p className="text-5xl mb-4">🎉</p>
            <h1 className="text-xl font-extrabold text-[#120A2B] mb-2">¡Tu perfil fue enviado!</h1>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Hola {firstName}, recibimos tu información correctamente. Estos son los próximos pasos:
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-0">
            {[
              {
                n: 1,
                icon: "🪪",
                title: "Verificamos tu cédula",
                desc: "Luisa revisará tus antecedentes penales y verificará tu identidad. Esto toma 1–2 días hábiles.",
              },
              {
                n: 2,
                icon: "📝",
                title: "Examen psicotécnico",
                desc: "Recibirás un correo electrónico con un enlace para completar el examen (≈ 5 min).",
              },
              {
                n: 3,
                icon: "📞",
                title: "Capacitación y visita",
                desc: "Si pasas el examen, te contactaremos para coordinar la capacitación virtual y la visita a tu hogar.",
              },
              {
                n: 4,
                icon: "✅",
                title: "¡Empieza a recibir reservas!",
                desc: "Tu perfil se publica y los dueños de perritos podrán encontrarte.",
              },
            ].map(({ n, icon, title, desc }, i, arr) => (
              <div key={n} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full bg-[#FFF1EB] flex items-center justify-center text-lg shrink-0">
                    {icon}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-0.5 flex-1 my-1 bg-gray-100 rounded-full min-h-[20px]" />
                  )}
                </div>
                <div className="pb-5 pt-1 flex-1">
                  <p className="text-sm font-extrabold text-[#120A2B]">{title}</p>
                  <p className="text-xs text-[#6B7280] leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/pawwer/dashboard"
            className="block w-full text-center bg-[#120A2B] text-white font-extrabold text-sm py-4 rounded-2xl hover:bg-[#1e1145] transition-colors"
          >
            Ver mi panel →
          </Link>

          <p className="text-xs text-center text-[#120A2B]/40">
            ¿Tienes preguntas? Escríbenos a{" "}
            <a href="mailto:hola@pawwi.co" className="text-[#FF7031] underline">hola@pawwi.co</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div className="relative min-h-screen bg-cream pb-28">
        <div className="absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-plum/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-ice/20 blur-3xl pointer-events-none" />

        {/* Sticky header — z-30 para quedar sobre el contenido al hacer scroll */}
        <header className="relative z-30 bg-white/90 backdrop-blur-xl border-b border-white/50 sticky top-0 px-4 py-3 shadow-sm">
          <div className="max-w-xl mx-auto grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
            <button
              type="button"
              onClick={() => step > 1 && setStep((s) => (s - 1) as 1 | 2 | 3)}
              disabled={step === 1}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-0 disabled:pointer-events-none shrink-0 transition-opacity"
            >
              <ArrowLeft size={16} />
            </button>

            {/* Logo + steps — siempre centrados */}
            <div className="flex flex-col items-center gap-1.5">
              <Image
                src="/LogoPawwiCompleteOrange.svg"
                alt="Pawwi"
                width={80}
                height={26}
                style={{ width: "auto", height: "1.4rem" }}
              />
              <div className="flex items-center gap-1">
                {STEPS.map((s, i) => (
                  <div key={s.n} className="flex items-center gap-1">
                    <div
                      className={[
                        "flex items-center justify-center w-6 h-6 rounded-full text-xs font-extrabold transition-all",
                        step > s.n ? "bg-green-500 text-white" : step === s.n ? "bg-[#120A2B] text-white" : "bg-gray-100 text-gray-400",
                      ].join(" ")}
                    >
                      {step > s.n ? "✓" : s.n}
                    </div>
                    <span className={`text-[11px] font-bold hidden sm:block ${step === s.n ? "text-midnight" : "text-gray-400"}`}>
                      {s.label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div className={`h-0.5 w-5 rounded-full ${step > s.n ? "bg-green-400" : "bg-gray-200"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div /> {/* spacer para simetría */}
          </div>
        </header>

        <main className="relative z-10 max-w-xl mx-auto px-4 py-8">

          {/* ── Paso 1: Datos personales ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-heading font-extrabold text-midnight mb-1">
                  Hola {firstName}, cuéntanos sobre ti
                </h1>
                <p className="text-sm text-midnight/50 font-body">
                  Información básica para verificar tu identidad y mostrarte a los clientes en tu zona.
                </p>
              </div>

              {/* Dirección */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-midnight font-body">
                  ¿Dónde cuidas a los perros? <span className="text-red-400">*</span>
                </label>
                <AddressAutocomplete
                  value={address}
                  onChange={handleAddressChange}
                  onSelect={handleAddressSelect}
                  placeholder="Escribe tu dirección, ej: Cra 11 # 93-53"
                />
                {lat !== null
                  ? <p className="text-xs text-green-600 font-body flex items-center gap-1"><Check size={12} /> Dirección confirmada{neighborhood ? ` · ${neighborhood}` : ""}</p>
                  : <p className="text-xs text-midnight/40 font-body">Escribe y selecciona una opción del listado para confirmar.</p>
                }
              </div>

              {/* Cédula */}
              <div className="flex flex-col gap-1.5">
                <Input
                  label="Número de cédula de ciudadanía *"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Ej: 1020456789"
                  maxLength={12}
                  inputMode="numeric"
                />
                <p className="text-xs text-midnight/40 font-body">Solo ingresa los números, sin puntos ni espacios.</p>
              </div>

              {/* Aclaración: por qué pedimos la cédula */}
              <div className="flex gap-3 rounded-2xl bg-[#92C0E9]/10 border border-[#92C0E9]/30 p-4">
                <div className="w-9 h-9 rounded-xl bg-[#92C0E9]/20 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-[#0284C7]" />
                </div>
                <p className="text-xs text-midnight/60 font-body leading-relaxed">
                  Te pedimos tu cédula para{" "}
                  <span className="font-bold text-midnight">verificar tus antecedentes penales y judiciales</span>.
                  Es un requisito de seguridad para las familias que confían el cuidado de sus mascotas en Pawwi.
                </p>
              </div>

              {/* Fotos de cédula */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-midnight font-body">
                  Foto de tu cédula — frente y reverso <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-midnight/40 font-body">
                  Necesitamos verificar tu identidad antes de publicar tu perfil. Las fotos son privadas y solo las ve el equipo Pawwi.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Frente */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => cedulaFrontRef.current?.click()}
                      className="w-full aspect-[8/5] rounded-xl border-2 border-dashed border-midnight/20 hover:border-tangerine bg-white flex flex-col items-center justify-center gap-1.5 overflow-hidden transition-colors"
                    >
                      {cedulaFrontPreview
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={cedulaFrontPreview} alt="Frente" className="w-full h-full object-cover" />
                        : <>
                          <Camera size={22} className="text-midnight/30" />
                          <span className="text-xs text-midnight/40 font-body font-semibold">Frente</span>
                        </>
                      }
                    </button>
                    {cedulaFrontPath && (
                      <p className="text-xs text-green-600 font-body flex items-center gap-1 justify-center"><Check size={11} /> Subida</p>
                    )}
                  </div>
                  {/* Reverso */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => cedulaBackRef.current?.click()}
                      className="w-full aspect-[8/5] rounded-xl border-2 border-dashed border-midnight/20 hover:border-tangerine bg-white flex flex-col items-center justify-center gap-1.5 overflow-hidden transition-colors"
                    >
                      {cedulaBackPreview
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={cedulaBackPreview} alt="Reverso" className="w-full h-full object-cover" />
                        : <>
                          <Camera size={22} className="text-midnight/30" />
                          <span className="text-xs text-midnight/40 font-body font-semibold">Reverso</span>
                        </>
                      }
                    </button>
                    {cedulaBackPath && (
                      <p className="text-xs text-green-600 font-body flex items-center gap-1 justify-center"><Check size={11} /> Subida</p>
                    )}
                  </div>
                </div>
                {cedulaUploading && (
                  <p className="text-xs text-midnight/50 font-body flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Subiendo foto...
                  </p>
                )}
                {uploadError && <p className="text-xs text-red-500 font-body">{uploadError}</p>}
                <input ref={cedulaFrontRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => handleCedulaPhoto(e, "front")} />
                <input ref={cedulaBackRef}  type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => handleCedulaPhoto(e, "back")} />
              </div>

              {/* Fecha de nacimiento */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-midnight font-body">
                  Fecha de nacimiento <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                  max={getMaxBirthDate()}
                  className="h-12 w-full rounded-xl border border-midnight/20 px-4 text-base text-midnight font-body bg-white outline-none focus:border-tangerine focus:ring-2 focus:ring-tangerine/20 transition"
                />
                {fechaNacimiento && edad !== null && (
                  <p className={`text-xs font-body flex items-center gap-1 ${edadValida ? "text-green-600" : "text-red-500"}`}>
                    {edadValida
                      ? <><Check size={12} /> {edad} años — ¡aceptado!</>
                      : `${edad} años — debes tener al menos 18 años`}
                  </p>
                )}
              </div>

              {/* Días disponibles */}
              <div>
                <p className="text-sm font-semibold text-midnight font-body mb-1">
                  ¿Qué días sueles estar disponible? <span className="text-red-400">*</span>
                </p>
                <p className="text-xs text-midnight/40 font-body mb-2">
                  Podrás afinar fechas específicas después desde tu panel.
                </p>
                <div className="flex gap-1.5">
                  {WEEK_KEYS.map((key, i) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleDay(key)}
                      className={[
                        "flex-1 h-11 rounded-xl flex items-center justify-center text-sm font-extrabold border transition-colors",
                        weekPattern[key]
                          ? "bg-[#120A2B] text-white border-[#120A2B]"
                          : "bg-white text-gray-400 border-gray-200 hover:border-gray-300",
                      ].join(" ")}
                    >
                      {WEEK_LABELS[i]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 2: Tu hogar y perfil ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-heading font-extrabold text-midnight mb-1">Cuéntale a los clientes sobre ti</h1>
                <p className="text-sm text-midnight/50 font-body">Esto aparece en tu perfil público.</p>
              </div>

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-24 h-24 rounded-full bg-[#FFF1EB] border-2 border-dashed border-[#FF7031]/40 flex items-center justify-center overflow-hidden hover:border-[#FF7031] transition-colors"
                >
                  {uploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-[#FF7031]" />
                    </div>
                  )}
                  {avatarPreview
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    : <Camera size={24} className="text-[#FF7031]/60" />}
                </button>
                <span className="text-xs text-midnight/50 font-body">{uploading ? "Subiendo foto..." : "Foto de perfil (opcional)"}</span>
                {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
                <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleAvatar} />
              </div>

              <Input
                label="Profesión / a qué te dedicas"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="Ej: Veterinaria, Diseñador freelance..."
                maxLength={80}
              />

              {/* Bio */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-midnight font-body">
                  ¿Por qué amas los perros? Cuéntanos sobre ti <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={600}
                  placeholder="Cuéntale a los dueños por qué amas los perros, qué hace especial tu cuidado, tu personalidad, tus valores como Pawwer..."
                  className="w-full rounded-xl border border-midnight/20 bg-white px-4 py-3 text-base text-midnight font-body outline-none focus:border-tangerine focus:ring-2 focus:ring-tangerine/20 transition resize-none"
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-midnight/40 font-body">Mínimo 20 caracteres.</p>
                  <p className="text-xs text-midnight/40 font-body">{bio.length}/600</p>
                </div>
              </div>

              {/* Mi espacio */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-midnight font-body">¿Cómo es tu hogar para los perritos?</label>
                <textarea
                  rows={3}
                  value={miEspacio}
                  onChange={(e) => setMiEspacio(e.target.value)}
                  maxLength={400}
                  placeholder="Descríbenos tu espacio: si tienes patio, cuánto espacio hay para jugar, si es tranquilo, si hay zona para pasear cerca..."
                  className="w-full rounded-xl border border-midnight/20 bg-white px-4 py-3 text-base text-midnight font-body outline-none focus:border-tangerine focus:ring-2 focus:ring-tangerine/20 transition resize-none"
                />
                <p className="text-xs text-midnight/40 font-body text-right">{miEspacio.length}/400</p>
              </div>

              {/* Valores */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-midnight font-body">¿Cuáles son tus valores como cuidador/a?</label>
                <textarea
                  rows={3}
                  value={valores}
                  onChange={(e) => setValores(e.target.value)}
                  maxLength={400}
                  placeholder="Ej: soy muy detallista, mando actualizaciones constantes, trato a los perritos como si fueran míos, puntualidad, amor y paciencia..."
                  className="w-full rounded-xl border border-midnight/20 bg-white px-4 py-3 text-base text-midnight font-body outline-none focus:border-tangerine focus:ring-2 focus:ring-tangerine/20 transition resize-none"
                />
                <p className="text-xs text-midnight/40 font-body text-right">{valores.length}/400</p>
              </div>

              {/* Experiencia */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-midnight font-body">
                  ¿Cuánta experiencia tienes cuidando perros? <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCIA_OPTS.map((opt) => (
                    <button key={opt} type="button" onClick={() => setExperiencia(opt)}
                      className={["px-4 py-2 rounded-full text-sm font-semibold border transition-all",
                        experiencia === opt ? "bg-[#120A2B] text-white border-[#120A2B]" : "bg-white text-midnight/60 border-gray-200 hover:border-gray-300"].join(" ")}
                    >{opt}</button>
                  ))}
                </div>
              </div>

              {/* Tipo inmueble */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-midnight font-body">
                  ¿En qué tipo de lugar cuidas? <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIPO_INMUEBLE_OPTS.map((opt) => (
                    <button key={opt} type="button" onClick={() => setTipoInmueble(opt)}
                      className={["px-4 py-2 rounded-full text-sm font-semibold border transition-all",
                        tipoInmueble === opt ? "bg-[#120A2B] text-white border-[#120A2B]" : "bg-white text-midnight/60 border-gray-200 hover:border-gray-300"].join(" ")}
                    >{opt}</button>
                  ))}
                </div>
              </div>

              {/* Áreas externas */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-midnight font-body">¿Tienes áreas externas?</label>
                <p className="text-xs text-midnight/40 font-body">Puedes seleccionar varias opciones.</p>
                <div className="flex flex-wrap gap-2">
                  {AREAS_EXTERNAS_OPTS.map((opt) => (
                    <button key={opt} type="button" onClick={() => toggleArea(opt)}
                      className={["px-4 py-2 rounded-full text-sm font-semibold border transition-all",
                        areasExternas.includes(opt) ? "bg-[#120A2B] text-white border-[#120A2B]" : "bg-white text-midnight/60 border-gray-200 hover:border-gray-300"].join(" ")}
                    >{opt}</button>
                  ))}
                </div>
              </div>

              {/* Animales en casa */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-midnight font-body">¿Hay otros animales en tu casa?</label>
                <p className="text-xs text-midnight/40 font-body">Puedes seleccionar varios.</p>
                <div className="flex flex-wrap gap-2">
                  {ANIMALES_EN_CASA_OPTS.map((opt) => (
                    <button key={opt} type="button" onClick={() => toggleAnimal(opt)}
                      className={["px-4 py-2 rounded-full text-sm font-semibold border transition-all",
                        animalesEnCasa.includes(opt) ? "bg-[#120A2B] text-white border-[#120A2B]" : "bg-white text-midnight/60 border-gray-200 hover:border-gray-300"].join(" ")}
                    >{opt}</button>
                  ))}
                </div>
              </div>

              {/* Niños pequeños */}
              <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-midnight">¿Vives con niños pequeños?</p>
                  <p className="text-xs text-midnight/40 font-body mt-0.5">Menores de 10 años en el hogar.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNinosPequenos((v) => !v)}
                  className={[
                    "relative w-12 h-6 rounded-full transition-colors shrink-0",
                    ninosPequenos ? "bg-[#FF7031]" : "bg-gray-200",
                  ].join(" ")}
                  aria-pressed={ninosPequenos}
                >
                  <span className={[
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                    ninosPequenos ? "translate-x-6" : "translate-x-0.5",
                  ].join(" ")} />
                </button>
              </div>

              {/* Servicios */}
              <div>
                <p className="text-sm font-semibold text-midnight font-body mb-1">
                  ¿Qué servicios ofreces? <span className="text-red-400">*</span>
                </p>
                <p className="text-xs text-midnight/40 font-body mb-3">
                  Selecciona al menos uno. Los precios sugeridos son referencia de Pawwi — puedes ajustarlos.
                </p>
                <div className="space-y-2.5">
                  {Object.entries(SERVICE_META).map(([idStr, meta]) => {
                    const id  = Number(idStr);
                    const svc = services[id]!;
                    return (
                      <div key={id} className={["rounded-2xl border p-4 transition-all",
                        svc.active ? "border-[#120A2B] bg-white" : "border-gray-200 bg-white/60"].join(" ")}>
                        <button type="button" onClick={() => toggleService(id)} className="w-full flex items-center gap-3 text-left">
                          <div className={`p-2 rounded-xl ${svc.active ? "bg-[#120A2B] text-white" : "bg-[#FFF1EB] text-[#FF7031]"}`}>
                            {meta.icon}
                          </div>
                          <div className="flex-1">
                            <p className="font-extrabold text-sm text-midnight">{meta.name}</p>
                            <p className="text-xs text-gray-400 font-body">{meta.desc}</p>
                          </div>
                          <div className={["w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center",
                            svc.active ? "bg-[#FF7031] border-[#FF7031]" : "border-gray-300"].join(" ")}>
                            {svc.active && <Check size={12} className="text-white" />}
                          </div>
                        </button>
                        {svc.active && (
                          <div className="mt-3 pl-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-midnight/50 font-body">$</span>
                              <input
                                type="number"
                                min={1000}
                                step={1000}
                                value={svc.price}
                                onChange={(e) => setServicePrice(id, e.target.value)}
                                className="w-32 h-10 rounded-xl border border-midnight/20 px-3 text-sm font-bold text-midnight outline-none focus:border-tangerine focus:ring-2 focus:ring-tangerine/20"
                                inputMode="numeric"
                              />
                              <span className="text-xs text-gray-400 font-body">COP / {meta.unit}</span>
                            </div>
                            {Number(svc.price) >= 1000 && (
                              <p className="text-xs text-tangerine font-body mt-1">{fmtCOP(Number(svc.price))} por {meta.unit}</p>
                            )}
                            <p className="text-xs text-midnight/30 font-body mt-0.5">
                              Sugerido: {fmtCOP(SERVICE_SUGGESTED[id] ?? 0)} / {meta.unit}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Precio de transporte — movido aquí desde paso 1 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-midnight font-body">
                  ¿Cobras por trayecto de transporte? (opcional)
                </label>
                <div className="flex items-center border border-midnight/20 rounded-xl px-4 py-3 gap-2 focus-within:border-tangerine focus-within:ring-2 focus-within:ring-tangerine/20 transition bg-white">
                  <span className="text-midnight/40 text-sm font-body">$</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={transportPrice}
                    onChange={(e) => setTransportPrice(e.target.value)}
                    placeholder="0"
                    className="flex-1 outline-none text-midnight text-base font-body bg-transparent"
                    inputMode="numeric"
                  />
                  <span className="text-midnight/40 text-sm font-body">COP</span>
                </div>
                {Number(transportPrice) > 0 && Number(transportPrice) <= 15000 ? (
                  <p className="text-xs text-red-500 font-body">El transporte debe ser mayor a $15.000 por trayecto.</p>
                ) : Number(transportPrice) > 15000 ? (
                  <p className="text-xs text-tangerine font-body">{fmtCOP(Number(transportPrice))} por trayecto</p>
                ) : null}
                <p className="text-xs text-midnight/40 font-body">Si recoges o llevas al perro, cobra por cada trayecto (mínimo $15.000). Déjalo en 0 si no ofreces transporte.</p>
              </div>
            </div>
          )}

          {/* ── Paso 3: Preview ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-heading font-extrabold text-midnight mb-1">Así se verá tu perfil</h1>
                <p className="text-sm text-midnight/50 font-body">Revisa todo antes de enviarlo.</p>
              </div>

              <div className="bg-white/90 border border-white rounded-3xl p-5 shadow-sm space-y-5">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarPreview ?? FALLBACK_AVATAR} alt={name}
                    className="w-16 h-16 rounded-full object-cover border-4 border-[#FFF1EB]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-midnight">{name}</p>
                      <span className="text-[10px] bg-gradient-to-r from-[#FF80AB] to-[#D500F9] text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <ShieldCheck size={9} /> Nuevo
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-body">
                      {profession || "Pawwer"}{neighborhood ? ` · ${neighborhood}, Bogotá` : " · Bogotá"}
                    </p>
                    {tipoInmueble && <p className="text-xs text-gray-400 font-body">{tipoInmueble}{edad ? ` · ${edad} años` : ""}</p>}
                  </div>
                </div>

                {bio && <p className="text-sm text-gray-600 font-body leading-relaxed">{bio}</p>}

                <div>
                  <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-2">Servicios</p>
                  <div className="flex flex-wrap gap-2">
                    {activeServices.map((s) => (
                      <span key={s.id} className="text-xs font-bold bg-[#FFF1EB] text-[#FF7031] px-3 py-1.5 rounded-full">
                        {SERVICE_META[s.id]?.name} · {fmtCOP(s.price)}/{SERVICE_META[s.id]?.unit}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-2">Disponibilidad habitual</p>
                  <div className="flex gap-1.5">
                    {WEEK_KEYS.map((key, i) => (
                      <div key={key} className={["w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold border",
                        weekPattern[key] ? "bg-[#120A2B] text-white border-[#120A2B]" : "bg-gray-100 text-gray-300 border-gray-200 line-through"].join(" ")}>
                        {WEEK_LABELS[i]}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Perfil en revisión */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0">⏳</span>
                  <div>
                    <p className="font-extrabold text-sm text-amber-900">Tu perfil quedará en revisión</p>
                    <p className="text-xs text-amber-800/70 font-body leading-relaxed mt-1">
                      Nuestro equipo te contactará por WhatsApp al{" "}
                      <strong>{phone || "número registrado"}</strong> para coordinar las pruebas
                      de aptitudes, visita al hogar y verificación de identidad. El perfil se
                      publicará una vez aprobado.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={15} className="shrink-0" /> {error}
                </div>
              )}

              <p className="text-xs text-midnight/40 font-body text-center">
                Podrás editar tu información después desde tu panel de Pawwer.
              </p>
            </div>
          )}
        </main>

        {/* Bottom bar */}
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-4 z-30 shadow-[0_-8px_24px_rgba(18,10,43,0.08)]"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))" }}
        >
          <div className="max-w-xl mx-auto space-y-2">
            {step < 3 ? (
              <>
                <button
                  type="button"
                  onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                  disabled={step === 1 ? !canStep1 : !canStep2}
                  className={["w-full py-4 rounded-2xl font-extrabold text-base transition-all",
                    (step === 1 ? canStep1 : canStep2)
                      ? "bg-[#FF7031] text-white hover:bg-[#e6652c] shadow-md active:scale-95"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"].join(" ")}
                >
                  Continuar
                </button>
                {step === 1 && !canStep1 && (
                  <p className="text-xs text-center text-midnight/40 font-body leading-relaxed">
                    {!lat ? "Selecciona tu dirección · " : ""}
                    {!/^[0-9]{6,12}$/.test(cedula) ? "Ingresa tu cédula · " : ""}
                    {!cedulaFrontPath || !cedulaBackPath ? "Sube las fotos de tu cédula · " : ""}
                    {!edadValida ? "Fecha de nacimiento (18+) · " : ""}
                    {!Object.values(weekPattern).some(Boolean) ? "Selecciona al menos un día" : ""}
                  </p>
                )}
                {step === 2 && !canStep2 && (
                  <p className="text-xs text-center text-midnight/40 font-body leading-relaxed">
                    {bio.trim().length < 20 ? "Escribe sobre ti (mín. 20 caracteres) · " : ""}
                    {activeServices.length === 0 ? "Selecciona al menos un servicio · " : ""}
                    {!tipoInmueble ? "Indica el tipo de inmueble · " : ""}
                    {!experiencia ? "Indica tu experiencia" : ""}
                  </p>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="w-full py-4 rounded-2xl font-extrabold text-base bg-[#FF7031] text-white hover:bg-[#e6652c] shadow-md active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
              >
                {isPending
                  ? <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                  : "Enviar para revisión"
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </APIProvider>
  );
}
