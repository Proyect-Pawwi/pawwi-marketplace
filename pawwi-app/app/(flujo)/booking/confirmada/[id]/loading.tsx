import { SubScreenSkeleton } from "@/components/PortalSkeleton";

// El detalle de la reserva hace cuatro consultas (reserva, Pawwer, mascotas,
// reseña) y hasta hoy no mostraba NADA mientras tanto: pantalla en blanco.
export default function Loading() {
  return <SubScreenSkeleton cards={2} />;
}
