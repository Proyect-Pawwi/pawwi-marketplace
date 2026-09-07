// Definición del examen psicotécnico Pawwi.
// El servidor re-calcula el puntaje a partir de índices de respuesta
// — el cliente nunca envía los pesos, evitando manipulación.

export type QuestionType =
  | { kind: "scale" }
  | { kind: "choice"; options: { label: string; score: number }[] };

export interface ExamQuestion {
  id: string;
  text: string;
  hint?: string;
  type: QuestionType;
}

export interface ExamSection {
  id: string;
  title: string;
  emoji: string;
  questions: ExamQuestion[];
}

export const EXAM_SECTIONS: ExamSection[] = [
  {
    id: "s1",
    title: "Responsabilidad & Juicio",
    emoji: "⏰",
    questions: [
      {
        id: "s1q1",
        text: "¿Qué tan puntual te consideras normalmente?",
        hint: "1 = muy impuntual · 5 = siempre a tiempo",
        type: { kind: "scale" },
      },
      {
        id: "s1q2",
        text: "Si tienes un compromiso con un perro y te invitan a otro plan a la misma hora, ¿qué haces?",
        type: {
          kind: "choice",
          options: [
            { label: "Cancelo el cuidado si el otro plan es muy importante.", score: 0 },
            { label: "Intento cambiar el horario del perro; si no se puede, sigo con el perro.", score: 4 },
            { label: "El cuidado del perro va primero, no cancelo.", score: 5 },
          ],
        },
      },
      {
        id: "s1q3",
        text: "¿Has incumplido compromisos importantes en el último año?",
        type: {
          kind: "choice",
          options: [
            { label: "Una o dos veces, pero avisé con tiempo.", score: 3 },
            { label: "No, casi nunca incumplo.", score: 5 },
            { label: "Sí, varias veces.", score: 0 },
          ],
        },
      },
      {
        id: "s1q4",
        text: "¿Cómo describirías tu nivel de orden en casa?",
        hint: "1 = bastante desordenado/a · 5 = muy ordenado/a",
        type: { kind: "scale" },
      },
    ],
  },
  {
    id: "s2",
    title: "Ética & Honestidad",
    emoji: "🤝",
    questions: [
      {
        id: "s2q1",
        text: "Si un perro rompe algo de tu casa durante el cuidado, ¿qué harías?",
        type: {
          kind: "choice",
          options: [
            { label: "No digo nada al cliente ni a Pawwi.", score: 0 },
            { label: "Le digo al cliente, pero no reporto a Pawwi.", score: 2 },
            { label: "Reporto a Pawwi y al cliente, y buscamos una solución.", score: 5 },
          ],
        },
      },
      {
        id: "s2q2",
        text: "Si un cliente te ofrece pagarte por fuera de Pawwi para «ahorrarse algo», ¿qué haces?",
        type: {
          kind: "choice",
          options: [
            { label: "Acepto, así ganamos los dos.", score: 0 },
            { label: "Depende del caso.", score: 2 },
            { label: "Le explico que todo debe ir por Pawwi y no acepto.", score: 5 },
          ],
        },
      },
      {
        id: "s2q3",
        text: "Estás cuidando un perro y necesitas ir a la tienda 5–10 minutos. ¿Qué harías?",
        type: {
          kind: "choice",
          options: [
            { label: "Salgo rápido y dejo al perro solo en el apartamento.", score: 1 },
            { label: "Le escribo a Pawwi para que me dé instrucciones.", score: 2 },
            { label: "No salgo y priorizo al perro.", score: 5 },
          ],
        },
      },
    ],
  },
  {
    id: "s3",
    title: "Manejo Emocional & Estrés",
    emoji: "🧘",
    questions: [
      {
        id: "s3q1",
        text: "¿Qué haces si un perro ladra mucho y no se calma?",
        type: {
          kind: "choice",
          options: [
            { label: "Le grito o lo regaño fuerte.", score: 0 },
            { label: "Lo ignoro hasta que se canse.", score: 2 },
            { label: "Reviso si tiene miedo, le hablo suave y lo distraigo con juego o paseo.", score: 5 },
          ],
        },
      },
      {
        id: "s3q2",
        text: "Califica tu nivel de paciencia con animales.",
        hint: "1 = poca paciencia · 5 = mucha paciencia",
        type: { kind: "scale" },
      },
      {
        id: "s3q3",
        text: "Si el perro hace pis o popó en tu sala, ¿qué haces?",
        type: {
          kind: "choice",
          options: [
            { label: "Lo regaño fuerte porque dañó mi espacio.", score: 0 },
            { label: "Limpio rápido y ya.", score: 2 },
            { label: "Limpio, reviso qué lo pudo causar y se lo cuento a Pawwi y al cliente.", score: 5 },
          ],
        },
      },
    ],
  },
  {
    id: "s4",
    title: "Emergencias & Conocimiento",
    emoji: "🚨",
    questions: [
      {
        id: "s4q1",
        text: "El perro que cuidas empieza a vomitar varias veces en pocos minutos. ¿Qué harías primero?",
        type: {
          kind: "choice",
          options: [
            { label: "Espero a que se le pase solo.", score: 0 },
            { label: "Le doy algo de mi casa para que se mejore.", score: 2 },
            { label: "Aviso inmediatamente a Pawwi y al cliente, y sigo las instrucciones.", score: 5 },
          ],
        },
      },
      {
        id: "s4q2",
        text: "Un perro se escapa por la puerta sin correa. ¿Qué haces?",
        type: {
          kind: "choice",
          options: [
            { label: "Corro detrás sin pensar.", score: 0 },
            { label: "Le aviso a Pawwi pero sigo normal.", score: 2 },
            { label: "Cierro puertas, llamo al perro con calma, pido ayuda a vecinos y llamo a Pawwi.", score: 5 },
          ],
        },
      },
      {
        id: "s4q3",
        text: "¿Qué comida NUNCA le darías a un perro?",
        type: {
          kind: "choice",
          options: [
            { label: "Chocolate, uvas, cebolla y pastillas humanas.", score: 5 },
            { label: "Lo que yo esté comiendo también le puedo dar.", score: 0 },
          ],
        },
      },
      {
        id: "s4q4",
        text: "¿Qué revisas en tu casa antes de recibir un perro?",
        type: {
          kind: "choice",
          options: [
            { label: "Nada especial, mi casa está bien como está.", score: 0 },
            { label: "Reviso puertas, ventanas, cables y cosas peligrosas.", score: 5 },
          ],
        },
      },
    ],
  },
  {
    id: "s5",
    title: "Hogar & Contexto",
    emoji: "🏠",
    questions: [
      {
        id: "s5q1",
        text: "¿Vives con otras personas?",
        type: {
          kind: "choice",
          options: [
            { label: "Sí, pero no les gustan los perros.", score: 0 },
            { label: "Sí, y están de acuerdo con que reciba perros.", score: 3 },
            { label: "Vivo solo/a.", score: 5 },
          ],
        },
      },
      {
        id: "s5q2",
        text: "¿En tu casa hay balcones sin malla o zonas donde un perro pueda caer?",
        type: {
          kind: "choice",
          options: [
            { label: "Sí, y no he instalado protección.", score: 0 },
            { label: "Sí, pero tengo protección y cierro las puertas.", score: 4 },
            { label: "No, no hay riesgo de caídas.", score: 5 },
          ],
        },
      },
      {
        id: "s5q3",
        text: "¿Hay niños pequeños en tu hogar?",
        type: {
          kind: "choice",
          options: [
            { label: "Sí, menores de 7 años que están siempre en la zona del perro.", score: 0 },
            { label: "Sí, pero se pueden separar cuando haya perro.", score: 4 },
            { label: "No.", score: 5 },
          ],
        },
      },
      {
        id: "s5q4",
        text: "¿Vives con perritos?",
        type: {
          kind: "choice",
          options: [
            { label: "Sí.", score: 3 },
            { label: "No.", score: 5 },
          ],
        },
      },
      {
        id: "s5q5",
        text: "¿Vives con gatos?",
        type: {
          kind: "choice",
          options: [
            { label: "Sí.", score: 2 },
            { label: "No.", score: 5 },
          ],
        },
      },
    ],
  },
];

// Recalcula el puntaje server-side a partir de los índices de respuesta.
// - Scale: el valor enviado (1–5) ES el puntaje.
// - Choice: se busca el score por índice en la definición.
export function calcularPuntaje(answers: Record<string, number>): number {
  let total = 0;
  for (const section of EXAM_SECTIONS) {
    for (const q of section.questions) {
      const ans = answers[q.id];
      if (ans === undefined || ans === null) continue;
      if (q.type.kind === "scale") {
        total += Math.min(5, Math.max(1, Math.round(ans)));
      } else {
        const opt = q.type.options[Math.round(ans)];
        if (opt) total += opt.score;
      }
    }
  }
  return total;
}

export function clasificarResultado(
  score: number,
): "preselected" | "needs_review" | "rejected" {
  if (score >= 60) return "preselected";
  if (score >= 40) return "needs_review";
  return "rejected";
}

export const TOTAL_QUESTIONS = EXAM_SECTIONS.reduce(
  (acc, s) => acc + s.questions.length,
  0,
);
