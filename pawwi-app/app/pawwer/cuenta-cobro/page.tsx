import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/server";
import type { BookingRow, PayoutSummary } from "@/app/actions/portal";
import PrintButton from "./PrintButton";
import { SERVICE_LABEL as SERVICE_DISPLAY } from "@/lib/services";

const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MONTHS_LONG = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function fmtCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}
function parseDate(iso: string): Date {
  return new Date(iso.slice(0, 10) + "T12:00:00");
}
function fmtDayMonth(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function fmtLong(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`;
}

export default async function CuentaCobroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/pawwer/login");

  const [profileRes, pawwerRes, payoutRes, bookingsRes] = await Promise.all([
    supabase.from("profile").select("name").eq("id", user.id).maybeSingle(),
    supabase.from("pawwer").select("cedula").eq("id", user.id).maybeSingle(),
    supabase.rpc("get_pawwer_payout_summary"),
    supabase.rpc("get_pawwer_bookings", { p_status_ids: [4] }),
  ]);

  const name = (profileRes.data?.name as string | null) ?? "Pawwer";
  const cedula = (pawwerRes.data?.cedula as string | null) || null;
  const payout = payoutRes.data as PayoutSummary | null;
  const today =
    payout?.today ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

  // Cuidados completados que aún no se han pagado (lo que cubre esta cuenta).
  const items = ((bookingsRes.data as BookingRow[]) ?? []).filter((b) => b.paid_at == null);
  const total = items.reduce((s, b) => s + (b.pawwer_payout ?? 0), 0);
  const docNumber = today.replaceAll("-", "");

  return (
    <div className="min-h-screen bg-[#FFF1EB] print:bg-white py-8 px-4">
      {/* Barra de acciones — se oculta al imprimir */}
      <div className="max-w-2xl mx-auto flex items-center justify-between mb-5 print:hidden">
        <Link
          href="/pawwer/ingresos"
          className="w-10 h-10 bg-white border border-white rounded-[14px] flex items-center justify-center text-[#120A2B] shadow-[0_8px_20px_rgba(18,10,43,0.05)] active:scale-95 transition-transform"
        >
          <ArrowLeft size={20} />
        </Link>
        <PrintButton />
      </div>

      {/* Documento */}
      <div className="max-w-2xl mx-auto bg-white rounded-[24px] print:rounded-none border border-gray-100 print:border-0 shadow-[0_12px_30px_rgba(18,10,43,0.06)] print:shadow-none p-8 sm:p-10">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-6">
          <div>
            <p className="text-2xl font-black tracking-tight text-[#120A2B]">Pawwi<span className="text-[#FF7031]">.</span></p>
            <p className="text-[11px] font-semibold text-gray-400 mt-0.5">Plataforma de cuidado de mascotas</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-black tracking-widest text-[#FF7031] uppercase">Cuenta de cobro</p>
            <p className="text-sm font-black text-[#120A2B] mt-0.5">Nº {docNumber}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtLong(today)}</p>
          </div>
        </div>

        {/* Partes */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <p className="eyebrow text-gray-400 mb-1.5">De</p>
            <p className="text-sm font-black text-[#120A2B]">{name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {cedula ? `C.C. ${cedula}` : "C.C. — (complétala en tu perfil)"}
            </p>
          </div>
          <div>
            <p className="eyebrow text-gray-400 mb-1.5">Para</p>
            <p className="text-sm font-black text-[#120A2B]">Pawwi</p>
            <p className="text-xs text-gray-500 mt-0.5">Comisiones y pagos a cuidadores</p>
          </div>
        </div>

        {/* Concepto */}
        <div className="mt-6">
          <p className="eyebrow text-gray-400 mb-1.5">Concepto</p>
          <p className="text-sm text-[#120A2B] leading-relaxed">
            Servicios de cuidado de mascotas prestados a través de la plataforma Pawwi. Los valores
            corresponden a la <span className="font-bold">ganancia neta</span> del cuidador (comisión de Pawwi ya descontada).
          </p>
        </div>

        {/* Detalle */}
        {items.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left eyebrow text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-2 font-black">Fecha</th>
                  <th className="py-2 px-2 font-black">Servicio</th>
                  <th className="py-2 px-2 font-black">Mascota</th>
                  <th className="py-2 pl-2 font-black text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => {
                  const dogNames = b.dogs.map((d) => d.name).join(", ") || "Mascota";
                  const date = b.start_date.slice(0, 10) === b.end_date.slice(0, 10)
                    ? fmtDayMonth(b.start_date)
                    : `${fmtDayMonth(b.start_date)}–${fmtDayMonth(b.end_date)}`;
                  return (
                    <tr key={b.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-2 text-[#120A2B] whitespace-nowrap">{date}</td>
                      <td className="py-2.5 px-2 text-gray-600">{SERVICE_DISPLAY[b.service_type] ?? b.service_type}</td>
                      <td className="py-2.5 px-2 text-gray-600 truncate max-w-[120px]">{dogNames}</td>
                      <td className="py-2.5 pl-2 text-[#120A2B] font-bold text-right whitespace-nowrap tabular-nums">{fmtCOP(b.pawwer_payout)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Total */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t-2 border-[#120A2B]">
              <span className="text-sm font-black text-[#120A2B] uppercase tracking-wide">Total a cobrar</span>
              <span className="text-2xl font-black text-[#120A2B] tabular-nums">{fmtCOP(total)}</span>
            </div>

            {payout && (
              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                Pago automático programado para el <span className="font-bold text-[#120A2B]">viernes {fmtLong(payout.next_payout_date)}</span>.
                No necesitas enviar esta cuenta: Pawwi la genera por ti.
              </p>
            )}

            {/* Firma */}
            <div className="mt-10 pt-2">
              <div className="w-56 border-t border-gray-300 pt-1.5">
                <p className="text-xs font-bold text-[#120A2B]">{name}</p>
                <p className="text-[11px] text-gray-400">{cedula ? `C.C. ${cedula}` : "C.C. —"}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 bg-gray-50 rounded-2xl p-8 text-center print:bg-white">
            <p className="text-sm font-bold text-[#120A2B]">Sin cuidados pendientes de pago</p>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Cuando completes cuidados, aquí aparecerá tu cuenta de cobro lista para imprimir.
            </p>
          </div>
        )}
      </div>

      <p className="max-w-2xl mx-auto text-center text-[10px] text-gray-400 mt-5 print:hidden">
        Documento generado automáticamente por Pawwi · {fmtLong(today)}
      </p>
    </div>
  );
}
