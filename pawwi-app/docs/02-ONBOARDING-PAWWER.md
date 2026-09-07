# 02 · Onboarding del Pawwer (embudo de alta)

> Cómo una persona pasa de "quiero ser cuidador" a **pawwer verificado** que puede recibir
> reservas. Todo esto vive **fuera** del grupo `(portal)` (no tiene BottomNav todavía).
> _Última actualización: 2026-07-17_

---

## 🎯 El embudo

```
/pawwer/unirse ─► /pawwer/registro ─► /pawwer/bienvenida ─► examen ─► capacitación ─► visita ─► APROBADO
   (landing)         (crear cuenta)      (wizard datos)                                          (→ /pawwer/inicio)
```

En cada paso, el pawwer aterriza en **`/pawwer/dashboard`**, que le muestra en qué punto va y
cuál es su siguiente acción, según su **estado** (`pawwer.status`).

---

## 🚪 Pantallas del embudo

| Ruta | Para qué es | Notas |
|---|---|---|
| **`/pawwer/unirse`** | Landing de **reclutamiento** (hero grande, marketing). Convierte visitantes en postulantes. | Página pública; el `<h1>` grande (`text-4xl+`) es intencional de landing. |
| **`/pawwer/registro`** · **`/pawwer/login`** | Crear cuenta / iniciar sesión del cuidador. | Auth de Supabase. |
| **`/pawwer/bienvenida`** | **Wizard de onboarding** (`OnboardingWizard.tsx`): captura datos del perfil (bio, profesión, barrio, foto, servicios, precios…) y crea la fila en `pawwer`. | Sube avatar a Storage (`profile.avatar_url`) — única escritura directa a `profile`, permitida por RLS. |
| **`/pawwer/examen`** | **Examen psicotécnico** (~5 min). Preguntas en `lib/exam-pawwer.ts`. | Se guarda en `exam_results`. |
| **`/pawwer/capacitacion`** | **Capacitación** ("Pawwi Academy"). Contenido en `lib/capacitacion.ts`. | Se guarda en `capacitacion_results`. |
| **`/pawwer/visita`** | Agendar la **visita domiciliaria** (el equipo Pawwi conoce el hogar). | Escribe en `visita_domiciliaria`. |
| **`/pawwer/dashboard`** | **Hub de estado**: timeline de 5 pasos + tarjeta con el estado actual y su CTA. | Si `status='approved'` → redirige a `/pawwer/inicio`. |

---

## 🔄 Máquina de estados del pawwer (`pawwer.status`)

El `dashboard` (`app/pawwer/dashboard/page.tsx`) mapea cada estado a una tarjeta (emoji, título,
copy, paso del timeline y CTA):

| # | Estado | Qué significa | Siguiente acción |
|---|---|---|---|
| 1 | `pending_review` | Luisa está verificando la **cédula** (antecedentes). 1–2 días. | Esperar (aviso por correo) |
| 2 | `exam_ready` | Cédula verificada ✅ → habilitado el **examen**. | `/pawwer/examen` |
| 2 | `needs_review` | Examen enviado, **en revisión** manual. | Esperar |
| 2 | `rejected` | No cumple requisitos (puede repostular en 6 meses). | — |
| 3 | `preselected` | Pasó el examen → **preseleccionado**. | Capacitación `/pawwer/capacitacion` |
| 4 | `visita_pendiente` | Aprobó la capacitación → **agendar visita**. | `/pawwer/visita` |
| 5 | `approved` | **Pawwer verificado** ✅ — perfil publicado, recibe reservas. | → `/pawwer/inicio` |

Timeline visible: **Cédula verificada → Examen psicotécnico → Capacitación → Visita al hogar →
Perfil publicado**.

> Nota: en `visita_pendiente`, el dashboard consulta `visita_domiciliaria` (status
> `pending`/`confirmed`) para mostrar "agenda tu visita" vs "visita agendada, Luisa te contacta".

---

## 🔐 El webhook de aprobación de cédula

**`/api/pawwer/notify-approved`** (`app/api/pawwer/notify-approved/route.ts`) — **único**
endpoint de servidor con `service_role`:

- **Fail-closed**: si falta `PAWWI_WEBHOOK_SECRET` o el `service_role` → responde 503 (no opera).
- Exige header `x-pawwi-secret` correcto (401 si no).
- Cuando Luisa verifica la cédula, este webhook hace `pawwer.status: pending_review → exam_ready`
  (update scopeado con doble condición) y **envía el email** ("tu cédula fue verificada, haz el
  examen") con **`escapeHtml(nombre)`** (sin inyección de HTML).

**Por qué así:** la aprobación es una acción **de operación interna** (Luisa/admin), no del
propio pawwer — por eso va por un endpoint server-only con secret y `service_role`, no por un
RPC de usuario. Es el germen de lo que será el **Portal Admin**.

---

## 🧭 Diseño / decisiones

- El onboarding vive **fuera de `(portal)`** porque el pawwer aún no está aprobado: no debe ver
  el BottomNav ni las herramientas del negocio hasta ser `approved`.
- **Revelación progresiva**: el dashboard solo muestra el siguiente paso, no todo el proceso de
  golpe → menos abandono.
- El gate real es `PortalLayout` (`app/pawwer/(portal)/layout.tsx`): si `status !== 'approved'`
  → `redirect('/pawwer/dashboard')`. Así nadie entra al portal sin estar verificado.
