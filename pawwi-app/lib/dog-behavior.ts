// Fuente única de cómo se lee el comportamiento del perro (migración 57).
//
// Los tres estados importan y NO son dos:
//   true  → el dueño lo declaró afirmativo
//   false → el dueño lo declaró negativo
//   null  → el dueño AÚN NO LO DECLARÓ
//
// Confundir null con false sería inventar un dato sobre un animal ajeno. El
// formulario del Pasaporte llega en S3, así que hasta entonces casi todo será
// null: se muestra como «sin informar», nunca como «no».

export interface DogBehavior {
  friendly_dogs?:      boolean | null;
  separation_anxiety?: boolean | null;
  energy_level?:       string  | null;
}

export type BehaviorTone = "alert" | "info" | "unknown";

export interface BehaviorFlag {
  key:   string;
  label: string;
  tone:  BehaviorTone;
}

const TONE_CLS: Record<BehaviorTone, string> = {
  alert:   "bg-amber-50 text-amber-700 border-amber-200",
  info:    "bg-gray-50 text-[#120A2B] border-gray-100",
  unknown: "bg-white text-gray-400 border-gray-100 italic",
};

export function behaviorChipClass(tone: BehaviorTone): string {
  return TONE_CLS[tone];
}

/**
 * Señales que el Pawwer debe ver ANTES de aceptar.
 *
 * `includeUnknown` distingue las dos superficies: en la tarjeta de solicitud
 * el espacio es escaso y solo caben las señales que cambian la decisión; en el
 * detalle sí conviene decir explícitamente que un dato falta, para que la
 * ausencia no se lea como un «no».
 */
export function behaviorFlags(dog: DogBehavior, includeUnknown = false): BehaviorFlag[] {
  const out: BehaviorFlag[] = [];

  if (dog.friendly_dogs === false) {
    out.push({ key: "fd-no", label: "No sociable con otros perros", tone: "alert" });
  } else if (dog.friendly_dogs === true) {
    out.push({ key: "fd-si", label: "Sociable con otros perros", tone: "info" });
  } else if (includeUnknown) {
    out.push({ key: "fd-?", label: "Sociabilidad sin informar", tone: "unknown" });
  }

  // Solo se anuncia cuando la hay: «no tiene ansiedad» no cambia ninguna decisión.
  if (dog.separation_anxiety === true) {
    out.push({ key: "sa-si", label: "Ansiedad por separación", tone: "alert" });
  } else if (includeUnknown && dog.separation_anxiety == null) {
    out.push({ key: "sa-?", label: "Ansiedad sin informar", tone: "unknown" });
  }

  if (dog.energy_level) {
    out.push({ key: "energia", label: `Energía ${dog.energy_level}`, tone: "info" });
  }

  return out;
}

/**
 * ¿Hay que advertir al CLIENTE antes de confirmar?
 * Solo si su perro no es sociable y ese día habrá otros perros.
 */
export function shouldWarnClient(dog: DogBehavior, otherDogsThatDay: number): boolean {
  return dog.friendly_dogs === false && otherDogsThatDay > 0;
}
