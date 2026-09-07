import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Permite probar en dispositivos de la red local (ej. celular) en modo dev.
  // Solo afecta a `next dev`; en producción no tiene efecto.
  allowedDevOrigins: ["192.168.5.137", "192.168.1.4", "192.168.1.5", "192.168.2.27", "192.168.2.46", "192.168.2.61"],
  // Reduce el footprint inicial de memoria del dev server (máquina con poca RAM libre).
  experimental: {
    preloadEntriesOnStart: false,
  },
};

export default nextConfig;
