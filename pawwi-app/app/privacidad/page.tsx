import Link from "next/link";
import { ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Política de Privacidad — Pawwi",
};

// ⚠️ BORRADOR PENDIENTE DE REVISIÓN LEGAL.
// Describe con exactitud qué datos se guardan y quién los ve — se verificó
// contra el código y las RPC, no contra suposiciones. Al hacerlo se encontró
// una fuga real (la dirección exacta llegaba a candidatos que no habían
// aceptado la reserva), corregida en la migración 65. Y la 65 dejó otra: el
// Pawwer ELEGIDO la veía antes de aceptar, porque en la etapa 1 pawwer_id viene
// desde la creación. Corregida en la 68, que además la retrasa hasta el pago.
//
// Lo que NO contiene, porque requiere abogado: plazos de retención concretos,
// el aviso de privacidad formal exigido por la Ley 1581 de 2012, el registro
// de la base de datos ante la SIC, y las cláusulas de transferencia
// internacional que aplican por usar proveedores fuera de Colombia.

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

export default function PrivacidadPage() {
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
          <ShieldCheck size={26} />
        </div>
        <h1 className="text-4xl font-black mb-3 text-balance">Política de Privacidad</h1>
        <p className="text-[#6B7280] font-medium leading-relaxed text-pretty">
          Qué datos guardamos, para qué, y —sobre todo— <strong>quién los puede ver</strong>.
        </p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>Versión preliminar.</strong> Lo que dice aquí se verificó contra el código, pero
            el aviso de privacidad formal está pendiente de revisión legal.
          </p>
        </div>

        <Seccion n="1" titulo="Qué guardamos">
          <p><strong>De todos:</strong> correo y contraseña (cifrada), nombre y foto de perfil.</p>
          <p>
            <strong>Del dueño:</strong> tu barrio y la dirección donde se recoge o entrega el perro;
            tu cédula cuando reservas; y la ficha de tu perro — raza, edad, peso, salud, vacunas,
            comportamiento y rutina.
          </p>
          <p>
            <strong>Del Pawwer:</strong> ubicación aproximada del hogar, fotos de la casa, datos de
            la cuenta de pago, cédula y certificación bancaria.
          </p>
          <p><strong>De la actividad:</strong> reservas, mensajes del chat, reseñas y conexión.</p>
        </Seccion>

        <Seccion n="2" titulo="Quién ve tu dirección exacta">
          <p>
            <strong>Solo el Pawwer que aceptó tu reserva, y solo cuando ya la pagaste.</strong> Es la
            regla y está implementada en la base de datos, no solo escrita aquí. Mientras el cuidado
            está confirmado o en curso la puede ver; después, ya no.
          </p>
          <p>
            Antes de eso —mientras tu solicitud espera respuesta, o si pasa a varios Pawwers— cada
            uno ve tu <strong>barrio</strong> y una distancia aproximada, redondeada a alrededor de un
            kilómetro, para decidir si le queda lejos. <strong>No ve tu dirección.</strong>
          </p>
          <p>
            Al revés tampoco: el perfil público de un Pawwer muestra su barrio, nunca su dirección.
          </p>
          <p className="text-xs text-gray-500">
            Antes de septiembre de 2026 esto no era así: la dirección exacta llegaba a Pawwers que
            aún no habían aceptado —primero a todos los de la bolsa, y hasta el 11 de septiembre al
            Pawwer que elegiste, desde que enviabas la solicitud—. Lo encontramos al verificar esta
            página contra el código y lo corregimos.
          </p>
        </Seccion>

        <Seccion n="3" titulo="Tu teléfono no se comparte, nunca">
          <p>
            Ni al Pawwer ni al cliente. Toda la coordinación ocurre en el chat de la reserva, que
            además <strong>bloquea automáticamente</strong> el envío de números de teléfono y correos.
            Protege a las dos partes y deja registro de lo acordado.
          </p>
        </Seccion>

        <Seccion n="4" titulo="Cédula y datos de pago">
          <p>
            Se guardan en almacenamiento privado y se muestran <strong>enmascarados</strong> (por
            ejemplo <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">••••1234</code>). El
            número de cuenta se escribe pero no se lee de vuelta: ni el propio usuario ve el número
            completo después de guardarlo.
          </p>
        </Seccion>

        <Seccion n="5" titulo="Con quién compartimos datos">
          <p>Solo con los proveedores necesarios para que Pawwi funcione:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase</strong> — base de datos, autenticación y almacenamiento</li>
            <li><strong>Vercel</strong> — alojamiento de la aplicación</li>
            <li><strong>Bold</strong> — procesamiento de pagos. Pawwi <strong>nunca</strong> recibe ni guarda datos de tu tarjeta</li>
            <li><strong>Google Maps</strong> — direcciones y distancias</li>
            <li><strong>Resend</strong> — correos de la plataforma</li>
          </ul>
          <p className="pt-1">
            <strong>No vendemos tus datos</strong> ni los cedemos para publicidad de terceros. Estos
            proveedores operan servidores fuera de Colombia, así que tus datos se procesan en el
            exterior.
          </p>
        </Seccion>

        <Seccion n="6" titulo="Las reseñas son públicas y no se borran">
          <p>
            Una reseña que dejas queda visible en el perfil del Pawwer con tu nombre y foto. No se
            editan ni se eliminan a pedido — es lo que las hace confiables. Piénsalo antes de
            publicarla.
          </p>
        </Seccion>

        <Seccion n="7" titulo="Tus derechos">
          <p>
            La Ley 1581 de 2012 te da derecho a conocer, actualizar, rectificar y suprimir tus datos,
            y a revocar la autorización para tratarlos. Puedes editar tu perfil y tus mascotas desde
            la aplicación, y eliminar tu cuenta desde tu perfil.
          </p>
          <p>
            Para cualquier otra solicitud, escríbenos a{" "}
            <a href="mailto:hola@pawwi.co" className="font-bold text-[#FF7031] underline underline-offset-2">
              hola@pawwi.co
            </a>
            .
          </p>
          <p className="text-xs text-gray-500">
            Al eliminar tu cuenta desactivamos tu perfil, pero conservamos el histórico de reservas y
            los datos de facturación por obligaciones contables y tributarias. Los plazos exactos
            quedarán en la versión definitiva de esta política.
          </p>
        </Seccion>

        <a href="mailto:hola@pawwi.co" className="inline-flex items-center gap-2 mt-10 bg-[#120A2B] text-white font-bold text-sm px-6 py-3.5 rounded-full hover:bg-[#1e1145] transition-colors">
          Dudas sobre tus datos: hola@pawwi.co
        </a>
        <p className="text-xs text-gray-400 mt-10">
          Pawwi S.A.S. · NIT 901.937.952-7 · Bogotá, Colombia
        </p>
      </main>
    </div>
  );
}
