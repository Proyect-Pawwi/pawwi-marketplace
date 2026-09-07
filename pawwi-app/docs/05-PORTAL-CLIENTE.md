# 05 · Portal del Cliente y Onboarding Progresivo

> Referencia técnica y de UX/UI del lado del "dueño del perro": cómo estructuramos la navegación
> (BottomNav condicional) y el embudo de alta seguro (Lazy KYC). Este portal está **en
> construcción**; abajo se marca qué existe hoy y qué es de fases futuras.
> _Última actualización: 2026-07-17_

---

## 🎯 Filosofía de diseño (UX / JTBD)

Dos leyes en tensión que resolvemos con diseño:
1. **Fricción cero en la entrada:** el usuario se enamora de la oferta (casas, precios, pawwers)
   sin que le pidamos ni el nombre → maximiza conversión.
2. **Seguridad absoluta en la transacción:** en Colombia el Pawwer asume un riesgo al abrir su
   casa. Antes de una solicitud formal, el cliente pasa un filtro de identidad (KYC) y da detalles
   exhaustivos del perro.

---

## 📱 1. Arquitectura de navegación (BottomNav del cliente)

El cliente necesita herramientas de **tranquilidad y logística** (no de negocio como el pawwer).
El nav aparece **solo con sesión de cliente** y tiene **5 pestañas**:

| Tab (icono) | Ruta | JTBD | Estado |
|---|---|---|---|
| 🔍 **Explorar** (FAB) | `/` | "Quiero buscar opciones." | ✅ Home/buscador existente |
| ❤️ **Favoritos** | `/mis-favoritos` | "Guardar cuidadores." | 🟡 Esqueleto (persistencia = Fase B) |
| 📅 **Reservas** | `/mis-reservas` | "¿Cómo va el cuidado?" | ✅ Existe (realtime) |
| 💬 **Mensajes** | `/mis-mensajes` | "Saber cómo está mi perro." | 🟡 Esqueleto (chat = Fase D) |
| 👤 **Perfil** | `/mi-perfil` | "Gestionar mis datos." | 🟡 Esqueleto (hub) |

### Cómo está implementado (importante)
El nav del pawwer vive en un **route-group** con layout propio. El del cliente **no puede**: su
tab "Explorar" **es la raíz `/`**, que también sirve páginas públicas, el onboarding del pawwer y
las legales. Solución → **`components/ClientNav.tsx`**, un Client Component que se monta **una vez**
en `app/layout.tsx` (patrón "Active Nav Links" de Next) y se **auto-gatea**:
1. `usePathname()` contra un allowlist exacto `CLIENT_TAB_ROOTS` (las 5 rutas de arriba). Las
   sub-rutas y flujos profundos (`/booking/**`, `/pawwer/**`, auth, legales, `/mis-mascotas`)
   quedan fuera solos — mismo patrón que el `TAB_ROOTS` del pawwer.
2. **Sesión con `role='client'`** (leída en cliente vía `lib/client.ts` + `onAuthStateChange`). A
   un pawwer navegando `/` **no** se le muestra. La sesión se lee en el cliente (no en el layout
   server-side) para **no forzar render dinámico** en las páginas estáticas.

> El **Pasaporte / gestión de mascotas** NO es una pestaña: vive **dentro de `/mi-perfil`**
> (sección "Mis peludos") y enlaza a `/mis-mascotas`. Decisión de producto para no ensuciar el
> BottomNav de 5 tabs.

---

## 🛡️ 2. Embudo de onboarding progresivo (Lazy KYC)

No bombardeamos con formularios al inicio. Repartimos la carga en 3 fases:

### Fase 1 — Registro ligero (modo Explorador)
- **Cuándo:** al tocar el corazón (favorito) o "Iniciar sesión".
- **Qué pedimos:** auth básico de Supabase (`AuthModal` con login/registro/recuperar).
- **Resultado:** se crea `auth.uid()` (+ fila `client` por trigger `handle_new_client`), el usuario
  vuelve a donde estaba y aparece el `ClientNav`. Sigue sin identidad legal.

### Fase 2 — "Pasaporte Pawwi" (modo Preparación)
- **Cuándo:** al tocar "Reservar" en el perfil de un pawwer.
- **UX:** "Para que [Pawwer] apruebe tu reserva, necesitamos conocer a tu peludo."
- **Datos (escriben en `dog`):** ficha (foto, nombre, raza, edad, tamaño, sexo), **salud**
  (esterilizado, vacunas al día = `dog.vaccine`, notas médicas), **comportamiento** (amigable con
  perros/gatos/niños, ansiedad por separación, nivel de energía) y **rutina** (horarios de comida,
  reglas de casa). Los campos nuevos están en la **migración 57**.

### Fase 3 — Gate de seguridad y pago (modo Transacción)
- **Cuándo:** último paso de `/booking/nuevo`, antes de confirmar.
- **Filtro:** OTP SMS del celular · cédula · tarjeta (Wompi). Campos KYC en la **migración 58**.
- **Resultado:** la reserva pasa a estado `1 (pendiente)`; el pawwer la ve con el sello "Identidad
  verificada" y puede leer el Pasaporte completo del perro.

---

## 🏗️ 3. Impacto técnico y estado actual

**Ya construido (Bloque 0 · estructura):**
- `components/ClientNav.tsx` + montaje en `app/layout.tsx`.
- Rutas stub `/mis-favoritos`, `/mis-mensajes`, `/mi-perfil` (con gate de sesión, `loading.tsx` y
  empty-states, sin lógica de negocio).
- Migraciones **57** (`dog` — Pasaporte) y **58** (`client` — KYC) como columnas foundation.

**Pendiente (fases siguientes):**
- **Fase B — Favoritos real.** Hoy el corazón del home (`app/page.tsx`, `toggleFavorite`) es
  **solo estado local**, NO persiste. Falta escribir/leer la tabla `favourite` (RLS `favourite_owner`
  ya existe) y sincronizar home ↔ `/mis-favoritos`.
- **Fase C — `PasaporteForm.tsx`** multi-step. Se hará **a mano + `zod`** (como los forms del portal
  pawwer); NO se introduce `react-hook-form` (no está en el stack, evitamos dependencia).
- **Fase D — Chat del cliente.** Reusar el patrón `ChatRoom` del pawwer (ver
  `PENDIENTES-PORTAL-CLIENTE.md`).
- **Fase E — `/mi-perfil` funcional** (cuenta, facturación).
- **Fase F — KYC + gate.** OTP SMS + cédula + Wompi, y **actualizar `create_booking`** (migración
  59) para lanzar error si `client.cedula_verified = false` o el perro no tiene el pasaporte
  completo.
- **Fase G — Pagos Wompi** (cobro al reservar + refund en cancelación).
