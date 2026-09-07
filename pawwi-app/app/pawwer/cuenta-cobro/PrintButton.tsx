"use client";

import { Printer } from "lucide-react";

// Botón que dispara el diálogo de impresión del navegador (Guardar como PDF).
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-5 h-11 rounded-full bg-[#120A2B] text-white text-sm font-black shadow-[0_10px_24px_rgba(18,10,43,0.2)] active:scale-95 transition-transform"
    >
      <Printer size={16} /> Imprimir / Guardar PDF
    </button>
  );
}
