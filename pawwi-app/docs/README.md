# 📚 Documentación de Pawwi

Referencia técnica y de producto del **marketplace**, el **portal del Pawwer** y el **portal del
cliente**: qué es cada cosa, qué hace, qué tecnología usa, para qué está y por qué se construyó.

> **Pawwer = el cuidador. Cliente = el dueño del perro.** Los Pawwers trabajan con Pawwi y reciben
> perros en su casa; los clientes reservan con ellos. «Pawwer» nunca se refiere al cliente.
> Glosario completo al principio de [`09-DISENO-PLATAFORMAS.md`](./09-DISENO-PLATAFORMAS.md).

> _Última actualización: 2026-09-11_

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
| [`07-PLAN-CONSTRUCCION.md`](./07-PLAN-CONSTRUCCION.md) | **El plan vigente**, hacia el soft launch del **12 de enero de 2027**. Ocho sprints en dos carriles. Empieza con un **cuadro de mando** y cada sprint abre con **«qué hay construido hoy»**, auditado contra el código. Incluye los cuatro bloqueadores y las cinco promesas que el producto hace y no cumple. |
| [`08-INFRAESTRUCTURA.md`](./08-INFRAESTRUCTURA.md) | **Referencia operativa.** Cuentas y servicios, variables de entorno, cómo desplegar, cómo correr migraciones, inventario DNS, problemas conocidos y **bitácora** de sesiones. |
| [`09-DISENO-PLATAFORMAS.md`](./09-DISENO-PLATAFORMAS.md) | **Las tres plataformas** —cliente, Pawwer y admin—: navegación, mapa de pantallas, qué muestra cada una y qué puede hacer el usuario, flujos, la **matriz de estados** de una reserva vista por los tres, quién recibe qué notificación, y el inventario de las 48 rutas con su estado. |

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
| **Reserva** | Instantánea para todos (specs) / aceptación para todos (código) | **Se ofrece, nunca se asigna.** Dos etapas —directa 1 h, bolsa general 6 h— con derecho de rechazo; la bolsa solo si el cliente consintió (`allow_pool`). La reserva instantánea se descartó el 2026-09-09 por riesgo laboral |
| **Cobro** | Al reservar, con reembolso si nadie acepta | **Solo cuando los dos aceptaron:** el Pawwer acepta, el cliente paga, queda confirmada. Si nadie acepta, nunca se movió un peso |
| **Alcance del lanzamiento** | Norte de Bogotá, por barrios | **Bogotá completa.** La unidad de densidad es el conjunto, no el barrio |
| **Reporte diario** | Obligación policiada por el equipo | Métrica que alimenta el nivel |
| **Sprints** | 7 sprints, lanzamiento 2026-07-10 | Ver [`07-PLAN-CONSTRUCCION.md`](./07-PLAN-CONSTRUCCION.md): **8 sprints**, soft launch **2027-01-12** |
| **Portal del cliente** | El backlog de `PENDIENTES-PORTAL-CLIENTE.md` | Superado por **S4** del `07`, que audita las doce pantallas |
| **Portal admin** | Dashboard completo de operación · luego «dos pantallas, después del lanzamiento» | Es **S3** y es un **bloqueador**: sin él ningún Pawwer real llega al marketplace. Siete pantallas, acceso por `profile.is_admin` |

---

## Cómo leer esto

- **Empezar de cero** → `06`, y después `07`.
- **Volver tras una pausa** → `08`, que tiene el estado real de la infraestructura y la bitácora.
- **Qué construir esta semana** → `07`.
- **Dónde vive algo / cómo se despliega / algo se rompió** → `08`.
- **Cómo funciona algo que ya existe** → `03` (portal) y `04` (backend/seguridad).
- **Cómo se vuelve pawwer alguien** → `02`.

## Dónde está la verdad

- **Producto y decisiones**: `06-PRODUCTO-REDISENO.md`.
- **Rutas**: `app/**/page.tsx` (App Router de Next.js).
- **Base de datos**: `supabase/NN_*.sql` — **68 migraciones** incrementales, que se corren a mano en
  el SQL Editor de Supabase como owner (el `service_role` no tiene grants sobre
  `booking`/`pawwer`/`client`). Lo que de verdad está vivo en la base se comprueba contra
  `pg_proc` e `information_schema`, no leyendo los archivos — ver `08`.
- **Estilos/tokens**: `app/globals.css`; helpers en `lib/`.
