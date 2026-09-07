export interface VideoModule {
  id: number;
  title: string;
  youtubeId: string;
  duration: string;
  tag: string;
}

export interface CapQuestion {
  text: string;
  options: string[];
  correct: number;
  rationale: string;
}

export interface QuizSection {
  title: string;
  emoji: string;
  questions: CapQuestion[];
}

export const VIDEO_MODULES: VideoModule[] = [
  { id: 1, title: "Bienvenida Pawwi",       youtubeId: "ZNHrozxD3gc", duration: "1 min",     tag: "Intro" },
  { id: 2, title: "Playbook Daycare",        youtubeId: "ZDCJtDrHxoc", duration: "1 min",     tag: "Operaciones" },
  { id: 3, title: "Flujo Operativo",         youtubeId: "cOCOE-5M88k", duration: "1 min",     tag: "Operaciones" },
  { id: 4, title: "Adaptar el Hogar",        youtubeId: "5vbilzjl96U", duration: "1 min",     tag: "Hogar" },
  { id: 5, title: "Comportamiento Canino",   youtubeId: "h0_NBxeerB0", duration: "Masterclass", tag: "Canino" },
  { id: 6, title: "Guía de Emergencias",     youtubeId: "8dCHJOpEx_c", duration: "Vital",     tag: "Seguridad" },
  { id: 7, title: "Aspectos Legales — Parte 1", youtubeId: "5AP7ewYdWMU", duration: "Legal",  tag: "Legal" },
  { id: 8, title: "Aspectos Legales — Parte 2", youtubeId: "xvbWRHk5BYo", duration: "Legal",  tag: "Legal" },
];

export const QUIZ_SECTIONS: QuizSection[] = [
  {
    title: "Operaciones Pawwi",
    emoji: "🐾",
    questions: [
      {
        text: "¿Cuál es la diferencia fundamental entre Pawwi y una guardería tradicional?",
        options: ["Manadas grandes", "Experiencia 100% en hogar, sin jaulas", "Perros solos todo el día", "Solo paseos"],
        correct: 1,
        rationale: "Pawwi es hogar y libertad — el perro vive contigo como si fuera de la familia.",
      },
      {
        text: "Al ingresar un perro, lo PRIMERO que debes hacer es:",
        options: ["Darle comida", "Grabar un video del estado en que llega", "Salir a pasear", "Esperar instrucciones del dueño"],
        correct: 1,
        rationale: "El video de ingreso es tu seguro: documenta el estado del perro antes de empezar.",
      },
      {
        text: "¿Qué debes hacer ante una emergencia personal grave mientras cuidas un perro?",
        options: ["Salir rápido y dejarlo solo", "Dejarlo con un vecino cualquiera", "Llevarlo en moto sin avisar", "Notificar a Pawwi y NO abandonar la custodia"],
        correct: 3,
        rationale: "Nunca abandonamos la custodia. Siempre hay que coordinar antes de actuar.",
      },
      {
        text: "¿Cuál es la condición INDISPENSABLE que debe tener tu hogar?",
        options: ["Patio con pasto verde", "Prevención total de fugas (mallas, cerramientos)", "Juguetes propios del Pawwer", "Cámaras de seguridad"],
        correct: 1,
        rationale: "La seguridad es lo primero: tu espacio debe ser a prueba de fugas.",
      },
      {
        text: "Ante una herida profunda o cojera del perro, debes:",
        options: ["Esperar a ver si mejora solo", "Aplicar un remedio casero", "Dar soporte básico y llevarlo al vet autorizado", "Llamar al dueño antes de actuar"],
        correct: 2,
        rationale: "La salud del perro es prioridad. Actúa y coordina con Pawwi.",
      },
      {
        text: "¿Qué cubre el Fondo de Asistencia Pawwi?",
        options: ["Daños a muebles del Pawwer", "La integridad física del perro", "Objetos perdidos por el cliente", "Enfermedades preexistentes"],
        correct: 1,
        rationale: "El Fondo protege la vida y salud del perro durante el servicio.",
      },
      {
        text: "¿Cuál es la consecuencia de un 'No Show' (no presentarte a un servicio aceptado)?",
        options: ["Una advertencia leve", "Una multa económica", "Terminación inmediata del contrato", "Ninguna consecuencia"],
        correct: 2,
        rationale: "La confianza es nuestro pilar. El No Show es inaceptable.",
      },
      {
        text: "¿Cuáles son las actualizaciones obligatorias durante el servicio?",
        options: ["Solo una al inicio", "Una cada 10 minutos", "Inicio, intermedia y final", "Ninguna — solo si el dueño pregunta"],
        correct: 2,
        rationale: "Trazabilidad completa: tres momentos clave del servicio deben quedar documentados.",
      },
      {
        text: "Si un perro muestra agresividad, debes:",
        options: ["Gritar para que obedezca", "Aislarlo con calma y reportarlo a Pawwi", "Sacarlo a la calle inmediatamente", "Juntarlo con otro perro para que se tranquilice"],
        correct: 1,
        rationale: "Calma y seguridad siempre. El reporte a Pawwi es indispensable.",
      },
      {
        text: "¿Cuándo realiza Pawwi los pagos?",
        options: ["En efectivo cuando termina el servicio", "Mensual", "Los viernes (cortes semanales)", "Pago directo en Nequi después de cada servicio"],
        correct: 2,
        rationale: "Los cortes son semanales y se pagan los viernes.",
      },
    ],
  },
  {
    title: "Seguridad y Emergencias",
    emoji: "🛡️",
    questions: [
      {
        text: "¿Cuánto tiempo antes debes reprogramar sin recibir multa?",
        options: ["Cuando quieras, sin límite", "Mínimo 8 horas antes", "Con 1 hora de anticipación", "Después del servicio"],
        correct: 1,
        rationale: "La logística responsable requiere avisar con al menos 8 horas de anticipación.",
      },
      {
        text: "¿Se permiten visitas de terceros mientras cuidas al perro?",
        options: ["Sí, familia directa puede venir", "No, está completamente prohibido", "Sí, si ayudan con el cuidado", "Sí, solo amigos cercanos"],
        correct: 1,
        rationale: "Cero extraños con los perros a cargo. Sin excepciones.",
      },
      {
        text: "¿Debes usar correa en parques y espacios abiertos?",
        options: ["Solo a veces, si el perro es bravo", "SIEMPRE, sin importar el temperamento", "Nunca — los perros necesitan libertad", "Solo si el dueño lo pide"],
        correct: 1,
        rationale: "Control total siempre. La correa en espacios abiertos es obligatoria.",
      },
      {
        text: "¿Puedes darle snacks propios al perro?",
        options: ["Sí, fruta fresca está bien", "No — puede tener alergias", "Sí, un poquito no hace daño", "Sí, si el perro lo pide"],
        correct: 1,
        rationale: "Solo se le da lo que envíe el dueño. Las alergias pueden ser mortales.",
      },
      {
        text: "Si el perro se escapa, lo PRIMERO es:",
        options: ["Esperar a que vuelva solo", "Contactar a Soporte Pawwi INMEDIATAMENTE", "Llamar al dueño directamente", "Buscarlo solo sin avisar a nadie"],
        correct: 1,
        rationale: "Activa el protocolo de búsqueda con Pawwi de inmediato.",
      },
      {
        text: "Ante un sismo mientras cuidas el perro, debes:",
        options: ["Abrir la puerta para que escape", "Asegurar al perro y buscar una zona segura", "Salir al balcón", "Esconderte sin el perro"],
        correct: 1,
        rationale: "Evitar fugas por pánico del animal es prioritario durante un sismo.",
      },
      {
        text: "¿Cuáles son los signos de una reacción alérgica grave?",
        options: ["Mucha hambre y energía", "Hinchazón del hocico o dificultad para respirar", "Somnolencia leve", "Mucha sed"],
        correct: 1,
        rationale: "La hinchazón o dificultad para respirar es una urgencia veterinaria.",
      },
      {
        text: "Si rechazas una visita de auditoría aleatoria de Pawwi, ¿qué ocurre?",
        options: ["Se reprograma sin consecuencias", "Suspensión por falta de transparencia", "Una multa pequeña", "Nada, es opcional"],
        correct: 1,
        rationale: "La transparencia es fundamental. Debemos poder auditar en cualquier momento.",
      },
    ],
  },
  {
    title: "Calidad y Normativa",
    emoji: "⭐",
    questions: [
      {
        text: "¿Qué documentación se requiere para solicitar el Fondo de Asistencia?",
        options: ["Solo tu palabra es suficiente", "Evidencia fotográfica + factura + historia clínica", "Solo una foto del perro", "Nada, el fondo es automático"],
        correct: 1,
        rationale: "El Fondo requiere soporte documental completo para procesar la solicitud.",
      },
      {
        text: "¿En cuánto tiempo responde Pawwi a una solicitud del Fondo de Asistencia?",
        options: ["24 horas", "5 días hábiles", "Un mes", "Inmediatamente"],
        correct: 0,
        rationale: "Pawwi garantiza agilidad: respuesta en 24 horas.",
      },
      {
        text: "¿Qué evidencia debes enviar al FINAL del servicio?",
        options: ["Video del perro y sus pertenencias", "Una selfie tuya", "Un mensaje de texto", "No es necesario nada"],
        correct: 0,
        rationale: "El video final es tu descargo de responsabilidad y confirma la entrega en buen estado.",
      },
      {
        text: "¿Qué debes hacer con los cables eléctricos en tu hogar antes de recibir un perro?",
        options: ["Dejarlos como están", "Cubrirlos o esconderlos completamente", "No hacer nada si el perro es tranquilo", "Solo desconectarlos"],
        correct: 1,
        rationale: "Los cables eléctricos son un riesgo de electrocución para los perros. Deben estar fuera de alcance.",
      },
      {
        text: "¿Cuáles son los principales indicadores de calidad Pawwi?",
        options: ["La marca de ropa que usas", "Puntualidad, amor por los perros y reportes completos", "Tener una casa con televisor", "Vivir cerca del cliente"],
        correct: 1,
        rationale: "El servicio 5 estrellas se construye con puntualidad, cariño y comunicación.",
      },
      {
        text: "¿Cuándo debes estar listo para recoger o entregar el perro?",
        options: ["En la hora exacta acordada", "5 minutos antes, sin excepción", "Si llegas tarde está bien", "30 minutos de margen siempre"],
        correct: 0,
        rationale: "La puntualidad es respeto al tiempo del cliente.",
      },
      {
        text: "Si el perro ingiere un objeto extraño, debes:",
        options: ["Inducirle el vómito con leche", "Identificar el objeto, tomar foto y llevarlo al veterinario", "Darle agua y esperar", "Llamar al dueño y no hacer nada más"],
        correct: 1,
        rationale: "No adivines. Documenta y actúa rápido con el veterinario.",
      },
      {
        text: "¿Cuál es el tiempo mínimo de un servicio en Pawwi?",
        options: ["30 minutos", "1 hora", "4 horas", "Un día completo"],
        correct: 1,
        rationale: "El mínimo operativo es 1 hora para garantizar un servicio de calidad.",
      },
      {
        text: "¿Puedes delegar el servicio a tu compañero de cuarto o pareja?",
        options: ["Sí, si sabe cuidar perros", "No — el servicio es intransferible y personal", "A veces, si avisa a Pawwi", "Sí, si el cliente lo aprueba"],
        correct: 1,
        rationale: "TÚ eres quien fue verificado y certificado. El servicio es personal e intransferible.",
      },
    ],
  },
];

export const PASSING_SCORE = 22;
export const TOTAL_QUESTIONS = 27;
export const TOTAL_VIDEOS = VIDEO_MODULES.length;
