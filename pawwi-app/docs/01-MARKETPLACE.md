# 01 · Marketplace (lado cliente)

> Todo lo que ve y hace el **dueño del perro** (cliente): buscar, ver perfiles, reservar y
> gestionar sus reservas/mascotas.
> _Última actualización: 2026-07-17_

---

## 🏠 Home / Buscador — `/` (`app/page.tsx`)

**Para qué es:** la puerta de entrada pública. Un **buscador estilo Airbnb** para encontrar
pawwers disponibles cerca, filtrando por servicio y fecha, con mapa y tarjetas.

**Qué hace / funciones:**
- **Hero + barra de búsqueda** (`AddressAutocomplete` con Google Maps para "¿dónde?"): el
  cliente escribe su dirección/barrio → se obtienen coords para el filtro por distancia.
- **Filtros de servicio** (Todos / Daycare / Nightcare / Travel / Express) — pills.
- **Filtro por fecha / rango** (para Travel se elige rango) → cruza con la tabla `availability`
  y solo deja pawwers con **cupo real** en esas fechas.
- **Filtro por radio** (1/2/5/10 km) con "auto-expand": si a ese radio hay 0 resultados, prueba
  a 3 km y luego muestra todos → **nunca pantalla vacía**.
- **Mapa** (`components/MapView.tsx`, cargado con `next/dynamic({ ssr:false })` porque Google
  Maps necesita `window`) con marcadores de cada pawwer, sincronizado con la tarjeta seleccionada.
- **Tarjetas de pawwer**: foto del hogar, **chip de nivel** (Nuevo/Súper/Ranger con los colores
  de `lib/levels.ts`), rating, ubicación + distancia, precio "desde", servicios y **favorito**
  (corazón, se guarda en la tabla `favourite`).
- **Ordenamiento**: la lista final se ordena por **nivel** (`Ranger > Súper > Nuevo`) y luego
  por rating — así los mejores cuidadores salen primero (regla del sistema de niveles).
- **Registro lazy**: puedes navegar y buscar sin cuenta; el `AuthModal` (`components/AuthModal.tsx`)
  solo aparece cuando intentas una acción que requiere sesión (reservar/favoritos).

**Cómo (tech):**
- Client Component (`"use client"`) que hace fetch a Supabase (browser client `lib/client.ts`):
  `supabase.from("pawwer").select(...)` filtrado por `verified=true`, `accepting_bookings=true`,
  `deactivated_at is null`, `lat not null`. Trae `level`, precio, rating, servicios, imágenes.
- El **ordenamiento es en cliente** (no `.order()` en la query) porque se combina con el filtro
  de distancia (Haversine) y disponibilidad, que también se resuelven en cliente.
- Disponibilidad: segunda query a `availability` (`slots_remaining > 0`) para las fechas elegidas.
- `mapDbPawwer()` normaliza cada fila del DB al tipo `Pawwer` de la UI.

**Por qué así:** el buscador debe sentirse instantáneo y "explorable" sin fricción (registro
lazy = más conversión). El ordenamiento por nivel conecta el marketplace con el incentivo del
portal pawwer (subir de nivel = más visibilidad).

---

## 👤 Perfil público del pawwer — `/pawwer/[id]`

**Archivos:** `app/pawwer/[id]/page.tsx` (UI) + `app/pawwer/[id]/layout.tsx` (metadata SEO/OG).

**Para qué es:** la vitrina del pawwer que ve el cliente antes de reservar. Genera confianza y
es la superficie donde el cliente **decide y reserva**.

**Qué hace / funciones:**
- **Galería de fotos del hogar** (respeta el `sort_order` que el pawwer definió) con chip de
  **nivel** encima.
- **Cabecera de identidad**: nombre, **chip de nivel** + chip **"Verificado"** (de
  `pawwer.verified`), profesión, ubicación, rating + nº reseñas, tiempo de respuesta y
  **presencia en tiempo real** ("Activo ahora / Ausente / Activo hace X" — `components/Presence.tsx`).
- **Stats** (años de experiencia, cuidados), **presentación/bio**, **chips de experiencia**
  (sellos de confianza), **detalles del hogar reales** (mascotas en casa, tipo de inmueble,
  áreas externas, seguridad).
- **Servicios + calculadora de reserva**: precio por servicio, y bajo el selector las **reglas
  de mascotas** ("Acepta hasta N perros · hasta tamaño X").
- **Disponibilidad** (calendario con días habilitados), **horarios de recepción**, **FAQ** y
  **reseñas** verificadas.
- **CTA de reserva**: deshabilitado con banner si el perfil está **en pausa**
  (`accepting_bookings=false`); si el pawwer desactivó su cuenta o el `id` no existe →
  pantalla **"Este perfil ya no está disponible"** (se usa `maybeSingle()` para no romper con
  ids inválidos).

**Cómo (tech):** Client Component que hace una query grande a `pawwer` con embeds (profile,
servicios, imágenes, reseñas) + query a `availability`. `mapDbToPawwer()` arma el modelo de UI
con datos **reales** (no placeholders). El `layout.tsx` genera `generateMetadata` (title/OG con
foto y barrio) para que el link sea compartible con buena preview.

**Por qué así:** es el punto de conversión — todo lo que el pawwer edita en su portal
(fotos, tarifas, bio, disponibilidad, pausa) se refleja aquí en tiempo (casi) real, para que el
esfuerzo del cuidador tenga payoff visible.

---

## 🛒 Flujo de reserva — `/booking/nuevo` → `/booking/confirmada/[id]`

**Archivos:** `app/booking/nuevo/` (`page.tsx` orquesta + `BookingHeader`, `Step1Servicios`,
`Step2Fechas`, `Step3Mascota`, `Step4Resumen`) y `app/booking/confirmada/[id]/` (+ `BookingActions`).

**Para qué es:** convertir la intención (desde el perfil público) en una **reserva** creada.

**Qué hace / funciones (4 pasos):**
1. **Servicios** — elegir el tipo de cuidado.
2. **Fechas / horas** — fecha o rango + hora de entrega/recogida (el cliente elige las horas;
   el motor es *overnight-aware* para pernoctas).
3. **Mascota(s) + transporte** — cuáles perros, y si quiere transporte (0/1/2 trayectos) +
   dirección de recogida (`AddressAutocomplete`).
4. **Resumen** — desglose de precio (cuidado + transporte) y confirmar.

**Cómo (tech):** al confirmar se llama al RPC **`create_booking`** (SECURITY DEFINER) que:
valida que las mascotas sean del cliente, verifica disponibilidad, **congela la comisión según
el nivel del pawwer** (`compute_pawwer_level` → 20% Ranger / 25%), calcula transporte y crea el
`booking` en estado `pendiente (1)` + `dog_booking`. La reserva entra al **motor de escalación**
(ver `04-BACKEND-Y-SEGURIDAD.md`).

**Reserva confirmada** (`/booking/confirmada/[id]`): resumen + `BookingActions` (cuando el
cuidado está completado, el cliente deja **reseña/rating** vía `create_review`).

---

## 📋 Área del cliente

| Ruta | Qué hace |
|---|---|
| `/mis-reservas` (`app/mis-reservas/page.tsx`) | Lista de reservas del cliente, **en vivo** (`RealtimeClientBookings`): estados, pawwer asignado, canceladas. Se actualiza cuando el pawwer acepta/cancela. |
| `/mis-mascotas` · `/mis-mascotas/nueva` | Gestión de las mascotas del cliente (perfil del perro: raza, peso, sexo, notas). Escritura directa a `dog` (permitida por RLS del dueño). |

**Auth del cliente:** `/login`, `/registro` (+ `/registro/confirmar`), `/recuperar`,
`/nueva-contrasena`, y el **route handler** `/auth/confirm` (`route.ts`) que procesa el link de
confirmación de email de Supabase. Estáticas: `/soporte`, `/terminos`, `/privacidad`, `/bienvenida`.

> ⚠️ **Pendiente del lado cliente**: chat del cliente, notificaciones + emails (Resend), y timer
> de urgencia. Detalle en `PENDIENTES-PORTAL-CLIENTE.md`.
