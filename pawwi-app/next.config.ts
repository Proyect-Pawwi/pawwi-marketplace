import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Permite probar en dispositivos de la red local (ej. celular) en modo dev.
  // Solo afecta a `next dev`; en producción no tiene efecto.
  //
  // OJO — esto NO es cosmético. Next bloquea los recursos de DESARROLLO desde
  // orígenes no autorizados: la página responde 200 pero el cliente de recarga
  // en caliente devuelve 403. Resultado: en el celular el hot reload muere sin
  // avisar y la pestaña se queda congelada en el JavaScript que cargó primero.
  // Se depuran horas de bugs que ya estaban arreglados (2026-09-17).
  //
  // El nombre Bonjour va PRIMERO y es el que conviene usar desde el móvil: no
  // depende del DHCP, así que no se caduca. Las IP sí — esta lista ya se quedó
  // vieja una vez, con seis direcciones de arrendamientos anteriores.
  allowedDevOrigins: [
    "MacBook-Air-M2-de-Nicolas.local",
    "192.168.2.17",
    "192.168.5.137", "192.168.1.4", "192.168.1.5",
    "192.168.2.27", "192.168.2.46", "192.168.2.61",
  ],
  // Reduce el footprint inicial de memoria del dev server (máquina con poca RAM libre).
  experimental: {
    preloadEntriesOnStart: false,
  },
};

export default nextConfig;
