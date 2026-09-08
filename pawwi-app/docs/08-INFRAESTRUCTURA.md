# 08 · Infraestructura y operación

> Dónde vive cada cosa, cómo se despliega, y qué hacer cuando algo falla.
> Referencia operativa: si vuelves al proyecto después de una pausa, empieza por aquí.
> _Última actualización: 2026-09-07_

---

## 🔑 Servicios y cuentas

| Servicio | Para qué | Detalles |
|---|---|---|
| **GitHub** | Código | `Proyect-Pawwi/pawwi-marketplace` · rama `main` · la app vive en el subdirectorio `pawwi-app/` |
| **Vercel** | Hosting del front | Cuenta `nicoding44`, plan Hobby · proyecto `pawwi-marketplace` · **Root Directory = `pawwi-app`** |
| **Supabase** | Postgres, Auth, Storage, Realtime, pg_cron | Plan Free · proyecto `pawwi-marketplace` |
| **Bold** | Pasarela de pagos | `merchant_id 50X516TA29` · cuenta aprobada · **sin dispersión a terceros** |
| **HostGator** | Registrador del dominio | `pawwi.co` · los nameservers apuntan a Cloudflare |
| **Cloudflare** | DNS autoritativo | `miki.ns.cloudflare.com` · `uriah.ns.cloudflare.com` |
| **Titan Email** | Correo de negocio | `@pawwi.co` · MX `mx1/mx2.titan.email` |
| **MailerLite** | Marketing por correo | Aparece en el SPF |
| **Resend** | Correo transaccional | ⏳ **sin configurar** |

**URL de producción actual:** `https://pawwi-marketplace-zeta.vercel.app`
**URL objetivo:** `https://app.pawwi.co` (bloqueada, ver [Problemas conocidos](#-problemas-conocidos))

---

## 🔐 Variables de entorno

Ocho variables. En Vercel están divididas por tipo, y esa división importa: las `NEXT_PUBLIC_*`
**se incrustan en el bundle del navegador** — marcarlas como secretas en Vercel no las protege, solo
impide que tú las veas.

| Variable | Tipo en Vercel | Notas |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Config | ⚠️ Hoy con valor temporal (URL de Vercel) |
| `NEXT_PUBLIC_SUPABASE_URL` | Config | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config | Pública por diseño; la RLS es lo que protege |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Config | |
| `NEXT_PUBLIC_BOLD_API_KEY` | Config | Llave de **identidad**, pública por diseño |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒 **Secret** | Salta toda la RLS — la más peligrosa |
| `PAWWI_WEBHOOK_SECRET` | 🔒 **Secret** | Sin ella, `/api/pawwer/notify-approved` responde 503 |
| `BOLD_SECRET_KEY` | 🔒 **Secret** | Firma el hash de integridad y valida webhooks |
| `RESEND_API_KEY` | — | ⏳ pendiente. **Sin la variable**, `lib/email.ts` omite el envío y sigue; con un valor inválido, falla |

**Regla:** en local (`.env.local`) van las llaves de **pruebas** de Bold; en Vercel las de
**producción**. `.env.local` está en `.gitignore`; `.env.example` sí se versiona, sin valores.

> ⚠️ **Deuda de S2:** las llaves de producción de Bold están disponibles también en los despliegues
> de *preview*. En cuanto exista código de cobro, un preview podría procesar pagos reales. Hay que
> separar por entorno: Production → llaves reales, Preview/Development → llaves de pruebas.

---

## 🚀 Despliegue

**Automático:** cada push a `main` dispara un despliegue de producción en Vercel.

**Manual / redespliegue:** Deployments → el último → ⋯ → Redeploy.
Necesario **siempre que cambies una variable de entorno** — no se aplican en caliente.

### Antes de empujar a `main`

```bash
npx tsc --noEmit                  # debe dar 0 errores
rm -rf .next && npm run build     # debe compilar y generar las 43 páginas
rm -rf .next                      # deja el árbol limpio para el próximo `npm run dev`
```

> **Nunca** correr `next build` con el dev server vivo: pisa `.next/dev` y el server empieza a dar
> 500 en toda ruta. Parece un bug de la pantalla que estás tocando, pero es `.next` corrupto.
> Para verificar mientras el dev corre, usa solo `tsc` y `eslint`.

### Requisitos del entorno

- **Node v20 LTS.** v21+ rompe `@swc/helpers` y `next dev` muere sin imprimir nada.
- Si `npm run dev` termina en silencio, revisa `node --version` antes que cualquier otra cosa.

---

## 🗄️ Base de datos

Las migraciones viven en `supabase/NN_*.sql` y se corren **a mano, una por una y en orden**, desde el
**SQL Editor** del panel de Supabase.

**No por CLI ni por REST:** el `service_role` no tiene grants sobre `booking`, `pawwer` ni `client`.
El SQL Editor corre como owner, que es lo que se necesita.

Todas son idempotentes (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`), así que repetir una es
inofensivo.

### Verificar que una migración quedó aplicada

Consultar `information_schema.columns`. Ejemplo, para las tres últimas:

```sql
select
  (select count(*) from information_schema.columns
    where table_name='dog' and column_name in
      ('neutered','medical_notes','friendly_dogs','friendly_cats','friendly_kids',
       'separation_anxiety','energy_level','feeding_schedule','house_rules'))  as mig_57,
  (select count(*) from information_schema.columns
    where table_name='client' and column_name in
      ('cedula','cedula_verified','phone','phone_verified'))                   as mig_58,
  (select is_nullable from information_schema.columns
    where table_name='profile' and column_name='phone')                        as mig_59;
-- esperado: 9 · 4 · YES
```

### Autenticación

**Supabase → Authentication → URL Configuration:**

- **Site URL:** `https://pawwi-marketplace-zeta.vercel.app` ⚠️ *temporal*
- **Redirect URLs:**
  - `https://pawwi-marketplace-zeta.vercel.app/**`
  - `https://app.pawwi.co/**`
  - `http://localhost:3000/**`

El código redirige a **dos rutas**: `/auth/confirm` (registro de cliente, de pawwer y recuperación)
y `/nueva-contrasena` (cambio de clave desde el portal). El `/**` las cubre junto con sus query
strings.

> ⚠️ **El remitente de Supabase tiene un límite muy bajo** en el plan Free y suele caer en spam.
> Conectar Resend como SMTP personalizado (Project Settings → Authentication → SMTP Settings)
> resuelve el límite y hace que los correos salgan desde `pawwi.co`.

---

## 🌐 DNS · inventario de `pawwi.co`

Respaldo de la zona al 2026-09-07. Indispensable si alguna vez hay que migrarla.

| Tipo | Nombre | Valor | Qué es |
|---|---|---|---|
| NS | `@` | `miki.ns.cloudflare.com` · `uriah.ns.cloudflare.com` | Autoritativos |
| A | `@` | `104.21.66.53` · `172.67.201.77` | Landing (proxiada por Cloudflare) |
| AAAA | `@` | `2606:4700:3034::6815:4235` · `2606:4700:3033::ac43:c94d` | Landing IPv6 |
| MX | `@` | `mx1.titan.email` · `mx2.titan.email` (prio 1) | **Correo de negocio** |
| TXT | `@` | `v=spf1 include:_spf.mlsend.com include:spf.titan.email ~all` | SPF |
| TXT | `@` | `mailerlite-domain-verification=a64edd…` | MailerLite |
| A | `www`, `ftp`, `cpanel`, `webmail` | → Cloudflare | Proxiados |
| A | `mail` | `162.241.60.182` | HostGator, **sin proxy** |

### 🚨 Al agregar Resend: NO crear un SPF nuevo

Ya existe un registro SPF con Titan y MailerLite. **El estándar permite un solo SPF por dominio** —
dos registros no se suman, **rompen la autenticación de todo el correo** y `@pawwi.co` empieza a
rebotar o caer en spam.

Hay que **editar el existente** y agregar el `include` de Resend dentro de la misma línea:

```
v=spf1 include:_spf.mlsend.com include:spf.titan.email include:<el-de-resend> ~all
```

El DKIM y el MX de Resend sí se agregan como registros nuevos, sin problema.

---

## ⚠️ Problemas conocidos

### 1. El CNAME de `app.pawwi.co` no llega a Cloudflare

**Síntoma:** el registro aparece en el editor de Zona de DNS de HostGator, pero los nameservers
autoritativos responden `NXDOMAIN`.

```bash
dig @miki.ns.cloudflare.com app.pawwi.co CNAME   # → status: NXDOMAIN
```

**Descartado:** no hay duplicado (`app.pawwi.co.pawwi.co`), no hay registro A en conflicto, y la
zona funciona bien para todos los demás registros.

**Hipótesis:** el editor de HostGator escribe en una zona local que nadie consulta, o su
sincronizador hacia Cloudflare no está corriendo. Soporte respondió con el guion de «espere 24
horas», que no aplica: esto no es propagación, el registro no existe en el servidor autoritativo.

**Registro que debe crearse:**

| Tipo | Nombre | Valor | Proxy |
|---|---|---|---|
| CNAME | `app` | `5deb4aa6401ae0fb.vercel-dns-017.com.` | **Desactivado** (nube gris) |

**Si no se resuelve:** migrar la zona a una cuenta propia de Cloudflare usando el inventario de
arriba. Da control total, incluido el interruptor de proxy — que Vercel **exige apagado** y que el
editor de HostGator probablemente ni expone.

**Valores temporales que hay que revertir** cuando el dominio esté vivo:
1. `NEXT_PUBLIC_SITE_URL` en Vercel → `https://app.pawwi.co` (y redesplegar)
2. **Site URL** en Supabase → `https://app.pawwi.co`

Las Redirect URLs de Supabase ya incluyen `app.pawwi.co`; esas no se tocan.

### 2. El repositorio vive en una carpeta sincronizada con iCloud

`~/Desktop` está bajo iCloud Drive. Eso genera duplicados tipo `archivo 2.tsx` en cada conflicto (el
2026-09-07 había 68), vuelve lento el acceso cuando iCloud descarga archivos bajo demanda, y en el
peor caso puede corromper `.git` si sincroniza a mitad de una escritura.

Hay una regla en `.gitignore` para que los duplicados no lleguen al repo, pero **la solución real es
mover el proyecto fuera de iCloud** (`~/Proyectos/`, por ejemplo).

---

## 📓 Bitácora

### 2026-09-07 · Retomar el proyecto y desplegar

Primera sesión tras seis semanas de pausa. El proyecto se retomó sin respaldo en GitHub desde el 23
de mayo.

**Producto**
- Rediseño completo para que Pawwi pueda operarse **con una sola persona** → [`06-PRODUCTO-REDISENO.md`](./06-PRODUCTO-REDISENO.md)
- Plan de doce semanas hacia el lanzamiento del 30 de noviembre → [`07-PLAN-CONSTRUCCION.md`](./07-PLAN-CONSTRUCCION.md)
- Pasarela resuelta: **Bold** (2,99% + $900, modalidad «siguiente día»). Sin dispersión a terceros → el pago al Pawwer es manual y semanal
- Correcciones al modelo financiero: punto de equilibrio real ~89 transacciones (no 68), LTV/CAC con pauta 0,79× (no 3,75×)

**Código**
- 312 archivos y ~38.000 líneas respaldadas en GitHub, en 11 commits por área
- `main` fusionado y limpio: fuera `app/signup/`, `lib/resend.ts`, `lib/supabase/client.ts`, `lib/emails/` — una línea de trabajo paralela que nunca se fusionó
- **7 vulnerabilidades altas → 0.** Next 16.2.6 → 16.3.4. Varias aplicaban directamente: bypass del proxy con Turbopack, confusión de caché entre respuestas, exposición de endpoints de Server Functions
- **PawwiProtect y PawwiVet retirados** de 10 lugares, incluido el paso previo al pago y las meta descripciones. Se reemplazaron por la promesa que sí es verdadera: la visita domiciliaria

**Infraestructura**
- Primer despliegue en Vercel. Pawwi está en internet
- Supabase: URL Configuration y migraciones 57, 58 y 59 aplicadas y verificadas
- Dominio `app.pawwi.co` bloqueado por el problema de DNS descrito arriba

**Incidente**
Un commit arrastró 120 deleciones no revisadas (`app/pawwer/**` y `.agents/**`). Se detectó y
restauró el mismo día; nada se perdió del disco ni del remoto. **Lección: revisar `git status
--cached` antes de confirmar, no después.**

---

**Pawwi S.A.S.** · NIT 901.937.952-7 · Bogotá, Colombia
