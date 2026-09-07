# 06 · Producto — Rediseño 2026

> **Documento maestro del producto.** Define qué es Pawwi, en qué se convierte y por qué.
> Donde este documento contradiga a los `00`–`05`, **manda este**.
> _Última actualización: 2026-09-07_

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
| **04** | **La reserva tiene dos velocidades** | Instantánea para quien se la ganó; aceptación con escalación para el resto |
| **05** | **Lanzamiento en Bogotá completa desde el día uno** | La unidad de densidad es el **conjunto**, no el barrio. La búsqueda deja de cortar por radio |
| **06** | **El transporte ocurre entre las partes** | Pawwi nunca traslada animales |
| **07** | **La capacidad la decide el Pawwer, sin tope de Pawwi** | Pawwi expone capacidad y ocupación; el mercado hace el resto |

---

## 🚪 Las dos puertas

El filtro es **bidireccional**, y esa simetría es el producto. El Pawwer abre su casa; tiene
derecho a saber que del otro lado hay una persona identificada y un perro con historia.

### Puerta del Pawwer

Cuatro pasos automáticos y **uno humano**. Ese único paso humano es toda la tesis del producto:

```
registro → examen → capacitación → agenda visita
   auto      auto        auto           auto
                                          ↓
                            ┌─────────────────────────────┐
                            │  VISITA DOMICILIARIA        │
                            │  humano · una sola vez      │
                            └─────────────────────────────┘
                                          ↓
                                    perfil activo
                                        auto
```

El examen y la capacitación ya se autocalifican en `lib/exam-pawwer.ts` y `lib/capacitacion.ts`.
La visita se agenda sola con los cupos de `15_visita_slots.sql`.

### Puerta del cliente

Cero intervención humana. Explora libre sin registrarse; el filtro aparece **solo al reservar**.

| Momento | Qué se pide | Dónde vive |
|---|---|---|
| Explorar | Nada | — |
| Guardar favorito | Registro ligero | Supabase Auth |
| Reservar | Pasaporte del perro: salud, comportamiento, rutina, vacunas | Migración **57** · `dog` |
| Reservar | Cédula (celular por OTP → v1.1) | Migración **58** · `client` |

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
- Activar `verified` y conceder `instant_booking`
- Explicar la regla de oro: toda comunicación ocurre dentro de Pawwi

> Configurar la disponibilidad juntos importa más de lo que parece: el Pawwer que se va sin
> disponibilidad cargada nunca recibe una reserva y se apaga en tres semanas.

### ⚠️ La línea que no se cruza

Ver el espacio invita a validar la capacidad — _«esta casa no da para seis perros»_. Pero si Pawwi
valida capacidad, vuelve a poner la regla que la decisión 07 eliminó.

Los hechos observados se **publican como datos del perfil**, no como tope.
**Pawwi expone; no arbitra.**

### Cómo se programan

Los cupos se agrupan **por zona y por día** — «sábado 12, Cedritos» — para que cada jornada sean
cinco visitas caminando y no cinco travesías por Bogotá. La prioridad no es por orden de llegada
sino **dirigida por demanda**: las búsquedas sin resultado indican dónde va el próximo sábado.

---

## ⚡ Motor de reservas

| | Con reserva instantánea | Pawwer nuevo |
|---|---|---|
| Al reservar | Estado 2 (confirmada), cupo bloqueado al crear | Estado 1 (pendiente) |
| Si no responde | No aplica | Escalación de tres fases |
| El cliente ve | «Confirmación inmediata» | «Responde en ~1 hora» |
| Cron | Ignora estas reservas | `run_booking_cron`, sin cambios |

**Cómo se otorga:** se concede en la visita (donde ya hay contacto humano, así que cuesta cero) y
**el sistema la revoca solo** si el nivel cae. Sin la concesión manual inicial, la función nace
vacía: al lanzar nadie tiene reseñas y nadie alcanza nivel Súper.

### Escalación · para el flujo con aceptación

```
Fase 1 directo (1 h) → Fase 2 ±20% precio (6 h) → Fase 3 toda la ciudad (6 h) → sin_cuidador
```

Al vencer o declinar la fase 1, la solicitud escala y suelta el `pawwer_id`. Es matchmaking
automático que reemplaza a un despachador humano.

### Estados

```
1 pendiente · 2 confirmada · 3 en curso · 4 completada · 5 cancelada · 6 sin_cuidador
```

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

### ⚠️ Deuda técnica a resolver antes de subir la capacidad

Conviven **dos sistemas de capacidad**:

- `service_X_Pawwer.max_animals` — por servicio, es lo que se le muestra al cliente
- `availability.slots_remaining` — por día, es lo que `accept_booking` descuenta de verdad

Hay que unificarlos. Con capacidad 1 nadie lo nota; con capacidad 4 es un error garantizado.
Además, `update_service_rules` (mig 49) impone un tope de 10 que la decisión 07 elimina.

### La compatibilidad se vuelve obligatoria

`dog.friendly_dogs` existe desde la migración 57 y **hoy no se usa en ninguna parte del código**.
Con esta decisión pasa a ser indispensable:

- Si la reserva pone al perro con otros y `friendly_dogs = false` → advertencia antes de confirmar
- El Pawwer ve `friendly_dogs` y `separation_anxiety` del perro entrante **antes** de aceptar

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

**Qué se desmonta:** `set_transport_provider` (migs 29/31/36), `booking.transport_decided`, el
`CHECK` de la mig 29, el modal en `BookingDetail.tsx:673`, la rama `pawwiTransp` en
`cuidados/page.tsx:226`, y el tipo en `actions/portal.ts:64`.

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

Total de una reserva = `cuidado + transporte`. La comisión se calcula siempre en el backend al
crear la reserva y queda **congelada e inmutable** en `booking.commission_rate`.

| Concepto | Pawwer | Pawwi |
|---|---|---|
| Cuidado · estándar | 75% | 25% |
| Cuidado · nivel Ranger | 80% | 20% |
| Transporte (si lo hace el Pawwer) | 75% | 25% |

### Pasarela: **Bold**

Cuenta de comercio **ya aprobada y apta para recibir pagos**. Resuelve la ambigüedad Wompi/Bold que
los documentos anteriores nunca cerraron.

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
| Framework | **Next.js 16.2.6** · App Router · Turbopack | `middleware` se renombró a `proxy` |
| UI | React 19.2.4 · TypeScript 5 · Tailwind v4 | Tokens en `app/globals.css`, sin `tailwind.config.js` |
| Runtime | **Node v20 LTS** | v21+ rompe `@swc/helpers` y `next dev` muere en silencio |
| Backend | Supabase — Postgres, RLS, Auth, Realtime, Storage | `@supabase/ssr` 0.10.3 |
| Cron | pg_cron dentro de Supabase | Reemplazó a la Edge Function, que daba 403 |
| Mapas | `@vis.gl/react-google-maps` | Geocoding y autocomplete de barrios |
| Validación | zod 4 | Formularios a mano, sin react-hook-form |
| Gráficas | recharts 3 | Carga diferida |
| Pagos | **Bold** | Cuenta aprobada, sin integrar. Sin dispersión a terceros |
| Email | Resend vía API directa | Cableado en `lib/email.ts`, sin clave |
| Deploy | — | Sin definir. No hay `vercel.json` ni `railway.json` |

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
queda para usuarios autenticados es solo `dog`, `profile` y las tablas de examen, capacitación y
visita.

### Tiempo real

`booking`, `booking_candidates`, `messages` y `notifications` están en la publicación de Supabase
Realtime. Presencia por latido cada 30 s con estados en línea / ausente / desconectado.

### Almacenamiento

Públicos: `dog-photos`, `pawwer-avatars`, `pawwer-images`, `chat-photos`.
Privados: `cedula-docs`, `pago-docs`. Todos con inserción restringida a la carpeta del propio usuario.

---

## 🛡️ Seguridad

Auditado el 2026-09-07. Es la parte más sólida del proyecto.

| Control | Estado |
|---|---|
| Funciones `SECURITY DEFINER` | 116 — **todas** con `SET search_path` |
| Políticas RLS | 52 sobre 16 tablas |
| Escritura directa a tablas sensibles | Revocada (migración 44) |
| `dangerouslySetInnerHTML` en todo el proyecto | 0 |
| Inyección SQL | Imposible — parámetros enlazados, sin SQL dinámico |
| PII (cédula, cuenta de pago) | Escritura por RPC, lectura enmascarada |
| Moderación del chat | Server-side: bloquea correos y teléfonos |
| Fotos del chat | Solo del bucket propio; MIME y tamaño validados |

Las cuatro funciones sin `search_path` de la migración 06 fueron reemplazadas o eliminadas en las
migraciones 25 y 44. No queda deuda.

**Anti-leakage:** los teléfonos nunca se exponen y toda comunicación ocurre en el chat de una
reserva. Sin el Fondo de Asistencia, **el ancla del lado del Pawwer pasa a ser su nivel** — irse
cuesta la comisión del 20%, la visibilidad y el flujo de clientes nuevos.

---

## 📍 Estado del código

| Métrica | Valor |
|---|---|
| Código de aplicación | ~19.200 líneas |
| Migraciones SQL | 59 archivos · 8.319 líneas |
| `tsc --noEmit` | 0 errores |
| ESLint | 16 errores · 8 avisos |
| Cron activos | 2 — reservas (cada minuto) y niveles (8:00) |

| Pieza | Estado |
|---|---|
| Marketplace, buscador y perfil público | ✅ Construido |
| Wizard de reserva de 4 pasos | ✅ Construido |
| Embudo completo del Pawwer (examen, capacitación, visita) | ✅ Construido |
| Portal del Pawwer (inicio, cuidados, chat, ganancias, perfil, tarifas) | ✅ Construido |
| Motor de escalación y ciclo de vida por cron | ✅ Construido |
| Chat con fotos, moderación y tiempo real | ✅ Construido |
| Reseñas, niveles y presencia | ✅ Construido |
| Ledger de pagos y cuenta de cobro imprimible | ✅ Construido |
| Estructura del Pasaporte y del KYC (migs 57 y 58) | 🔨 Solo columnas |
| Portal del cliente (favoritos, mensajes, perfil) | 🔨 Esqueleto |
| Pagos, emails, deploy | ⏳ Falta |
| Referidos, reporte diario, portal admin | ⏳ Falta |

---

## ❓ Decisiones abiertas

1. **Anti-leakage del lado del cliente sin el Fondo.** Del lado del Pawwer sigue siendo fuerte
   (nivel, comisión, flujo). Del lado del cliente queda débil: decidir si se acepta —el valor de
   Pawwi es el descubrimiento, no la retención eterna— o si algo lo reemplaza.
2. **Qué cuenta como reporte diario** y cuánto pesa en el cálculo del nivel.
3. **Precio bruto o neto para el Pawwer.** Los documentos viejos dicen tres cosas distintas: que ve
   lo que recibe, que ve el desglose completo, y que nunca ve la comisión. El código eligió una y el
   marketing dice otra.
4. **Umbral de lealtad.** Alinear la promesa del 20% con la regla real de Ranger, o al revés.
5. **Si los 15 Pawwers actuales ya tuvieron visita domiciliaria.** Si sí, la oferta inicial está
   hecha. Si no, esos quince sábados son lo primero del calendario.
6. **La tarifa real de Bold**, que mueve el ingreso neto y el punto de equilibrio.

---

**Pawwi S.A.S.** · NIT 901.937.952-7 · Bogotá, Colombia · pawwi.co
Plan de construcción en [`07-PLAN-CONSTRUCCION.md`](./07-PLAN-CONSTRUCCION.md).
