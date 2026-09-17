import { SubScreenSkeleton } from "@/components/PortalSkeleton";

// El wizard consulta al Pawwer, sus servicios y su disponibilidad antes de
// pintar el paso: sin esto, cambiar de paso dejaba la pantalla en blanco.
export default function Loading() {
  return <SubScreenSkeleton cards={2} />;
}
