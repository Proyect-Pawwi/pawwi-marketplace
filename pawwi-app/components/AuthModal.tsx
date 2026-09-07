"use client";

import { Suspense, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import LoginForm from "@/app/login/LoginForm";
import RegistroForm from "@/app/registro/RegistroForm";
import RecuperarForm from "@/app/recuperar/RecuperarForm";

type ModalView = "login" | "registro" | "recuperar";

// Modal de auth del CLIENTE (lazy registration desde el home). Se abre por el
// parámetro `?modal=login|registro|recuperar` — así los redirects de rutas
// protegidas (`/?modal=login&next=…`) y el proxy pueden abrirlo. El login exitoso
// hace recarga dura (ver LoginForm) para una sesión limpia.
function AuthModalInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const view = searchParams.get("modal") as ModalView | null;
  const next = searchParams.get("next");
  const isOpen = view === "login" || view === "registro" || view === "recuperar";

  // Cerrar = cancelar → vuelve al home sin parámetros de modal.
  const close = useCallback(() => router.push("/", { scroll: false }), [router]);

  // Cambiar de vista preservando `next` (y limpiando `error`).
  const switchView = useCallback(
    (v: ModalView) => {
      const params = new URLSearchParams({ modal: v });
      if (next) params.set("next", next);
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [router, next]
  );

  // Cerrar con Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const title =
    view === "registro" ? "Crear cuenta" : view === "recuperar" ? "Recuperar acceso" : "Ingresar";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-midnight/50 backdrop-blur-sm animate-fade-in"
        onClick={close}
        aria-hidden
      />

      {/* Panel — sube desde abajo en móvil, centrado en desktop */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex justify-center sm:inset-0 sm:items-center sm:p-4"
        onClick={close}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-slide-up max-h-[92dvh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 px-6 pt-5 pb-4 border-b border-gray-100">
            {/* Asa de arrastre (solo móvil) */}
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between">
              {view !== "recuperar" ? (
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => switchView("login")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                      view === "login" ? "bg-white text-midnight shadow-sm" : "text-midnight/40 hover:text-midnight"
                    }`}
                  >
                    Ingresar
                  </button>
                  <button
                    onClick={() => switchView("registro")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                      view === "registro" ? "bg-white text-midnight shadow-sm" : "text-midnight/40 hover:text-midnight"
                    }`}
                  >
                    Crear cuenta
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => switchView("login")}
                  className="text-sm font-semibold text-midnight/50 hover:text-midnight transition-colors"
                >
                  ← Volver al login
                </button>
              )}

              <button
                onClick={close}
                aria-label="Cerrar"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-midnight/40 hover:text-midnight"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Cuerpo — scrollable */}
          <div className="overflow-y-auto px-6 py-6">
            {view === "login"     && <LoginForm />}
            {view === "registro"  && <RegistroForm />}
            {view === "recuperar" && <RecuperarForm />}
          </div>
        </div>
      </div>
    </>
  );
}

export default function AuthModal() {
  // useSearchParams exige un límite de Suspense.
  return (
    <Suspense fallback={null}>
      <AuthModalInner />
    </Suspense>
  );
}
