// Fuente ÚNICA de nombres y colores de los servicios. Antes estos mapas estaban
// duplicados en ~10 pantallas y el color de "Express" divergía entre archivos
// (#4A148C / #6B21A8 / #7c3aed). Aquí queda canónico.
//
// Los labels SÍ son contextuales: algunas pantallas del pawwer usan los nombres
// de marca (DayCare/NightCare) y las orientadas al cliente usan español
// (Guardería/Pernocta). Por eso exponemos las dos variantes.

// Etiqueta en español — la más usada (mensajes, ganancias, mis-reservas, chat…).
export const SERVICE_LABEL: Record<string, string> = {
  DayCare: "Guardería",
  Night:   "Pernocta",
  Travel:  "Viaje",
  Express: "Express",
};

// Etiqueta con nombres de marca (pantallas internas: inicio, cuidados).
export const SERVICE_LABEL_BRAND: Record<string, string> = {
  DayCare: "DayCare",
  Night:   "NightCare",
  Travel:  "Travel",
  Express: "Express",
};

// Colores del chip de servicio (bg + text). Express unificado a #6B21A8.
export const SERVICE_COLOR: Record<string, string> = {
  DayCare: "bg-[#FFF1EB] text-[#FF7031]",
  Night:   "bg-[#120A2B]/10 text-[#120A2B]",
  Travel:  "bg-[#E0F2FE] text-[#0284C7]",
  Express: "bg-[#F7AEF1]/30 text-[#6B21A8]",
};
