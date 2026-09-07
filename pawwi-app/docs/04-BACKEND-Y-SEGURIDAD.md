# 04 · Backend, seguridad y design system

> El motor que hace funcionar todo: base de datos, reservas, escalación, dinero, niveles,
> presencia; el modelo de seguridad; y las convenciones de front.
> _Última actualización: 2026-07-17_

---

## 🗄️ Base de datos (Supabase Postgres)

- **56 migraciones** en `supabase/*.sql` (`01…56`), **incrementales** e **idempotentes**. Se
  corren **a mano** en el SQL Editor de Supabase (owner), NO por CLI/REST. Los tests
  (`supabase/test_*.sql`) son auto-limpiantes con impersonación JWT.
- **Tablas núcleo**: `profile`, `client`, `pawwer`, `service_type`, `service_X_Pawwer`,
  `availability`, `booking`, `booking_status`, `booking_candidates`, `dog`, `dog_size`,
  `dog_booking`, `reviews`, `messages`, `notifications`, `favourite`, `Pawwer_images`,
  `presence` / `presence_ping`, y las de onboarding (`exam_results`, `capacitacion_results`,
  `visita_domiciliaria`).
- **Estados de reserva** (`booking_status`): `1 pendiente · 2 confirmada · 3 en curso ·
  4 completada · 5 cancelada · 6 sin_cuidador`.

---

## ⚙️ El motor (cómo funciona la operación)

### 🔄 Reservas + escalación en 3 instancias
Cuando un cliente crea una reserva (`create_booking`), esta busca cuidador en fases:
1. **Directo** (1h) — al pawwer elegido.
2. **±20% de precio** (6h) — se abre a cuidadores en ese rango.
3. **Ciudad** (6h) — se abre a más cuidadores.
4. **`sin_cuidador`** — si nadie acepta.

`find_escalation_candidates` busca candidatos con **disponibilidad en la fecha exacta**. "Primero
en aceptar gana": el **cupo se descuenta al ACEPTAR** (`accept_booking`, con `GET DIAGNOSTICS`
para cortar doble-aceptación), no al crear — así varios pueden ser candidatos a la vez.

### ⏱️ Ciclo de vida por tiempo + cron
- `advance_booking_statuses()` (por-pawwer, al abrir Home/Cuidados) y
  `advance_all_booking_statuses()` (global) mueven 2→3→4 según hora, en zona `America/Bogota`,
  y son **overnight-aware** (una pernocta que entrega de noche termina al día siguiente).
- **pg_cron** (mig 39): `run_booking_cron()` corre **cada minuto** (escalación + avance de
  estados). Un segundo job, **`pawwi-levels-daily`** (mig 56), recalcula niveles una vez al día
  (para las reglas por tiempo). Reemplaza a la vieja Edge Function `escalate-bookings` (que
  quedaba con 403).

### 💰 Dinero
- **Comisión por nivel, congelada por reserva** (`booking.commission_rate`): `create_booking`
  llama `compute_pawwer_level` → **0.20 si Ranger, 0.25 si no**.
- **Transporte**: `transport_legs` (0/1/2), `transport_fee`, `transport_provider` (`pawwer`|`pawwi`).
- **Ledger honesto**: `booking.paid_at` (cuándo se pagó de verdad) y `accepted_at` (cuándo
  aceptó). `mark_payouts_paid(pawwer, up_to)` sella el pago — **solo `service_role`**.

### ⭐ Reseñas / rating / 🎖️ niveles
- `create_review` valida (reserva del cliente + completada + único) y un **trigger**
  (`refresh_pawwer_rating`) recalcula `pawwer.rating`/`reviews_count` **y** el **nivel**.
- **Niveles** (mig 56): `compute_pawwer_level(id)` es la **fuente única** de las reglas:
  - **Ranger**: `reviews≥15 ∧ rating≥4.8 ∧ cancel_rate≤0.02 ∧ activo 30d`.
  - **Súper**: `reviews≥5 ∧ rating≥4.5 ∧ cancel_rate≤0.10`.
  - **Nuevo**: piso.
  - `cancel_rate` = canceladas **por el pawwer** / aceptadas (usa `booking.cancelled_by`).
    `activo 30d` = presencia (mig 54) **o** una reserva aceptada/completada en 30 días.
  - Se guarda en `pawwer.level` (para ordenar el marketplace y leerlo barato). Se recalcula por
    **evento** (reseña, cancelación) y por **cron diario** (reglas por tiempo).

### 🟢 Presencia (mig 54)
Tabla `presence` (estado actual: `active`/`idle` + `last_seen_at`) alimentada por un **heartbeat**
(RPC `heartbeat`) cada 30s. `presence_ping` (append-only) guarda actividad por minuto para
**métricas**. Se muestra en 3 lugares (home, perfil público, chat) como verde/amarillo/rojo.

### 💬 Chat (mig 45)
`send_message` con **moderación** (bloquea correos/teléfonos), validación de URL de foto (solo
bucket propio) y tope de longitud. Fotos al bucket público `chat-photos`.

---

## 🔒 Modelo de seguridad

> Filosofía: **el cliente nunca escribe directo a las tablas de negocio.** Todo pasa por RPCs
> controladas.

- **RLS activo** en todas las tablas. La **escritura directa** (INSERT/UPDATE/DELETE) a las
  tablas sensibles (`booking`, `pawwer`, `messages`, `availability`, `reviews`, `notifications`,
  `booking_candidates`, `service_X_Pawwer`) está **REVOCADA** (mig 44). Solo queda escritura
  directa a `dog`, `profile` y las tablas de onboarding — cubiertas por RLS del dueño.
- **Todas las escrituras van por RPCs** `SECURITY DEFINER SET search_path = public`, scopeadas a
  `auth.uid()` → una función corre como owner (bypass RLS) pero **solo toca las filas del usuario
  autenticado**.
- **Inyección SQL: imposible** — todo parametrizado; el único SQL dinámico (detección de columna
  FK en mig 50) usa `%I` sobre un nombre del catálogo, nunca input de usuario.
- **XSS: imposible** — **cero `dangerouslySetInnerHTML`** en todo el proyecto; React escapa.
- **PII de pago**: número de cuenta **write-only** + **enmascarado** al leerlo (`••••1234`);
  certificación en bucket **privado**.
- **Storage buckets**: privados `cedula-docs` / `pago-docs` (RLS por carpeta `<uid>/…`),
  públicos `chat-photos` / `pawwer-images` (con límites de mime/tamaño + validación de URL en las
  RPCs). Las subidas están scopeadas por RLS a la carpeta del propio usuario.
- **Endpoint server** (`/api/pawwer/notify-approved`): único con `service_role`, **fail-closed**,
  secret por header, `escapeHtml` en el email.

---

## 🎨 Design system y front (transversal)

- **Tokens** (`app/globals.css`): cream `#FFF1EB`, midnight `#120A2B`, tangerine `#FF7031`,
  plum `#F7AEF1`, blue-ice `#92C0E9`. Fuentes: `--font-sans` (Jakarta) en el root de toda
  pantalla (el `body` default es Montserrat).
- **Headers**: pantalla-tab = `h1 text-3xl font-black` + chip de ícono, **sin** "volver";
  sub-pantalla = `text-2xl font-black` + botón `<ArrowLeft>`. Antetítulo/eyebrow = clase
  **`.eyebrow`** (fuente única; reemplazó ~44 variantes inline).
- **Motion / performance**: clase **`.enter`** + `.enter-1..6` (entrada escalonada), **skeletons**
  de navegación (`loading.tsx` por tab + `components/PortalSkeleton.tsx`), y respeto a
  **`prefers-reduced-motion`**. Perf: `advance_booking_statuses` en paralelo, chart lazy, blobs
  estáticos.
- **Fuentes únicas** para evitar drift: `lib/levels.ts` (niveles) y `lib/services.ts` (labels +
  colores de servicio). `lib/image.ts` (`resizeImage` con soporte HEIC).
- **Formateo determinístico** de fechas/horas en zona Bogotá (restar 5h + `getUTC*`, sin
  `toLocale*`) para evitar hydration mismatch y desfases de TZ.

> ⚠️ **Ojo de seguridad conocido (por diseño)**: `profile_own: FOR ALL USING(auth.uid()=id)`
> bloquea lecturas anónimas del JOIN a `profile` en algunos contextos — decisión de producto,
> "dejar así".

---

## 🟡 Backlog / pendientes

- **Pagos reales** (Wompi): hoy existe el ledger `paid_at` pero no hay cobro ni transferencia.
- **Emails** (Resend): avisos al cliente (aceptación/escalación/sin_cuidador) — pendientes.
- **Portal del Cliente**: chat, notificaciones y timer del lado cliente (ver
  `PENDIENTES-PORTAL-CLIENTE.md`).
- **Portal Admin (Luisa)**: aprobar pawwers/visitas, dashboard, marcar pagos.
- **Menores**: `next/image` (hoy `<img>`), paginación del marketplace a escala, **validar
  `max_animals`/`max_size` en la reserva** (hoy se muestran pero no se hacen cumplir).
- **Git**: gran parte del trabajo reciente aún **sin commitear** — conviene versionar.
