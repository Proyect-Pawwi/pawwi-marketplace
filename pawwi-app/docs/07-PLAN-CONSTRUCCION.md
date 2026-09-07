# 07 · Plan de construcción — 12 semanas

> Siete sprints, dos carriles en paralelo, y una regla nueva contra el error que hundió el plan
> anterior: **cada sprint declara qué NO se construye.**
> Producto definido en [`06-PRODUCTO-REDISENO.md`](./06-PRODUCTO-REDISENO.md).
> _Última actualización: 2026-09-07_

## 🚀 Lanzamiento objetivo: **30 de noviembre de 2026**

Soft launch a los 22 clientes históricos, justo antes de la temporada alta de viajes de diciembre
—que según el JTBD es el trabajo de mayor ticket (PawwiTravel).

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
        sep 7   sep 14   sep 21   sep 28   oct 5   oct 12   oct 19   oct 26   nov 2   nov 9   nov 16   nov 23
       ┌──────┬────────────────┬────────────────┬────────────────┬────────────────┬──────┬────────────────┐
CÓDIGO │  S0  │       S1       │       S2       │       S3       │       S4       │  S5  │       S6       │
       │Rescate│   Rediseño    │   EL DINERO    │ Puerta cliente │ Cerrar círculo │Refer.│  QA + LANZA    │
       └──────┴────────────────┴────────────────┴────────────────┴────────────────┴──────┴────────────────┘
       ┌───────────────────────────────────────┬──────────────────────────────────────────────────────────┐
OFERTA │   Reactivar los 15 Pawwers actuales   │   Visitas domiciliarias · 2 sábados al mes                │
       └───────────────────────────────────────┴──────────────────────────────────────────────────────────┘
```

**Ritmo asumido:** cuatro días enfocados de código por semana, más dos sábados al mes para visitas.
No son cinco días: hay que dejar aire para soporte, decisiones y la vida. Un plan que asume 100% de
disponibilidad es un plan que se incumple en la semana tres.

---

## ⛓️ La ruta crítica no es código

| Dependencia | Por qué bloquea | Latencia |
|---|---|---|
| Cuenta de comercio Bold | Sin cuenta aprobada no hay cobro real | ✅ **Ya resuelta** |
| Verificación de dominio en Resend | Registros DNS en `pawwi.co` + propagación | 1–3 días |
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

## 📦 Los siete sprints

### S0 · Rescate y desbloqueo
**sep 7 – 13 · 1 semana**

Poner a salvo tres meses y medio de trabajo, y arrancar los relojes externos. Es el sprint con menos
código y el que más desbloquea.

**Entregables**
- **Commit y push de todo.** 56 archivos, ~19.200 líneas de app y 8.319 de SQL, sin respaldar desde
  el 23 de mayo. Agrupado en commits coherentes por área
- Verificar que `.env.local` está ignorado y que ningún secreto se cuela
- ~~Credenciales de Bold en sandbox y producción~~ ✅ llaves de identidad en `.env.local`; falta pegar las secretas
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

**✅ Criterio de cierre** — El código está en GitHub, la app responde en una URL pública con HTTPS,
las credenciales de Bold están en producción y el dominio de Resend está verificado.

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
- **Reserva instantánea:** columna `instant_booking`, rama en `create_booking` con bloqueo de cupo
  al crear, exclusión del cron de escalación
- Reescribir términos y privacidad: intermediario explícito, sin Fondo de Asistencia

**❌ No se construye**
- Reporte diario formal
- Precios por nivel de capacidad dentro de un mismo Pawwer
- Rediseño visual de la búsqueda — solo cambia la lógica
- Portal admin

**✅ Criterio de cierre** — Una reserva de prueba con un Pawwer de capacidad 3 y transporte propio
recorre el flujo completo, y en ningún lugar del producto aparece Pawwi como transportador.

---

### S2 · El dinero
**sep 28 – oct 11 · 2 semanas**

El sprint que convierte el producto en negocio, adelantado al segundo lugar porque es el de mayor
riesgo técnico y la cuenta de Bold ya está lista.

**Entregables**
- **Checkout de Bold.** Preferir el hospedado: el cliente paga en la interfaz de Bold y Pawwi nunca
  toca datos de tarjeta
- Endpoint de creación de la sesión de pago con el monto total (cuidado + transporte)
- **Webhook de confirmación** que mueve la reserva a confirmada y sella `paid_at`
- Retención de la comisión con la tasa congelada en `booking.commission_rate`
- Pantalla de pago fallido con tres salidas: reintentar, cambiar método, escribir a soporte
- Expiración de reservas sin pagar a los 30 minutos, liberando el cupo
- Reembolso en cancelación según la política de 48 horas
- **Pantalla de liquidación semanal** para ti: qué le debes a cada Pawwer el viernes, con su cuenta
- **Exportación del archivo de dispersión masiva** con el formato del banco, y marcado en lote con
  `mark_payouts_paid`

**❌ No se construye**
- Dispersión automática — **Bold no la soporta**, es manual y punto
- Propinas
- Descuentos, cupones y códigos promocionales
- Suscripciones o membresías

**✅ Criterio de cierre** — Una transacción real de punta a punta: el cliente paga con tarjeta, la
reserva se confirma sola, la comisión queda retenida, y el viernes sale un archivo que el banco acepta.

> ### ⚠️ La única operación recurrente que sobrevive
> Bold no dispersa a terceros, así que Pawwi cobra el 100% y transfiere el 75% a cada Pawwer. A 30
> Pawwers con cuatro servicios al mes son **~30 transferencias semanales**.
>
> Transcribirlas a mano no escala y es un error humano esperando ocurrir sobre dinero ajeno. Por eso
> la liquidación no produce una lista: produce un **archivo de dispersión masiva** que se sube al
> banco de una sola vez. El trabajo semanal pasa a ser de minutos y deja de crecer con el número de
> Pawwers.

---

### S3 · La puerta del cliente
**oct 12 – 25 · 2 semanas**

Construir la mitad del producto que hoy solo existe como columnas en la base de datos. Es lo que
convierte «dueños» en «dueños responsables».

**Entregables**
- **Formulario del Pasaporte Pawwi**, multi-paso y a mano con zod: ficha, salud, comportamiento y
  rutina sobre la migración 57
- **KYC del cliente:** cédula sobre la migración 58, escrita por RPC dedicado y leída enmascarada,
  igual que la cuenta de pago del Pawwer
- **Gate en `create_booking`:** no se reserva sin Pasaporte completo ni sin identidad registrada
- Favoritos con persistencia real sobre la tabla `favourite` — hoy el corazón es solo estado local
- `/mi-perfil` funcional: datos, mascotas, cuenta

**❌ No se construye**
- **OTP por SMS.** Requiere proveedor nuevo y costo por mensaje; va a v1.1
- Validación automática de la cédula contra fuentes externas
- Login con Google
- Historial médico del perro más allá del Pasaporte

**✅ Criterio de cierre** — Un cliente nuevo no puede completar una reserva sin haber llenado el
Pasaporte de su perro y registrado su cédula.

> **Decisión asumida:** se lanza con cédula y Pasaporte, **sin OTP de celular**. A volumen bajo el
> filtro real es que el Pasaporte obliga a dar información verdadera y que cada cliente es visible.
> El OTP es un mecanismo de escala, no de arranque. Si se prefiere lo contrario, +1 semana.

---

### S4 · Cerrar el círculo
**oct 26 – nov 8 · 2 semanas**

Hoy el cliente paga y queda ciego: solo el Pawwer tiene chat. Este sprint construye la tranquilidad
emocional que es, según las 40 entrevistas, el producto entero.

**Entregables**
- **Chat del cliente**, reusando el patrón de `ChatRoom` del Pawwer: realtime, fotos, moderación y
  botón de soporte. La RLS ya lo permite (`messages_select_parties` cubre a ambas partes)
- **Reporte diario** en su forma mínima: el Pawwer marca un mensaje con foto como reporte del día,
  y eso alimenta el nivel
- Campana y feed de notificaciones del cliente
- **Correos por Resend** en los eventos que importan: reserva confirmada, Pawwer aceptó, escaló,
  sin cuidador, reporte del día, servicio terminado, solicitud de reseña
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

### S5 · Referidos
**nov 9 – 15 · 1 semana**

El único motor de adquisición con economía viable, y —vía el loop B— lo que vuelve las visitas
geográficamente densas. Va antes del lanzamiento porque tiene que estar vivo desde la primera
transacción.

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

### S6 · QA y lanzamiento
**nov 16 – 29 · 2 semanas**

**Entregables · semana 1 (QA)**
- 3 a 5 clientes históricos y 5 Pawwers recorren el flujo completo con dinero real y montos bajos
- Prueba en Safari iOS y Chrome Android a 375 px — el 85% del uso es móvil y **nunca se revisó
  formalmente**
- Verificar que ningún teléfono aparece jamás en el chat
- Corrección de bugs que bloqueen pago o búsqueda
- SEO básico: meta tags por Pawwer, sitemap, Open Graph para compartir por WhatsApp
- Analítica de embudo: búsqueda, perfil visto, reserva iniciada, pago completado

**Entregables · semana 2 (soft launch)**
- Aviso a los 22 clientes históricos
- Guardia de 72 horas

**❌ No se construye**
- Función nueva de ningún tipo
- Los 16 errores de ESLint, salvo que rompan algo
- Campaña de marketing pago
- App nativa, paseos, portal admin

**✅ Criterio de cierre** — Cinco reservas reales completadas de punta a punta, pagadas y
calificadas, sin que nadie del equipo intervenga en ninguna.

---

## 🐾 Carril B · la oferta

Corre en paralelo desde la primera semana. Si empieza cuando el código termina, el lanzamiento se va
a febrero.

| Periodo | Trabajo | Meta |
|---|---|---|
| Sep 7 – Oct 4 | Contactar y reactivar los 15 Pawwers actuales: confirmar que siguen, actualizar perfil, cargar disponibilidad | 15 activos |
| Oct 5 – Nov 1 | Visitas nuevas, 2 sábados al mes, agrupadas por conjunto | +8 |
| Nov 2 – Nov 29 | Visitas nuevas, priorizadas por búsquedas sin resultado | +8 |
| **Al lanzar** | Pawwers verificados con disponibilidad real cargada | **~30** |

> ### ⚠️ La pregunta que puede mover todo el calendario
> **¿Los 15 Pawwers actuales ya tuvieron visita domiciliaria?**
>
> Si **sí**: el carril B de septiembre es telefónico y el plan se sostiene tal cual.
>
> Si **no**: son 15 visitas antes de poder lanzar, es decir 3–4 sábados adicionales al frente del
> calendario, y el lanzamiento se corre a mediados de diciembre — lo cual choca con la temporada de
> viajes y probablemente conviene aplazar a enero.

---

## ⚠️ Qué puede mover la fecha

| Factor | Impacto | Señal temprana |
|---|---|---|
| Los 15 Pawwers sin visitar | +4 sem | Se sabe esta misma semana |
| Ritmo real por debajo de 4 días/semana | +2 a 4 sem | Visible al cerrar S1 |
| Sorpresas en la integración de Bold | +1 a 2 sem | Visible en la semana 4, con ocho de colchón por delante |
| Se insiste en OTP por SMS antes de lanzar | +1 sem | Decisión de producto, hoy |
| Bold no dispersa a terceros | 0 al calendario | Confirmado. Cuesta operación semanal, no tiempo de construcción |
| Cuenta de comercio ya aprobada | **Riesgo eliminado** | Era la mayor incertidumbre del plan |
| Aparece un socio o una contratación | −3 a 4 sem | S3 y S4 son los sprints más paralelizables |

### Sobre la caja

Este plan asume **doce semanas sin ingresos**. El modelo financiero conservador ya marcaba alerta de
caja en julio *con* la venta corriendo desde mayo. Antes de comprometerse con el calendario hay que
cuantificar la caja real y la quema mensual — si el runway no llega a diciembre, el plan correcto no
es este sino uno de **ocho semanas** que sacrifica S5 y la mitad de S3.

---

## 🔮 Después del lanzamiento

Explícitamente fuera de las doce semanas, en orden de valor:

1. **Paseos.** El desbloqueo de frecuencia y de LTV. El uso hoy es episódico y sin esto el valor por
   cliente es bajo
2. **OTP por SMS** y verificación automática de cédula, cuando el volumen lo justifique
3. **Loop D:** el prompt de «vuélvete Pawwer» en el portal del cliente
4. **Portal admin**, reducido a dos pantallas: quién espera visita y en qué zona, y la liquidación
   semanal
5. Reporte diario completo con checks fisiológicos
6. Los 16 errores de ESLint y la deuda técnica acumulada

---

**Pawwi S.A.S.** · NIT 901.937.952-7 · Bogotá, Colombia · pawwi.co
