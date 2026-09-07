"use client";

import { useRef, useState } from "react";

export default function HeroImage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -13, y: px * 13 });
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => { setActive(false); setTilt({ x: 0, y: 0 }); }}
      className="relative w-full h-full select-none"
      style={{ perspective: "900px" }}
    >
      {/* Float wrapper — translateY only, no conflict with tilt */}
      <div className="hero-float w-full h-full relative">

        {/* Tilt wrapper */}
        <div
          className="w-full h-full relative"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: active ? "transform 0.08s ease-out" : "transform 0.55s ease-out",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Ambient shadow — grows on tilt */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-12 bg-[#120A2B]/15 rounded-full blur-2xl -z-10"
            style={{
              transform: `translateX(-50%) scaleX(${1 + Math.abs(tilt.y) * 0.03})`,
              opacity: 0.4 + Math.abs(tilt.y) * 0.02,
            }}
          />

          {/* Hero image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ImagenHero.png"
            alt="Pawwer cuidando a tu perro en su hogar"
            className="w-full h-full object-contain"
            draggable={false}
            style={{ filter: "drop-shadow(0 24px 48px rgba(18,10,43,0.22))" }}
          />

          {/* Badge: mensaje WhatsApp realista — solo desktop */}
          <div className="hidden lg:block absolute top-[8%] right-[2%]" style={{ transform: "translateZ(28px)" }}>
            <div className="badge-bob bg-white rounded-2xl shadow-2xl border border-gray-100/80 overflow-hidden" style={{ width: "230px" }}>

              {/* Sender row */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=80&auto=format&fit=crop"
                  alt="Juliana"
                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-[#25D366]/30"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-[#120A2B] leading-none">Juliana M.</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Pawwer de Mochi</p>
                </div>
                {/* WhatsApp dot */}
                <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.393A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.076-1.119l-.291-.174-3.015.843.857-2.939-.19-.302A7.96 7.96 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/>
                  </svg>
                </div>
              </div>

              {/* Message bubble */}
              <div className="px-3 py-2.5">
                <div className="bg-[#ECE5DD] rounded-xl rounded-tl-none px-3 py-2">
                  <p className="text-[12px] font-medium text-[#111B21] leading-snug">¡Mochi está súper bien! 🐾</p>
                  <p className="text-[11px] text-[#111B21]/60 mt-0.5">Le tomé fotos en el jardín</p>
                  <div className="flex items-center justify-end gap-1 mt-1.5">
                    <span className="text-[9px] text-[#111B21]/40">2:34 PM</span>
                    <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
                      <path d="M1 5.5L5 9.5L15 1.5" stroke="#53BDEB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 5.5L9 9.5" stroke="#53BDEB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
