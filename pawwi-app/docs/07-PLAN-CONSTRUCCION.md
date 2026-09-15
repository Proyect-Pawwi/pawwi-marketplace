# 07 · Plan de construcción — hasta enero

> Ocho sprints, dos carriles en paralelo, y dos reglas contra el error que hundió el plan anterior:
> **cada sprint declara qué NO se construye**, y **cada sprint abre con lo que hay construido de
> verdad** — auditado contra el código, no recordado.
> Producto definido en [`06-PRODUCTO-REDISENO.md`](./06-PRODUCTO-REDISENO.md). Las tres plataformas
> —qué pantallas tiene cada una y qué hace cada pantalla— en
> [`09-DISENO-PLATAFORMAS.md`](./09-DISENO-PLATAFORMAS.md).
> _Última actualización: 2026-09-11_

## 🚀 Lanzamiento objetivo: **12 de enero de 2027**

Soft launch a los 22 clientes históricos.

> ### Por qué se movió desde el 30 de noviembre · 2026-09-10
> La auditoría de las tres superficies encontró **tres semanas de trabajo que no estaban en este
> plan**, incluida una que bloquea el lanzamiento por completo: **el embudo del Pawwer no termina**
> — nadie puede llegar al marketplace sin dos `UPDATE` a mano en Supabase.
>
> Con eso encima, empujar a mediados de diciembre era la peor de las tres salidas: se llega
> **tarde** al pico de viajes y además con prisa. Enero tiene su propio pico —el regreso a oficina
> tras vacaciones— y se llega sin deuda.
>
> El calendario reserva **del 21 de diciembre al 4 de enero**. Un plan que finge que alguien
> trabaja en Navidad es un plan que se incumple en la primera semana.

---

## 📊 Estado de un vistazo

| Sprint | Fechas | Estado | Lo que decide |
|---|---|---|---|
| **S0** · Rescate | sep 7–13 | ✅ **cerrado por completo** — Resend, el último hilo, quedó el 15 de septiembre | El código está a salvo y en internet |
| **S1** · Rediseño en código | sep 14–27 | ✅ **cerrado y verificado** — terminó el 9, dos semanas antes | El código dice lo que el producto promete |
| 🔒 **Hotfix** de seguridad | sep 10 | ✅ **en producción** | El Pawwer no puede auto-certificarse |
| **S2** · El dinero | ~~sep 28~~ **sep 11** – 25 | 🔨 **en curso** — código escrito, falta correr la mig 68 y probar | Pawwi puede cobrar |
| **S3** · El operador | oct 12 – nov 1 | 🆕 3 semanas · **el sprint que faltaba** | Un Pawwer real puede llegar al marketplace |
| **S4** · Puerta del cliente | nov 2–15 | ⏳ **~11 días en 8** — ver el aviso de tamaño | El cliente deja de ver errores donde debería ver nombres |
| **S5** · Cerrar el círculo | nov 16–29 | ⏳ backend listo, frontend cero | El cliente deja de estar ciego |
| **S6** · Referidos | nov 30 – dic 6 | ⏳ **la promesa ya está viva y es impagable** | El único canal con economía viable |
| **S7** · QA | dic 7–19 · ene 5–9 | ⏳ **sin framework de pruebas** | Que funcione en el móvil de verdad |
| 🚀 **Soft launch** | **12 de enero de 2027** | | |

**Cada sprint abre con «Qué hay construido hoy»** — una tabla de lo que existe, lo que es esqueleto
y lo que no está, con rutas de archivo. Esa sección es el resultado de auditar el código, no de
recordar lo que se planeó.

> ### Las dos semanas ganadas · 2026-09-11
> S1 cerró el 9 de septiembre, con dos semanas de adelanto, y **S2 arrancó el 11** en vez del 28.
> El orden no cambia y **las fechas de S3 en adelante tampoco**: esas dos semanas y media se quedan
> como colchón para los dos desbordes que este plan ya anticipa —S3 puede pasarse una o dos
> semanas, y S4 son once días de trabajo metidos en ocho—. Si al cerrar S2 sobra tiempo, se
> adelanta S3; no se reparte antes de saberlo.

### Los cuatro bloqueadores, en orden

1. 🔴 **El embudo del Pawwer no cierra.** `visita_pendiente → approved` no existe · **S3**
2. 🔴 **La visita no tiene herramienta** y su protocolo **no se puede ejecutar** hoy · **S3**
3. 🔴 **El Pawwer desaparece** de la tarjeta del cliente y parece un error de la app · **S4**
4. 🟠 **Pawwi no puede cobrar.** El código ya está escrito; falta correr la mig 68 y probar · **S2, en curso**

### Cinco promesas vivas que el sistema no cumple

Todas del mismo tipo que PawwiProtect, y todas en producción ahora mismo:

| Dónde | Promete | Se corrige en |
|---|---|---|
| `/ingresos` del Pawwer | «Pagos **100% automáticos**, sin trámites» | ✅ **S2** — dice «te transferimos cada viernes» |
| `/ingresos` y `perfil/tarifas` | «Eres Élite, **20%**» calculado con una regla incompleta | S3 |
| `/inicio` del Pawwer | «**$20.000** por vecino que reserve» sin atribución posible | S3 retira · S6 construye |
| Home del cliente | `4.9/5` · `+500 reseñas` · `15 Pawwers`, escritos a mano | S4 |
| Política de Privacidad | «puedes editar tu perfil y eliminar tu cuenta» — falso para el cliente | S4 |

---

## 🔍 Por qué falló el plan anterior

El plan de mayo tenía siete sprints y fecha de lanzamiento el 10 de julio. Nunca lanzó.

**No fue lentitud.** En ~2 meses de trabajo real se construyeron 19.200 líneas de aplicación y
8.319 de SQL — más de lo que el plan pedía. El embudo completo del Pawwer con examen, capacitación
y visita domiciliaria, el sistema de niveles, la presencia en tiempo real, la moderación del chat:
nada de eso estaba en el plan original.

**Fue expansión de alcance.** Se construyó profundidad en lugar de cerrar el circuito. El resultado
es un producto notablemente completo por dentro que no puede cobrar un peso, no envía un solo correo
y no está en internet.

> ### La regla nueva
> El plan viejo ya tenía la «regla de oro» de no empezar un sprint sin cerrar el anterior — y aun
> así falló, porque el problema no era el orden sino **el tamaño**. Por eso cada sprint de este plan
> declara explícitamente **qué NO se construye**. Esa lista es tan vinculante como la de entregables.

---

## 🛤️ La forma del plan

Dos carriles que corren en paralelo y no compiten: el código ocupa los días de semana, las visitas
domiciliarias ocupan los sábados. **Si se hacen en serie, el lanzamiento se duplica.**

```
      sep 7  sep 14   sep 28    oct 12       nov 2    nov 16   nov 30  dic 7   dic 21   ene 5
     ┌─────┬────────┬────────┬────────────┬────────┬────────┬──────┬──────┬───────┬─────────┐
CÓDIGO│ S0  │   S1   │   S2   │     S3     │   S4   │   S5   │  S6  │  S7  │ pausa │ LANZA   │
     │Resc.│Rediseño│ DINERO │ EL OPERADOR│ Cliente│ Círculo│Refer.│  QA  │ 🎄    │ ene 12  │
     └─────┴────────┴────────┴────────────┴────────┴────────┴──────┴──────┴───────┴─────────┘
     ┌──────────────────────┬────────────────────────────────────────────────────────────────┐
OFERTA│ Reactivar los 15     │  Visitas domiciliarias · 2 sábados al mes                      │
     └──────────────────────┴────────────────────────────────────────────────────────────────┘
```

> **S3 · El operador es nuevo**, y es el sprint que faltaba entero. Ver la auditoría más abajo.

**Ritmo asumido:** cuatro días enfocados de código por semana, más dos sábados al mes para visitas.
No son cinco días: hay que dejar aire para soporte, decisiones y la vida. Un plan que asume 100% de
disponibilidad es un plan que se incumple en la semana tres.

---

## ⛓️ La ruta crítica no es código

| Dependencia | Por qué bloquea | Latencia |
|---|---|---|
| Cuenta de comercio Bold | Sin cuenta aprobada no hay cobro real | ✅ **Ya resuelta** |
| Verificación de dominio en Resend | Registros DNS en `pawwi.co` + propagación | ✅ **Resuelta el 2026-09-15**, en una tarde |
| Deploy con dominio y HTTPS | **Los webhooks de Bold exigen una URL pública** | 1–2 días |

> ### La inversión de secuencia
> El plan de mayo ponía el deploy en el sprint final. Es al revés: **el deploy es requisito del
> sprint de pagos**, porque los webhooks necesitan un endpoint público al que golpear. Por eso está
> en S0 y no en S6.
>
> Y como la cuenta de Bold ya está aprobada, **el sprint de pagos se adelanta al segundo lugar**:
> es el de mayor riesgo técnico y conviene descubrir los problemas en la semana 4 con ocho de
> colchón, no en la semana 8 con cuatro.

---

## 🔎 La auditoría de las tres superficies · 2026-09-10

Se auditó lo construido en los tres lados —cliente, Pawwer y Pawwi como operador— para saber qué
falta de verdad. **Este plan daba por construido un embudo que no termina.**

### 🔴 El embudo del Pawwer no cierra

`visita_pendiente → approved` **no existe en el código**. Lo escribía
`supabase/13_capacitacion.sql:50`, pero `supabase/14_visita_domiciliaria.sql` hizo
`CREATE OR REPLACE` de esa función y lo cambió a `visita_pendiente`. Y `pawwer.verified` solo lo
pone en `true` el `INSERT` del seed.

**Un Pawwer real que complete el 100% del embudo nunca aparece en el marketplace.** Publicar a
alguien son hoy dos `UPDATE` a mano en Supabase, sin validación de transición, sin auditoría y sin
correo al Pawwer. Además `app/page.tsx` filtraba por `verified` pero no por `status`, así que las
dos puertas ni coincidían.

Es un bloqueador de lanzamiento que no estaba en ningún plan. Lo resuelve **S3 · El operador**.

### 🔒 Y una vulnerabilidad viva · corregida el mismo día

`set_pawwer_exam_result` y `set_pawwer_capacitacion_result` eran `SECURITY DEFINER`, recibían del
**cliente** el resultado a escribir, y **no tenían `GRANT` ni `REVOKE`** — conservaban el
`EXECUTE TO PUBLIC` por defecto de Postgres. Cualquier Pawwer podía llamarlas por REST con
`p_passed: true` y saltarse la capacitación entera.

Atacaba la única promesa que Pawwi hace. **Migraciones 66 y 67**, con tres defectos más del mismo
embudo: `visita_domiciliaria` sin blindar, las fotos de cédula que nunca se guardaban, y tres
firmas huérfanas de `complete_pawwer_onboarding` —una de ellas sin control de mayoría de edad—.

### Lo demás que encontró, ya repartido en los sprints

| Superficie | Hallazgo | Dónde se resuelve |
|---|---|---|
| Cliente | Favoritos **no persisten** — el corazón es estado local, `favourite` está huérfana | S4 |
| Cliente | El Pasaporte de la mig 57: `DogForm` usa **0 de sus 9 columnas** | S4 |
| Cliente | Editar mascota **crea un duplicado** — `nueva/page.tsx` no lee `?edit=` | S4 |
| Cliente | `/mis-favoritos` y `/mis-mensajes` no hacen **ni una query** | S4 · S5 |
| Cliente | Dos enlaces del menú van a rutas que **no existen** | S4 |
| Pawwer | `needs_review` es un **callejón sin salida**: nada lo saca de ahí | S3 |
| Pawwer | El chat del Pawwer es un **monólogo** — el cliente no puede responder | S5 |
| Pawwer | La agenda de visitas **no está modelada**: cupos inventados en el cliente | S3 |
| Operador | **No existe ningún concepto de admin** — ni rol, ni pantalla, ni RPC | S3 |
| Operador | `mark_payouts_paid` es `service_role`: **no hay forma de llamarla** desde la app | S3 |
| Pruebas | Los 10 `test_*.sql` tienen un **UUID quemado**; no hay seed de clientes; los Pawwers del seed **no pueden iniciar sesión** | S3 |

---

## 📦 Los ocho sprints

### S0 · Rescate y desbloqueo
**sep 7 – 13 · 1 semana**

Poner a salvo tres meses y medio de trabajo, y arrancar los relojes externos. Es el sprint con menos
código y el que más desbloquea.

**Entregables**
- **Commit y push de todo.** 56 archivos, ~19.200 líneas de app y 8.319 de SQL, sin respaldar desde
  el 23 de mayo. Agrupado en commits coherentes por área
- Verificar que `.env.local` está ignorado y que ningún secreto se cuela
- ~~Credenciales de Bold en sandbox y producción~~ ✅ identidad y secreta con valor en `.env.local`
  (comprobado el 2026-09-11 sin leerlas — **falta confirmar que la local sea la de pruebas**) y las
  de producción en Vercel
- ~~Confirmar la tarifa real de Bold~~ ✅ **2,99% + $900** (Visa/MC, modalidad «siguiente día»). Activar la **Cuenta Digital Bold**, que es la que habilita esa tarifa y es gratuita
- Averiguar el formato de **dispersión masiva del banco** (pago a proveedores): define el archivo
  que exporta la liquidación en S2
- **Configurar DNS de Resend** en pawwi.co
- **Deploy a producción** con dominio y HTTPS
- Variables de entorno en producción, incluida `PAWWI_WEBHOOK_SECRET` que hoy falta
- Correr las migraciones 57, 58 y 59 si aún no están en la base

**❌ No se construye**
- Ninguna función nueva
- Nada de los 16 errores de ESLint
- Ningún refactor «ya que estoy acá»
- CI/CD, tests automatizados, monitoreo

**✅ Criterio de cierre** — El código está en GitHub, la app responde en una URL pública con HTTPS y
las credenciales de Bold están en producción.

> **Ajuste (2026-09-07).** El criterio original exigía además el dominio de Resend verificado. Eso
> depende de una zona DNS atascada que no controlamos, y bloquear el sprint por ahí sería el error
> opuesto al que hundió el plan anterior. **Resend y el dominio pasan a hilos paralelos**, como el
> carril de visitas. S1 es trabajo puro de código y no depende de ninguno de los dos.

### Estado al cierre de S0

| Entregable | Estado |
|---|---|
| Código respaldado en GitHub | ✅ 312 archivos en `main` |
| `main` limpio (fusión + código abandonado fuera) | ✅ verificado con `npm ci` + build |
| Vulnerabilidades de dependencias | ✅ 7 altas → **0** (Next 16.2.6 → 16.3.4) |
| App desplegada con HTTPS | ✅ **`app.pawwi.co`** |
| Variables de entorno en producción | ✅ 8, con reparto Config/Secret correcto |
| Bold: cuenta, llaves, tarifa | ✅ 2,99% + $900 (modalidad «siguiente día») |
| `PAWWI_WEBHOOK_SECRET` | ✅ generado |
| Supabase: Site URL + Redirect URLs | ✅ |
| Migraciones 57, 58 y 59 | ✅ verificadas (9 / 4 / YES) |
| Fuga de la landing | ✅ tapada con formulario de dos lados |
| **Retirar PawwiProtect** *(era de S1)* | ✅ adelantado — 10 lugares |
| Dominio `app.pawwi.co` | ✅ **resuelto 2026-09-09** — HTTPS con certificado válido |
| Resend (cuenta, API key, DNS) | ✅ **2026-09-15** — dominio verificado y primer correo entregado |
| Formato de dispersión masiva del banco | ⏳ pendiente, se necesita en S2 |
| Activar Cuenta Digital Bold | ❓ por confirmar |

---

### S1 · El rediseño en código
**sep 14 – 27 · 2 semanas**

Alinear el código con las siete decisiones. Buena parte es borrar, y borrar es rápido — por eso va
temprano: todo lo que se construya después se construye sobre el modelo correcto.

**Entregables**
- **Desmontar el transporte de Pawwi:** `set_transport_provider`, `transport_decided`, el modal
  bloqueante en `BookingDetail`, la rama `pawwiTransp` y los tipos asociados
- Transporte como atributo del Pawwer: `pawwer.transport_price` visible antes de reservar; los
  trayectos en el paso 3 solo aparecen si el Pawwer lo ofrece
- **Búsqueda sin corte por radio.** Orden por nivel → rating → distancia, con el precio del
  transporte en la tarjeta
- **Unificar las dos capacidades** (`max_animals` y `slots_remaining`) y quitar el tope de 10 de la
  migración 49
- Mostrar ocupación real del día, no solo el máximo declarado
- Cablear `friendly_dogs`: advertencia al cliente y dato visible para el Pawwer antes de aceptar
- ~~**Reserva instantánea**~~ → **Simplificar el motor a dos etapas.** La reserva instantánea se
  descartó: auto-confirmar sin que el Pawwer pueda rechazar ese encargo concreto es el único
  patrón con riesgo laboral real. En su lugar, la escalación se **conserva y se simplifica**:
  - tres fases → **dos etapas** (directa 1 h, bolsa general 6 h). Siete horas, no trece
  - se quita el **piso de precio** del filtro de candidatos, que excluía a los Pawwers más baratos
    — Pawwi arbitrando el mercado contra la decisión 07. El techo se queda
  - los cupos se miden en **perros** también en `find_escalation_candidates`, que se había quedado
    atrás respecto a la unificación de capacidad
  - `booking.allow_pool`: el cliente consiente **al reservar** que su solicitud pase a la bolsa si
    el Pawwer elegido declina. Sin ese permiso, muere como `sin_cuidador` y elige de nuevo
- **Retirar PawwiProtect™ del producto.** La decisión 03 eliminó el Fondo de Asistencia, pero el
  producto lo sigue prometiendo en **8 lugares**, incluido el paso 1 de la reserva («PawwiProtect™
  incluido en todas las reservas»), la home («seguro veterinario y soporte 24/7 sin costo
  adicional»), el FAQ de soporte, la página de reclutamiento de Pawwers y —lo más delicado— las
  meta descripciones de `layout.tsx`, que son lo que sale en Google y en las vistas previas de
  WhatsApp
- Reescribir términos y privacidad: intermediario explícito, sin Fondo de Asistencia

**❌ No se construye**
- Reporte diario formal
- Precios por nivel de capacidad dentro de un mismo Pawwer
- Rediseño visual de la búsqueda — solo cambia la lógica
- Portal admin

**✅ Criterio de cierre** — Una reserva de prueba con un Pawwer de capacidad 3 y transporte propio
recorre el flujo completo, y en ningún lugar del producto aparece Pawwi como transportador.

### Estado al cierre de S1 · 2026-09-09

Todo el código está en `main` y las seis migraciones corridas y verificadas contra la base.

| Entregable | Estado |
|---|---|
| Transporte de Pawwi desmontado | ✅ mig 60 |
| Búsqueda sin corte por radio · nivel → rating → distancia | ✅ |
| Capacidades unificadas · el cupo se mide en **perros** | ✅ mig 61 |
| Tope de 10 eliminado (decisión 07) | ✅ mig 61 |
| Ocupación real del día · «tu perro sería 1 de 3» | ✅ mig 63 |
| `friendly_dogs` y `separation_anxiety` cableados | ✅ mig 63 |
| ~~Reserva instantánea~~ → **dos etapas, 13 h → 7 h** | ✅ mig 64 |
| `allow_pool` · consentimiento del cliente para la bolsa | ✅ mig 64 |
| Términos, privacidad y examen del Pawwer | ✅ borrador para abogado |
| Agenda de prueba repoblada *(no estaba en el plan)* | ✅ mig 62 |
| Fuga de dirección del cliente *(no estaba en el plan)* | ✅ mig 65 |

**Criterio de cierre, con un matiz honesto:** el flujo se puede recorrer, pero los Pawwers del
seed tienen capacidad máxima **2**, no 3. La aritmética nueva queda demostrada igual —una reserva
de 2 perros consume 2 cupos, que era exactamente el defecto—, y subir a uno del seed a 4 es un
`update` de dato de prueba cuando se quiera verificar el número literal.

> ### Lo que S1 dejó fuera a propósito
> **La vía 2 como puerta de entrada** —que el cliente publique una solicitud sin elegir Pawwer—.
> El obstáculo es concreto: con «total fijo, gana el primero», una reserva nacida en la bolsa no
> tiene precio ancla. Hay que decidir si lo fija el cliente como presupuesto o si Pawwi deriva una
> referencia del mercado.
>
> Aplazarla tiene un beneficio que no es solo de calendario: **obligar a navegar perfiles ES el
> mecanismo de confianza**. Un botón de «cualquier cuidador» convertiría a Pawwi en un commodity,
> que es lo contrario de lo que dicen las 40 entrevistas.

---

### 🔒 Hotfix de seguridad · 2026-09-10 · fuera de sprint

No fue un sprint: era una vulnerabilidad y se corrigió el día que se encontró.
**Migraciones 66 y 67**, las dos corridas y verificadas.

| Defecto | Corrección |
|---|---|
| El Pawwer podía **auto-certificarse** llamando las RPC del embudo por REST con `p_passed: true` | Las dos RPC pasan a `service_role`; reciben el id de `getUser()`, nunca del formulario |
| `visita_domiciliaria` **no estaba en el blindaje** de la mig 44 | `REVOKE INSERT/UPDATE/DELETE` |
| Las **fotos de cédula nunca se guardaban** — `UPDATE` revocado y error descartado | Entran por `complete_pawwer_onboarding` |
| El onboarding no escribía `slots_total`, de la mig 63 | Un Pawwer nuevo ya nace con la ocupación calculable |
| **Tres firmas huérfanas** de `complete_pawwer_onboarding`; la más vieja **sin control de mayoría de edad** | Eliminadas |

> **No se recalculó el puntaje dentro de la función**, que era lo primero que se intentó:
> `capacitacion_results` **no guarda las respuestas**, solo el puntaje, así que no hay nada que
> recalcular; y `exam_results` sí las guarda pero la clave vive en `lib/exam-pawwer.ts` —
> duplicarla en SQL crearía dos fuentes de verdad para la misma pregunta. La salida fue mover la
> frontera de confianza, no el cálculo.

---

### S2 · El dinero
**~~sep 28 – oct 11~~ sep 11 – 25 · 2 semanas** · 🔨 **en curso**

El sprint que convierte el producto en negocio, adelantado al segundo lugar porque es el de mayor
riesgo técnico y la cuenta de Bold ya está lista.

### Estado de S2 · 2026-09-11, primer día

**Todo el código está escrito y compila** (`tsc` en 0, ESLint sin problemas nuevos). Falta correr la
**migración 68**, conectar Bold por fuera del código y probarlo de punta a punta.

**Lo que encontró el primer día, antes de escribir una línea:**

- 🔴 **`paid_at` ya tenía dueño.** Desde la migración 48 es cuándo Pawwi le **transfiere al Pawwer**:
  lo leen Ganancias y `mark_payouts_paid`. Este plan decía «el webhook sella `paid_at`»: el Pawwer
  habría visto como pagado dinero que nunca se le transfirió, y la liquidación del viernes habría
  salido en cero. **El cobro al cliente va en su propia columna: `charged_at`**
- **El cliente no tiene cómo enterarse de que el Pawwer aceptó**: no tiene campana (S5) y Resend
  no está configurado. Cualquier plazo para pagar se vence solo si nadie se entera. Por eso
  **Resend deja de ser un hilo paralelo: es parte de la ruta crítica de S2**
- **La «política de 48 horas» que citaban este plan y `09` nunca se había escrito** en ningún lado:
  ni en los términos ni en el código
- Cinco defectos heredados, todos corregidos en la 68: la bolsa ignoraba `allow_pool` cuando el
  Pawwer abría su inicio; el Pawwer elegido veía la dirección exacta **antes de aceptar** (la 65
  solo tapó a los candidatos); el techo de precio de la bolsa medía mal; la bolsa no exigía
  transporte ni el tope de perros del candidato; y un candidato veía su ganancia con la tasa ajena

**Lo que Bold permite y lo que no** — leído en `developers.bold.co`:

| | |
|---|---|
| ✅ Abrir el checkout **cuando queramos**, con una firma que calcula el servidor | Por eso el cobro puede esperar a la aceptación. Era la pregunta pendiente para Bold |
| ✅ Ponerle **fecha de expiración** al checkout | Se cierra justo cuando vence el plazo de pago |
| ✅ **Webhook** firmado, con reintentos (15 min, 1 h, 4 h, 8 h, 24 h) y un endpoint de respaldo | La confirmación de verdad |
| ✅ **API de consulta** por orden | La verificación al volver del checkout |
| ⚠️ **En modo de pruebas no manda webhooks** | Se prueba con la API de consulta, o con «Probar el webhook» a mano |
| ❌ **No tiene API de reembolsos.** Solo anula tarjetas de **crédito**, **el mismo día antes de las 9 p. m.**, desde su panel | Todo lo demás es una transferencia manual. Los reembolsos se **anotan** solos y se **ejecutan** a mano |

**Las cuatro decisiones del primer día** (Nicolás, 2026-09-11):

| Decisión | Por qué |
|---|---|
| **2 horas para pagar** tras la aceptación, nunca más allá del inicio del servicio | Con 30 minutos y sin campana ni correo, casi nadie se entera a tiempo |
| **Cancelación de lo pagado: 100% con 48 h o más; con menos, no hay reembolso y el Pawwer cobra** | Protege al Pawwer que bloqueó el día. Va a los términos, que revisa el abogado |
| **El Pawwer ve la dirección exacta del cliente cuando el cliente paga** | Simétrico con el cliente. Si no paga, el Pawwer nunca tuvo su dirección |
| **La comisión es la del Pawwer que acepta**, congelada al aceptar | El cliente paga lo mismo; el Ranger que toma una reserva de la bolsa cobra como Ranger |

**Lo que quedó construido:**

| Pieza | Dónde |
|---|---|
| Cobro: `charged_at`, `payment_due_at`, `late_cancel`, `pawwer_earns` y la tabla `booking_payment` | mig 68 |
| Aceptar bloquea el cupo y abre el plazo · pagar confirma y abre el chat · sin pago, vence solo | mig 68 |
| Política de cancelación en `cancel_booking_client`, y `get_cancellation_terms` para mostrarla antes | mig 68 |
| Firma de integridad, validación del webhook, API de consulta | `lib/bold.ts` |
| Sello idempotente del pago y los correos que lo siguen | `lib/cobro.ts` |
| Webhook | `app/api/bold/webhook/route.ts` |
| Abrir el pago y verificarlo al volver | `app/actions/pago.ts` |
| Botón de pago con cuenta regresiva, pago en proceso y rechazado | `booking/confirmada/[id]/PagarReserva.tsx` |
| Cancelar diciendo antes qué pasa con el dinero | `BookingActions.tsx` |
| «Por pagar» en la lista del cliente · «Esperando pago» en el portal del Pawwer | `mis-reservas` · `cuidados` |
| Ganancias cuenta las cancelaciones tardías y deja de decir «automático» *(era de S3)* | `GananciasClient.tsx` |
| `sendEmail` a prueba de errores de red · avisos al equipo a `hola@pawwi.co` *(era de S3)* | `lib/email.ts` |
| Términos (secciones 3, 4 y 10) y privacidad (sección 2) con las reglas nuevas | `/terminos` · `/privacidad` |

**Lo que falta para cerrar S2:**

1. ✅ **Migración 68 corrida y verificada** (2026-09-15): `4 · true · false · false · 6 · 0 · 0`, y
   desplegada — el webhook responde 405 a un GET y 401 sin firma, comprobado contra producción
2. ✅ **Llaves de Bold separadas por entorno en Vercel** (2026-09-15): las reales solo en Production,
   las de pruebas en Preview y Development
3. ✅ **Webhook registrado en Bold** (2026-09-15): `https://app.pawwi.co/api/bold/webhook`, activo,
   con `SALE_APPROVED`, `SALE_REJECTED` y `VOID_APPROVED`. Sin «webhook de prueba»: en producción la
   firma de pruebas se rechaza a propósito
4. ✅ **Resend configurado** (2026-09-15): dominio `pawwi.co` verificado con DKIM, SPF en
   `send.pawwi.co` y DMARC en monitoreo; `RESEND_API_KEY` en Vercel y en local, y un correo de
   prueba desde `hola@pawwi.co` que **llegó a la bandeja principal**. Queda como extra conectar el
   SMTP de Supabase, para que los correos de confirmación de cuenta dejen de caer en spam
5. 🔨 **Probar de punta a punta con las llaves de pruebas**: reservar → aceptar → pagar con la
   tarjeta de prueba `4111 1111 1111 1111` → confirmada → cancelar con más y con menos de 48 h.
   **Desbloqueada el 2026-09-15 (noche)**: lo que la frenaba era un abrazo mortal en el candado de
   sesión de `supabase-js` que **congelaba todas las consultas del navegador al iniciar sesión** —
   causa y método en [`08`](./08-INFRAESTRUCTURA.md), problema 3, ya resuelto.
   - **Google Maps sigue sin facturación**, pero **no bloquea**: el paso 3 solo pide dirección si el
     Pawwer ofrece transporte, y el de pruebas lo tiene en 0
   - **La prueba va en `localhost:3000`, no en `app.pawwi.co`**: la tarjeta de prueba solo funciona
     con las llaves de pruebas, que viven en `.env.local`. Producción tiene las reales. Ojo: local
     habla con **la misma base que producción**, así que la reserva de prueba es un dato real
6. **Una transacción real** con monto bajo — es el criterio de cierre

> **La preparación de la prueba encontró siete bugs del lado del cliente**, todos del 2026-09-15 y
> ninguno de S2: el registro que fallaba sin decir por qué (celular único), la pantalla de «revisa tu
> correo» con la confirmación desactivada, los dos enlaces del menú que iban a 404, la sesión
> invisible en el header, el calendario que abría los días con cupo para un solo perro, **el candado
> de sesión que congelaba todas las consultas al iniciar sesión** —el que vaciaba el marketplace— y
> **`useMapsLibrary` fuera de su proveedor**, que tiene muerto el buscador de ubicación de la home
> (pendiente, problema 3b de [`08`](./08-INFRAESTRUCTURA.md)).
>
> Salieron porque **por primera vez alguien recorrió el producto como cliente nuevo**. Los dos
> últimos, además, solo aparecen **con sesión iniciada** — que es justo el estado en el que ninguna
> prueba anterior había mirado la home.

**Lo que pasa a S3**, porque necesita el `/admin` que se construye allí: la pantalla de liquidación,
el archivo de dispersión del banco y la **cola de reembolsos pendientes**. Hasta entonces, cada
reembolso llega por correo a `hola@pawwi.co` y se marca a mano en `booking_payment.refunded_at`.

### Qué hay construido hoy · el inventario con el que arrancó

**Cero líneas de código de pasarela.** Un `grep` de Bold en `app/`, `lib/` y `components/` no
devuelve nada. Es el único sprint que empieza en campo virgen — todos los demás arreglan o
completan algo que existe.

Lo que **sí** está listo y no hay que construir:

| Pieza | Dónde |
|---|---|
| Cuenta de comercio aprobada, llaves de identidad y secreta en Vercel | S0 |
| Tarifa confirmada: **2,99% + $900** Visa/MC, 2,89% + $900 PSE | `docs/06` |
| `booking.commission_rate` **congelada** por reserva al crearla | mig 36 |
| `booking.paid_at` y `accepted_at` — el ledger honesto | mig 48 |
| `get_pawwer_payout_summary` — qué se le debe a cada Pawwer | mig 48 |
| `mark_payouts_paid`, blindada a `service_role` | mig 48 |
| Cuenta de cobro imprimible del Pawwer | `/pawwer/cuenta-cobro` |
| El paso 4 del wizard, listo para recibir el checkout | `Step4Resumen` |

Es decir: **el dinero ya está contado, solo falta cobrarlo.**

### El estado que falta en la máquina

Con la secuencia corregida —no se cobra hasta que ambos aceptaron— aparece un estado que **hoy no
existe**: entre que el Pawwer acepta y el cliente paga.

```
1 pendiente  →  el Pawwer acepta  →  ¿…?  →  el cliente paga  →  2 confirmada
```

Hoy `accept_booking` salta directo a `2`. Hay que decidir si ese intermedio es un `status_id`
nuevo o `status_id = 2` sin pago registrado — **la segunda opción no añade estados**. Lo que no puede
pasar es que el Pawwer y el cliente vean «Confirmada» sobre una reserva sin pagar.

> **Corregido el 2026-09-11:** este párrafo proponía distinguirlo con `paid_at IS NULL`, «porque el
> ledger existe». Pero `paid_at` es el pago **al Pawwer**, no el del cliente. El intermedio quedó
> como `status_id = 2` con **`charged_at IS NULL`**, una columna nueva — ver el estado de S2 arriba.

Y con él, dos cosas que sí o sí acompañan:

- **El cupo se bloquea al aceptar**, no al pagar. Si se bloqueara al pagar, dos clientes podrían
  pagar el mismo lugar
- **El vencimiento del plazo** libera ese cupo. Es el único riesgo que introduce la secuencia —un
  Pawwer acepta y el cliente no paga—. Este plan decía media hora; quedó en **dos horas**, porque
  sin campana ni correo nadie se entera en treinta minutos

> ### ⚠️ La secuencia del dinero — corregida el 2026-09-09
>
> Este sprint decía que **el webhook de pago mueve la reserva a confirmada**. Pero S1 estableció
> que quien confirma es **la aceptación del Pawwer**, y con la secuencia anterior —pagar al
> reservar, aceptar después— **el cliente pagaba antes de que existiera un Pawwer que hubiera
> aceptado**. Con las dos etapas eso son hasta 7 horas con el dinero debitado sobre una reserva
> que puede no existir nunca, y una devolución de 3 a 15 días hábiles si no se concreta.
>
> **No se cobra nada hasta que ambos aceptaron:**
>
> ```
> El cliente reserva      → sin dinero, sin cupo bloqueado
> El Pawwer acepta        → se bloquea el cupo y se le pide el pago
> El cliente paga         → CONFIRMADA
> Nadie acepta en 7 h     → sin_cuidador, y nunca se movió un peso
> ```
>
> **El pago pasa a ser el consentimiento final del cliente.** Si la reserva salió a la bolsa y la
> tomó otro Pawwer, no puede terminar con él sin haber pagado activamente por él: ve su perfil y
> decide. La ventana de aprobación no hay que construirla — el paso de pago *es* la ventana.
>
> Lo que esta secuencia **elimina** de este sprint: el reembolso como camino habitual, cualquier
> necesidad de autorización y captura por separado, y la billetera de saldo a favor. También hace
> irrelevante si Bold soporta preautorización, que era una dependencia externa por resolver.
>
> _Nota sobre PSE:_ no admite preautorización porque es una transferencia bancaria, no un cupo de
> tarjeta. Con esta secuencia da igual — pero conviene recordar que **el medio más barato (2,89%,
> sin retenciones) es el que no se puede revertir limpiamente**, así que un reembolso por PSE
> siempre será lento.

**Entregables** · estado al 2026-09-11
- ⏳ **Separar llaves de Bold por entorno en Vercel.** Hoy las llaves de PRODUCCIÓN están
  disponibles también en los despliegues de vista previa: en cuanto exista código de cobro, un
  preview podría procesar pagos reales. Producción → llaves reales; Preview y Development → llaves
  de pruebas. *Es tuyo: se hace en el panel de Vercel*
- ✅ **Checkout de Bold**, el botón de pagos personalizado: el cliente paga en la interfaz de Bold y
  Pawwi nunca toca datos de tarjeta
- ✅ **El cobro se abre al ACEPTAR el Pawwer**, no al crear la reserva, con el total congelado
  desde la creación (cuidado + transporte)
- ✅ **Webhook de confirmación** que sella **`charged_at`** —no `paid_at`— y confirma la reserva. Es
  el segundo de los dos consentimientos, no el primero
- ✅ Retención de la comisión, con la tasa **del Pawwer que acepta**, congelada al aceptar
- ✅ Pago fallido con sus salidas: reintentar, cambiar de medio dentro del checkout, «ya pagué»
- ✅ **Vencimiento a las 2 horas desde la aceptación** (con 20 minutos de gracia para PSE),
  liberando el cupo
- ✅ **Reembolso en cancelación** con la política de 48 horas, **solo para lo ya pagado** — se
  anota solo; se ejecuta a mano
- ➡️ **Pantalla de liquidación semanal** → **S3**, en `/admin/liquidacion`: necesita `is_admin`
- ➡️ **Exportación del archivo de dispersión masiva** y marcado en lote con `mark_payouts_paid` →
  **S3**, en la misma pantalla. Sigue faltando el formato del banco

**❌ No se construye**
- Dispersión automática — **Bold no la soporta**, es manual y punto
- Propinas
- Descuentos, cupones y códigos promocionales
- Suscripciones o membresías

**✅ Criterio de cierre** — Una transacción real de punta a punta: el cliente paga con tarjeta, la
reserva se confirma sola, la comisión queda retenida y el Pawwer la ve en Ganancias como pendiente
del viernes. *El archivo que el banco acepta pasó al criterio de S3, junto con la liquidación.*

> ### ⚠️ La única operación recurrente que sobrevive
> Bold no dispersa a terceros, así que Pawwi cobra el 100% y transfiere el 75% a cada Pawwer. A 30
> Pawwers con cuatro servicios al mes son **~30 transferencias semanales**.
>
> Transcribirlas a mano no escala y es un error humano esperando ocurrir sobre dinero ajeno. Por eso
> la liquidación no produce una lista: produce un **archivo de dispersión masiva** que se sube al
> banco de una sola vez. El trabajo semanal pasa a ser de minutos y deja de crecer con el número de
> Pawwers.

---

### S3 · El operador
**oct 12 – nov 1 · 3 semanas** · 🆕 **el sprint que faltaba entero**

Todo lo que hoy te obliga a abrir Supabase Studio. Sin esto **no se puede lanzar**: ningún Pawwer
real llega al marketplace.

### El embudo, paso por paso · qué se captura y qué falta

| # | Paso | Qué se captura hoy | Qué falta |
|---|---|---|---|
| 1 | **Registro** | nombre, correo, teléfono, contraseña, términos | — |
| 2 | **Bienvenida** · 3 pasos | bio, profesión, fecha de nacimiento, nº y **fotos de cédula**, avatar · dirección, barrio, lat/lng, «mi espacio», valores, tipo de inmueble, áreas externas, animales en casa, niños pequeños, experiencia · servicios con precio, patrón semanal | — |
| 3 | **Revisión de cédula** | *manual, por `curl` o Studio* | **Pantalla** con los documentos y el botón |
| 4 | **Examen** | 26 respuestas **y las respuestas se guardan** + puntaje | Salida de `needs_review` |
| 5 | **Capacitación** | 8 videos, 27 preguntas, **solo el puntaje** | — |
| 6 | **Visita** | fecha, franja, estado, un `notes` de texto libre | **Casi todo · ver abajo** |
| 7 | **Aprobación** | *no existe* | La RPC, y **el correo de bienvenida** |

Los correos ya existen en los pasos 3 y 4. **Falta el de la aprobación final** — el más importante,
porque es el que le dice «ya estás en línea».

### 🔴 La visita no tiene ninguna herramienta

Es el único momento humano del producto y `docs/06` le pone un protocolo de ocho puntos. Hoy la
tabla `visita_domiciliaria` guarda cuatro campos y uno es texto libre.

**No hay dónde guardar lo observado.** El protocolo pide «metros, separación de zonas, exteriores»
— que son justo los datos que se publican en el perfil y **sostienen la promesa de verificación**.
Y tienen que quedar distinguibles de lo que el Pawwer declaró de sí mismo en el onboarding: la
diferencia entre «él dice que tiene patio» y «lo vi» es literalmente el producto.

**No hay set de fotos.** Cinco fotos estándar —entrada, sala, zona del perro, patio o balcón, dónde
duermen—. El bucket `pawwer-images` existe, pero solo se sube desde `perfil/fotos`, **dentro del
portal**.

**Y hay un círculo que impide ejecutar el protocolo:**

```
(portal)/layout.tsx:20 → if (pawwer.status !== "approved") redirect("/pawwer/dashboard")
```

El protocolo dice «configurar disponibilidad y precios ahí mismo, en el celular del Pawwer». En la
visita el Pawwer está en `visita_pendiente`, así que **su portal lo rechaza**: `perfil/tarifas`
—precios y cuántos perros acepta— es inalcanzable. Se aprueba *después* de la visita, pero la
visita tiene que configurar cosas que exigen estar aprobado.

> Curiosamente `/pawwer/disponibilidad` sí funciona: está fuera del portal y solo comprueba el rol.
> El «guard flojo» que la auditoría marcó como defecto es hoy lo único que permitiría cargar la
> agenda durante la visita.

**Y el contrato digital del protocolo no existe.** Cero código.

**Entregables · 3.1 · Cerrar el embudo** (la primera migración de S3 — no la 68: S2 va antes y
casi seguro necesita la suya, para la expiración a los 30 minutos y el sello del pago)

Primero las funciones, después las pantallas — hoy para «aprobar la visita» o «rechazar una
cédula» no hay nada que llamar.

- `is_admin()` — función `STABLE` que lee `profile.is_admin`, encendido a mano una sola vez.
  **No se toca el trigger `handle_new_user`**, que sigue con su lista blanca de dos valores: nadie
  puede darse el rol al registrarse
- `admin_verificar_cedula` — `pending_review → exam_ready` o `rejected`. Reemplaza al webhook
  `/api/pawwer/notify-approved`, que **nadie llama en todo el repo** y hoy es un `curl` a mano
- `admin_resolver_examen` — saca del callejón `needs_review`
- `admin_gestionar_visita` — `confirmed` / `completed` / `cancelled` / reagendar. Hoy **ningún
  código escribe `visita_domiciliaria.status`**
- **`admin_aprobar_pawwer`** — el que falta: `visita_pendiente → approved` **y** `verified = true`
  en una transacción. Es lo que publica al Pawwer, y **manda el correo de bienvenida** — hoy hay
  correos en los pasos 3 y 4 del embudo, y no en el único que de verdad importa
- Registro de aceptación de términos: `terminos_version` y `terminos_aceptados_at` en `pawwer`
- Alinear el filtro del marketplace: `verified` **y** `status = 'approved'`
- Tabla `admin_audit` — un `UPDATE` a pelo en Studio no deja rastro; una RPC sí
- 🔒 **Blindar `exam_results` y `capacitacion_results`** — `REVOKE INSERT, UPDATE, DELETE` a
  `authenticated`, y el `INSERT` del examen pasa a `service_role` como ya hace la capacitación.
  Hoy el Pawwer puede reescribir sus propias filas por REST; no le abre el embudo a nadie, porque
  el cambio de estado es solo de `service_role`, pero **la ficha del admin decide `needs_review`
  leyendo esas filas**. Va antes de construir la pantalla que confía en ellas
- ✅ ~~🔒 **`delete_availability` sin `search_path`**~~ → **se adelantó a la migración 68 (S2)**, que
  ya tocaba las funciones del Pawwer. De paso cambió `!=` por `IS DISTINCT FROM`: con `auth.uid()`
  NULL, la comparación vieja no entraba al `IF`
- ✅ ~~**Un correo que falla no puede tumbar la acción que lo manda**~~ → **hecho en S2**: `sendEmail`
  ya atrapa los errores de red. S2 empezó a mandar correos desde el webhook y no podía esperar

**Entregables · 3.2 · La visita, con herramienta** 🆕

Se resuelve **desde tu móvil**, en `/admin/visita/[id]`, pensada para usarse de pie y con una mano.
No se toca el gate del portal: el Pawwer no tiene que hacer nada durante la visita salvo enseñarte
la casa, y las fotos del hogar las tomas tú — que es justo lo que la visita venía a garantizar.

La pantalla recorre el protocolo de `docs/06` en orden, y **no deja aprobar sin completarlo**:

1. **Cédula en físico** — comparar contra las fotos que ya subió. Un check con sello de tiempo
2. **Las cinco fotos** — entrada · sala · zona del perro · patio o balcón · dónde duermen. Suben a
   `pawwer-images` con `sort_order`, y son las que verá el cliente
3. **Hechos observados** — columnas nuevas en `pawwer`, **nombradas para distinguirse de lo
   autodeclarado**: `verif_metros_zona`, `verif_zonas_separadas`, `verif_exteriores`,
   `verif_observaciones`. Se publican como datos del perfil, **nunca como tope** — la decisión 07
   dice que Pawwi expone, no arbitra
4. **Precios y capacidad** — los servicios del Pawwer con su precio y su `max_animals`, editables
   desde tu pantalla. Es el «configuramos perros» del protocolo, y resuelve el círculo del portal
5. **Disponibilidad** — abrir su agenda de los próximos 60 días
6. **Aceptación de términos** — el Pawwer acepta desde tu pantalla al final. Se guarda **qué
   versión aceptó, cuándo y desde dónde**. Sin firma electrónica certificada ni proveedor externo:
   trazable y honesto, y encaja con los términos que ya se están redactando para el abogado
7. **Aprobar y publicar** — `admin_aprobar_pawwer`, que cierra el embudo

> **Por qué el Pawwer sin disponibilidad cargada se apaga en tres semanas.** `docs/06` ya lo dice:
> el que se va de la visita sin agenda nunca recibe una reserva. Por eso el paso 5 no es opcional.

**Entregables · 3.3 · El portal del Pawwer · lo que promete y no cumple** 🆕

Las once pantallas del portal **están construidas y funcionan**. El problema no es que falten:
es que **tres prometen cosas que el sistema no puede cumplir**, y una de ellas es sobre dinero.

| Pantalla | Lo que dice | La verdad |
|---|---|---|
| `/ingresos` | «Próximo pago **automático**» · «Pagos **100% automáticos** · sin trámites» | **Bold no dispersa a terceros.** El pago es una transferencia manual cada viernes. Es la decisión más documentada de `docs/06` y la pantalla dice lo contrario |
| `/ingresos` y `perfil/tarifas` | «**¡Eres Pawwer Élite!** Comisión preferencial del 20%» | Calculan `isElite = rating ≥ 4.8 && reviews ≥ 15` **por su cuenta**. La regla real de `compute_pawwer_level` exige además `cancel_rate ≤ 0.02` y actividad en 30 días. **Un Pawwer puede leer «ganas 20%» y que se le cobre 25%** — la comisión que aplica sale de `booking.commission_rate`, congelada por el backend |
| `/inicio` · tarjeta de referidos | «Si un vecino reserva, ganas **$20.000 COP** extra» | `handleShare` comparte `/pawwer/{id}` **sin ningún parámetro**, y **no existe tabla de referidos ni columna de atribución**. El vecino reserva y el sistema no puede saber que vino de él. **La promesa es impagable** |

> **Es exactamente la clase de deuda que fue PawwiProtect**, y la razón por la que se retiró: el
> producto prometiendo lo que el sistema no sostiene. La diferencia es que aquí el destinatario es
> el Pawwer, y dos de las tres promesas son sobre su plata.

**Qué se hace con cada una:**

- ✅ **«Pago automático» → la verdad** · *hecho en S2*. «Te transferimos cada viernes», en Ganancias,
  en la cuenta de cobro y en la pantalla de la cuenta bancaria. Es menos brillante y es cierto
- **«Élite» → leer `pawwer.level`.** Se quita el cálculo duplicado de las dos pantallas y se usa
  `lib/levels.ts`, que ya es la fuente única del marketplace y del perfil público. De paso se
  unifica el nombre: el modelo dice **Ranger**, no «Élite»
- **Referidos → se retira la promesa hasta S6**, que es cuando se construye la atribución.
  Mientras tanto la tarjeta invita a compartir el perfil sin prometer un pago que no se puede
  rastrear

**Y dos huecos del modelo nuevo que el portal todavía no refleja:**

- **La bolsa general no se distingue de una solicitud directa.** Ambas caen en «Nuevas», separadas
  solo por una etiqueta de fase. Son cosas psicológicamente distintas — «te eligieron a ti» frente
  a «hay una oportunidad abierta» — y mezclarlas diluye la primera, que es la que sostiene el nivel
- ✅ **No había estado «aceptaste, falta que el cliente pague»** · *hecho en S2*. La pestaña pasó a
  llamarse «Aceptadas», la tarjeta dice «Esperando pago» con la hora límite, y el detalle explica
  que el chat y la dirección llegan con el pago

**Y dos guards flojos**, que viven fuera del grupo `(portal)` y por eso no heredan su gate:

- `/pawwer/disponibilidad` solo comprueba el rol → un Pawwer **sin aprobar** entra
- `/pawwer/cuenta-cobro` solo comprueba que haya sesión → **cualquier usuario logueado**, incluido
  un cliente, puede abrirla

Las dos pasan a exigir `status = 'approved'`. Durante el diseño pareció que el guard flojo de
disponibilidad servía para cargar la agenda en la visita; como la visita se hace desde el admin, ya
no le sirve a nadie.

**Lo que NO se toca:** `/cuidados`, el chat, `perfil/vitrina`, `fotos`, `faq` y `pago` funcionan y
escriben por RPC. El portal del Pawwer es la parte mejor construida del producto — por eso el
trabajo aquí es de honestidad, no de construcción.

> **El diseño completo de cada pantalla** —qué muestra, qué puede hacer el usuario, en qué estado
> está— vive en [`09-DISENO-PLATAFORMAS.md`](./09-DISENO-PLATAFORMAS.md).

**Entregables · 3.4 · La agenda de visitas, modelada**

Hoy los cupos están inventados en el cliente: cuatro franjas fijas en `lib/visita.ts`, duplicadas
en la migración 15, y los días son L-V generados en JS. Tabla `visita_slots (fecha, slot, zona)`
que el operador abre desde el panel. Es lo que permite **agrupar por zona**, que es la mitad del
argumento de densidad de `docs/06`.

**Entregables · 3.5 · El panel `/admin`**

Mismo patrón que el resto: Server Components como loaders → Client Components interactivos,
escritura por RPC. Gate con `is_admin()`.

| Pantalla | Qué resuelve |
|---|---|
| `/admin` | Tres colas con contador: cédulas, exámenes en revisión, visitas por confirmar |
| `/admin/pawwers` | Estado del embudo, filtro, ficha con documentos y acciones |
| `/admin/visitas` | Calendario del operador: abrir cupos por zona, confirmar, completar, reagendar |
| `/admin/visita/[id]` | **La visita en vivo**, desde el móvil. Ver 3.2 |
| `/admin/liquidacion` | Qué le debes a cada Pawwer, **archivo de dispersión** del banco y **marcado en lote** con `mark_payouts_paid` · y la **cola de reembolsos pendientes** de `booking_payment`. *Las tres cosas llegan de S2* |
| `/admin/metricas` | Embudo, GMV, reservas por estado y **búsquedas sin resultado** |

Tecnologías, todas ya en el stack: `recharts` con carga diferida como en `EarningsChart`,
`lib/levels.ts` y `lib/services.ts` como fuentes únicas, URLs firmadas para los buckets privados
`cedula-docs` y `pago-docs`.

Las **búsquedas sin resultado** necesitan registrarse: tabla `search_miss`, escrita desde el
buscador. Estaba en S6 y sube aquí porque alimenta las métricas y dirige a qué zona ir el sábado.

**Entregables · 3.6 · Seed con cuentas reales**

`scripts/seed-dev.ts` contra la **Admin API de Supabase**. Crea usuarios que **sí pueden iniciar
sesión** — los 10 del seed actual solo existen en `profile`, sin fila en `auth.users`, así que son
escaparate. Deja 3 clientes con perros (uno con Pasaporte completo, uno con `friendly_dogs=false`,
uno sin declarar) y **5 Pawwers, uno en cada estado del embudo**. Y arregla el UUID quemado de los
10 `test_*.sql`.

**❌ No se construye**
- Portal admin para nadie que no seas tú — sin invitaciones ni permisos por rol
- **Firma electrónica certificada.** La aceptación de términos se registra, no se firma con un
  proveedor externo. Si el abogado lo exige, es una integración aparte
- Edición de los datos que el Pawwer declaró — se aprueba o se rechaza, no se corrige por él.
  Los **hechos observados** sí los escribes tú: son tuyos, no suyos
- Reagendar la visita desde el lado del Pawwer sin pasar por ti

**✅ Criterio de cierre** — Recorrer el embudo **completo** sin tocar Supabase ni una vez:
registrar un Pawwer por la interfaz → verificar su cédula desde `/admin` → que haga examen y
capacitación → agendar visita sobre un cupo que tú abriste → completar la visita desde el móvil con
las cinco fotos, los hechos observados, precios, capacidad, agenda y términos → aprobar →
**encontrarlo en el marketplace como cliente anónimo**, con sus fotos y sus datos verificados.
Y, heredado de S2: **el viernes sale un archivo de dispersión que el banco acepta**.

---

### S4 · La puerta del cliente
**nov 2 – 15 · 2 semanas**

Construir la mitad del producto que hoy solo existe como columnas en la base de datos. Es lo que
convierte «dueños» en «dueños responsables».

### Qué hay construido hoy

| Pantalla | Estado | Qué le falta |
|---|---|---|
| `/` · home y buscador | ✅ **Construida** — 1.190 líneas, filtros de servicio y fecha reales, mapa, orden por nivel | Favoritos no persisten · `petsCount` decorativo · dos enlaces 404 · datos inventados en el hero |
| `/pawwer/[id]` · perfil público | ✅ **Construida** — galería, calendario, reseñas, presencia en vivo, metadatos OG | Sin corazón de favorito |
| `/booking/nuevo` · pasos 1–3 | ✅ **Construidos** — validan fechas, `week_pattern`, disponibilidad, tope de perros, ocupación real, consentimiento de bolsa | Al añadir un perro se pierde la reserva a medias (`?back=` que nadie lee) |
| `/booking/nuevo` · paso 4 | ✅ **S2** — ya no es un cartel: dice que todavía no se paga y lleva a la reserva, donde aparece el pago cuando el Pawwer acepta | — |
| `/mis-reservas` | ✅ **Construida** con realtime sobre `booking` | 🔴 **El Pawwer desaparece** · sin chat · sin temporizador · sin badge |
| `/booking/confirmada/[id]` | ✅ **Construida** — aquí sí se cancela y se reseña | Está escondida: no se llega desde `/mis-reservas` |
| `/mis-mascotas` | ✅ **Construida** | **Editar crea un duplicado** · queda sin navegación inferior |
| `/mis-mascotas/nueva` | ⚠️ **Sin Pasaporte** — 9 campos básicos | **0 de las 9 columnas** de la migración 57 |
| `/mis-favoritos` | 🔨 **Esqueleto** — el propio código lo admite | **Cero queries.** Empty-state escrito a mano |
| `/mis-mensajes` | 🔨 **Esqueleto** | **Cero queries, cero chat.** Es **S5** |
| `/mi-perfil` | 🔨 **Parcial** — lee nombre y avatar, cierra sesión | **No se puede editar nada** · tres filas «Pronto» |
| Auth · login, registro, recuperar, confirmar | ✅ **Construida** — zod, `next` preservado, anti open-redirect | — |

### 🔴 El Pawwer que desaparece

Es el defecto más grave del lado del cliente, y lo creó el modelo de dos etapas de S1.

Cuando una reserva pasa a la bolsa, el cron hace `pawwer_id = NULL`. Y la tarjeta hace esto:

```ts
const pawwerName = b.pawwer?.profile?.name ?? "Pawwer";
```

**Sofía reservó con Juliana. Juliana declina. La tarjeta pasa de «Juliana M.» con su foto a decir
literalmente «Pawwer», con una «P» genérica.** Sin explicación y sin aviso.

No es «falta una notificación»: es un estado que **parece un error de la aplicación**. Y le ocurre
justo en el momento de más ansiedad — cuando no sabe quién va a cuidar a su perro.

### Dos cosas que S1 volvió arreglables

- **`petsCount` es decorativo.** Se fija, se muestra en cinco sitios, y **nunca entra en el filtro
  ni en la URL de la reserva**. Un cliente con 3 perros ve los mismos resultados, elige un Pawwer
  de capacidad 1, y **se estrella en el paso 3**. Antes no había con qué filtrar; **desde la
  migración 61 sí lo hay** — `max_animals` es real y se hace cumplir
- **La advertencia de compatibilidad** de `Step3Mascota` es lógica muerta: `friendly_dogs` siempre
  es `null` porque nadie puede escribirlo. El Pasaporte la enciende

### Los datos inventados del hero

`4.9 / 5` · `+500 reseñas Google` · `15 Pawwers` están escritos a mano en `app/page.tsx`. Con 11
Pawwers verificados y 16 reservas históricas, **son prueba social falsa en la primera pantalla del
producto**. Es la misma clase de deuda que PawwiProtect, y del mismo tamaño: se retiran o se
calculan de verdad.

### El portal del cliente, definido

Cinco pestañas —las de `ClientNav`— y un ciclo de vida. Esto es lo que el cliente **puede hacer**
cuando S4 y S5 estén cerrados:

| Momento | Qué puede hacer | Dónde | Sprint |
|---|---|---|---|
| **Explorar** | Buscar sin registrarse, por servicio, fecha, **y número de perros** | `/` | S4 |
| | Guardar favoritos que **persisten** | `/` · `/pawwer/[id]` · `/mis-favoritos` | S4 |
| | Leer las **FAQ del Pawwer**, sus reseñas y las fotos verificadas de su hogar | `/pawwer/[id]` | ✅ ya |
| **Reservar** | Cuatro pasos, con ocupación real del día y aviso de compatibilidad | `/booking/nuevo` | ✅ ya |
| | Decidir si acepta un **sustituto de la bolsa** | paso 3 | ✅ S1 |
| | Llenar el **Pasaporte** de su perro y registrar su cédula | paso 3 | S4 |
| | **Pagar**, cuando el Pawwer ya aceptó | detalle de la reserva | ✅ S2 |
| **Esperar** | Ver **quién** tiene su reserva y en qué etapa, con temporizador | `/mis-reservas` | S4 |
| | Enterarse si pasó a la bolsa y **quién la tomó**, con enlace a su perfil | aviso + tarjeta | S5 |
| | Cancelar antes de que empiece | `/mis-reservas` | S4 · *hoy escondido* |
| **Durante** | **Chatear** con el Pawwer, mandar y recibir fotos | `/mis-mensajes` | S5 |
| | Ver el **reporte diario** | chat | S5 |
| | Saber **dónde queda la casa**, con enlace a Maps | detalle de la reserva | S4 |
| **Después** | Reseñar | `/booking/confirmada/[id]` | ✅ *hoy escondido* |
| | **Reservar de nuevo en un toque** | reserva completada · favoritos | S4 |
| **Su cuenta** | Editar nombre, foto y teléfono | `/mi-perfil` | S4 |
| | Gestionar sus perros | `/mis-mascotas` | ✅ ya |
| | **Eliminar su cuenta** | `/mi-perfil` | S4 · **obligación legal** |

### Tres decisiones de diseño

**La dirección del Pawwer se revela al confirmarse y pagarse.** Hoy el cliente **nunca la ve**: el
perfil público solo muestra el barrio, y si no hay transporte tiene que llevar el perro sin saber
a dónde. Se resuelve por chat, a mano, si el Pawwer se acuerda.

> Es **simétrico con la migración 65**, que hizo lo mismo al revés: el Pawwer solo ve la dirección
> del cliente cuando acepta. Antes de eso, barrio y distancia aproximada. La misma regla en las dos
> direcciones — el dato exacto aparece cuando hay un compromiso firme, no antes.

**No hay chat antes de reservar.** El Pawwer ya tiene FAQ que edita él mismo (`perfil/faq`), y el
Pasaporte hace que la información del perro viaje con la reserva. Abrir el chat antes es el camino
más corto a que cierren el trato por fuera de Pawwi — el chat ya bloquea teléfonos justo por eso —
y le añade trabajo no remunerado al Pawwer.

**Reservar de nuevo en un toque**, desde una reserva completada y desde favoritos: mismo Pawwer,
mismo servicio, solo elegir fechas. Ataca directo el problema que `docs/06` señala como la mayor
debilidad del modelo: **el uso es episódico y sin frecuencia el LTV es bajo**. Un cliente que ya
confió en Juliana no debería tener que volver a buscarla.

**Entregables · 4.1 · Que nadie desaparezca** 🔴

Va primero porque es lo único que hoy **parece un error de la app**.

- Cuando la reserva está en la bolsa, la tarjeta lo **dice**: «Buscando otro cuidador verificado
  por el mismo precio», con el nombre de quien no pudo. Nunca la palabra «Pawwer» como nombre
- Estado visible por etapa, no solo por `status_id`: *esperando a Juliana* · *en la bolsa* ·
  *la tomó Pedro, revísalo y paga*
- **Entrada a `/booking/confirmada/[id]`** desde `/mis-reservas` — hoy es donde se cancela y se
  reseña, y no se llega desde ninguna parte
- Temporizador: cuánto le queda al Pawwer para responder

**Entregables · 4.2 · El Pasaporte**

- **Formulario multi-paso** a mano con zod (sin `react-hook-form`, que no está en el stack):
  ficha, salud, comportamiento y rutina sobre la migración 57. Hoy `DogForm` usa **0 de sus 9
  columnas**.
  > Esto **desbloquea lógica que ya está escrita y hoy está muerta**: `shouldWarnClient` en
  > `lib/dog-behavior.ts` nunca se dispara porque `friendly_dogs` siempre es `null`, y los chips de
  > comportamiento que ve el Pawwer salen siempre «sin informar». Se construyó en S1 la lectura sin
  > la escritura.
- **Editar mascota está roto.** `mis-mascotas/page.tsx` enlaza `?edit=<id>` pero `nueva/page.tsx`
  **no lee `searchParams`**: el lápiz abre un formulario vacío y guardar **crea un perro duplicado**.
  Falta la acción `actualizarMascota`
- **Arreglar `?back=`**, que hoy manda a `/mis-mascotas` y **pierde la reserva a medias**

> ⚠️ **Antes de escribir una línea de 4.3 y 4.5: faltan permisos de tabla.** `client`, `favourite` y
> `dog_size` **no tienen ningún privilegio para `authenticated`** (comprobado el 2026-09-15). Es el
> mismo defecto que tumbó `dog` en la migración 69 y que ocultó que reservar era imposible. La
> primera migración de S4 tiene que concederlos, o el KYC y los favoritos fallarán con
> `permission denied` en cuanto se cableen. Detalle en [`08`](./08-INFRAESTRUCTURA.md) §
> «Los permisos de tabla son estado ambiental».

**Entregables · 4.3 · Favoritos, de verdad**

El corazón es solo `setFavorites`; la tabla `favourite` existe con RLS desde la migración 03 y está
**huérfana**. Son dos mitades que nunca se tocan: el home escribe en memoria y `/mis-favoritos`
renderiza un empty-state fijo sin consultar nada. Se cablean las dos, más el corazón en el perfil
público, que hoy no lo tiene.

**Entregables · 4.4 · El filtro de perros, que ya se puede**

`petsCount` entra en el filtro contra `max_animals` y viaja en la URL de la reserva. **Es nuevo que
esto sea posible:** la migración 61 hizo real la capacidad. Evita que un cliente con 3 perros
recorra tres pasos para estrellarse en el cuarto.

**Entregables · 4.5 · Identidad, cuenta y una obligación legal**

- **KYC del cliente:** cédula sobre la migración 58, escrita por RPC dedicado y leída enmascarada,
  igual que la cuenta de pago del Pawwer
- **Gate en `create_booking`:** no se reserva sin Pasaporte completo ni sin identidad registrada
- `/mi-perfil` **editable** — hoy lee nombre y avatar, cierra sesión, y tiene **tres filas
  «Pronto»**. No se puede cambiar ni el nombre ni la foto ni el teléfono
- ⚖️ **Eliminar la cuenta.** El Pawwer tiene `deactivate_pawwer_account` con su modal de «escribe
  ELIMINAR». **El cliente no tiene nada.** Suprimir datos es un derecho de la Ley 1581, no una
  función opcional

  > 🔴 **Y hay un obstáculo de esquema, encontrado el 2026-09-15:** `profile.id` **no tiene llave
  > foránea hacia `auth.users`**, así que borrar el usuario de Auth **deja el perfil vivo** —con
  > nombre, teléfono y dirección— y su celular sigue ocupando el índice único. Comprobado creando y
  > borrando usuarios de diagnóstico. La migración de S4 tiene que borrar el perfil de verdad, no
  > solo el usuario.
- **¿El celular debe seguir siendo único?** `profile.phone` es UNIQUE y no se verifica con OTP. Dos
  personas que comparten número —una familia— no pueden tener las dos cuenta, y hasta el 2026-09-15
  la app respondía «Ocurrió un error» sin decir por qué. Decisión de producto de este sprint

  > **Y la Política de Privacidad publicada ya afirma que existe:** «puedes editar tu perfil y tus
  > mascotas desde la aplicación, y eliminar tu cuenta desde tu perfil». Para el cliente **las dos
  > cosas son falsas hoy**. Se escribió el 2026-09-09 y el error es de quien la redactó. O se
  > construye en S4, o hay que corregir el texto antes — no puede quedarse como está.

**Entregables · 4.6 · La dirección del Pawwer**

En cuanto la reserva está confirmada y pagada, el detalle muestra **dónde queda la casa**, con
enlace a Google Maps. Hoy el cliente **nunca la ve**: el perfil público solo da el barrio, y si no
hay transporte tiene que llevar el perro sin saber a dónde.

Simétrico con la migración 65 — el dato exacto aparece cuando hay compromiso firme, en las dos
direcciones. Antes de eso, barrio y distancia aproximada.

**Entregables · 4.7 · Reservar de nuevo en un toque**

Desde una reserva completada y desde favoritos: mismo Pawwer, mismo servicio, solo elegir fechas.
Es el entregable más barato del sprint y el que ataca la debilidad que `docs/06` señala como la
mayor del modelo — **el uso episódico**.

**Entregables · 4.8 · Honestidad y remates**

- **Retirar los datos inventados del hero** — `4.9/5`, `+500 reseñas Google`, `15 Pawwers` — o
  calcularlos de verdad desde `reviews` y `pawwer`
- Los dos enlaces del menú que van a `/reservas` y `/mascotas`, que **no existen**: 404
- `/mis-mascotas` fuera de `CLIENT_TAB_ROOTS`, sin navegación inferior: es un callejón sin salida

> ### ⚠️ Ocho entregables no caben en dos semanas
> Contados con honestidad: 4.1 dos días · 4.2 tres · 4.3 uno · 4.4 medio · 4.5 dos y medio ·
> 4.6 medio · 4.7 uno · 4.8 medio. Son **once días**, y a cuatro días útiles por semana eso es
> **casi tres semanas**, no dos.
>
> **El orden ya es la respuesta.** Si hay que cortar, se corta por el final: 4.7 (reservar de
> nuevo) y 4.4 (el filtro de perros) son los que menos duelen — mejoran la conversión y la
> frecuencia, no la confianza. Lo que **no se puede cortar** es 4.1, 4.2 y 4.5: el Pawwer que
> desaparece, el Pasaporte que desbloquea lógica ya escrita, y la eliminación de cuenta, que es
> una obligación legal y además está **prometida por escrito** en la Política de Privacidad.
>
> Se anota aquí en vez de descubrirlo el 15 de noviembre.

**❌ No se construye**
- **OTP por SMS.** Requiere proveedor nuevo y costo por mensaje; va a v1.1
- **Chat antes de reservar.** Decisión de diseño, no de calendario: las FAQ del Pawwer y el
  Pasaporte cubren la duda previa, y abrir el chat antes es el camino más corto a que cierren por
  fuera de Pawwi
- **Reservas recurrentes** («todos los martes con Juliana»). Es lo que de verdad convierte el uso
  episódico en frecuente y encaja con el «día ocupado» del JTBD, pero toca el motor de reservas,
  los cupos y los cobros: es un sprint propio, después del lanzamiento
- Validación automática de la cédula contra fuentes externas
- Login con Google
- Historial médico del perro más allá del Pasaporte
- **El chat del cliente y las notificaciones** — son **S5**, y son la otra mitad de que el cliente
  deje de estar ciego. S4 arregla lo que ve; S5 le avisa
- Facturación y métodos de pago guardados: las dos filas «Pronto» que sobreviven

**✅ Criterio de cierre** — Dos cosas, y la segunda es la que importa:

1. Un cliente nuevo **no puede completar una reserva** sin haber llenado el Pasaporte de su perro
   y registrado su cédula.
2. Se reserva con un Pawwer, ese Pawwer declina, y **en ningún momento el cliente ve la palabra
   «Pawwer» donde debería ir un nombre**. Sabe qué pasó, quién no pudo, y qué sigue.

> **Decisión asumida:** se lanza con cédula y Pasaporte, **sin OTP de celular**. A volumen bajo el
> filtro real es que el Pasaporte obliga a dar información verdadera y que cada cliente es visible.
> El OTP es un mecanismo de escala, no de arranque. Si se prefiere lo contrario, +1 semana.

---

### S5 · Cerrar el círculo
**nov 16 – 29 · 2 semanas**

Hoy el cliente paga y queda ciego: solo el Pawwer tiene chat. Este sprint construye la tranquilidad
emocional que es, según las 40 entrevistas, el producto entero.

### Qué hay construido hoy

**Casi todo el backend, y nada del frontend del cliente.** Es el sprint con la mejor relación entre
lo que falta y lo que cuesta.

| Pieza | Estado |
|---|---|
| `send_message` con moderación de correos y teléfonos, tope de 2000 chars | ✅ **y ya autoriza a `client_id`** (mig 45) |
| Canal realtime `messages-${bookingId}` | ✅ **nombre neutro**, sirve igual para los dos lados |
| `messages` en la publicación de Realtime | ✅ mig 16 |
| Fotos al bucket `chat-photos`, validadas en servidor | ✅ mig 45 |
| `ChatRoom.tsx` · 677 líneas con realtime, dedup, envío optimista, HEIC | ✅ **el molde ya existe** |
| Tabla `notifications` + realtime | ✅ mig 23 |
| `usePresence` y la tabla `presence` con latido | ✅ mig 54 |
| `lib/email.ts` cableado a Resend | ✅ **sin la clave** — omite el envío y sigue |
| Chat del cliente | ❌ `/mis-mensajes` no hace **ni una query** |
| Campana del cliente | ❌ `NotificationsProvider` solo se monta en el portal del Pawwer |

> **El cliente ya tiene notificaciones que nadie puede leer.** `cancel_booking` le escribe filas en
> `notifications` desde la migración 32, y no hay campana que las muestre. Los datos existen desde
> julio; la interfaz no.

### Los avisos que hoy NO existen

Al cliente solo se le notifica si le cancelan. No sabe:

| Evento | Hoy | Por qué importa |
|---|---|---|
| El Pawwer **aceptó** | ❌ | Es el momento en que puede pagar y confirmar |
| Pasó a la **bolsa** | ❌ | 🔴 Su tarjeta cambia a «Pawwer» sin explicación — ver S4 |
| **La tomó otro** Pawwer | ❌ | Tiene que poder ver su perfil **antes** de pagar |
| Nadie la tomó · `sin_cuidador` | ❌ | Se queda esperando algo que ya murió |
| Reporte del día | ❌ | Es *el* producto según las 40 entrevistas |
| Servicio terminado | ❌ | — |

Los tres primeros son consecuencia directa del modelo de dos etapas de S1. **La confianza no se
transfiere en silencio** — `allow_pool` pide permiso, pero permiso no es lo mismo que enterarse.

**Entregables**
- 🔴 **Visibilidad del cliente sobre la bolsa. Va primero de todo.** Hoy solo se le notifica si le
  cancelan: no sabe si el Pawwer aceptó, si su reserva salió a la bolsa ni si se quedó sin cuidador.
  El consentimiento previo de S1 (`allow_pool`) evita la sustitución silenciosa, pero **no la
  sustituye**: quien dijo «sí, busquen otro» sigue necesitando saber **quién** es ese otro. Tres
  avisos concretos:
  1. **Salió a la bolsa** — «Juliana no está disponible; estamos buscando entre los Pawwers
     verificados por el mismo precio»
  2. **Alguien la tomó** — nombrando al Pawwer nuevo y **enlazando su perfil**, para que pueda
     mirarlo antes de pagar
  3. **Nadie la tomó** — `sin_cuidador`, con la salida de volver a buscar

  Sin esto, un cliente que investigó la casa de Juliana descubre que su perro va a la de Pedro sin
  haberlo visto. Es el daño de marca más rápido que puede hacerse el producto.
- **Chat del cliente**, reusando el patrón de `ChatRoom` del Pawwer: realtime, fotos, moderación y
  botón de soporte.
  > **El backend ya está listo:** `send_message` autoriza a `client_id` (mig 45) y el canal
  > `messages-${bookingId}` es neutro. Falta **solo la interfaz** — el molde son las 677 líneas de
  > `ChatRoom.tsx`. Hoy `/mis-mensajes` no hace ni una query: **el Pawwer escribe en un chat donde
  > nadie puede responder.**
- **Presencia del cliente.** `usePresence` ya está en el chat, pero `PresenceProvider` solo se monta
  en el portal del Pawwer: el cliente **nunca late** y el punto verde nunca se enciende
- **Reporte diario** en su forma mínima: el Pawwer marca un mensaje con foto como reporte del día,
  y eso alimenta el nivel. `messages.is_daily_report` existe en el esquema, se lee, y **se escribe
  siempre `false`** — columna fantasma desde la migración 02
- Campana y feed de notificaciones del cliente. `NavTab` de `ClientNav` **ya acepta `badge` y lo
  renderiza**, y ningún llamador se lo pasa: el contador está construido y desconectado
- **Correos por Resend** en el resto de eventos: reserva confirmada, reporte del día, servicio
  terminado, solicitud de reseña
- Timer de urgencia del lado del cliente
- Recordatorios automáticos 24 h y 2 h antes

**❌ No se construye**
- Push notifications del navegador
- WhatsApp Business por Railway
- Checks fisiológicos del reporte (comió, durmió, paseó)
- Plantillas de correo elaboradas — HTML simple y funcional

**✅ Criterio de cierre** — Un cliente recibe una foto de su perro durante un cuidado activo, por
correo y en la app, y puede responder desde su propia pantalla.

---

### S6 · Referidos
**nov 30 – dic 6 · 1 semana**

El único motor de adquisición con economía viable, y —vía el loop B— lo que vuelve las visitas
geográficamente densas. Va antes del lanzamiento porque tiene que estar vivo desde la primera
transacción.

### 🔴 La promesa ya está viva, y es impagable

`/pawwer/inicio` le dice **hoy** a cada Pawwer: *«Si un vecino reserva, ganas $20.000 COP extra»*.

Y `handleShare` comparte `/pawwer/{id}` **sin ningún parámetro**. No existe tabla de referidos, ni
columna de atribución, ni código en la URL. **El vecino reserva y el sistema no puede saber que
vino de él.**

> Es la misma clase de deuda que PawwiProtect. **S3 retira la promesa** de la tarjeta mientras la
> atribución no exista; este sprint la construye y la devuelve.

### Qué hay construido hoy

| Pieza | Estado |
|---|---|
| Tabla de referidos | ❌ **no existe** |
| Código o parámetro de atribución | ❌ **no existe** |
| Tarjeta de referidos en el inicio del Pawwer | ⚠️ existe y **promete sin poder cumplir** |
| `search_miss` · búsquedas sin resultado | ✅ **la construye S3** para las métricas |
| Cupos de visita por zona | ✅ **los modela S3** — es lo que hace posible el loop B |

**S3 hizo la mitad del trabajo de este sprint sin proponérselo:** el registro de búsquedas sin
resultado y la agenda de visitas por zona son las dos piezas que el loop B necesitaba.

**Entregables**
- **URL única por Pawwer y por cliente**, con atribución al completarse la primera reserva del
  referido
- **Loop B:** el Pawwer refiere vecinos, y los referidos del mismo conjunto se agrupan en un mismo
  cupo de visita
- **Loop C:** solicitud automática de referido tras una reseña de 5 estrellas
- Registro de búsquedas sin resultado, para dirigir las visitas por demanda real
- Cola de visitas visible para el Pawwer, acelerable refiriendo vecinos

**❌ No se construye**
- **Loop D** (cliente que se vuelve Pawwer) — necesita clientes con historial primero
- Loop E (saturación de conjunto) — necesita densidad primero
- Pago automático del incentivo de $20.000; al principio se liquida a mano
- Dashboard de referidos con métricas

**✅ Criterio de cierre** — Un Pawwer comparte su enlace, alguien reserva por ahí, y la atribución
queda registrada.

---

### S7 · QA y lanzamiento
**dic 7 – 19 · QA · pausa navideña · ene 5 – 12 · lanzamiento**

### Qué hay construido hoy

**Ningún framework de pruebas.** `package.json` no tiene script `test`, ni Vitest, ni Jest, ni
Playwright. Un `find` de `*.test.*` y `*.spec.*` no devuelve nada.

Lo que hay son **10 archivos `supabase/test_*.sql`**, y son mejores de lo que suena: siete se
autolimpian —siembran, comprueban con asertos y borran todo, restaurando incluso la disponibilidad
original— y tres son seeds de demo deliberados. Varios simulan la identidad del usuario con
`set_config('request.jwt.claims', …)`, que es el truco correcto para probar RPC `SECURITY DEFINER`.

**Pero los diez tienen dos dependencias que los rompen fuera de un entorno concreto:**

- un **UUID de Pawwer quemado** (`2dc6b8eb-…`), que es una cuenta real de una base específica
- **ninguno crea un cliente**: los seis hacen `SELECT … WHERE role='client' LIMIT 1` y abortan si
  no lo encuentran

**Los arregla S3** con el seed de cuentas reales. Hasta entonces, las pruebas SQL no corren en una
base limpia.

> **Y el 85% del uso es móvil, que nunca se revisó formalmente.** No es una tarea de QA más: es la
> mayoría del tráfico sobre una interfaz que solo se ha visto en un escritorio.

**dic 7 – 19 · QA**
- 3 a 5 clientes históricos y 5 Pawwers recorren el flujo completo con dinero real y montos bajos
- Prueba en Safari iOS y Chrome Android a 375 px — el 85% del uso es móvil y **nunca se revisó
  formalmente**
- Verificar que ningún teléfono aparece jamás en el chat
- Corrección de bugs que bloqueen pago o búsqueda
- SEO básico: meta tags por Pawwer, sitemap, Open Graph para compartir por WhatsApp
- Analítica de embudo: búsqueda, perfil visto, reserva iniciada, pago completado
- **Recorrido completo con los seeds de S3** — es la primera vez que se puede entrar como cada tipo
  de usuario en cada estado del embudo

**dic 21 – ene 4 · pausa navideña**

Deliberada, no un hueco. Un plan que finge que alguien trabaja del 24 al 31 se incumple solo.

**ene 5 – 9 · re-verificación**
- Volver a correr el recorrido completo: dos semanas sin tocar nada bastan para que algo externo
  cambie
- Aviso a los 22 clientes históricos

**ene 12 · soft launch**
- Guardia de 72 horas

**❌ No se construye**
- Función nueva de ningún tipo
- Los 16 errores de ESLint, salvo que rompan algo
- Campaña de marketing pago
- App nativa, paseos
- Nada del panel de operador: eso se cerró en S3

**✅ Criterio de cierre** — Cinco reservas reales completadas de punta a punta, pagadas y
calificadas, sin que nadie del equipo intervenga en ninguna.

---

## 🐾 Carril B · la oferta

Corre en paralelo desde la primera semana. Si empieza cuando el código termina, el lanzamiento se va
a febrero.

| Periodo | Trabajo | Meta |
|---|---|---|
| **Sep 7 – 13** | **Tapar la fuga de la landing.** Hoy `pawwi.co` manda a un WhatsApp que nadie contesta: recoge interesados y los quema. Cambiar el CTA por un formulario de Tally de **dos lados** (lista de espera de clientes + aplicación de Pawwers). Sin código, sin deploy | Fuga cerrada |
| Sep 7 – Oct 4 | Contactar y reactivar los 15 Pawwers actuales: confirmar que siguen, actualizar perfil, cargar disponibilidad | 15 activos |
| Oct 5 – Nov 1 | Visitas nuevas, 2 sábados al mes, agrupadas por conjunto | +8 |
| Nov 2 – Dic 20 | Visitas nuevas, priorizadas por **búsquedas sin resultado** — el dato lo empieza a registrar S3 | +12 |
| **Al lanzar** | Pawwers verificados con disponibilidad real cargada | **~35** |
| **Al lanzar** | Clientes en lista de espera para el soft launch (22 históricos + los que junte la landing) | **>40** |

> **Las seis semanas extra del calendario nuevo son seis semanas más de sábados.** El aplazamiento a
> enero, que es un costo del lado del código, es una ganancia del lado de la oferta: caben ~4
> sábados adicionales de visitas, y la oferta es el cuello de botella real.
>
> **Por qué la lista de espera importa más de lo que parece:** el lado Pawwer del formulario alimenta
> directamente ese cuello de botella — quien aplique se puede visitar los sábados, así que llegas al
> lanzamiento con más oferta. Y el lado cliente convierte el arranque en
> frío (el mayor riesgo del lanzamiento según el Service Blueprint) en un lanzamiento a gente que ya
> levantó la mano.

> ### ⚠️ La pregunta que puede mover todo el calendario
> **¿Los 15 Pawwers actuales ya tuvieron visita domiciliaria?**
>
> Si **sí**: el carril B de septiembre es telefónico y el plan se sostiene tal cual.
>
> Si **no**: son 15 visitas antes de poder lanzar, 3–4 sábados adicionales al frente del calendario.
> **Con el aplazamiento a enero esto dejó de ser un riesgo de fecha** y pasó a ser trabajo que cabe:
> hay sábados de sobra entre octubre y diciembre. Sigue sin responderse, y sigue conviniendo saberlo.
>
> Ojo con el orden: hasta que **S3** cierre el embudo (12 de octubre – 1 de noviembre), cada Pawwer
> que visites hay que publicarlo con dos `UPDATE` a mano en Supabase.

---

## ⚠️ Qué puede mover la fecha

| Factor | Impacto | Señal temprana |
|---|---|---|
| **El panel de S3 se desborda** | +1 a 2 sem | Es el trozo más grande y menos acotado del plan. **Lo primero que se recorta son las métricas** — `/admin/metricas` no bloquea el lanzamiento; las tres colas y el botón de aprobar, sí |
| Los 15 Pawwers sin visitar | +4 sem | Se sabe con una llamada |
| Ritmo real por debajo de 4 días/semana | +2 a 4 sem | Visible al cerrar S2 |
| Sorpresas en la integración de Bold | +1 a 2 sem | Visible al arrancar S2, con quince semanas de colchón |
| Se insiste en OTP por SMS antes de lanzar | +1 sem | Decisión de producto |
| Bold no dispersa a terceros | 0 al calendario | Confirmado. Cuesta operación semanal, no tiempo de construcción |
| Cuenta de comercio ya aprobada | **Riesgo eliminado** | Era la mayor incertidumbre del plan |
| **El pago va después de la aceptación** | **Riesgo eliminado** | Ya no hace falta saber si Bold soporta preautorización: era una dependencia externa en la ruta crítica |
| Aparece un socio o una contratación | −3 a 4 sem | S3 y S4 son los más paralelizables: el panel y el portal del cliente no se tocan |

### Sobre la caja

Este plan asume **dieciocho semanas sin ingresos** —del 7 de septiembre al 12 de enero—; eran doce
con la fecha de noviembre. El modelo financiero conservador ya marcaba alerta de caja en julio *con*
la venta corriendo desde mayo. Antes de comprometerse con el calendario hay que cuantificar la caja
real y la quema mensual.

Si la caja no llega a mediados de enero, el plan correcto es uno más corto, que recorta por donde
este documento ya dice que se recorta: las métricas de S3, la 4.7 y la 4.4 de S4, y S6 entero.
**Nunca** el cierre del embudo, el cobro, que nadie desaparezca de la tarjeta del cliente ni los
avisos de la bolsa — sin esos cuatro no hay producto que lanzar.

---

## 🔮 Después del lanzamiento

Explícitamente fuera de este plan, en orden de valor:

1. **Paseos.** El desbloqueo de frecuencia y de LTV. El uso hoy es episódico y sin esto el valor por
   cliente es bajo
2. **OTP por SMS** y verificación automática de cédula, cuando el volumen lo justifique
3. **Loop D:** el prompt de «vuélvete Pawwer» en el portal del cliente
4. ~~**Portal admin**~~ → **se adelantó a S3.** La auditoría del 2026-09-10 mostró que no es un
   «después»: sin él ningún Pawwer real llega al marketplace
5. Reporte diario completo con checks fisiológicos
6. Los 16 errores de ESLint y la deuda técnica acumulada

---

**Pawwi S.A.S.** · NIT 901.937.952-7 · Bogotá, Colombia · pawwi.co
