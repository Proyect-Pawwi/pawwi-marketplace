# 00 · Visión general — Pawwi

> Documentación técnica del marketplace y el portal del pawwer.
> _Última actualización: 2026-07-17_

---

## 🐾 Qué es Pawwi

Pawwi es un **marketplace de cuidado de perros en hogares de familia** (Bogotá): conecta a
**dueños** ("clientes", ej. Sofía) con **cuidadores verificados** ("pawwers", ej. Juliana).
La promesa: *hogares reales, cero jaulas, cuidadores verificados y con póliza*.

Son **3 plataformas** sobre el mismo backend:

| Plataforma | Estado | Para quién |
|---|---|---|
| **Cliente / Marketplace** | ✅ Construida | Dueños que buscan y reservan cuidado |
| **Portal del Pawwer** | ✅ Construida (foco de esta doc) | Cuidadores aprobados que gestionan su negocio |
| **Portal Admin (Luisa)** | ⏳ Pendiente | Operación interna: aprobar pawwers, visitas, pagos |

---

## 💰 Modelo de negocio

- **Total de una reserva** = `cuidado + transporte`.
- **Comisión de Pawwi sobre el cuidado**: **25%** estándar, **20%** si el pawwer es nivel
  **Ranger**. La tasa se **congela** en cada reserva al momento de crearla (`booking.commission_rate`).
- **Transporte** (por trayecto, lo pone el pawwer): si lo hace el **pawwer** → 75% para él /
  25% Pawwi; si lo hace **Pawwi** → 100% Pawwi.
- **Niveles de rendimiento** (gamificación + retención): **Nuevo → Súper → Ranger**. Ranger da
  la comisión 20% + prioridad en el ordenamiento del buscador. (Ver `04-BACKEND-Y-SEGURIDAD.md`.)
- **Pagos al pawwer**: automáticos cada **viernes** (hoy el "ledger" de pagos existe —
  `booking.paid_at` — pero el cobro/transferencia real con Wompi está **pendiente**).

---

## 🧱 Stack técnico (versiones reales de `package.json`)

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 16.2.6** (App Router + Turbopack) |
| UI | **React 19.2.4**, TypeScript 5, **TailwindCSS v4** (tokens en `app/globals.css`) |
| Iconos / charts | `lucide-react`, `recharts` (lazy) |
| Backend | **Supabase** — Postgres + RLS + Auth + Realtime + Storage (`@supabase/ssr`, `@supabase/supabase-js`) |
| Cron | **pg_cron** (SQL, dentro de Supabase) |
| Mapas | Google Maps (`@vis.gl/react-google-maps`) |
| Validación | `zod` |
| Fuentes | Plus Jakarta Sans (`--font-sans`), Montserrat, Montserrat Alternates (vía `next/font`) |

---

## ☁️ Hosting e infraestructura

> **Honestidad**: el deploy del front **aún no está definido en el repo** (no hay
> `railway.json` ni `vercel.json`; el `README.md` es el boilerplate de create-next-app). Hoy
> corre en **local** (`npm run dev`, `localhost:3000`).

- **Backend**: **Supabase** (hosted) provee Postgres, Auth, Storage, Realtime y pg_cron. Las
  migraciones viven en `supabase/*.sql` y se corren **a mano** en el SQL Editor (owner), NO por
  CLI/REST (el `service_role` no tiene grants sobre las tablas de negocio).
- **Front**: app Next.js estándar → desplegable a **Vercel o Railway** (decisión pendiente). El
  cliente *viejo* (HTML) estaba en Railway; esta app es la reescritura en Next.
- **Variables de entorno** (`.env.example`):

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL pública (links de confirmación/recuperación de email). **Obligatoria en prod.** |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (browser + SSR) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor (`/api/pawwer/notify-approved`). Nunca en el cliente |
| `PAWWI_WEBHOOK_SECRET` | Secret del webhook de aprobación (fail-closed sin él) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Autocomplete de dirección + mapa |
| `WOMPI_PUBLIC_KEY` | Pagos (**integración pendiente**) |
| `RESEND_API_KEY` | Emails transaccionales (**integración pendiente**) |

---

## 📁 Estructura del repositorio

```
pawwi-app/
├── app/                      # Rutas (App Router)
│   ├── page.tsx              # Home / marketplace
│   ├── pawwer/
│   │   ├── [id]/             # Perfil público del pawwer
│   │   ├── (portal)/         # Portal del pawwer (layout con BottomNav)
│   │   └── {unirse,registro,bienvenida,examen,...}  # Onboarding
│   ├── booking/              # Flujo de reserva
│   ├── mis-reservas/, mis-mascotas/  # Área cliente
│   └── api/pawwer/notify-approved/   # Webhook (server, service_role)
├── components/               # UI compartida (MapView, AuthModal, Presence, PortalSkeleton…)
├── lib/                      # Clients Supabase + helpers (levels, services, image, email…)
├── supabase/                 # 56 migraciones SQL + tests + QUERIES.md
└── docs/                     # Esta documentación
```

- **`lib/client.ts`** / **`lib/server.ts`**: clientes Supabase (browser / SSR con cookies).
- **`lib/levels.ts`**, **`lib/services.ts`**: fuentes únicas de estilos/labels (evitan drift).
- **`lib/image.ts`**: `resizeImage` robusto (maneja HEIC de cámara iPhone).

---

## 🗺️ Mapa de rutas (42)

### Marketplace / Portal del Cliente
> Las 5 pestañas del cliente comparten el **`ClientNav`** (BottomNav condicional, aparece con
> sesión `role='client'`): Explorar `/` · Favoritos · Reservas · Mensajes · Perfil.

| Ruta | Archivo | Acceso | Propósito |
|---|---|---|---|
| `/` | `app/page.tsx` | Público | **Home / buscador** de pawwers (tab Explorar) |
| `/pawwer/[id]` | `app/pawwer/[id]/page.tsx` | Público | **Perfil público** del pawwer |
| `/booking/nuevo` | `app/booking/nuevo/page.tsx` | Cliente (registro lazy) | Flujo de reserva (4 pasos) |
| `/booking/confirmada/[id]` | `app/booking/confirmada/[id]/page.tsx` | Cliente | Reserva confirmada + reseña |
| `/mis-reservas` | `app/mis-reservas/page.tsx` | Cliente | Reservas del cliente (realtime) |
| `/mis-favoritos` | `app/mis-favoritos/page.tsx` | Cliente | Favoritos (🟡 esqueleto — persistencia pendiente) |
| `/mis-mensajes` | `app/mis-mensajes/page.tsx` | Cliente | Chat del cliente (🟡 esqueleto) |
| `/mi-perfil` | `app/mi-perfil/page.tsx` | Cliente | Hub "Centro de Control" (🟡 esqueleto) |
| `/mis-mascotas` · `/mis-mascotas/nueva` | `app/mis-mascotas/**` | Cliente | Gestión de mascotas (Pasaporte, dentro de Perfil) |
| `/login` · `/registro` · `/registro/confirmar` | `app/{login,registro}/**` | Público | Auth cliente |
| `/recuperar` · `/nueva-contrasena` | `app/{recuperar,nueva-contrasena}/` | Público | Reset de contraseña |
| `/auth/confirm` | `app/auth/confirm/route.ts` | Público | Handler de confirmación de email |
| `/soporte` · `/terminos` · `/privacidad` · `/bienvenida` | `app/**` | Público | Estáticas / legales |

### Onboarding del Pawwer (fuera del portal)
| Ruta | Acceso | Propósito |
|---|---|---|
| `/pawwer/unirse` | Público | Landing de reclutamiento |
| `/pawwer/registro` · `/pawwer/login` | Público | Auth del pawwer |
| `/pawwer/bienvenida` | Pawwer | Wizard de onboarding (`OnboardingWizard`) |
| `/pawwer/examen` | Pawwer | Examen psicotécnico |
| `/pawwer/capacitacion` | Pawwer | Capacitación (Pawwi Academy) |
| `/pawwer/visita` | Pawwer | Agendar visita domiciliaria |
| `/pawwer/dashboard` | Pawwer | Estados de aprobación (timeline) |

### Portal del Pawwer (aprobado — grupo `(portal)`, con BottomNav)
| Ruta | Propósito |
|---|---|
| `/pawwer/inicio` | Home del pawwer (solicitudes, ingresos, nivel) |
| `/pawwer/cuidados` · `/pawwer/cuidados/[id]` | Gestión de cuidados + detalle |
| `/pawwer/mensajes` · `/pawwer/mensajes/[bookingId]` | Chat con clientes |
| `/pawwer/ingresos` | Ganancias / próximos pagos |
| `/pawwer/perfil` · `/perfil/{vitrina,tarifas,pago,faq,resenas,fotos}` | Centro de control |
| `/pawwer/disponibilidad` | Calendario de disponibilidad |
| `/pawwer/cuenta-cobro` | Cuenta de cobro imprimible |

### API
| Ruta | Acceso | Propósito |
|---|---|---|
| `/api/pawwer/notify-approved` | Server (webhook secret) | Aprobar cédula → `exam_ready` + email |

---

## 📚 Índice de la documentación
- **`01-MARKETPLACE.md`** — lado cliente: home, perfil público, reserva, área cliente.
- **`02-ONBOARDING-PAWWER.md`** — embudo de alta del cuidador + máquina de estados.
- **`03-PORTAL-PAWWER.md`** — portal del pawwer, **pantalla por pantalla**.
- **`04-BACKEND-Y-SEGURIDAD.md`** — motor (reservas, escalación, dinero, niveles, presencia),
  seguridad y design system.
- **`05-PORTAL-CLIENTE.md`** — portal del cliente (en construcción): navegación y Lazy KYC.
- **`PENDIENTES-PORTAL-CLIENTE.md`** — backlog del lado cliente.
