import Link from "next/link";
import { MapPin, Star, Car } from "lucide-react";
import { LEVEL_META } from "@/lib/levels";
import { SERVICE_BADGE, type Pawwer } from "@/lib/pawwers";

/**
 * La tarjeta de un Pawwer en el marketplace.
 *
 * Nace aquí, y no copiada de `app/page.tsx`, porque desde hoy la muestran dos
 * pantallas. La home todavía tiene la suya escrita en línea: se rediseña esta
 * semana y adopta esta. Mientras tanto la diferencia es deliberada y temporal.
 *
 * `accion` es lo que va sobre la foto, arriba a la derecha: el corazón en la
 * home, el «quitar» en favoritos. Va como slot y no como prop booleano porque
 * cada pantalla necesita un botón distinto, y ambos son de cliente mientras la
 * tarjeta puede renderizarse en el servidor.
 *
 * Ojo al usarlo: la tarjeta entera es un enlace, así que el botón que se pase
 * en `accion` tiene que hacer `preventDefault()` y `stopPropagation()`.
 */
export default function PawwerCard({
  pawwer,
  accion,
  distancia,
  selected = false,
  className = "",
}: {
  pawwer: Pawwer;
  accion?: React.ReactNode;
  distancia?: string;
  /** La marcó el mapa: se resalta para que se vea cuál es al hacer scroll. */
  selected?: boolean;
  className?: string;
}) {
  const meta = LEVEL_META[pawwer.level];
  const LvlIcon = meta.icon;
  const dist = distancia ?? pawwer.distance;

  const cuerpo = (
    <>
      <div className="relative h-44 w-full rounded-2xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pawwer.image}
          alt={`Hogar de ${pawwer.name}`}
          className={`w-full h-full object-cover transition-transform duration-500 outline outline-1 -outline-offset-1 outline-black/10
            ${pawwer.disponible ? "group-hover:scale-105" : "grayscale"}`}
        />

        {pawwer.disponible ? (
          <div className={`absolute top-3 left-3 text-[0.7rem] font-extrabold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1 ${meta.chip}`}>
            <LvlIcon size={14} /> {meta.label}
          </div>
        ) : (
          <div className="absolute top-3 left-3 text-[0.7rem] font-extrabold px-3 py-1.5 rounded-full shadow-md bg-midnight/80 text-white">
            No disponible
          </div>
        )}

        {accion && <div className="absolute top-3 right-3">{accion}</div>}

        {pawwer.rating > 0 && (
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-xl text-sm font-extrabold flex items-center gap-1 text-midnight shadow-sm">
            <Star size={13} className="text-star fill-current" /> {pawwer.rating}
          </div>
        )}
      </div>

      <div className="p-3 pt-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pawwer.avatar}
            alt={pawwer.name}
            className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover -mt-8 relative z-10 bg-white shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-midnight leading-tight truncate">{pawwer.name}</h4>
            <p className="text-xs font-medium text-midnight/45 flex items-center gap-1">
              <MapPin size={11} className="text-tangerine shrink-0" />
              <span className="truncate">
                {pawwer.location}
                {dist && dist !== "—" ? ` · A ${dist}` : ""}
              </span>
            </p>
          </div>
          <div className="bg-cream px-3 py-1.5 rounded-chip shrink-0">
            <p className="text-sm font-extrabold text-midnight">{pawwer.price}</p>
          </div>
        </div>

        {pawwer.services.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {pawwer.services.map((srv) => (
              <span
                key={srv}
                className={`text-[0.65rem] font-bold px-2 py-1 rounded-md border uppercase tracking-wide ${SERVICE_BADGE[srv] ?? "bg-gray-50 text-gray-600 border-gray-100"}`}
              >
                {srv}
              </span>
            ))}
          </div>
        )}

        {/* Sin corte por radio, la distancia se negocia con el transporte:
            saber que recoge y entrega es lo que vuelve viable a un Pawwer lejano. */}
        {pawwer.transportPrice > 0 && (
          <p className="text-[0.7rem] font-bold text-[#0284C7] flex items-center gap-1">
            <Car size={12} className="shrink-0" />
            Recoge y entrega por ${Math.round(pawwer.transportPrice / 1000)}k
          </p>
        )}
      </div>
    </>
  );

  const marco =
    `bg-white rounded-card p-3 shadow-card flex flex-col self-start border ${className} ` +
    (selected ? "border-tangerine ring-2 ring-tangerine/30" : "border-white");

  // Un Pawwer que ya no está publicado no lleva a ningún sitio: su perfil
  // público no lo encontraría. Se queda como tarjeta muerta, pero visible —
  // y con su botón de quitar, que es lo único que tiene sentido hacer con él.
  if (!pawwer.disponible) {
    return <div className={`${marco} opacity-70`}>{cuerpo}</div>;
  }

  return (
    <Link
      href={`/pawwer/${pawwer.id}`}
      data-pawwer-id={pawwer.id}
      className={`${marco} group hover:shadow-lift ${selected ? "" : "hover:border-gray-200"} active:scale-[0.98] transition-[box-shadow,transform,border-color] duration-200`}
    >
      {cuerpo}
    </Link>
  );
}
