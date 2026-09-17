import { SubScreenSkeleton } from "@/components/PortalSkeleton";

// El perfil público es la pantalla más pesada del cliente (1.105 líneas, con
// galería, servicios y reseñas). Es justo donde más se nota no tener skeleton.
export default function Loading() {
  return <SubScreenSkeleton cards={3} />;
}
