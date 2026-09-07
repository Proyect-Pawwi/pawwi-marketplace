export type SearchPhase = 1 | 2 | 3;

export const PHASE_LABEL: Record<SearchPhase, string> = {
  1: "Te eligió a ti",
  2: "Búsqueda relacionada",
  3: "Búsqueda ciudad",
};

// Tasa por defecto (no-élite). La real se congela por reserva en
// booking.commission_rate (0.20 élite / 0.25 estándar) y llega en BookingRow.
export const COMMISSION_RATE = 0.25;

// Desglosa la ganancia del pawwer en cuidado vs transporte.
//  • cuidado:   lo que SIEMPRE gana por el cuidado (1 - rate del cuidado).
//  • transport: lo que gana si ÉL hace el transporte (1 - rate del transporte).
// Coincide con la matemática del backend (commission por componente, redondeada).
// `rate` = booking.commission_rate; si no llega, cae a la tasa estándar.
export function payoutBreakdown(
  total: number,
  transportFee: number | null | undefined,
  rate: number | null | undefined = COMMISSION_RATE,
) {
  const r = rate ?? COMMISSION_RATE;
  const fee = transportFee ?? 0;
  const cuidadoTotal = total - fee;
  return {
    cuidado:      cuidadoTotal - Math.round(cuidadoTotal * r),
    transport:    fee - Math.round(fee * r),
    hasTransport: fee > 0,
  };
}
