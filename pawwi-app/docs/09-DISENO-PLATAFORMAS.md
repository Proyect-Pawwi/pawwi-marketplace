# 09 · Diseño de las tres plataformas

> **Qué es cada plataforma**: quién la usa, cómo se navega, qué pantallas tiene, qué muestra cada
> una, qué puede hacer el usuario y cómo se conectan entre sí.
>
> [`06`](./06-PRODUCTO-REDISENO.md) dice **qué es Pawwi y por qué**. [`07`](./07-PLAN-CONSTRUCCION.md)
> dice **cuándo y en qué orden** se construye. Este documento dice **qué se está construyendo**.
> _Última actualización: 2026-09-11_

## 📖 Quién es quién

**Pawwer es siempre el cuidador. Nunca el cliente.**

| Término | Quién es | En los ejemplos | En el código |
|---|---|---|---|
| **Pawwer** | El **cuidador** verificado que recibe perros en su casa y trabaja con Pawwi como contratista independiente | Juliana, Pedro | `role = 'pawwer'` · tabla `pawwer` · rutas `/pawwer/*` |
| **Cliente** | El **dueño del perro**, que busca, reserva y paga | Sofía | `role = 'client'` · tabla `client` · rutas `/mis-*` y `/booking/*` |
| **Pawwi** | La empresa: el intermediario que conecta a los dos | — | — |
| **Admin** | Pawwi operando la plataforma — hoy, una persona | — | `profile.is_admin` · rutas `/admin/*` |

Cuando una pantalla del cliente habla «del Pawwer», se refiere **a su cuidador**: la persona a la
que el cliente le va a dejar su perro.

---

**Leyenda de estado**, en cada pantalla:

| | |
|---|---|
| ✅ | Construida y funciona |
| ⚠️ | Construida, con defectos conocidos |
| 🔨 | Esqueleto: renderiza pero no hace nada real |
| 🆕 | No existe, se construye |

---

## 🧭 Cómo se conectan las tres

Pawwi son **tres plataformas sobre un solo backend**. Ninguna habla con otra directamente: todas
leen y escriben la misma base de Supabase, a través de RPC `SECURITY DEFINER` que validan contra
`auth.uid()`.

| Plataforma | Para quién | Cómo entra | Dispositivo |
|---|---|---|---|
| **Cliente** | El dueño del perro | Registro ligero, solo al reservar o guardar | **Móvil primero** — el 85% del uso |
| **Pawwer** | El cuidador | Registro + embudo de verificación | **Móvil primero** |
| **Admin** | Pawwi como operador — hoy, una persona | `profile.is_admin`, encendido a mano | **Escritorio**, salvo la visita, que es móvil |

### El ciclo de una reserva, visto por las tres

```
CLIENTE                          PAWWER                           ADMIN
───────                          ──────                           ─────
Explora, elige a Juliana
Reserva · Pasaporte · consiente
  la bolsa (o no)             →  Le llega la solicitud
                                 «Te eligió a ti» · 1 hora
                                     │
                     ┌───────────────┴───────────────┐
                  acepta                          declina / vence
                     │                               │
Ve «Juliana aceptó» ←┘                    ┌──────────┴──────────┐
Paga                                  allow_pool           sin permiso
  │                                      │                     │
  ▼                                 BOLSA · 6 horas      sin_cuidador
CONFIRMADA                          Otros Pawwers la          │
Ve la dirección                     ven y el primero    Cliente elige
Chatea                              en aceptar gana     de nuevo
  │                                      │
  ▼                                 El cliente ve QUIÉN
EN CURSO · reporte diario           y paga — o no
  │
  ▼
COMPLETADA · reseña                 Ganancia pendiente  →  Liquidación
Reservar de nuevo                   del viernes             del viernes
```

**El admin no aparece dentro del ciclo de la reserva.** Es una decisión de `docs/06`: Pawwi no
modera relaciones ni asigna trabajo. El admin entra **antes** —verificando a quién se le permite
recibir perros— y **después** —pagándole al Pawwer lo que ganó—.

### El embudo del Pawwer, visto por dos

```
PAWWER                                         ADMIN
──────                                         ─────
Se registra
Llena bienvenida (3 pasos)        →  pending_review  →  Revisa la cédula
                                                         aprueba / rechaza
Examen psicotécnico  ←  exam_ready  ←─────────────────────────┘
  │ se califica solo
  ├─ ≥ corte ──→ preselected
  ├─ 40–59 ───→ needs_review  →  Resuelve el examen
  └─ < 40 ────→ rejected
Capacitación · 8 videos + quiz
  │ se califica solo
  ▼
visita_pendiente  →  Agenda sobre un cupo  ←──  Abrió cupos por zona
                        que el admin abrió
                                               VISITA · desde su móvil
                                               cédula en físico · 5 fotos
                                               hechos · precios · agenda
                                               términos
                                                  │
                     approved + verified  ←── Aprueba y publica
Ve «Ya estás en línea»
Entra a su portal
```

---

## 🎨 Principios comunes

**Móvil primero, siempre**, salvo el admin de escritorio. El 85% del tráfico es móvil y la interfaz
**nunca se revisó formalmente** en un teléfono — se hace en S7.

**El dato exacto aparece cuando hay compromiso firme, en las dos direcciones — y el compromiso
firme es el pago.** El Pawwer ve la dirección del cliente cuando el cliente paga (mig 68); el cliente
ve la del Pawwer también al pagar (S4). Antes, barrio y distancia
aproximada a ~1 km.

**`null` no es `false`.** Un dato que el usuario no ha dado se muestra como «sin informar», nunca como
un «no» sobre él o sobre su perro. Fuente única en `lib/dog-behavior.ts`.

**Nunca prometer lo que el sistema no cumple.** Es la lección de PawwiProtect, y la auditoría del
2026-09-10 encontró cinco promesas más del mismo tipo. Ningún texto de interfaz afirma algo que el
código no garantice.

**Fuentes únicas.** Niveles en `lib/levels.ts`, servicios en `lib/services.ts`, comportamiento del
perro en `lib/dog-behavior.ts`. Ninguna pantalla recalcula por su cuenta lo que ya calcula el
backend — que es exactamente el defecto del «Élite» del Pawwer.

**Dos tipos de pantalla**, con reglas distintas:

| | Pantalla-pestaña | Sub-pantalla |
|---|---|---|
| Título | `h1 text-3xl font-black` + chip de ícono | `text-2xl font-black` |
| Volver | No | Botón `ArrowLeft` |
| Navegación inferior | Visible | **Oculta** |
| Guardar | — | Barra flotante que aparece solo si hay cambios |

**Identidad visual** — detalle completo en [`04`](./04-BACKEND-Y-SEGURIDAD.md):
cream `#FFF1EB` fondo · midnight `#120A2B` texto y botones · tangerine `#FF7031` acción principal ·
plum `#F7AEF1` y blue-ice `#92C0E9` acentos. **Plus Jakarta Sans** en la raíz de toda pantalla.

---

# 🐶 Plataforma 1 · Cliente

**Quién:** Sofía — 28 a 45 años, trabajo híbrido, apartamento, ama a su perro. Su dolor no es
logístico sino emocional: *«es como dejarle un hijo a alguien»*. El 100% de las 40 entrevistas
nombró la confianza como la barrera principal.

**Por eso el diseño tiene una sola prioridad:** que Sofía **nunca se sienta a oscuras** — sobre a
quién le entrega su perro, sobre qué está pasando con su reserva, y sobre cómo está su perro.

## Navegación

Cinco pestañas en `ClientNav`, montado una vez en `app/layout.tsx`. Aparece **solo** con sesión de
cliente y **solo** en las cinco raíces exactas — en las sub-pantallas y en los flujos profundos se
oculta sola.

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│Favoritos │ Reservas │ Explorar │ Mensajes │  Perfil  │
│    ♡     │    📅    │   (🔍)   │    💬    │    👤    │
│          │  • badge │  central │  • badge │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

Los dos **badges** —cambios en reservas y mensajes sin leer— ya están construidos en `NavTab` y
**ningún llamador los alimenta**. Se conectan en S5.

## Mapa de pantallas

```
/                              Explorar · la home ES el buscador
├── /pawwer/[id]               Perfil público del Pawwer
├── /booking/nuevo             Reservar · 4 pasos
│   ├── paso 1                 Servicio
│   ├── paso 2                 Fechas y horas
│   ├── paso 3                 Perros · Pasaporte · transporte · bolsa
│   └── paso 4                 Solicitud enviada · todavía no se paga
├── /mis-favoritos             Pawwers guardados
├── /mis-reservas              Activas e historial
│   └── /mis-reservas/[id]     Detalle de una reserva  (hoy: /booking/confirmada/[id])
├── /mis-mensajes              Conversaciones
│   └── /mis-mensajes/[id]     Chat de una reserva
└── /mi-perfil                 Centro de control
    ├── /mis-mascotas          Mis peludos
    │   └── /mis-mascotas/[id] Pasaporte del perro · crear y editar
    ├── identidad              Cédula (KYC)
    └── eliminar cuenta

Fuera de la navegación:  /login · /registro · /recuperar · /nueva-contrasena
                         /soporte · /terminos · /privacidad
```

## Pantalla por pantalla

### Explorar · `/` · ⚠️ construida · S4

La puerta de entrada y el buscador a la vez. Se explora **sin registrarse**.

| Zona | Qué muestra |
|---|---|
| Hero | Promesa y prueba social **real**: nº de Pawwers verificados y rating promedio calculados de `pawwer` y `reviews`. Hoy los tres números están escritos a mano — `4.9/5`, `+500 reseñas Google`, `15 Pawwers` |
| Buscador | **Dónde** (autocompletado de Google) · **cuándo** (fecha, o rango para Travel) · **cuántos perros** |
| Filtros | Todos · Daycare · Nightcare · Travel |
| Resultados | Lista y mapa sincronizados. Orden **nivel → rating → distancia**. Sin corte por radio |
| Tarjeta de cada Pawwer (cuidador) | Foto de su hogar · chip de nivel · rating · barrio y distancia · precio desde · servicios · «recoge y entrega por $Xk» · ♡ |

**Qué puede hacer:** buscar, filtrar, abrir un perfil, guardar favoritos.

**Cambios de S4:** los favoritos **persisten** en `favourite`; el número de perros **filtra** contra
`max_animals` y viaja a la reserva — hoy es decorativo y un cliente con 3 perros se estrella en el
paso 3; el hero pasa a datos reales; y los dos enlaces del menú que van a rutas 404.

### Perfil público del Pawwer · `/pawwer/[id]` · ✅ construida · S3 · S4

La ficha pública **del cuidador**, tal como la ve el cliente. Es la pantalla donde Sofía **decide** a
quién le deja su perro, así que todo lo que aparece aquí tiene que sostener la confianza.

| Zona | Qué muestra |
|---|---|
| Galería | **Las cinco fotos tomadas por el operador en la visita**, no las que subió el Pawwer. Chip de nivel encima |
| Identidad | Nombre, nivel, sello **Verificado**, rating y nº de reseñas, tiempo de respuesta, **presencia en vivo** |
| Lo verificado | 🆕 **Hechos observados en la visita** —metros de la zona del perro, zonas separadas, exteriores— **separados visualmente** de lo que el Pawwer declaró de sí mismo. Es la promesa entera en una sección |
| Lo declarado | Bio, experiencia, tipo de hogar, animales en casa, niños |
| Servicios | Precio por servicio y calculadora · «acepta hasta N perros, hasta tamaño X» |
| Disponibilidad | Calendario con los días abiertos y **ocupación real** |
| Transporte | Si lo ofrece, su precio por trayecto |
| FAQ y reseñas | Las preguntas que responde él mismo · reseñas verificadas, que no se editan ni se borran |
| Acción | **Reservar** · ♡ guardar |

**No hay chat antes de reservar.** Las FAQ y el Pasaporte cubren la duda previa; abrir el chat
antes es el camino más corto a que cierren el trato por fuera de Pawwi.

### Reservar · `/booking/nuevo` · pasos 1–4 ✅ · S4

| Paso | Qué pide | Qué valida |
|---|---|---|
| **1 · Servicio** | Uno de los servicios activos del Pawwer | Que esté activo |
| **2 · Fechas** | Fecha o rango, horas de entrega y recogida | Pasado, `week_pattern`, disponibilidad, fin > inicio. Consciente de pernoctas |
| **3 · Perros** | Qué perros · dirección si hay transporte · notas | **Tope de perros** del Pawwer · Pasaporte completo · cédula registrada |
| | Muestra **«tu perro sería 1 de 3 ese día»** y avisa si uno no es sociable | Ocupación del día más ocupado del rango |
| | Pregunta **«si Juliana no puede, ¿buscamos otro por el mismo precio?»** | Se guarda como `allow_pool` |
| **4 · Enviada** | Nada: *«Todavía no pagas nada»*. El pago no es un paso del asistente — ocurre después, en el detalle de la reserva, cuando el Pawwer acepta | ✅ S2 — antes era un cartel de «la pasarela se habilitará en la próxima versión» |

**Si falta el Pasaporte**, el paso 3 abre el formulario y **vuelve a la reserva** al terminar. Hoy el
`?back=` se ignora y se pierde la reserva a medias.

### Mis reservas · `/mis-reservas` · ⚠️ construida · S4

Activas arriba, historial abajo. Actualiza **en vivo** cuando cambia algo.

**La tarjeta muestra la etapa, no solo el estado** — ver la matriz al final. La regla es simple:
**la clienta siempre ve el nombre de su cuidador**, nunca la palabra genérica «Pawwer» en su lugar.
Hoy, cuando la reserva pasa a la bolsa, el cron hace `pawwer_id = NULL` y la tarjeta, que debería
decir «Juliana M.», cae al texto de respaldo `"Pawwer"` con una «P» genérica. **Parece un error de la
app**, en el momento de más ansiedad de Sofía.

### Detalle de la reserva · `/mis-reservas/[id]` · ⚠️ construida y escondida · S4 · S5

Hoy existe como `/booking/confirmada/[id]`, **con cancelar y reseñar funcionando**, y no se llega a
ella desde ninguna parte. Se mueve bajo `/mis-reservas` y se enlaza desde cada tarjeta.

| Zona | Qué muestra | Cuándo |
|---|---|---|
| Estado | Etapa en lenguaje humano, con **quién** y **cuánto falta** | Siempre |
| Su cuidador (el Pawwer) | Foto, nombre, nivel, enlace a su perfil | Siempre que haya uno |
| Temporizador | Cuánto le queda al Pawwer para responder · o cuándo empieza y termina el cuidado | Pendiente · confirmada · en curso |
| Pagar | Botón al checkout de Bold, con la hora límite, «pago en proceso», «el pago no pasó» y «ya pagué» | ✅ **S2** · solo cuando el Pawwer ya aceptó |
| Dirección | **Dónde queda la casa**, con enlace a Maps | 🆕 **Solo al estar pagada** |
| Chat | Entrada a la conversación | Confirmada y en curso |
| Cancelar | Diciendo **antes** qué pasa con el dinero: 100% con 48 h o más; con menos, sin reembolso (✅ S2) | Pendiente y confirmada |
| Reseñar | Estrellas y comentario | Completada |
| Reservar de nuevo | Mismo Pawwer, mismo servicio, solo fechas | 🆕 Completada |

### Favoritos · `/mis-favoritos` · 🔨 esqueleto · S4

Lista de los Pawwers guardados, con **reservar de nuevo** en un toque. Hoy no hace **ni una query**
y su estado vacío está escrito a mano — aunque el cliente tuviera favoritos, diría que no.

### Mensajes · `/mis-mensajes` · 🔨 esqueleto · S5

Lista de conversaciones, una por reserva, con el último mensaje y los no leídos. El chat reutiliza
el molde de `ChatRoom.tsx` del Pawwer: tiempo real, fotos, moderación que bloquea correos y
teléfonos, tarjeta de resumen del cuidado, presencia de la otra parte y botón de soporte.

**El backend ya está listo** — `send_message` autoriza a `client_id` y el canal es neutro. Hoy el
Pawwer escribe en un chat donde nadie puede responder.

### Mi perfil · `/mi-perfil` · 🔨 parcial · S4

| Sección | Qué hace |
|---|---|
| Mis datos | 🆕 Editar nombre, foto y teléfono — hoy **no se puede editar nada** |
| Mis peludos | → `/mis-mascotas` |
| Mi identidad | 🆕 Cédula, escrita por RPC y mostrada enmascarada (`••••1234`) |
| Ayuda | Soporte · Términos · Privacidad |
| Sesión | Cerrar sesión |
| Eliminar cuenta | 🆕 ⚖️ **Obligación de la Ley 1581**, y la Política de Privacidad ya afirma que existe |

### Mis peludos · `/mis-mascotas` · ⚠️ construida · S4

Lista de perros con su foto. Crear y **editar** abren el **Pasaporte** — hoy editar abre un
formulario vacío y **crea un perro duplicado**.

**El Pasaporte**, en cuatro pasos y a mano con `zod`:

| Paso | Campos | Migración |
|---|---|---|
| **Ficha** | Foto, nombre, raza, edad, tamaño, sexo, peso | ya existen |
| **Salud** | Vacunas al día, esterilizado, notas médicas urgentes | 57 |
| **Comportamiento** | Sociable con perros · con gatos · con niños · ansiedad por separación · energía | 57 |
| **Rutina** | Horarios de comida, reglas de la casa | 57 |

Hoy el formulario usa **0 de las 9 columnas** de la migración 57. Por eso la advertencia de
compatibilidad del paso 3 y los chips que ve el Pawwer **no se encienden nunca**.

## Flujos del cliente

**Primera reserva.** Explora sin cuenta → abre un perfil → «Reservar» → se registra (modal, vuelve
donde estaba) → servicio → fechas → perros; si falta el Pasaporte lo llena y vuelve → dirección si
hay transporte → decide sobre la bolsa → envía la solicitud → **espera a que Juliana acepte** → paga
→ ve la dirección → chatea.

**Juliana no puede.** Con `allow_pool`: la tarjeta dice *«Juliana no pudo, buscamos otro por el
mismo precio»* → le llega aviso → alguien la toma → *«La tomó Pedro · revisa su perfil y paga»* → Sofía
mira a Pedro y **decide con la tarjeta en la mano**. Sin `allow_pool`: *«Juliana no pudo»* → elige de
nuevo. **En ningún caso cambia de casa sin enterarse.**

**Durante el cuidado.** Recibe fotos en el chat · el reporte del día · puede responder · sabe cuándo
termina.

**La segunda vez.** Desde la reserva completada o desde favoritos: **reservar de nuevo** → solo
elige fechas.

---

# 🏠 Plataforma 2 · Pawwer

**Quién:** el cuidador independiente. Abre su casa, pone sus precios, decide cuántos perros recibe
y **qué encargos toma** — rechazar nunca le cuesta nada. Es un contratista, no un empleado, y el
diseño tiene que sostener esa diferencia.

**La plataforma tiene dos zonas**, y el paso de una a otra es la aprobación:

| | Embudo | Portal |
|---|---|---|
| Estado | Cualquiera antes de `approved` | `approved` |
| Navegación | El **dashboard** como sala de espera | **BottomNav** de cinco pestañas |
| Gate | Rol `pawwer` | `(portal)/layout.tsx` exige `status = 'approved'` |

## Navegación del portal

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Cuidados │   Chat   │  Inicio  │ Ganancias│  Perfil  │
│    📋    │    💬    │   (🏠)   │    💵    │    ⚙️    │
│          │  • badge │  central │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

Solo aparece en las cinco raíces. En editores, detalle y chat se oculta: tienen «volver» y, a veces,
su propia barra de guardar, que antes chocaba con la navegación.

## Mapa de pantallas

```
EMBUDO                                   PORTAL · requiere approved
/pawwer/unirse       Landing             /pawwer/inicio        Inicio
/pawwer/registro     Crear cuenta        /pawwer/cuidados      Mis cuidados
/pawwer/login        Entrar                └── /[id]           Detalle
/pawwer/bienvenida   Datos · 3 pasos     /pawwer/mensajes      Conversaciones
/pawwer/dashboard    Sala de espera        └── /[bookingId]    Chat
/pawwer/examen       Psicotécnico        /pawwer/ingresos      Ganancias
/pawwer/capacitacion Academy             /pawwer/perfil        Centro de control
/pawwer/visita       Agendar visita        ├── vitrina         Presentación
                                           ├── tarifas         Precios y capacidad
                                           ├── fotos           Fotos del hogar
                                           ├── pago            Cuenta bancaria
                                           ├── faq             Preguntas frecuentes
                                           └── resenas         Reseñas recibidas
                                         /pawwer/disponibilidad  Calendario
                                         /pawwer/cuenta-cobro    Documento imprimible
```

## El embudo, pantalla por pantalla

| Pantalla | Qué hace | Estado |
|---|---|---|
| **Landing** `/unirse` | Qué es ser Pawwer, beneficios, preguntas, CTA a registro. Sin promesas de respaldo económico — PawwiVet y «Pawwi responde contigo» se retiraron | ✅ |
| **Registro** | Nombre, correo, teléfono, contraseña, términos. Correo de confirmación | ✅ |
| **Bienvenida** · paso 1 *Tus datos* | Bio, profesión, fecha de nacimiento, nº de cédula, **fotos de cédula**, avatar | ✅ · las fotos se guardan desde el hotfix del 2026-09-10 |
| **Bienvenida** · paso 2 *Tu hogar* | Dirección, barrio, «mi espacio», valores, tipo de inmueble, áreas externas, animales en casa, niños, experiencia | ✅ |
| **Bienvenida** · paso 3 *Publicar* | Servicios con precio, patrón semanal, vista previa del perfil | ✅ |
| **Dashboard** | La sala de espera: línea de tiempo de cinco pasos y **solo el siguiente**, con su CTA | ⚠️ `needs_review` y `rejected` no tienen salida · S3 |
| **Examen** | 26 preguntas en 5 secciones. Se califica solo en el servidor | ✅ |
| **Capacitación** | 8 videos y un quiz de 27 preguntas. Pasa con 22 | ✅ |
| **Visita** | Calendario para elegir día y franja | ⚠️ los cupos están **inventados en el cliente** · S3 los lee de la agenda real |

**La revelación progresiva es deliberada:** el dashboard muestra solo el paso siguiente, no el
proceso entero de golpe. Menos abandono.

**Lo que falta del embudo:** el correo de **aprobación final** —el único que de verdad importa,
el que dice «ya estás en línea»— y una salida para `needs_review` y `rejected`. Ambos en S3.

## El portal, pantalla por pantalla

### Inicio · `/pawwer/inicio` · ⚠️ construida · S3

Lo primero que ve cada día. Prioriza **reaccionar rápido**, porque las solicitudes vencen.

| Zona | Qué muestra |
|---|---|
| Cabecera | Saludo, **presencia propia**, campana de notificaciones |
| 🆕 **Te eligieron a ti** | Solicitudes directas, cada una con **temporizador de 1 hora** |
| 🆕 **Bolsa general** | Oportunidades abiertas, **separadas** de las directas. Hoy caen mezcladas en la misma lista, y son psicológicamente distintas: «te eligieron» sostiene el nivel; «hay una abierta» es una oportunidad |
| Tarjeta de solicitud | Fechas · perros con **chips de comportamiento** · barrio y distancia (la dirección exacta llega cuando el cliente paga) · **cuánto gana ÉL**, con su propia comisión · Aceptar · Declinar · Ver detalle |
| En curso | Los cuidados de hoy |
| Ingresos | Del período, con gráfica — hoy/semana/mes/rango |
| Tu nivel | Solo **la próxima meta**, no la final. Checklist accionable |
| Referidos | ⚠️ Hoy promete **$20.000 sin atribución posible**. S3 retira la promesa; S6 la construye y la devuelve |

**Declinar nunca penaliza.** Es lo que sostiene que la relación sea civil y no laboral.

### Mis cuidados · `/pawwer/cuidados` · ✅ construida · S2

Cinco pestañas: **Nuevas · Aceptadas · En curso · Completadas · Canceladas** —«Aceptadas» se llamaba
«Confirmadas» hasta S2, cuando aceptar dejó de confirmar—. Cada tarjeta con la
etapa, el temporizador y la ganancia.

🆕 **Aceptada, falta que el cliente pague** — con la secuencia de S2, entre aceptar y cobrar hay un
intermedio. El Pawwer tiene que verlo, o va a creer que tiene un cuidado firme que todavía puede
caerse a los 30 minutos.

### Detalle del cuidado · `/pawwer/cuidados/[id]` · ✅ construida

| Zona | Qué muestra |
|---|---|
| El perro | Foto, raza, edad, peso, sexo, y **comportamiento**: en el detalle sí dice «sin informar» cuando falta — la ausencia no se lee como un «no» |
| Observaciones | Notas del cliente, resaltadas mientras esté pendiente |
| Transporte | Informativo: «tú haces el transporte, +$X». Pawwi no transporta |
| Dónde | Barrio y distancia; **dirección exacta cuando el cliente pagó**, mientras dura el cuidado |
| Ganancia | Neto, con el desglose cuidado y transporte |
| Acciones | Aceptar · Declinar · Cancelar (esta sí cuenta para el nivel) |

### Chat · `/pawwer/mensajes` · ✅ construido

Lista de conversaciones con no leídos, y el chat: tiempo real, fotos, moderación, tarjeta de resumen
del cuidado, presencia del cliente —que se enciende cuando el cliente tenga portal, en S5— y soporte.

🆕 **Marcar como reporte del día** — un mensaje con foto marcado como reporte, que alimenta el nivel.
La columna `is_daily_report` existe desde la migración 02 y hoy se escribe siempre `false`. S5.

### Ganancias · `/pawwer/ingresos` · ⚠️ construida · S3

| Zona | Qué muestra |
|---|---|
| Próximo pago | Monto y fecha del viernes: *«Te lo transferimos el viernes»*. ✅ Decía «automático» y «100% automáticos, sin trámites», que era falso —**Bold no dispersa a terceros**—; se corrigió en S2. Suma lo completado **y las cancelaciones tardías del cliente**, que también se le pagan |
| Rendimiento | Este mes · mes pasado · año · todo, con barras de 6 meses |
| Historial | Pagados · Pendientes · Cancelados, desde el ledger real `paid_at` |
| Tu nivel | ⚠️ Hoy calcula «Élite» por su cuenta con una regla **incompleta**: puede decir «ganas 20%» y que se le cobre 25%. S3 lee `pawwer.level` y lo llama **Ranger** |
| Cuenta de cobro | → documento imprimible |

### Centro de control · `/pawwer/perfil` · ✅ construido

| Módulo | Qué configura |
|---|---|
| **Perfil activo / en pausa** | Se oculta del marketplace sin desactivar la cuenta |
| **Horario de recepción** | A qué horas recibe perros |
| **Vitrina** | Profesión, años, tiempo de respuesta, bio, sellos, detalles del hogar, medidor de completitud |
| **Tarifas** | Precio por servicio con calculadora de neto · activar o desactivar servicio · **tamaño y número máximo de perros** · precio del transporte |
| **Disponibilidad** | Calendario de 60 días, por rango, con capacidad por día |
| **Fotos** | Subir, borrar, reordenar, portada, máximo 8 |
| **Pago** | Llave Bre-B o cuenta bancaria —el número se escribe y no se vuelve a leer completo— y certificación bancaria obligatoria |
| **FAQ** | Sus preguntas frecuentes — es lo que reemplaza al chat previo del cliente |
| **Reseñas** | Solo lectura. No las puede responder ni borrar |
| **Cuenta** | Cambiar contraseña · soporte · cerrar sesión · **eliminar cuenta** con «escribe ELIMINAR» |

**Dos pantallas viven fuera del grupo `(portal)` y por eso no heredan su gate** — ⚠️ S3:

| Pantalla | Qué comprueba hoy | El problema |
|---|---|---|
| `/pawwer/disponibilidad` | Solo que el rol sea `pawwer` | Un Pawwer **sin aprobar** entra y abre su agenda |
| `/pawwer/cuenta-cobro` | Solo que haya sesión | **Cualquier usuario logueado**, incluido un cliente, puede abrirla |

Durante el diseño de S3 el guard flojo de disponibilidad pareció útil —era lo único que permitía
cargar la agenda en la visita—, pero como la visita se hace desde el móvil del admin, ya no le
sirve a nadie. Las dos pasan a exigir `status = 'approved'`, igual que el resto del portal.

## Flujos del Pawwer

**Una solicitud directa.** Le llega el aviso → la ve en «Te eligieron a ti» con 1 hora → mira el
perro y su comportamiento → acepta → **espera el pago del cliente** → confirmada → recibe la
dirección → coordinan por el chat.

**Una oportunidad de la bolsa.** La ve en «Bolsa general» → el precio ya está fijado, y si su tarifa
es menor **gana más que la de lista** → acepta primero → mismo flujo. Si no le interesa, la ignora:
no hay nada que declinar.

**El cuidado.** Hoy manda fotos por el chat → marca una como reporte del día → al terminar, la
reserva pasa sola a completada.

**El viernes.** Ve lo pendiente en Ganancias → recibe la transferencia → aparece como pagado.

---

# 🛠️ Plataforma 3 · Admin

**Quién:** Pawwi como operador. Hoy, **una sola persona**. Todo el diseño parte de ahí: el admin no
opera el día a día, **mantiene el sistema** que lo opera.

**Qué hace:** exactamente lo que hoy obliga a abrir Supabase Studio. Verificar a quién se deja
recibir perros, hacer la visita, publicar, pagarle a los Pawwers y leer las métricas. **Nada más.**

**Qué no hace, por diseño:** no interviene en reservas, no asigna trabajo, no modera reseñas, no
media disputas. `docs/06` es explícito: Pawwi responde por la verificación, no por el incidente.

**Estado:** 🆕 **no existe nada.** Ni rol, ni pantalla, ni RPC. Todo se construye en **S3**.

## Acceso

`profile.is_admin`, un booleano que **solo se enciende con un `UPDATE` a mano** en el SQL Editor. La
función `is_admin()` es el guardia de todas las RPC de operador y del layout de `/admin`.

**No se toca el trigger de registro**, que sigue aceptando solo `client` y `pawwer`: nadie puede
darse el rol al registrarse. Y cada acción queda en `admin_audit` — quién, qué y cuándo — porque un
`UPDATE` a pelo en Studio no deja rastro y una RPC sí.

## Navegación

**Escritorio:** barra lateral fija. **Móvil:** solo la visita, que se usa de pie en casa del Pawwer.

```
┌─────────────────┬──────────────────────────────────────────┐
│  PAWWI · admin  │                                          │
│                 │                                          │
│  ● Hoy          │                                          │
│  ○ Pawwers      │         contenido de la pantalla         │
│  ○ Visitas      │                                          │
│  ○ Liquidación  │                                          │
│  ○ Métricas     │                                          │
│                 │                                          │
│  ─────────      │                                          │
│  Ver como       │                                          │
│  cliente ↗      │                                          │
└─────────────────┴──────────────────────────────────────────┘
```

## Mapa de pantallas

```
/admin                     Hoy · las colas
/admin/pawwers             Todos los Pawwers, por estado del embudo
  └── /admin/pawwers/[id]  Ficha: documentos, examen, visita, historial, acciones
/admin/visitas             La agenda: abrir cupos por zona, confirmar, reagendar
  └── /admin/visita/[id]   La visita en vivo · MÓVIL
/admin/liquidacion         El viernes: qué se le debe a cada uno
/admin/metricas            Embudo, dinero, reservas, demanda sin atender
```

## Pantalla por pantalla

### Hoy · `/admin`

Lo que requiere una acción, y nada más. **Si todas las colas están en cero, no hay nada que hacer.**

| Cola | Cuenta | Acción |
|---|---|---|
| **Cédulas por verificar** | `pending_review` | Abrir la ficha |
| **Exámenes en revisión** | `needs_review` | Abrir la ficha |
| **Visitas por confirmar** | visitas `pending` | Confirmar o reagendar |
| **Visitas de hoy** | con dirección y hora | Abrir la visita en el móvil |
| **Listos para aprobar** | visita `completed`, aún sin `approved` | Aprobar |
| **Liquidación del viernes** | Pawwers con saldo, si es viernes | Ir a liquidación |

### Pawwers · `/admin/pawwers` y la ficha

**La lista:** todos, filtrables por estado del embudo, buscables por nombre o cédula, con fecha de
registro y días en el estado actual — un Pawwer con 10 días en `pending_review` es un Pawwer que se
está enfriando.

**La ficha** reúne todo lo que hoy está disperso en seis tablas:

| Sección | Qué muestra |
|---|---|
| Identidad | Nombre, correo, teléfono, fecha de nacimiento y **edad**, nº de cédula |
| Documentos | **Fotos de la cédula**, por URL firmada del bucket privado `cedula-docs` |
| Onboarding | Todo lo que declaró en los tres pasos de bienvenida |
| Examen | Puntaje, resultado, y **las respuestas** — que sí se guardan |
| Capacitación | Puntaje y fecha |
| Visita | Fecha, estado, y lo capturado: fotos, hechos, términos aceptados |
| Historial | Cada acción de admin sobre él, desde `admin_audit` |

**Las acciones dependen del estado**, y la ficha solo muestra las que aplican:

| Estado | Acción |
|---|---|
| `pending_review` | Verificar cédula · Rechazar, con motivo |
| `needs_review` | Pasar a capacitación · Rechazar |
| `visita_pendiente` | Ver o reagendar la visita |
| `approved` | Ver su perfil público · Pausar |

Cada acción **manda el correo que le corresponde** al Pawwer.

### Visitas · `/admin/visitas`

La agenda del operador, agrupada **por zona y por día** —«sábado 12, Cedritos»— para que cada jornada
sean cinco visitas caminando y no cinco travesías por Bogotá. Es la mitad del argumento de densidad.

| Zona | Qué hace |
|---|---|
| **Abrir cupos** | Elegir día, zona y franjas → se escriben en `visita_slots`. Es lo que el Pawwer ve disponible. Hoy los cupos son cuatro franjas fijas **inventadas en el cliente** |
| **Semana** | Visitas agendadas por día y zona, con estado |
| **Demanda** | Barrios con **búsquedas sin resultado** — dónde conviene ir el próximo sábado |
| **Acciones** | Confirmar · reagendar · cancelar · abrir la visita |

### La visita · `/admin/visita/[id]` · MÓVIL

**El único momento humano del producto.** Se usa de pie, con una mano, en casa del Pawwer.

La pantalla recorre el protocolo de `docs/06` **en orden**, y **no deja aprobar sin completarlo**:

```
 1 ─ Cédula en físico          comparar contra las fotos que subió · check con hora
 2 ─ Las cinco fotos           entrada · sala · zona del perro · patio o balcón · dónde duermen
 3 ─ Hechos observados         metros · zonas separadas · exteriores · observaciones
 4 ─ Precios y capacidad       sus servicios con precio y cuántos perros acepta
 5 ─ Disponibilidad            abrir su agenda de los próximos 60 días
 6 ─ Términos                  el Pawwer acepta desde esta pantalla · se guarda versión y hora
 7 ─ Aprobar y publicar        approved + verified · correo de bienvenida
```

**Por qué desde el móvil del admin y no del Pawwer:** en la visita el Pawwer está en
`visita_pendiente` y **su portal lo rechaza**. Se aprueba después de la visita, pero la visita
configura cosas que exigirían estar aprobado. Así el círculo se rompe sin tocar el gate.

**Y las fotos las toma el operador.** La diferencia entre «él dice que tiene patio» y «lo vi» es
literalmente el producto. Por eso los hechos van en columnas `verif_*`, separadas de lo declarado, y
el perfil público las muestra aparte.

**El paso 5 no es opcional:** el Pawwer que se va de la visita sin agenda cargada nunca recibe una
reserva y se apaga en tres semanas.

### Liquidación · `/admin/liquidacion`

El trabajo de cada viernes, que **no se puede automatizar** porque Bold no dispersa a terceros.

| Zona | Qué muestra |
|---|---|
| La semana | Total a transferir y nº de Pawwers |
| Por Pawwer | Nombre, cuidados completados sin pagar, **monto neto**, banco, cuenta —visible para el admin, enmascarada para todos los demás— y certificación bancaria |
| Exportar | 🆕 **Archivo de dispersión masiva** con el formato del banco, para subirlo de una vez. El formato **sigue sin conseguirse** y es un recado de S0 |
| Marcar pagado | En lote, con `mark_payouts_paid` — que existe desde la migración 48 y hoy es inalcanzable desde la app |

**La meta:** que treinta transferencias sean un archivo y dos clics, y que el volumen deje de
importar.

### Métricas · `/admin/metricas`

Para decidir, no para mirar. **Es lo primero que se recorta si S3 se desborda:** no bloquea el
lanzamiento; las colas y el botón de aprobar, sí.

| Bloque | Qué responde |
|---|---|
| **Embudo del Pawwer** | ¿Dónde se pierden? Registro → bienvenida → cédula → examen → capacitación → visita → aprobado, con conversión y tiempo en cada paso |
| **Dinero** | GMV, comisión, ticket promedio — que mueve el punto de equilibrio más que ninguna otra variable |
| **Reservas** | Por estado · tiempo hasta aceptar · **% que va a la bolsa** · **% que muere en `sin_cuidador`** |
| **Demanda sin atender** | Búsquedas sin resultado por barrio y servicio, desde `search_miss`. Es lo que dirige a qué zona ir el sábado |

Gráficas con `recharts` y carga diferida, como `EarningsChart` del Pawwer.

## Flujos del admin

**Un Pawwer, de principio a fin.** Aparece en «cédulas por verificar» → abre la ficha, mira las fotos
de la cédula y la edad → verifica → el Pawwer hace examen y capacitación solo → agenda sobre un cupo
que el admin abrió → el día de la visita, abre `/admin/visita/[id]` en el móvil → recorre los siete
pasos → aprueba → el Pawwer recibe el correo → **aparece en el marketplace**.

**El sábado de visitas.** Durante la semana mira «demanda sin atender» → abre cupos en ese barrio → se
llenan → el sábado hace cinco visitas caminando.

**El viernes.** Abre liquidación → exporta el archivo → lo sube al banco → marca todo como pagado.

---

## 🔀 Matriz de estados de una reserva

Lo que ve cada uno, para el mismo estado interno. **La regla del cliente es que nunca vea un estado
técnico ni un nombre genérico.**

| Interno | Cliente ve | Pawwer ve | Admin |
|---|---|---|---|
| `1` · etapa 1 | *Esperando a Juliana · responde en 42 min* | **Te eligió a ti** · temporizador | — |
| `1` · etapa 2 | *Juliana no pudo. Buscamos otro por el mismo precio* | **Bolsa general** · oportunidad abierta | — |
| `2` · sin pagar | *Pedro aceptó · paga antes de las 3:30 p. m.* · botón de pago ✅ S2 | *Esperando pago · hasta las 3:30 p. m.* · sin chat ni dirección ✅ S2 | — |
| `2` · pagada | *Confirmada con Pedro · empieza el sábado* · dirección visible (S4) | *Confirmada* · dirección del cliente y chat ✅ S2 | — |
| `5` · sin pago a tiempo | *Se venció el plazo para pagar* | *La reserva no se pagó · tu cupo quedó libre* | — |
| `3` | *En curso · termina mañana a las 6 pm* | *En curso* · temporizador | — |
| `4` | *Completada · ¿cómo le fue?* · reseñar · reservar de nuevo | *Completada* · pago pendiente del viernes | Entra a liquidación |
| `5` | *Cancelada* — por quién | *Cancelada* | — |
| `6` | *Nadie pudo tomarla. No se te cobró nada* · buscar de nuevo | — | Cuenta en métricas |

El admin **no aparece** en la columna mientras la reserva está viva. Solo entra cuando hay que pagar.

---

## 🔔 Quién recibe qué

| Evento | Cliente | Pawwer | Admin | Sprint |
|---|---|---|---|---|
| Nueva solicitud directa | — | 🔔 | — | ✅ ya |
| El Pawwer aceptó · pagar | 🔔 ✉️ | — | — | ✅ **S2** · la fila de la campana y el correo ya salen; falta la campana (S5) y Resend |
| Venció el plazo de pago | 🔔 | 🔔 | — | ✅ S2 · sin campana del cliente hasta S5 |
| Reembolso por hacer | — | — | ✉️ | ✅ S2 · a `hola@pawwi.co`, hasta la cola de S3 |
| Salió a la bolsa | 🔔 ✉️ | — | — | S5 |
| Nueva oportunidad en la bolsa | — | 🔔 | — | S5 |
| La tomó otro Pawwer | 🔔 ✉️ | — | — | S5 |
| Nadie la tomó | 🔔 ✉️ | — | — | S5 |
| Pago confirmado | 🔔 ✉️ | 🔔 | — | S2 |
| Cancelación | 🔔 | 🔔 | — | ✅ ya · **el cliente no tiene campana para verla** |
| Reporte del día | 🔔 ✉️ | — | — | S5 |
| Recordatorio 24 h y 2 h | ✉️ | 🔔 | — | S5 |
| Servicio terminado · reseñar | 🔔 ✉️ | — | — | S5 |
| Cédula verificada | — | ✉️ | — | ✅ ya · por `curl` hasta S3 |
| Resultado del examen | — | ✉️ | — | ✅ ya |
| Visita agendada | — | — | ✉️ | ✅ desde S2 · antes solo salía si existía `PAWWI_ADMIN_EMAIL`, que nunca existió en producción: **ninguna visita avisó jamás**. Ahora va a `hola@pawwi.co`, y el correo sigue llevando solo el UUID |
| **Aprobado · ya estás en línea** | — | ✉️ | — | 🆕 **S3** |
| Pago del viernes | — | 🔔 ✉️ | — | S3 |

🔔 campana en la app · ✉️ correo por Resend — que **sigue sin configurar**: sin la clave,
`lib/email.ts` omite el envío y sigue.

---

## 📦 Inventario

Contado por rutas reales (`page.tsx`), no por recuerdo:

| Plataforma | Rutas | ✅ | ⚠️ | 🔨 | 🆕 |
|---|---|---|---|---|---|
| **Cliente** | 18 | 7 | 7 | 3 | 1 |
| **Pawwer** · embudo | 8 | 6 | 2 | — | — |
| **Pawwer** · portal | 15 | 10 | 5 | — | — |
| **Admin** | 7 | — | — | — | **7** |
| **Total** | **48** | **23** | **14** | **3** | **8** |

- **Cliente ⚠️:** Explorar · Reservar (el paso 4 dejó de ser un cartel en S2; queda el Pasaporte) · Mis reservas · el detalle escondido ·
  Mis peludos · el Pasaporte · la Política de Privacidad. 🔨: Favoritos, Mensajes, Mi perfil.
  🆕: el chat del cliente
- **Pawwer ⚠️:** Inicio (referidos) · Ganancias (pago «automático» y «Élite») · Tarifas («Élite») ·
  Disponibilidad y Cuenta de cobro (guards flojos) · el Dashboard y la Visita del embudo
- **Admin:** las siete, desde cero

**El reparto dice algo:** el Pawwer tiene la plataforma más completa y la mejor construida; el
cliente tiene la mitad hecha y la otra mitad en esqueletos; el admin no existe. El orden de los
sprints —operador, cliente, círculo— sigue exactamente ese gradiente.

---

**Pawwi S.A.S.** · NIT 901.937.952-7 · Bogotá, Colombia
