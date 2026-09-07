"use client";

import { useState, useRef, useTransition, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Check, AlertCircle, ShieldCheck, Lock, Zap, FileText, Upload, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/client";
import { updatePago } from "@/app/actions/perfil";

const BANCOS = ["Nequi", "Daviplata", "Bancolombia", "Davivienda", "BBVA", "Banco de Bogotá", "Nu", "Lulo Bank", "Scotiabank Colpatria", "Otro"];
const TIPOS = ["Ahorros", "Corriente", "Billetera digital"];
const LLAVE_TIPOS = [
  { v: "celular", label: "Celular", ph: "Ej: 3001234567", mode: "numeric" as const },
  { v: "correo", label: "Correo", ph: "correo@ejemplo.com", mode: "email" as const },
  { v: "cedula", label: "Cédula", ph: "Ej: 1012345678", mode: "numeric" as const },
  { v: "alfanumerica", label: "@Llave", ph: "Ej: @millave", mode: "text" as const },
];

interface PagoFields { banco: string; tipo: string; titular: string; documento: string; llaveTipo: string; llaveValor: string; }

export default function PagoClient({
  userId, initial, numeroMask, hasNumero, hasCert,
}: {
  userId: string;
  initial: PagoFields;
  numeroMask: string;
  hasNumero: boolean;
  hasCert: boolean;
}) {
  const [f, setF] = useState<PagoFields>(initial);
  const [baseline, setBaseline] = useState<PagoFields>(initial); // último estado guardado
  const [numero, setNumero] = useState("");
  const [certPath, setCertPath] = useState("");   // nuevo PDF subido en esta sesión
  const [certName, setCertName] = useState("");
  const [certReady, setCertReady] = useState(hasCert);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const llaveMeta = LLAVE_TIPOS.find((t) => t.v === f.llaveTipo);

  const dirty = useMemo(
    () => JSON.stringify(f) !== JSON.stringify(baseline) || numero.trim() !== "" || certPath !== "",
    [f, baseline, numero, certPath],
  );
  const hasMethod = f.llaveValor.trim() !== "" || numero.trim() !== "" || hasNumero;
  const canSave = dirty && certReady && hasMethod;

  function set<K extends keyof PagoFields>(k: K, val: string) {
    setF((prev) => ({ ...prev, [k]: val }));
  }

  async function handlePdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { setError("La certificación debe ser un PDF."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("El PDF no puede superar 10 MB."); return; }
    setError(null);
    setUploadingCert(true);
    try {
      const supabase = createClient();
      const path = `${userId}/certificacion.pdf`;
      const { error: upErr } = await supabase.storage.from("pago-docs").upload(path, file, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      setCertPath(path);
      setCertName(file.name);
      setCertReady(true);
    } catch (err) {
      console.error("Error subiendo certificación:", err);
      setError("No se pudo subir el PDF. Intenta de nuevo.");
    } finally {
      setUploadingCert(false);
    }
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await updatePago({ ...f, numero: numero.trim(), certPath });
      if (res.error) setError(res.error);
      else { setBaseline(f); setSaved(true); setNumero(""); setCertPath(""); setTimeout(() => setSaved(false), 2500); }
    });
  }

  return (
    <div className="min-h-screen relative pb-28 font-sans">
      <header className="relative z-20 pt-12 pb-3">
        <div className="max-w-xl mx-auto px-6 flex items-center gap-4">
          <Link href="/pawwer/perfil" className="w-10 h-10 bg-white/80 backdrop-blur-md border border-white rounded-[14px] flex items-center justify-center text-[#120A2B] shadow-[0_8px_20px_rgba(18,10,43,0.05)] active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="eyebrow text-[#FF7031] ">Datos de pago</p>
            <h1 className="text-2xl font-black text-[#120A2B] leading-none mt-0.5">Cuenta para pagos</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-red-600">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="flex items-start gap-2.5 bg-[#E0F2FE]/50 border border-[#92C0E9]/30 rounded-2xl px-4 py-3">
          <ShieldCheck size={16} className="text-[#0284C7] shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-[#120A2B]/60 leading-relaxed">
            Aquí depositamos tus pagos automáticos de los viernes. Registra una <span className="font-black text-[#120A2B]">llave Bre-B</span> y/o una <span className="font-black text-[#120A2B]">cuenta bancaria</span>. Tus datos se guardan cifrados y el número nunca se muestra completo.
          </p>
        </div>

        {/* ── Llave Bre-B ── */}
        <div className="bg-white rounded-[24px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] bg-[#F7AEF1]/30 text-[#9C27B0] flex items-center justify-center shrink-0"><Zap size={17} /></div>
            <div>
              <p className="text-sm font-black text-[#120A2B]">Llave Bre-B</p>
              <p className="text-xs text-[#120A2B]/45">Pago instantáneo (opcional si pones cuenta)</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {LLAVE_TIPOS.map((t) => (
              <button key={t.v} onClick={() => set("llaveTipo", f.llaveTipo === t.v ? "" : t.v)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-all ${f.llaveTipo === t.v ? "bg-[#120A2B] text-white border-[#120A2B]" : "bg-white text-[#120A2B]/60 border-gray-200"}`}>
                {t.label}
              </button>
            ))}
          </div>
          {f.llaveTipo && (
            <input value={f.llaveValor} onChange={(e) => set("llaveValor", e.target.value)}
              inputMode={llaveMeta?.mode} placeholder={llaveMeta?.ph}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-[#120A2B] focus:outline-none focus:border-gray-400 bg-white" />
          )}
        </div>

        {/* ── Cuenta bancaria ── */}
        <div className="bg-white rounded-[24px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5 space-y-4">
          <p className="text-[11px] font-black tracking-widest text-[#120A2B]/40 uppercase">Cuenta bancaria</p>
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-1.5">Banco o billetera</label>
            <select value={f.banco} onChange={(e) => set("banco", e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-[#120A2B] focus:outline-none focus:border-gray-400 bg-white">
              <option value="">Selecciona…</option>
              {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-1.5">Tipo de cuenta</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button key={t} onClick={() => set("tipo", t)}
                  className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-all ${f.tipo === t ? "bg-[#120A2B] text-white border-[#120A2B]" : "bg-white text-[#120A2B]/60 border-gray-200"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 flex items-center gap-1.5 mb-1.5"><Lock size={11} /> Número de cuenta</label>
            <input value={numero} onChange={(e) => setNumero(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric" placeholder={hasNumero ? `Guardado: ${numeroMask}` : "Ej: 3001234567"}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-[#120A2B] focus:outline-none focus:border-gray-400 bg-white" />
            {hasNumero && <p className="text-[10px] text-[#120A2B]/35 mt-1">Déjalo vacío para conservar el número actual.</p>}
          </div>
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-1.5">Titular de la cuenta</label>
            <input value={f.titular} onChange={(e) => set("titular", e.target.value)} placeholder="Nombre completo del titular"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-[#120A2B] focus:outline-none focus:border-gray-400 bg-white" />
          </div>
          <div>
            <label className="text-xs font-extrabold text-[#120A2B]/50 block mb-1.5">Documento del titular</label>
            <input value={f.documento} onChange={(e) => set("documento", e.target.value)} inputMode="numeric" placeholder="Cédula del titular"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-[#120A2B] focus:outline-none focus:border-gray-400 bg-white" />
          </div>
        </div>

        {/* ── Certificación bancaria (obligatoria) ── */}
        <div className="bg-white rounded-[24px] border border-white shadow-[0_12px_30px_rgba(18,10,43,0.04)] p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] bg-[#FFF1EB] text-[#FF7031] flex items-center justify-center shrink-0"><FileText size={17} /></div>
            <div className="flex-1">
              <p className="text-sm font-black text-[#120A2B]">Certificación bancaria <span className="text-red-500">*</span></p>
              <p className="text-xs text-[#120A2B]/45">PDF que confirma que la cuenta es tuya (obligatorio)</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={handlePdf} />
          {certReady ? (
            <div className="flex items-center gap-2.5 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
              <CheckCircle2 size={18} className="text-green-600 shrink-0" />
              <p className="text-sm font-bold text-[#120A2B] flex-1 min-w-0 truncate">{certName || "Certificación subida"}</p>
              <button onClick={() => fileRef.current?.click()} disabled={uploadingCert} className="text-xs font-bold text-[#FF7031] shrink-0">Cambiar</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploadingCert}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-[#FF7031]/30 bg-[#FFF1EB]/40 text-[#FF7031] font-bold text-sm hover:bg-[#FFF1EB] transition-colors disabled:opacity-60">
              {uploadingCert ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {uploadingCert ? "Subiendo…" : "Subir PDF de certificación"}
            </button>
          )}
        </div>
      </main>

      {(dirty || saved) && (
        <div className="fixed inset-x-0 bottom-0 z-[60] bg-white/90 backdrop-blur-xl border-t border-white/60 shadow-[0_-4px_16px_rgba(18,10,43,0.06)] px-6 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}>
          <div className="max-w-xl mx-auto">
            {dirty && !certReady && (
              <p className="text-[11px] font-bold text-red-500 text-center mb-2">Adjunta la certificación bancaria (PDF) para poder guardar.</p>
            )}
            {dirty && certReady && !hasMethod && (
              <p className="text-[11px] font-bold text-red-500 text-center mb-2">Registra una llave Bre-B o una cuenta.</p>
            )}
            <button onClick={save} disabled={saving || !canSave}
              className="w-full py-3.5 rounded-full font-black text-sm bg-[#120A2B] text-white flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] shadow-[0_8px_20px_rgba(18,10,43,0.25)] transition-transform">
              {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
              {saving ? "Guardando…" : saved ? "Guardado" : "Guardar datos de pago"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
