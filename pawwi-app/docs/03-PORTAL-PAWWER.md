# 03 · Portal del Pawwer (pantalla por pantalla)

> El "back-office" del cuidador aprobado: gestiona solicitudes, cuidados, chat, dinero, su
> perfil y su disponibilidad. **Este es el foco del producto construido.**
> _Última actualización: 2026-07-17_

---

## 🧩 El layout compartido — `app/pawwer/(portal)/layout.tsx`

Todas las pantallas del grupo `(portal)` comparten un layout que:
- **Gate de acceso**: valida sesión y `pawwer.status === 'approved'`; si no → `redirect` a login
  o `/pawwer/dashboard`. Nadie entra sin estar verificado.
- Monta **`NotificationsProvider`** (campana + realtime sobre la tabla `notifications`) y
  **`PresenceProvider`** (heartbeat de presencia cada 30s + en foco/blur).
- Pinta la **atmósfera** (blobs difusos, ahora estáticos para no gastar GPU) y el **`BottomNav`**.
- **`BottomNav`** (`BottomNav.tsx`) solo se muestra en las **5 pantallas-tab** (inicio, cuidados,
  mensajes, ingresos, perfil). En sub-pantallas (editores, detalle, chat) se **oculta** — tienen
  botón "volver" y a veces su propia barra "Guardar", que antes chocaba con el nav.

**Tecnología base del portal:** Server Components para los *loaders* (`page.tsx` que hacen fetch
con `lib/server.ts`) que pasan datos a **Client Components** interactivos. Datos vía **RPCs**
Supabase (`SECURITY DEFINER`, scopeadas a `auth.uid()`), **Realtime** para lo que cambia en vivo,
y **Storage** para fotos.

---

## 1) 🏠 Inicio — `/pawwer/inicio`

**Archivos:** `inicio/page.tsx` (loader) → `InicioClient.tsx` + `NivelCard.tsx` + `EarningsChart.tsx`.

**Para qué es:** el tablero diario. Lo primero que ve el pawwer: solicitudes que atender, cómo
va su dinero y su nivel.

**Qué hace / funciones:**
- **Solicitudes pendientes** (`SolicitudCard`): cada solicitud con **temporizador de urgencia**
  (cuenta regresiva del plazo para aceptar), datos del cliente/mascota/fechas, dirección
  tappable a Google Maps, y desglose de ganancia. Botones **Aceptar / Declinar / Ver detalle**.
  Al vencer el timer, la solicitud **se escala** y desaparece del home.
- **Realtime**: las solicitudes nuevas (directas o candidaturas por escalación) aparecen **en
  vivo** (canal sobre `booking` + `booking_candidates` filtrado por `pawwer_id`).
- **Cuidados en curso**, **ingresos del período** con filtros (hoy/semana/mes/personalizado) y
  un **chart** (`recharts`, cargado **lazy** con `next/dynamic` para no engordar el bundle).
- **Tarjeta "Tu Nivel"** (`NivelCard`): revelación progresiva del nivel actual + meta inmediata
  + checklist + modal de beneficios (ver más abajo).
- **Referidos**, accesos rápidos, campana de **notificaciones**, y **presencia propia** (punto
  verde/amarillo sobre el avatar).

**Cómo (tech):** el loader corre `advance_booking_statuses` **en paralelo** con las lecturas
(RPCs `get_pawwer_stats`, `get_pawwer_earnings_daily`, `get_pawwer_bookings`,
`get_pawwer_level_detail`) — no bloquea la carga. Aceptar/declinar = RPCs `accept_booking` /
`decline_solicitud`.

**Por qué así:** el pawwer gana dinero **reaccionando rápido** a solicitudes con plazo, así que
el home prioriza velocidad (skeletons + realtime) y contexto para decidir (distancia, pago).

---

## 2) 📋 Cuidados — `/pawwer/cuidados` + detalle `/pawwer/cuidados/[id]`

**Archivos:** `cuidados/page.tsx` (lista) · `cuidados/[id]/page.tsx` + `BookingDetail.tsx` · `CuidadoTimer.tsx`.

**Para qué es:** el historial y la gestión de todos los cuidados por estado.

**Qué hace / funciones:**
- Lista filtrable por pestañas: **Nuevas (1) · Confirmadas (2) · En curso (3) · Completadas (4)
  · Canceladas (5)**.
- **Detalle** de un cuidado: datos completos, `CuidadoTimer` (cuenta "empieza en / termina en",
  *overnight-aware*), y —si hay transporte— el **popup obligatorio** para elegir quién lo hace
  (pawwer o Pawwi) justo después de aceptar.
- Avance de estados por tiempo (confirmado→en curso→completado) reflejado al abrir la pantalla.

**Cómo (tech):** loader llama `advance_booking_statuses` (en paralelo) + `get_pawwer_bookings`
con los `status_ids` de la pestaña. `RealtimeBookings` refresca en vivo. La decisión de
transporte usa `set_transport_provider`.

**Por qué así:** separa "lo que requiere acción" (nuevas) de "lo que ya está corriendo" e
"histórico" — el pawwer ubica de un vistazo qué le toca hacer.

---

## 3) 💬 Mensajes — `/pawwer/mensajes` + chat `/pawwer/mensajes/[bookingId]`

**Archivos:** `mensajes/page.tsx` (lista) · `mensajes/[bookingId]/page.tsx` + `ChatRoom.tsx`.

**Para qué es:** coordinar cada cuidado con el cliente (fotos, horarios, dudas) sin salir de Pawwi.

**Qué hace / funciones:**
- **Lista de conversaciones**: último mensaje, no-leídos, "en curso", ordenadas por actividad.
- **Chat** (`ChatRoom`) en **realtime**: mensajes de texto + **fotos** (incluye fix para HEIC de
  la cámara del iPhone vía `lib/image.ts`), **tarjeta "Resumen del cuidado"** (mensaje de sistema
  con fechas/dirección/transporte), **presencia de la contraparte** (el cliente; hoy en gris
  hasta que exista su portal), y **botón de soporte** (WhatsApp).
- **Moderación server-side**: `send_message` bloquea compartir **correos/teléfonos** (para
  mantener la transacción dentro de Pawwi) y valida que las fotos sean **solo** del bucket propio.

**Cómo (tech):** Supabase **Realtime** (canal `messages-{bookingId}`), RPCs `send_message` y
`mark_messages_seen`; fotos al bucket **público** `chat-photos` (con límites de mime/tamaño).

**Por qué así:** el chat es donde se genera confianza y se coordina la logística; la moderación
protege el modelo de negocio (que no se salten la plataforma).

---

## 4) 💵 Ganancias — `/pawwer/ingresos`

**Archivos:** `ingresos/page.tsx` (loader) → `GananciasClient.tsx`; + `cuenta-cobro`.

**Para qué es:** que el pawwer entienda **cuánto gana, cuándo le pagan y por qué**.

**Qué hace / funciones:**
- **Próximo pago automático** (ticket): monto y fecha del **viernes** de depósito.
- **Rendimiento** por período (este mes / mes pasado / año / todo) con barras de 6 meses.
- **Historial en 3 pestañas**: **Pagados / Pendientes** (desde el ledger real `booking.paid_at`)
  y **Cancelados** (solo los que el pawwer realmente aceptó, vía `accepted_at`).
- Tarjeta de **calidad/nivel** (progreso a la comisión 20%) y acceso a la **cuenta de cobro**.

**Cómo (tech):** RPC `get_pawwer_payout_summary` (calcula próximo viernes en zona Bogotá y sumas
del ledger). El pago se sella con `mark_payouts_paid` — **solo `service_role`** (un pawwer no
puede marcarse pagado a sí mismo).

**Por qué así:** transparencia total del dinero = confianza. El "ledger honesto" (`paid_at`)
reemplazó una heurística por fecha, para no mentir sobre qué está pagado.

---

## 5) ⚙️ Perfil — Centro de Control `/pawwer/perfil` (+ 6 sub-pantallas)

**Archivos:** `perfil/page.tsx` → `PerfilHub.tsx`, y sub-rutas `perfil/{vitrina,tarifas,pago,faq,resenas,fotos}`.

**Para qué es:** todo lo que el pawwer configura de su negocio y su cuenta.

**Hub (`/pawwer/perfil`):** cabecera con avatar + nivel/badge, **toggle Perfil activo / en pausa**
(oculta del marketplace sin desactivar la cuenta), **horarios de recepción**, y accesos a los
módulos + seguridad (cambiar contraseña, soporte, cerrar sesión, **eliminar cuenta** con modal
"escribe ELIMINAR" → soft-delete).

**Sub-pantallas** (patrón: **server-loader → client** con barra flotante **"Guardar cambios"**
que aparece solo si hay cambios y desaparece al guardar, usando un estado **`baseline`**):

| Ruta | Qué configura |
|---|---|
| `perfil/vitrina` | **Presentación**: profesión, años de experiencia, tiempo de respuesta, bio, **chips de experiencia** (sellos de confianza), y **detalles del hogar** (tipo, áreas, animales, niños, seguridad). Medidor de completitud. |
| `perfil/tarifas` | **Precios y reglas** por servicio: precio + calculadora de neto, activar/desactivar servicio, **tamaño máx.** y **máx. de mascotas a la vez**, y el **transporte** por trayecto. |
| `perfil/pago` | **Cuenta para pagos**: **llave Bre-B** (celular/correo/cédula/@) y/o cuenta bancaria (número **write-only + enmascarado**), + **certificación bancaria (PDF) obligatoria** (bucket privado). |
| `perfil/faq` | **Preguntas frecuentes** (jsonb, validadas server-side). |
| `perfil/resenas` | Lee las **reseñas** recibidas (solo lectura). |
| `perfil/fotos` | **Fotos del hogar** (subir, borrar, reordenar; portada; máx 8). |

**Cómo (tech):** cada módulo escribe por un **RPC** dedicado (`update_pawwer_vitrina`,
`update_service_rules`, `set_transport_price`, `update_pawwer_pago`, `update_pawwer_faqs`,
`set_service_active`, `set_accepting_bookings`, `set_recepcion_horario`,
`deactivate_pawwer_account`). Todo lo editado **se refleja en el perfil público** (`/pawwer/[id]`).

**Por qué así:** un solo "Centro de Control" estilo iOS Settings; el patrón `baseline` evita el
bug de que la barra "Guardar" quede pegada tras guardar. La escritura por RPCs (no directa) es la
base de seguridad (ver doc 04).

---

## 6) 🗓️ Disponibilidad — `/pawwer/disponibilidad`  ·  🧾 Cuenta de cobro — `/pawwer/cuenta-cobro`

> Ambas **fuera** del grupo `(portal)` (sin BottomNav; tienen botón "volver").

- **Disponibilidad** (`DisponibilidadCalendar.tsx`): calendario con **selección por rango**
  (toca inicio y fin, hasta 30 días) → **Habilitar / Bloquear** días, atajos por mes, y barra
  flotante de "Guardar". Escribe en la tabla `availability` (`upsert_availability` /
  `delete_availability`). El **cupo se descuenta al aceptar** una reserva, no al crearla.
- **Cuenta de cobro** (`cuenta-cobro/page.tsx`): documento **imprimible** (`window.print()`) con
  los cuidados completados **no pagados**, el total neto y la fecha del próximo pago. Usa
  `profile.name` + `pawwer.cedula`.

---

## 🎁 Sistema de niveles en el portal (tarjeta "Tu Nivel")

`NivelCard.tsx` en el home muestra **revelación progresiva**: nivel actual (chip + estrellas),
**la meta inmediata** (barra de progreso hacia el siguiente nivel — segmentada a Súper, continua
a Ranger), un **checklist accionable** (reseñas/rating/cancelación) y un **CTA** que abre un
**modal centrado** (`createPortal` a `document.body`, para escapar del `transform` residual de la
animación de entrada). Los colores/umbrales salen de `lib/levels.ts` — la misma fuente que usa el
marketplace y el perfil público, para que el chip se vea **idéntico** en todos lados.

**Por qué así:** el pawwer solo ve su próxima meta (no la final) → menos abrumación, más
motivación. El nivel conecta esfuerzo → beneficio real (comisión 20% + prioridad en búsqueda).
La lógica de niveles se explica en `04-BACKEND-Y-SEGURIDAD.md`.
