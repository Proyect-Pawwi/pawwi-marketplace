# 06 · Producto — Rediseño 2026

> **Documento maestro del producto.** Define qué es Pawwi, en qué se convierte y por qué.
> Donde este documento contradiga a los `00`–`05`, **manda este**.
> _Última actualización: 2026-09-11_

---

## 🎯 Qué es Pawwi

Pawwi conecta **dueños responsables** con **cuidadores certificados y validados**. Nada más.
Esa frase no es marketing: es la restricción de diseño de la que sale todo lo demás.

> **Pawwi no cuida a tu perro. Pawwi garantiza a quién se lo entregas — y garantiza a quién recibes.**

Pawwi responde por **la verificación**, no por el incidente. Es la única promesa que asume y la
única que puede sostener sin equipo. Todo lo que ocurre después de la conexión —el cuidado, el
transporte, los acuerdos— sucede entre el cliente y el Pawwer.

### Qué NO es Pawwi

- **No es una guardería.** No opera espacios ni cuida animales.
- **No es una aseguradora.** No hay Fondo de Asistencia ni respaldo económico ante incidentes.
- **No es un servicio de transporte.** El traslado lo resuelven el cliente y el Pawwer.
- **No arbitra capacidad ni precio.** El Pawwer decide cuántos perros recibe y cuánto cobra.
- **No modera relaciones.** Sin soporte humano dentro del ciclo de la reserva.

### El problema, y por qué es emocional

Validado en 40+ entrevistas de campo en el norte de Bogotá. El dolor central no es logístico sino
emocional: _«Es como dejarle un hijo a alguien.»_ El 100% de los entrevistados mencionó la
confianza como barrera principal.

La consecuencia de producto ordena todas las prioridades: **la verificación va primero; la
conveniencia va después.** La confianza es el producto; la tecnología es el canal.

---

## 🔄 El cambio de modelo

El Pawwi de los documentos de abril era **una empresa de servicios con un marketplace encima**: el
equipo garantizaba la calidad con visitas, monitoreo, alertas a las 12 h, un fondo económico y
soporte humano. Ese modelo requiere 3–4 personas.

El Pawwi de este documento es uno donde **el sistema garantiza la calidad**. Hay una sola persona,
y su trabajo es construir y mantener el sistema, no operarlo.

### El filtro de diseño

Un mecanismo de confianza sobrevive **solo** si es una de estas tres cosas:

1. **Un filtro de entrada** — se paga una vez, no escala con el volumen.
2. **Un incentivo que se auto-refuerza** — reputación, nivel, comisión, visibilidad.
3. **Una regla que corre sola** — cron, máquina de estados, escrow, timeout.

Todo lo que necesite _«alguien revisa / alguien llama / alguien responde»_ no existe.

### Qué sobrevive al filtro y qué no

| Mecanismo del modelo anterior | Veredicto | Qué lo reemplaza |
|---|---|---|
| Visita domiciliaria | ✅ Sobrevive | Es filtro de entrada. Se mantiene **presencial** |
| Examen y capacitación | ✅ Sobrevive | Ya se autocalifican en código |
| Aprobación manual de fotos | ❌ Muere | Fotos tomadas en la visita |
| Reporte diario obligatorio | 🔀 Muta | Deja de ser obligación policiada → métrica que alimenta el nivel |
| Alerta al equipo si no hay reporte en 12 h | ❌ Muere | Aviso automático al Pawwer + castigo de nivel |
| Muestreo de calidad de reportes | ❌ Muere | Reseñas verificadas |
| Soporte para cancelar | ❌ Muere | Botón con reglas automáticas (`cancel_booking_client` ya existe) |
| Disputas de reseñas | ❌ Muere | Sin edición, sin moderación, política pública |
| Fondo de Asistencia ($1,5 M COP) | ❌ Muere | Intermediación explícita en términos |
| Transporte prestado por Pawwi | ❌ Muere | El Pawwer lo ofrece, o el cliente lo resuelve |
| **Pagos manuales los viernes** | ⚠️ **Sobrevive** | **Bold no dispersa a terceros.** Ver [El dinero](#-el-dinero) |

---

## 📌 Las siete decisiones

| # | Decisión | Nota |
|---|---|---|
| **01** | **Pawwi es únicamente un intermediario** | Los términos lo dicen sin asteriscos |
| **02** | **La visita domiciliaria sigue siendo presencial** | Costo aceptado: el crecimiento de la oferta queda limitado por el calendario de una persona. _Se descartó la verificación remota por video_ |
| **03** | **Se elimina el Fondo de Asistencia** | Pasivo sin fondear; una persona sola no absorbe un siniestro de $1,5 M |
| **04** | **La reserva se ofrece, nunca se asigna** | Dos etapas —directa 1 h, bolsa general 6 h— con derecho de rechazo en las dos. El paso a la bolsa **requiere consentimiento del cliente** |
| **05** | **Lanzamiento en Bogotá completa desde el día uno** | La unidad de densidad es el **conjunto**, no el barrio. La búsqueda deja de cortar por radio |
| **06** | **El transporte ocurre entre las partes** | Pawwi nunca traslada animales |
| **07** | **La capacidad la decide el Pawwer, sin tope de Pawwi** | Pawwi expone capacidad y ocupación; el mercado hace el resto |

---

## 🚪 Las dos puertas

El filtro es **bidireccional**, y esa simetría es el producto. El Pawwer abre su casa; tiene
derecho a saber que del otro lado hay una persona identificada y un perro con historia.

### Puerta del Pawwer

Todo es automático salvo **dos toques humanos** —tres si el examen cae en revisión—, y todos son
filtros de entrada: se pagan una vez por Pawwer y no crecen con el número de reservas, así que pasan
el filtro de diseño. La visita es toda la tesis del producto:

```
registro → revisión de cédula → examen → capacitación → agenda visita
   auto      humano · minutos     auto        auto            auto
                                                                ↓
                                              ┌─────────────────────────────┐
                                              │  VISITA DOMICILIARIA        │
                                              │  humano · una sola vez      │
                                              └─────────────────────────────┘
                                                                ↓
                                                  aprobación · cierra la visita
```

- **La revisión de cédula** es un vistazo de escritorio desde una cola: que las fotos correspondan
  al número y a la fecha de nacimiento que declaró. Existe para no gastar un sábado en alguien que
  no pasa la identidad.
- **El examen y la capacitación** se autocalifican en `lib/exam-pawwer.ts` y `lib/capacitacion.ts`.
  Un examen de 40 a 59 puntos queda en `needs_review` y también lo resuelve una persona.
- **La visita se agenda sola**, sobre cupos que el operador abre por zona. Hoy esos cupos están
  inventados en el cliente —cuatro franjas fijas de lunes a viernes—; la agenda real la modela S3.
- **La aprobación no es automática**: la da el operador al terminar la visita, y es lo que publica
  el perfil. Hoy no existe en el código — ver [Estado del código](#-estado-del-código).

### Puerta del cliente

Cero intervención humana. Explora libre sin registrarse; el filtro aparece **solo al reservar**.

| Momento | Qué se pide | Dónde vive |
|---|---|---|
| Explorar | Nada | — |
| Guardar favorito | Registro ligero | Supabase Auth |
| Reservar | Pasaporte del perro: salud, comportamiento, rutina, vacunas | Migración **57** · `dog` |
| Reservar | Cédula (celular por OTP → v1.1) | Migración **58** · `client` |

**El dato exacto aparece cuando hay compromiso firme, en las dos direcciones — y el compromiso
firme es el pago.** El Pawwer ve la dirección del cliente **cuando el cliente paga** (migración 68);
el cliente verá la del Pawwer también al pagar (S4). Antes de eso, los dos ven barrio y distancia
aproximada. Es la misma regla, simétrica.

> Hasta el 2026-09-11 este párrafo decía que el Pawwer la veía «al aceptar (migración 65)». No era
> así: en la etapa 1 `pawwer_id` viene puesto desde la creación, y la 65 solo tapó a los candidatos
> de la bolsa, así que **el Pawwer elegido veía la casa del cliente antes de aceptar nada**. La 68
> lo corrige y retrasa el dato hasta el pago.

**No hay chat antes de reservar.** El Pawwer publica sus FAQ y el Pasaporte hace que la información
del perro viaje con la solicitud. Abrir el chat antes sería el camino más corto a que cierren el
trato por fuera — que es exactamente lo que el bloqueo de teléfonos del chat existe para evitar.

> Las migraciones 57 y 58 se escribieron en julio como «fases futuras». En este diseño **son la
> mitad del producto**, y la estructura ya está en la base de datos.

---

## 🏠 La visita como ceremonia de activación

Si la visita es el único momento humano, tiene que absorber **todo** el trabajo humano del ciclo de
vida del Pawwer. Sesenta minutos, y esa persona no vuelve a necesitar a nadie.

**Protocolo:**

- Verificar la cédula en físico
- Fotografiar el hogar con set estándar: entrada · sala · zona del perro · patio o balcón · dónde duermen
- Registrar **hechos observados** del espacio (metros, separación de zonas, exteriores)
- Confirmar examen y capacitación (ya autocalificados)
- **Configurar disponibilidad y precios ahí mismo**, en el celular del Pawwer
- Firmar el contrato digital y tomar la foto de perfil
- Registrar la **aceptación de términos**: qué versión, cuándo y desde dónde
- Activar `verified` y publicar el perfil
- Explicar la regla de oro: toda comunicación ocurre dentro de Pawwi

> Configurar la disponibilidad juntos importa más de lo que parece: el Pawwer que se va sin
> disponibilidad cargada nunca recibe una reserva y se apaga en tres semanas.

> **Todo esto se captura desde el móvil del operador**, en `/admin/visita/[id]` — no desde el
> celular del Pawwer. La razón no es solo comodidad: en la visita el Pawwer está en
> `visita_pendiente` y **su portal lo rechaza**, porque el gate exige `approved`. Se aprueba
> después de la visita, pero la visita configura cosas que exigirían estar aprobado. Se construye
> en S3 · El operador.
>
> Y las **fotos del hogar las toma el operador**, no el Pawwer. Es lo que la visita venía a
> garantizar: la diferencia entre «él dice que tiene patio» y «lo vi» es literalmente el producto.

### ⚠️ La línea que no se cruza

Ver el espacio invita a validar la capacidad — _«esta casa no da para seis perros»_. Pero si Pawwi
valida capacidad, vuelve a poner la regla que la decisión 07 eliminó.

Los hechos observados se **publican como datos del perfil**, no como tope.
**Pawwi expone; no arbitra.**

Van en columnas propias de `pawwer` —`verif_metros_zona`, `verif_zonas_separadas`,
`verif_exteriores`, `verif_observaciones`— **separadas de lo que el Pawwer declaró de sí mismo**
en el onboarding (`tipo_inmueble`, `areas_externas`, `mi_espacio`). Esa separación es lo que
permite que el perfil distinga «declarado» de «verificado», que es la promesa entera.

### Cómo se programan

Los cupos se agrupan **por zona y por día** — «sábado 12, Cedritos» — para que cada jornada sean
cinco visitas caminando y no cinco travesías por Bogotá. La prioridad no es por orden de llegada
sino **dirigida por demanda**: las búsquedas sin resultado indican dónde va el próximo sábado.

---

## ⚡ Motor de reservas

> ### ⚠️ Un error de análisis que conviene no repetir
>
> Una versión anterior de esta sección proponía **retirar la escalación**, alegando que empujar
> solicitudes a Pawwers que no las habían pedido creaba un indicio de subordinación laboral.
> **Era falso, y se corrigió el mismo día.**
>
> Uber, DiDi, Yango y Rappi hacen exactamente eso: ofrecen trabajo que el trabajador no pidió.
> Lo que genera riesgo laboral es **obligar a aceptar** o **castigar el rechazo**, no ofrecer.
> El patrón defendible es justamente **oferta con derecho de rechazo**, que es el que Pawwi ya
> tenía en `decline_solicitud`.
>
> Lo que sí era riesgoso fue una **auto-confirmación sin salida** que se diseñó brevemente: la
> reserva nacía confirmada y el Pawwer solo podía cancelar, pagando con su nivel. Un derecho que
> se castiga al ejercerlo no es un derecho. Esa idea se descartó: **toda reserva pasa por la
> aceptación del Pawwer.**

La reserva **se ofrece, nunca se asigna.** Dos etapas, con derecho de rechazo en las dos.

### Etapa 1 · Directa — 1 hora, exclusiva de quien el cliente eligió

```
El cliente elige un Pawwer y reserva  →  estado 1 (pendiente)
   →  el Pawwer acepta  →  se bloquea el cupo; el cliente tiene 2 horas para pagar
   →  el cliente paga   →  CONFIRMADA, se abre el chat
   →  no paga a tiempo  →  vence y el cupo se libera solo
```

Si declina o se le vence la hora, la reserva pasa a la etapa 2 — **pero solo si el cliente lo
consintió** (`booking.allow_pool`). Rechazar es su derecho; sustituirle la casa al cliente sin
permiso no es una consecuencia aceptable de ese derecho.

### Etapa 2 · Bolsa general — 6 horas, toda la ciudad

La reserva se le muestra a todos los Pawwers cualificados con cupo suficiente, y **gana el primero
en aceptar**. El total **está congelado** desde que se creó: la bolsa solo la ven Pawwers cuyo
precio publicado sea **igual o menor**, así que quien la tome gana **más que su tarifa de lista** y
el cliente nunca paga más de lo que aceptó.

> **Pawwi solo pone techo, nunca piso.** El filtro tenía antes un piso del 80% que excluía a los
> Pawwers más baratos — Pawwi arbitrando el mercado, justo lo que prohíbe la decisión 07. Con solo
> techo, la bolsa se vuelve un incentivo: hay reservas que rinden por encima de la tarifa propia.

Si nadie acepta en esas 6 horas → `sin_cuidador`. **Siete horas en total, no trece:** antes había
una fase intermedia de «±20% de precio» con otras 6 horas, que no aportaba nada porque la bolsa ya
es toda la ciudad, y dejaba al cliente medio día sin saber si tenía cuidador.

### La confianza no se transfiere en silencio

El cliente no compró «un cuidado»: eligió **esa** casa después de mirar sus fotos, sus reseñas y su
perfil. Que la reserva termine en otra sin que se entere convierte a Pawwi en la guardería
impersonal que la clienta evita — y hace más daño que un `sin_cuidador` honesto.

Por eso se le pregunta **al reservar, una sola vez**: _«Si Juliana no puede, ¿buscamos otro cuidador
verificado por el mismo precio?»_. Si dice que no, la reserva muere en la etapa 1 y elige de nuevo.

Y hay una segunda garantía, estructural: **como el pago va después de la aceptación, el cliente no
puede terminar con otro Pawwer sin haber pagado activamente por él.** Ve quién la tomó y decide con
la tarjeta en la mano. La ventana de aprobación no hay que construirla — el paso de pago *es* la
ventana.

### Estados

```
1 pendiente · 2 confirmada · 3 en curso · 4 completada · 5 cancelada · 6 sin_cuidador
```

`1 pendiente` es el estado normal de arranque en las dos etapas: una reserva creada que aún no
tiene la aceptación del Pawwer. Al aceptar pasa a `2` **sin pagar** —`charged_at` vacío—: el cupo
está bloqueado pero la reserva no es firme, y el Pawwer y el cliente lo ven así, nunca como
«Confirmada». Con el pago queda `2 confirmada`. Si el pago no llega en las dos horas (más 20
minutos de gracia para PSE), pasa a `5` con `cancelled_by = 'system'`, que no cuenta contra el nivel
del Pawwer. `6 sin_cuidador` es el final si nadie aceptó en las siete horas — y en ese caso **nunca
se movió un peso**.

Una reserva sin pagar **no empieza**: el avance a `3 en curso` exige el pago. Las aceptadas antes de
S2 —con `payment_due_at` vacío— se respetan como confirmadas.

Avance por tiempo automático, consciente de servicios que cruzan la medianoche, zona
`America/Bogota`. Lo ejecuta `pg_cron` cada minuto.

---

## 🐕 Capacidad y precio

Aquí es donde Pawwi se vuelve un marketplace de verdad: el Pawwer fija capacidad y precio, y el
mercado los valora. **Más perros, menos precio. Menos perros, más precio.** Pawwi no interviene.

### Por qué esta decisión cambia la economía

Las visitas presenciales son el límite del negocio, pero la capacidad de la red no está atada al
número de Pawwers sino al número de **perros simultáneos**:

| Configuración | Perros simultáneos |
|---|---|
| 15 Pawwers × 1 perro | 15 |
| 15 Pawwers × 3 perros promedio | **45** |

Los mismos quince sábados, el triple de mercado. **Cada visita compra tres veces más capacidad
transaccional.**

### El máximo no es lo que el cliente necesita saber

_«Acepta hasta 4 perros»_ no sirve para decidir. Hay que mostrar cuántos perros habrá **el día que
se reserva**:

```
Sábado 14 · Tu perro sería 1 de 3 · Juliana acepta hasta 4 en Daycare
```

El descubrimiento de precio solo funciona sobre la ocupación real.

### ✅ Las dos capacidades, unificadas en S1

Convivían **dos sistemas de capacidad**: `service_X_Pawwer.max_animals`, por servicio, que era lo
que veía el cliente, y `availability.slots_remaining`, por día, que era lo que `accept_booking`
descontaba de verdad. Con capacidad 1 nadie lo notaba; con capacidad 4 era un error garantizado.

**Resuelto en la migración 61:** el cupo se mide en **perros** —una reserva de 2 perros consume 2
cupos—, `create_booking` hace cumplir `max_animals`, y desapareció el tope de 10 de
`update_service_rules`. La 63 añadió `availability.slots_total`, que es lo que permite mostrar la
ocupación real del día.

### La compatibilidad se vuelve obligatoria

Con esta decisión, `dog.friendly_dogs` (migración 57) pasa a ser indispensable:

- Si la reserva pone al perro con otros y `friendly_dogs = false` → advertencia antes de confirmar
- El Pawwer ve `friendly_dogs` y `separation_anxiety` del perro entrante **antes** de aceptar

Las dos cosas están construidas desde S1 —la advertencia en el paso 3, los chips en el portal del
Pawwer—, pero **nadie puede escribir el dato todavía**: el formulario del perro no tiene el campo.
Hasta que el Pasaporte de S4 lo pida, la advertencia no se dispara nunca y el Pawwer ve «sin
informar».

### El mensaje cambia de promesa

Un Pawwer que acepta ocho perros _es_ una guardería pequeña. La decisión no lo prohíbe: lo revela.

- ~~«En Pawwi tu perro nunca está con 20 perros»~~ — garantía de Pawwi
- **«En Pawwi tú decides con cuántos perros está el tuyo»** — elección informada

---

## 🚗 Transporte

Deja de negociarse por reserva y pasa a ser un **atributo del Pawwer**.

| | Antes | Ahora |
|---|---|---|
| Quién decide | El Pawwer, después de aceptar | El Pawwer, al configurar su perfil |
| Opciones | Pawwer o Pawwi | Pawwer, o el cliente lo resuelve |
| Fuente de verdad | `booking.transport_provider` | `pawwer.transport_price` |
| Fricción | Modal bloqueante tras aceptar | Ninguna |

**Se desmontó en S1** (migración 60): `set_transport_provider`, el modal bloqueante de
`BookingDetail`, la rama `pawwiTransp` de `cuidados` y su tipo en `actions/portal.ts`. Las columnas
`booking.transport_provider` y `transport_decided` siguen en la tabla, **congeladas** y comentadas
como tales, para no romper el histórico.

### Y se convierte en palanca de crecimiento

- Pawwer que transporta → su mercado es **Bogotá entera**
- Pawwer que no → su mercado es quien esté dispuesto a llegar hasta él

Más mercado → más reservas → más reseñas → más nivel → más visibilidad. Se auto-refuerza y presiona
al resto a ofrecerlo. Pasó de centro de costo a palanca que se promueve sola.

### La búsqueda no corta por radio

La distancia deja de ser filtro binario y pasa a ser componente del precio.
Orden: **nivel → rating → distancia**. Nunca una pantalla vacía.

```
Juliana M. · Suba · 6,2 km · ★4,9 (12) · Ranger · Daycare $65.000 · recoge y entrega por $18.000
```

---

## 💰 El dinero

Total de una reserva = `cuidado + transporte`, fijado **al crear** la solicitud: el cliente nunca
paga más que eso. La comisión se calcula siempre en el backend **al aceptar**, con el nivel **del
Pawwer que acepta**, y queda **congelada e inmutable** en `booking.commission_rate`.

> Hasta la migración 68 se congelaba al crear, con el nivel del Pawwer elegido: si la reserva la
> tomaba otro desde la bolsa, heredaba una tasa ajena. Como el cliente paga después de la
> aceptación, moverla no le cambia nada a él.

| Concepto | Pawwer | Pawwi |
|---|---|---|
| Cuidado · estándar | 75% | 25% |
| Cuidado · nivel Ranger | 80% | 20% |
| Transporte (si lo hace el Pawwer) | 75% | 25% |

### Pasarela: **Bold**

Cuenta de comercio **ya aprobada y apta para recibir pagos**. Resuelve la ambigüedad Wompi/Bold que
los documentos anteriores nunca cerraron.

### El cobro, paso a paso · S2, migración 68

1. **El Pawwer acepta** → se bloquea el cupo y se abre un plazo de **dos horas** para pagar, que
   nunca pasa del inicio del servicio (con un mínimo de 15 minutos)
2. **El cliente paga** en el **checkout de Bold**, que se abre con una firma que calcula el servidor
   y **se cierra solo** al vencer el plazo. Pawwi nunca toca datos de tarjeta
3. **Bold confirma** por webhook —o por la consulta al volver del checkout, que en pruebas es la
   única vía— y el servidor sella **`charged_at`**: la reserva queda confirmada y se abre el chat.
   El sello es idempotente: el webhook y la consulta pueden llegar los dos, repetidos y en cualquier
   orden, sin cobrar ni confirmar dos veces
4. **Sin pago a tiempo**, la reserva vence y el cupo se libera. Si un pago llega tarde, se anota
   para reembolso

> ⚠️ **`paid_at` no es el pago del cliente.** Es cuándo Pawwi le **transfiere al Pawwer**, y lo
> leen Ganancias y `mark_payouts_paid`. El pago del cliente es `charged_at`. El plan original de S2
> los confundía — ver `07`.

### Cancelaciones y reembolsos · decidido el 2026-09-11

| Quién cancela | Cuándo | Qué pasa con el dinero |
|---|---|---|
| El cliente | Antes de pagar | No hay nada que devolver |
| El cliente | Pagado, con **48 h o más** de anticipación | Se le devuelve el **100%** |
| El cliente | Pagado, con **menos de 48 h** | **No hay reembolso**, y el Pawwer cobra su parte: bloqueó el día |
| El Pawwer | Cuando sea | Se le devuelve al cliente el **100%**, y la cancelación cuenta contra su nivel |

**Bold no tiene API de reembolsos.** Solo anula pagos con tarjeta de **crédito**, **el mismo día
antes de las 9 p. m.**, desde su panel. Todo lo demás es una transferencia desde la cuenta de Pawwi.
Por eso los reembolsos se **anotan solos** —en `booking_payment.refund_amount`, con aviso por correo
al equipo— y se **ejecutan a mano**. Es la segunda pieza, junto con la liquidación de los viernes,
que no pasa el filtro de diseño; a volumen bajo son casos contados, y la cola para gestionarlos llega
en S3, en `/admin`.

La regla de las 48 horas vive en **un solo sitio**: `cancel_booking_client` la aplica y
`get_cancellation_terms` la muestra antes de confirmar, con la misma cuenta. La pantalla nunca promete
un reembolso que no llega. Va en la sección 10 de los términos, pendientes del abogado.

### ⚠️ La excepción al diseño: el pago al Pawwer es manual

**Bold no dispersa a terceros.** Pawwi cobra el 100% y transfiere el 75% a cada Pawwer por su
cuenta. Es la única pieza del producto que **no pasa el filtro de diseño** —requiere una persona— y
no es una elección: es una limitación de la pasarela.

El costo real: a 30 Pawwers con cuatro servicios al mes son ~30 transferencias semanales.

**La mitigación es de diseño, no de disciplina:** la liquidación semanal no produce una lista para
transcribir, sino un **archivo de dispersión masiva** que se sube al banco de una sola vez.
Treinta transferencias se vuelven un archivo y dos clics, y el volumen deja de importar.

Piezas que ya existen: `booking.paid_at`, `booking.accepted_at`, `get_pawwer_payout_summary` y
`mark_payouts_paid` (restringida a `service_role` — un Pawwer no puede marcarse pagado a sí mismo).

### Tarifa Bold — confirmada (2026-09-07)

Modalidad elegida: **«Recibe tu dinero al siguiente día»** a la Cuenta Digital Bold (gratuita). Es
0,6% más barata que las otras dos, y la velocidad no importa porque los pagos a los Pawwers son
manuales y semanales de todos modos.

| Medio de pago en línea | Tarifa |
|---|---|
| Visa / Mastercard | **2,99% + $900** |
| Otras tarjetas | 3,29% + $900 |
| PSE, Bancolombia, billeteras | **2,89% + $900** *(sin retenciones para PSE)* |
| Tarjetas internacionales | +1% adicional |

PSE es más barato que tarjeta y evita retenciones: conviene dejarlo visible como medio de pago.
**El cargo fijo de $900 hace la tarifa regresiva** — ver la sensibilidad por ticket en
[Economía unitaria](#-economía-unitaria).

### Niveles

Fuente única de reglas: `compute_pawwer_level()`. Recálculo por evento y cron diario a las 8:00.

| Nivel | Reseñas | Rating | Cancelación | Beneficio |
|---|---|---|---|---|
| Nuevo | — | — | — | Piso |
| Súper | ≥ 5 | ≥ 4,5 | ≤ 10% | Visibilidad |
| Ranger | ≥ 15 | ≥ 4,8 | ≤ 2% | Comisión 20% + prioridad |

> ⚠️ **Contradicción a resolver.** El marketing promete «comisión baja al 20% por lealtad», pero el
> umbral real de Ranger es mucho más estricto que cualquier documento anterior. Un Pawwer que lea
> la promesa rara vez calificará. Hay que alinear el mensaje con la regla, o la regla con el mensaje.
>
> **Y es peor de lo que decía este párrafo.** `/ingresos` y `perfil/tarifas` calculan la élite por
> su cuenta —`rating ≥ 4.8 && reviews ≥ 15`— sin el `cancel_rate ≤ 0.02` ni la actividad de 30 días
> que sí exige `compute_pawwer_level`. **Un Pawwer puede leer «ganas 20%» y que se le cobre 25%**,
> porque la comisión que aplica sale de `booking.commission_rate`, congelada por el backend. Se
> corrige en S3 leyendo `pawwer.level` en vez de recalcular.

---

## 📈 Los cinco loops de crecimiento

El crecimiento no viene de pauta. Viene de que cada Pawwer verificado siembra su propio
micro-mercado, y de que los referidos abaratan **a la vez** la adquisición y la verificación.

### A · El Pawwer siembra su propio mercado

```
Pawwer verificado → activa su conjunto → vecinos reservan → reseñas
   → sube de nivel → más visibilidad → más reservas ⟲
```

No necesitas diez Pawwers en un barrio: necesitas que cada Pawwer active su edificio.

### B · Pawwer refiere Pawwer — el loop que resuelve el cuello de botella

```
Pawwer activo refiere 3 vecinos → mismo conjunto → una sola tarde, 4 visitas
   → 4 micro-mercados nuevos ⟲
```

El referido no solo baja el CAC: **vuelve las visitas geográficamente densas.** Un sábado disperso
por Bogotá son 3–4 visitas; un sábado en un conjunto referido son 6–8. **Es el único loop que ataca
las dos restricciones a la vez.**

### C · Cliente refiere cliente

```
Servicio ★5 → solicitud automática de referido → vecino llega con confianza previa → reserva ⟲
```

El momento de pedirlo es inmediatamente después del servicio, no tres días más tarde.

### D · El cliente que se vuelve Pawwer

```
Cliente con N reservas completadas → «¿Y si tú también cuidaras?» → embudo de Pawwer ⟲
```

Sofía tiene 28–45 años, trabaja híbrido, vive en apartamento y ama a los perros: es literalmente el
perfil del Pawwer Vecinal. **Demanda que se convierte en oferta, sin costo de adquisición.**
No estaba en ningún documento anterior.

### E · Saturación de conjunto

```
Densidad en un conjunto → «3 Pawwers verificados en tu conjunto» → conversión sin costo ⟲
```

---

## 📊 Economía unitaria

| Métrica | Valor |
|---|---|
| Ticket promedio (supuesto del modelo) | $100.000 COP |
| Tarifa Bold en línea (siguiente día) | 2,99% + $900 → **3,89% efectiva** sobre $100.000 |
| Ingreso neto Pawwi por transacción | **$21.110 COP** (con ticket de $100.000) |
| Costos fijos mensuales | $1.480.000 COP |
| Marketing mensual | $400.000 COP |
| GMV año 1 (conservador) | $145.500.000 COP |
| EBITDA año 1 (conservador) | $1.850.000 COP · margen 5,1% |

### Dos errores del modelo anterior

**El punto de equilibrio no es 68 — y depende del ticket promedio.**
Dos errores acumulados: el 68 dejaba fuera los $400.000 de marketing, y el neto de $22.000 asumía
una tarifa plana del 3%. La tarifa real de Bold es **2,99% + $900**, y ese cargo fijo la vuelve
**regresiva**: castiga más los tickets bajos, que son justamente los servicios más frecuentes.

| Ticket | Servicio | Tarifa efectiva | Neto Pawwi | Equilibrio |
|---|---|---|---|---|
| $50.000 | Daycare económico | **4,79%** | $10.105 | 186 trans/mes |
| $70.000 | Daycare típico | 4,28% | $14.507 | 130 trans/mes |
| $100.000 | *Supuesto del modelo* | 3,89% | $21.110 | **89 trans/mes** |
| $200.000 | PawwiTravel | 3,44% | $43.120 | 44 trans/mes |

**Subir el ticket promedio es la palanca financiera más potente que existe:** pasar de $70.000 a
$100.000 baja el equilibrio un tercio. Refuerza algo que ya sabíamos por el JTBD — PawwiTravel es el
trabajo de mayor valor, y ahora también el de mejor margen. Empujar estadías largas vale más que
empujar volumen de daycare barato.

⚠️ El Lean Canvas pone Daycare en $50.000–$70.000 y Nightcare en $60.000–$90.000, así que **el
ticket promedio real probablemente esté por debajo de los $100.000** que asume el modelo.

_Contrapeso:_ si hoy no hay salarios de $1.400.000, los fijos caen a ~$80.000 (celular + hosting) y
el equilibrio se desploma por debajo de diez transacciones.

**El LTV/CAC está invertido.**
El Lean Canvas presentaba LTV $300.000 contra CAC $80.000 = 3,75×. Pero esos $300.000 son **lo que
gasta el cliente**, no lo que gana Pawwi. Descontando comisión y pasarela, el LTV real de Pawwi por
cliente (3 reservas de $100.000) es **$63.330**:

| Canal | CAC | LTV real Pawwi | Ratio | Veredicto |
|---|---|---|---|---|
| Pauta (Lead Ads) | $80.000 | $63.330 | **0,79×** | ❌ Pierde plata |
| Referido | $20.000 | $63.330 | 3,17× | ✅ Viable |
| Grupos de WhatsApp | $0 | $63.330 | ∞ | ✅ Viable |

**Con pauta, entre más creces más pierdes.** Por eso los cinco loops no son una función opcional de
crecimiento sino la única vía.

**El problema de la frecuencia.** El uso es episódico: emergencia laboral 4–8 veces al año, viaje
2–4, primera búsqueda una sola vez. Solo el «día ocupado» es semanal. **Sin paseos, el LTV por
cliente es bajo** — es el siguiente movimiento estratégico.

---

## 🧱 Stack técnico

| Capa | Tecnología | Nota |
|---|---|---|
| Framework | **Next.js 16.3.4** · App Router · Turbopack | `middleware` se renombró a `proxy` |
| UI | React 19.2.4 · TypeScript 5 · Tailwind v4 | Tokens en `app/globals.css`, sin `tailwind.config.js` |
| Runtime | **Node v20 LTS** | v21+ rompe `@swc/helpers` y `next dev` muere en silencio |
| Backend | Supabase — Postgres, RLS, Auth, Realtime, Storage | `@supabase/ssr` 0.10.3 |
| Cron | pg_cron dentro de Supabase | Reemplazó a la Edge Function, que daba 403 |
| Mapas | `@vis.gl/react-google-maps` | Geocoding y autocomplete de barrios |
| Validación | zod 4 | Formularios a mano, sin react-hook-form |
| Gráficas | recharts 3 | Carga diferida |
| Pagos | **Bold** | Cuenta aprobada, sin integrar. Sin dispersión a terceros |
| Email | **Resend** vía API directa | `lib/email.ts`. Dominio `pawwi.co` verificado el 2026-09-15; remitente `hola@pawwi.co` |
| Deploy | **Vercel** | Producción en **`https://app.pawwi.co`**, HTTPS con Let's Encrypt. Cada push a `main` despliega. Detalle en [`08`](./08-INFRAESTRUCTURA.md) |

### Identidad visual

| Token | Hex | Uso |
|---|---|---|
| cream | `#FFF1EB` | Fondo principal de pantallas |
| midnight | `#120A2B` | Texto primario, botones dark, BottomNav |
| tangerine | `#FF7031` | CTA principal, acentos, FAB |
| plum | `#F7AEF1` | Blobs de atmósfera |
| blue-ice | `#92C0E9` | Acentos secundarios |

Tipografía: **Plus Jakarta Sans** (`font-sans`, obligatoria en la raíz de toda pantalla) ·
**Montserrat Alternates** (títulos) · **Montserrat** (cuerpo).
Jerarquía siempre al extremo: `font-black` en títulos, nunca `font-semibold` en algo importante.

Detalle completo del design system en [`04-BACKEND-Y-SEGURIDAD.md`](./04-BACKEND-Y-SEGURIDAD.md).

---

## 🏗️ Arquitectura

### Rutas

- `pawwi.co/` — marketplace y buscador (la home **es** la búsqueda; no existe `/buscar` aparte)
- `pawwi.co/pawwer/[id]` — perfil público del Pawwer
- `pawwi.co/booking/nuevo` — wizard de reserva de cuatro pasos
- `pawwi.co/mis-*` — área del cliente: reservas, mascotas, favoritos, mensajes, perfil
- `pawwi.co/pawwer/*` — portal del Pawwer, login siempre separado del cliente

### Patrón de datos

El frontend **nunca escribe directo** en tablas sensibles. Los server actions delegan toda la
autorización a RPCs `SECURITY DEFINER` que validan contra `auth.uid()`. La escritura directa que
queda para usuarios autenticados es `dog`, `profile`, `exam_results` y `capacitacion_results`.

La de `visita_domiciliaria` se cerró en el hotfix (migración 66). **Las dos de resultados se cierran
en S3**, y no por un agujero que exista hoy —el cambio de estado del embudo ya es solo de
`service_role`— sino por el que abriría el panel: la ficha del admin decide `needs_review` leyendo
esas filas, y hoy **el Pawwer puede reescribir las suyas** —puntaje, resultado y respuestas— por
REST. Sus policies son `FOR ALL` sobre las filas propias y ninguna migración les revoca la
escritura.

### Tiempo real

`booking`, `booking_candidates`, `messages` y `notifications` están en la publicación de Supabase
Realtime. Presencia por latido cada 30 s con estados en línea / ausente / desconectado.

### Almacenamiento

Públicos: `dog-photos`, `pawwer-avatars`, `pawwer-images`, `chat-photos`.
Privados: `cedula-docs`, `pago-docs`. Todos con inserción restringida a la carpeta del propio usuario.

---

## 🛡️ Seguridad

Auditado el 2026-09-07 y otra vez el 2026-09-10. Sigue siendo la parte más sólida del proyecto,
pero **la primera auditoría se equivocó dos veces**, y la corrección está abajo.

| Control | Estado |
|---|---|
| Funciones `SECURITY DEFINER` | Todas con `SET search_path` **salvo una**: `delete_availability` (mig 06) · la corrige la **migración 68**, de S2. *Leído de los archivos el 2026-09-11; su verificación lo confirma contra `pg_proc`* |
| RPC que confiaban en el cliente | 🔒 Las del embudo —examen y capacitación— eran llamables por REST con el resultado a escribir. **Cerradas en el hotfix** (migs 66–67) |
| Firmas huérfanas de una RPC | Tres de `complete_pawwer_onboarding`, una sin control de mayoría de edad · eliminadas (mig 67) |
| Políticas RLS | 52 sobre 16 tablas *(conteo del 2026-09-07)* |
| Escritura directa a tablas sensibles | Revocada (mig 44 y, para la visita, mig 66). Quedan `exam_results` y `capacitacion_results` · S3 |
| `dangerouslySetInnerHTML` en todo el proyecto | 0 |
| Inyección SQL | Imposible — parámetros enlazados. Todo el `EXECUTE` que existe es DDL que corre al migrar (mig 50 y tres policies); ninguna función arma SQL con datos del usuario |
| PII (cédula, cuenta de pago) | Escritura por RPC, lectura enmascarada |
| Dirección del cliente | Exacta solo para el Pawwer que aceptó, **y solo cuando el cliente pagó**; a los demás, barrio y ~1 km (migs 65 y 68) |
| El sello del pago | `record_booking_payment` es solo de `service_role`, y el estado que sella viene siempre de Bold —webhook firmado o consulta servidor a servidor—, nunca del navegador (mig 68) |
| Webhook de pagos | Firma HMAC obligatoria. La firma de **modo pruebas** —llave vacía, que cualquiera fabrica— se rechaza salvo que se encienda a mano, y en producción siempre |
| Moderación del chat | Server-side: bloquea correos y teléfonos |
| Fotos del chat | Solo del bucket propio; MIME y tamaño validados |

> ### Los dos errores de la auditoría del 2026-09-07
>
> **1. Decía «no queda deuda» y había una vulnerabilidad viva.** `set_pawwer_exam_result` y
> `set_pawwer_capacitacion_result` recibían del cliente el resultado a escribir y conservaban el
> `EXECUTE TO PUBLIC` por defecto: cualquier Pawwer podía certificarse a sí mismo. Se encontró tres
> días después y se cerró ese mismo día. Ver el hotfix en [`07`](./07-PLAN-CONSTRUCCION.md).
>
> **2. Decía que las cuatro funciones sin `search_path` de la migración 06 se habían reemplazado en
> la 25.** Solo dos: `create_booking` se redefinió y `revert_booking` se eliminó. A
> `upsert_availability` y `delete_availability` la 25 solo les hizo `REVOKE`/`GRANT` — sus nombres
> aparecen en ese archivo, y eso bastó para darlas por arregladas. La primera se corrigió de rebote
> en la 63; **la segunda la corrige la 68**, y hasta entonces la llama el calendario del Pawwer.
>
> El riesgo práctico de la segunda es bajo —solo la ejecuta `authenticated` y usa nombres
> calificados—, pero la lección vale más que el arreglo: **que el nombre de una función aparezca en
> una migración no significa que la migración la haya cambiado.** La comprobación correcta es contra
> `pg_proc` en la base, no contra los archivos — ver la consulta en
> [`08`](./08-INFRAESTRUCTURA.md), apartado «Base de datos».

**Anti-leakage:** los teléfonos nunca se exponen y toda comunicación ocurre en el chat de una
reserva. Sin el Fondo de Asistencia, **el ancla del lado del Pawwer pasa a ser su nivel** — irse
cuesta la comisión del 20%, la visibilidad y el flujo de clientes nuevos.

---

## 📍 Estado del código

| Métrica | Valor |
|---|---|
| Código de aplicación | ~19.500 líneas |
| Migraciones SQL | 67 archivos · 8.979 líneas |
| `tsc --noEmit` | 0 errores |
| ESLint | 16 errores · 8 avisos |
| Cron activos | 2 — reservas (cada minuto) y niveles (8:00) |

| Pieza | Estado |
|---|---|
| Marketplace, buscador y perfil público | ✅ Construido |
| Wizard de reserva de 4 pasos | ✅ Construido |
| Embudo del Pawwer (registro, examen, capacitación, agendar visita) | ✅ Construido |
| 🔴 …pero **el embudo no cierra** | `visita_pendiente → approved` no existe en el código y `verified` solo lo pone el seed: ningún Pawwer real llega al marketplace. La visita no tiene herramienta. Se resuelve en **S3 · El operador** |
| Portal del Pawwer (inicio, cuidados, chat, ganancias, perfil, tarifas) | ✅ Construido |
| ⚠️ …pero **tres pantallas prometen lo que el sistema no cumple** | Pago «automático», «Élite» mal calculado, referidos sin atribución. Ver S3 en [`07`](./07-PLAN-CONSTRUCCION.md) |
| Ciclo de vida por cron | ✅ Construido |
| Motor de escalación · **dos etapas** | ✅ Construido, simplificado en S1 |
| Chat con fotos, moderación y tiempo real | ✅ Construido |
| Reseñas, niveles y presencia | ✅ Construido |
| Ledger de pagos y cuenta de cobro imprimible | ✅ Construido |
| Estructura del Pasaporte y del KYC (migs 57 y 58) | 🔨 Solo columnas |
| Portal del cliente (favoritos, mensajes, perfil) | 🔨 Esqueleto |
| Deploy | ✅ **`app.pawwi.co`** |
| Pagos | 🔨 **S2 en curso** — cobro, webhook y checkout escritos (mig 68, `lib/bold.ts`); falta correr la migración y probar |
| Correos | ✅ **Resend funcionando** desde el 2026-09-15 · los avisos que faltan son de S5 |
| Portal admin | 🆕 **no existe** y **bloquea el lanzamiento** · S3 |
| Referidos, reporte diario | ⏳ S6 · S5 |

El inventario completo de las 48 rutas, con el estado de cada una, está en
[`09-DISENO-PLATAFORMAS.md`](./09-DISENO-PLATAFORMAS.md).

---

## ❓ Decisiones abiertas

1. **Anti-leakage del lado del cliente sin el Fondo.** Del lado del Pawwer sigue siendo fuerte
   (nivel, comisión, flujo). Del lado del cliente queda débil: decidir si se acepta —el valor de
   Pawwi es el descubrimiento, no la retención eterna— o si algo lo reemplaza.
2. **Qué cuenta como reporte diario** y cuánto pesa en el cálculo del nivel.
3. **Precio bruto o neto para el Pawwer.** Los documentos viejos dicen tres cosas distintas: que ve
   lo que recibe, que ve el desglose completo, y que nunca ve la comisión. El código eligió una y el
   marketing dice otra.
4. **Umbral de lealtad.** Alinear la promesa del 20% con la regla real de Ranger, o al revés. Parte
   del problema ya tiene arreglo en S3: `/ingresos` y `tarifas` dejarán de recalcular la élite por
   su cuenta y leerán `pawwer.level`. Lo que sigue abierto es si la regla es demasiado estricta.
5. **Si los 15 Pawwers actuales ya tuvieron visita domiciliaria.** Con el lanzamiento en enero ya
   no mueve la fecha —hay sábados de sobra—, pero sigue sin responderse.
6. ~~**La tarifa real de Bold**~~ → **resuelta el 2026-09-07:** 2,99% + $900 Visa/Mastercard, 2,89%
   + $900 PSE. Ver [El dinero](#-el-dinero).

---

**Pawwi S.A.S.** · NIT 901.937.952-7 · Bogotá, Colombia · pawwi.co
Plan de construcción en [`07-PLAN-CONSTRUCCION.md`](./07-PLAN-CONSTRUCCION.md).
