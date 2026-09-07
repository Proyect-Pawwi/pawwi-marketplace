# 📚 Documentación de Pawwi

Referencia técnica y de producto del **marketplace**, el **portal del pawwer** y el **portal del
cliente**: qué es cada cosa, qué hace, qué tecnología usa, para qué está y por qué se construyó.

> _Última actualización: 2026-09-07_

---

## ⚠️ Precedencia

En septiembre de 2026 el producto se rediseñó por completo para poder operarse **con una sola
persona**. Los documentos `06` y `07` son el resultado de ese rediseño.

**Donde `06` o `07` contradigan a los `00`–`05`, mandan `06` y `07`.**

Los documentos `00`–`05` siguen siendo válidos como descripción de **lo que está construido**
(pantalla por pantalla, RPC por RPC), pero algunas de sus decisiones de producto ya no aplican.

---

## Índice

### Producto y plan · 2026

| Doc | Contenido |
|---|---|
| [`06-PRODUCTO-REDISENO.md`](./06-PRODUCTO-REDISENO.md) | **Documento maestro.** Qué es Pawwi, las 7 decisiones, las dos puertas, la visita, el motor de reservas, capacidad y precio, el dinero, los 5 loops de crecimiento, economía unitaria, stack y estado del código. |
| [`07-PLAN-CONSTRUCCION.md`](./07-PLAN-CONSTRUCCION.md) | **Plan de 12 semanas** hacia el lanzamiento del 30 de noviembre de 2026. Siete sprints en dos carriles, con la lista de «qué NO se construye» en cada uno. |

### Referencia de lo construido

| Doc | Contenido |
|---|---|
| [`00-VISION-GENERAL.md`](./00-VISION-GENERAL.md) | Las 3 plataformas, modelo de negocio, stack, hosting y mapa de rutas. |
| [`01-MARKETPLACE.md`](./01-MARKETPLACE.md) | Lado cliente: home/buscador, perfil público del pawwer, flujo de reserva. |
| [`02-ONBOARDING-PAWWER.md`](./02-ONBOARDING-PAWWER.md) | Embudo de alta del cuidador y la máquina de estados (`pending_review → … → approved`). |
| [`03-PORTAL-PAWWER.md`](./03-PORTAL-PAWWER.md) | El portal del pawwer pantalla por pantalla. |
| [`04-BACKEND-Y-SEGURIDAD.md`](./04-BACKEND-Y-SEGURIDAD.md) | El motor (reservas, escalación, cron, dinero, niveles, presencia), el modelo de seguridad y el **design system**. |
| [`05-PORTAL-CLIENTE.md`](./05-PORTAL-CLIENTE.md) | Portal del cliente: navegación, Lazy KYC y estado por fases. |
| [`PENDIENTES-PORTAL-CLIENTE.md`](./PENDIENTES-PORTAL-CLIENTE.md) | Backlog del lado cliente (chat, notificaciones, timer). |

---

## 🔧 Qué quedó obsoleto en los documentos 00–05

Estos puntos cambiaron con el rediseño. El detalle está en `06`:

| Tema | Decía antes | Dice ahora |
|---|---|---|
| **Pasarela de pagos** | Wompi (o «sin resolver») | **Bold**, cuenta ya aprobada. Sin dispersión a terceros → el pago al Pawwer es **manual**, mitigado con archivo de dispersión masiva |
| **Transporte** | Lo podía hacer el Pawwer **o Pawwi** | Solo el Pawwer, o el cliente lo resuelve. Pawwi nunca traslada animales |
| **Fondo de Asistencia** | $1,5 M COP por evento | **Eliminado.** Pawwi responde por la verificación, no por el incidente |
| **Capacidad del Pawwer** | Tope de Pawwi (1–2, luego ≤10 en la mig 49) | La decide el Pawwer **sin tope**. Pawwi expone capacidad y ocupación del día |
| **Búsqueda** | Filtro por radio de 2 km, expandible | **Sin corte por radio.** La distancia es componente del precio, no filtro |
| **Reserva** | Instantánea para todos (specs) / aceptación para todos (código) | **Dos velocidades** según nivel del Pawwer |
| **Alcance del lanzamiento** | Norte de Bogotá, por barrios | **Bogotá completa.** La unidad de densidad es el conjunto, no el barrio |
| **Reporte diario** | Obligación policiada por el equipo | Métrica que alimenta el nivel |
| **Portal admin** | Dashboard completo de operación | Dos pantallas: cola de visitas y liquidación semanal |
| **Sprints** | 7 sprints, lanzamiento 2026-07-10 | Ver [`07-PLAN-CONSTRUCCION.md`](./07-PLAN-CONSTRUCCION.md), lanzamiento 2026-11-30 |

---

## Cómo leer esto

- **Empezar de cero** → `06`, y después `07`.
- **Qué construir esta semana** → `07`.
- **Cómo funciona algo que ya existe** → `03` (portal) y `04` (backend/seguridad).
- **Cómo se vuelve pawwer alguien** → `02`.

## Dónde está la verdad

- **Producto y decisiones**: `06-PRODUCTO-REDISENO.md`.
- **Rutas**: `app/**/page.tsx` (App Router de Next.js).
- **Base de datos**: `supabase/*.sql` — **59 migraciones** incrementales, que se corren a mano en el
  SQL Editor de Supabase como owner (el `service_role` no tiene grants sobre `booking`/`pawwer`/`client`).
- **Estilos/tokens**: `app/globals.css`; helpers en `lib/`.
