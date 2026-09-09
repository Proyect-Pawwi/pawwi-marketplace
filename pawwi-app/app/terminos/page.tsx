import Link from "next/link";
import { ArrowLeft, FileText, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Términos y Condiciones — Pawwi",
};

// ⚠️ BORRADOR PENDIENTE DE REVISIÓN LEGAL.
// El contenido refleja fielmente el modelo de producto (decisiones 01–07 de
// docs/06-PRODUCTO-REDISENO.md) y es deliberadamente conservador: dice que
// Pawwi hace MENOS, nunca más. Lo que NO contiene, porque requiere abogado:
// cláusula de jurisdicción, resolución de disputas, plazos de retención y
// cualquier cita normativa específica.
//
// El punto que el abogado debe revisar primero es la sección 6: la relación
// con el Pawwer es civil, no laboral, y de eso depende que el modelo entero
// sea viable. Ver la nota sobre subordinación en docs/06.

function Seccion({ n, titulo, children }: { n: string; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-lg font-black mb-2 text-balance">
        <span className="text-[#FF7031]">{n}.</span> {titulo}
      </h2>
      <div className="text-sm text-[#374151] leading-relaxed space-y-2.5 text-pretty">{children}</div>
    </section>
  );
}

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[#FFF1EB] text-[#120A2B] font-sans">
      <header className="border-b border-black/5 bg-white/60 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/LogoPawwiCompleteOrange.svg" alt="Pawwi" className="h-6 w-auto" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="w-14 h-14 rounded-[18px] bg-white shadow-[0_12px_30px_rgba(18,10,43,0.06)] flex items-center justify-center text-[#FF7031] mb-5">
          <FileText size={26} />
        </div>
        <h1 className="text-4xl font-black mb-3 text-balance">Términos y Condiciones</h1>
        <p className="text-[#6B7280] font-medium leading-relaxed text-pretty">
          Estos términos explican qué es Pawwi, qué hacemos y qué no. Están escritos para
          entenderse sin abogado.
        </p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>Versión preliminar.</strong> El contenido describe con exactitud cómo funciona
            Pawwi hoy, pero está pendiente de revisión legal. Si algo aquí te genera dudas antes de
            reservar o de recibir un perro, escríbenos y te respondemos antes de que aceptes nada.
          </p>
        </div>

        <Seccion n="1" titulo="Qué es Pawwi">
          <p>
            Pawwi es un <strong>marketplace</strong>: una plataforma que conecta a dueños de perros
            con cuidadores independientes (a quienes llamamos <em>Pawwers</em>) en Bogotá.
          </p>
          <p>
            Pawwi <strong>no cuida perros</strong>. No operamos guarderías, no tenemos instalaciones
            y no empleamos cuidadores. Lo que hacemos es verificar a quién le entregas tu perro —y a
            quién recibes en tu casa— y poner las herramientas para que se pongan de acuerdo.
          </p>
        </Seccion>

        <Seccion n="2" titulo="Lo que Pawwi garantiza, y lo que no">
          <p>
            <strong>Pawwi responde por la verificación, no por el incidente.</strong> Es la única
            promesa que asumimos, y la decimos sin asteriscos.
          </p>
          <p>Verificamos, antes de que un Pawwer pueda recibir reservas:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>su identidad, con cédula en físico</li>
            <li>su hogar, con una <strong>visita domiciliaria presencial</strong></li>
            <li>que aprobó un examen y una capacitación</li>
          </ul>
          <p className="pt-1">
            <strong>Pawwi no es una aseguradora.</strong> No cubrimos daños, lesiones, enfermedades,
            pérdidas ni gastos veterinarios. No existe ningún fondo de asistencia, seguro incluido
            ni respaldo económico ante incidentes. Si alguna vez leíste lo contrario en nuestro
            sitio, era información desactualizada y la retiramos.
          </p>
        </Seccion>

        <Seccion n="3" titulo="Cómo funciona una reserva">
          <p>
            Eliges un Pawwer, sus fechas y su precio, y envías la solicitud. Él tiene{" "}
            <strong>una hora</strong> para aceptarla o rechazarla.
          </p>
          <p>
            Si la rechaza o no responde, tu solicitud pasa a los demás Pawwers verificados{" "}
            <strong>por el mismo precio</strong> durante seis horas más — pero solo si tú lo
            autorizaste al reservar. Si preferiste que no, la solicitud termina ahí y eliges de
            nuevo.
          </p>
          <p>
            <strong>No se te cobra nada hasta que un Pawwer haya aceptado.</strong> Cuando alguien
            acepta, te pedimos el pago; hasta que pagues, la reserva no está confirmada. Si nadie
            acepta, no se mueve un peso.
          </p>
          <p>
            Si tu reserva la tomó un Pawwer distinto al que elegiste, verás quién es y podrás
            revisar su perfil <strong>antes</strong> de pagar. No transferimos tu reserva a otra casa
            sin que lo sepas.
          </p>
        </Seccion>

        <Seccion n="4" titulo="Precio, comisión y pagos">
          <p>
            <strong>Cada Pawwer fija sus propios precios</strong> y decide cuántos perros acepta a la
            vez. Pawwi no impone tarifas ni topes de capacidad: mostramos lo que cada uno ofrece y la
            ocupación real de cada día, para que decidas informado.
          </p>
          <p>
            Del valor del cuidado, Pawwi retiene una comisión del <strong>25%</strong>, que baja al{" "}
            <strong>20%</strong> para Pawwers de nivel Ranger. La tasa queda congelada en cada
            reserva al momento de crearla y no cambia después.
          </p>
          <p>
            Al Pawwer se le transfiere su parte semanalmente. Pawwi cobra al cliente el 100% y
            transfiere al Pawwer lo que le corresponde.
          </p>
        </Seccion>

        <Seccion n="5" titulo="Transporte">
          <p>
            <strong>Pawwi no traslada animales.</strong> Algunos Pawwers ofrecen recoger y entregar
            por un precio que ellos publican; en ese caso el traslado lo hace el Pawwer, no Pawwi. Si
            el Pawwer no lo ofrece, el traslado lo resuelve el dueño.
          </p>
        </Seccion>

        <Seccion n="6" titulo="La relación entre las partes">
          <p>
            El cuidado es un <strong>acuerdo entre el dueño y el Pawwer</strong>. Pawwi es el
            intermediario que los conecta y no es parte de ese acuerdo.
          </p>
          <p>
            Los Pawwers son <strong>contratistas independientes</strong>, no empleados ni
            contratistas de Pawwi. Cada uno decide si acepta o rechaza cada encargo, cuándo está
            disponible, cuánto cobra y cuántos perros recibe. Pawwi <strong>nunca asigna trabajo
            obligatorio</strong>: rechazar una solicitud no tiene ninguna penalización.
          </p>
          <p>
            Como el cuidado ocurre entre las partes, cualquier gasto, daño o desacuerdo se resuelve
            entre ellas. Recomendamos a los Pawwers considerar un seguro propio de responsabilidad
            civil, y a los dueños hablar los gastos veterinarios con el Pawwer antes de entregar el
            perro.
          </p>
        </Seccion>

        <Seccion n="7" titulo="Tus obligaciones como dueño">
          <ul className="list-disc pl-5 space-y-1">
            <li>Dar información veraz sobre tu perro: salud, vacunas, comportamiento y rutina.</li>
            <li>
              Avisar si tu perro <strong>no es sociable con otros perros</strong>, tiene ansiedad por
              separación o requiere medicación. Ocultarlo pone en riesgo a tu perro, a los demás y al
              Pawwer.
            </li>
            <li>Entregar al perro con sus vacunas al día.</li>
            <li>Recogerlo a la hora acordada.</li>
          </ul>
        </Seccion>

        <Seccion n="8" titulo="Tus obligaciones como Pawwer">
          <ul className="list-disc pl-5 space-y-1">
            <li>Mantener tu hogar en las condiciones que se verificaron en la visita.</li>
            <li>No exceder la capacidad que tú mismo declaraste.</li>
            <li>Responder las solicitudes dentro del plazo, aunque sea para rechazarlas.</li>
            <li>Avisar al dueño de inmediato ante cualquier incidente de salud.</li>
            <li>No transferir el cuidado a otra persona ni a otro domicilio.</li>
          </ul>
        </Seccion>

        <Seccion n="9" titulo="Comunicación dentro de Pawwi">
          <p>
            Toda la coordinación de un cuidado ocurre en el chat de la reserva. El chat bloquea
            correos y números de teléfono: es para proteger a las dos partes y para que quede
            registro de lo acordado.
          </p>
        </Seccion>

        <Seccion n="10" titulo="Cancelaciones y reseñas">
          <p>
            Puedes cancelar antes de que el cuidado empiece. Las cancelaciones del Pawwer afectan su
            nivel dentro de la plataforma; las del cliente, no.
          </p>
          <p>
            Las reseñas solo puede dejarlas quien completó un cuidado. <strong>No se editan ni se
            borran a pedido</strong>, ni del cliente ni del Pawwer.
          </p>
        </Seccion>

        <Seccion n="11" titulo="Datos personales">
          <p>
            Cómo tratamos tus datos está en nuestra{" "}
            <Link href="/privacidad" className="font-bold text-[#FF7031] underline underline-offset-2">
              Política de Privacidad
            </Link>
            .
          </p>
        </Seccion>

        <a href="mailto:hola@pawwi.co" className="inline-flex items-center gap-2 mt-10 bg-[#120A2B] text-white font-bold text-sm px-6 py-3.5 rounded-full hover:bg-[#1e1145] transition-colors">
          ¿Dudas? Escríbenos a hola@pawwi.co
        </a>
        <p className="text-xs text-gray-400 mt-10">
          Pawwi S.A.S. · NIT 901.937.952-7 · Bogotá, Colombia
        </p>
      </main>
    </div>
  );
}
