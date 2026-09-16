import PortalSkeleton from "@/components/PortalSkeleton";

// El shell del grupo (cliente) ya envuelve fondo, atmósfera y hueco del nav:
// este esqueleto aparece al instante DENTRO del marco definitivo, sin salto.
export default function Loading() {
  return <PortalSkeleton cards={3} subtitle />;
}
