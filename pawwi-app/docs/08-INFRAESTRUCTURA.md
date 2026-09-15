# 08 · Infraestructura y operación

> Dónde vive cada cosa, cómo se despliega, y qué hacer cuando algo falla.
> Referencia operativa: si vuelves al proyecto después de una pausa, empieza por aquí.
> _Última actualización: 2026-09-11_

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
| **Resend** | Correo transaccional | ✅ dominio `pawwi.co` verificado (2026-09-15) · región **São Paulo (sa-east-1)**, no se puede cambiar sin recrear el dominio · remitente `hola@pawwi.co` · tres API keys por sitio de uso: `vercel-produccion`, `local-dev`, `supabase-smtp`, todas con *Sending access* y restringidas a `pawwi.co` |

**URL de producción:** `https://app.pawwi.co` ✅ HTTPS con certificado Let's Encrypt (renovación automática)
**URL alterna:** `https://pawwi-marketplace-zeta.vercel.app` (sigue activa)

---

## 🔐 Variables de entorno

Ocho variables. En Vercel están divididas por tipo, y esa división importa: las `NEXT_PUBLIC_*`
**se incrustan en el bundle del navegador** — marcarlas como secretas en Vercel no las protege, solo
impide que tú las veas.

| Variable | Tipo en Vercel | Notas |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Config | `https://app.pawwi.co` |
| `NEXT_PUBLIC_SUPABASE_URL` | Config | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config | Pública por diseño; la RLS es lo que protege |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Config | |
| `NEXT_PUBLIC_BOLD_API_KEY` | Config | Llave de **identidad**, pública por diseño |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒 **Secret** | Salta toda la RLS — la más peligrosa |
| `PAWWI_WEBHOOK_SECRET` | 🔒 **Secret** | Sin ella, `/api/pawwer/notify-approved` responde 503 |
| `BOLD_SECRET_KEY` | 🔒 **Secret** | Firma el hash de integridad y valida webhooks |
| `RESEND_API_KEY` | 🔒 **Secret** | ✅ desde el 2026-09-15, en Production y Preview (y en `.env.local` con su propia llave). **Sin la variable**, `lib/email.ts` omite el envío y sigue; con un valor inválido, Resend lo rechaza y solo queda un error en el log — nunca tumba la acción que manda el correo. **Es ruta crítica de S2**: así se entera el cliente de que el Pawwer aceptó y tiene dos horas para pagar |
| `PAWWI_ADMIN_EMAIL` | — | Opcional. Adónde llegan los avisos al equipo: reembolsos por hacer, visitas agendadas, preselecciones. **Sin ella, `hola@pawwi.co`** (antes el respaldo era `luisa@pawwi.co`) |
| `BOLD_ALLOW_TEST_WEBHOOK` | — | Apagada salvo mientras se prueba el webhook en modo pruebas, donde Bold firma con **llave vacía**. En `1` acepta esa firma —que cualquiera puede fabricar—, y **en producción se ignora**. Se pone en el preview donde se prueba y se quita al terminar |

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

Consultar `information_schema.columns`. Ejemplo, con las migraciones 57 a 59:

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

### 🚨 Al cambiar la firma de una RPC: elimina la vieja

`CREATE OR REPLACE FUNCTION` solo **reemplaza** cuando la lista de parámetros coincide. Si le
añades o le quitas uno, **crea una sobrecarga** — y la versión anterior sigue viva, llamable por
REST, y con las validaciones que tuviera en su día.

Ya pasó dos veces. `complete_pawwer_onboarding` acumuló **tres firmas** entre las migraciones 07,
08 y 09: la más vieja no tenía el control de mayoría de edad, así que se podía crear un Pawwer
menor de 18 años llamándola directamente (limpiado en la migración 67). Y `create_booking` estuvo
a punto de lo mismo en la 64, donde sí se puso el `DROP` a tiempo.

**Después de cada migración que cambie una firma**, correr:

```sql
select p.proname, count(*),
       string_agg(pg_get_function_identity_arguments(p.oid), E'\n' order by p.oid)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
group by p.proname having count(*) > 1;
-- esperado: cero filas
```

Y **verificar siempre el número de firmas**, no solo que la función nueva exista: `count(*) = 1`
es la comprobación que atrapa esto; `¿existe la función?` no.

### 🚨 Los permisos de tabla son estado ambiental, no declarado

Es el mismo problema que `pg_proc`, en otra esquina: **las migraciones casi no declaran `GRANT`s.**
Los privilegios de cada tabla son los que quedaron al crearla —fuera del repo— y solo dos
migraciones los han tocado desde entonces: la 43 (SELECT sobre `booking` y `messages`), la 44
(revocar escritura en ocho tablas) y la 69 (`dog` y `dog_booking`).

Consecuencia: **un `grep` por el nombre de una tabla no dice qué permisos tiene.** `dog` no aparecía
en un solo `GRANT` ni `REVOKE` de todo `supabase/` — y era porque nunca se los dio nadie, no porque
estuvieran bien. La comprobación correcta:

```sql
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM   information_schema.role_table_grants
WHERE  grantee = 'authenticated' AND table_schema = 'public'
GROUP  BY table_name ORDER BY table_name;
```

**Estado al 2026-09-15**, comprobado tabla por tabla con la sesión real de un cliente:

| Tabla | `authenticated` | |
|---|---|---|
| `booking`, `messages`, `notifications`, `reviews`, `availability`, `pawwer`, `service_X_Pawwer`, `booking_candidates`, `profile`, `service_type`, `presence` | lectura ✅ | |
| `dog` | lectura y escritura ✅ | desde la **mig 69**; antes, nada |
| `dog_booking` | lectura ✅ | desde la **mig 69**; la necesita la RLS de `dog` |
| `booking_payment` | **sin permisos** ✅ | **a propósito** (mig 68): el sello del pago es solo de `service_role` |
| `client`, `favourite`, `dog_size` | **sin permisos** ⚠️ | hoy ningún código las lee directo. **S4 va a chocar con esto** al construir el KYC y los favoritos |

> **Nota menor:** `authenticated` conserva `TRUNCATE`, `REFERENCES` y `TRIGGER` en varias tablas, de
> cuando se crearon. `TRUNCATE` **no pasa por la RLS**, pero PostgREST no lo expone y ninguna función
> llamable lo ejecuta, así que hoy no es alcanzable. Anotado por si algún día se abre SQL directo.

### 🚨 La verdad de una función está en `pg_proc`, no en los archivos

Que el nombre de una función aparezca en una migración no significa que esa migración la haya
cambiado. La auditoría del 2026-09-07 dio por reemplazadas cuatro funciones sin `search_path`
porque sus nombres salían en la 25 — y a dos de ellas la 25 solo les hizo `REVOKE`/`GRANT`. Una
siguió así hasta la 63; la otra, `delete_availability`, sigue viva.

Para saber qué funciones `SECURITY DEFINER` hay de verdad sin `search_path`:

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                  where c like 'search_path=%');
-- esperado: cero filas · al 2026-09-11, según los archivos, sale delete_availability
```

### Autenticación

**Supabase → Authentication → URL Configuration:**

- **Site URL:** `https://app.pawwi.co`
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

## 💳 Bold · cómo está conectado

Desde S2 (migración 68). El detalle del producto está en `06` § El dinero.

| Pieza | Qué hace | Dónde |
|---|---|---|
| Botón de pagos personalizado | Abre el checkout de Bold con una **firma de integridad** que calcula el servidor: SHA-256 de `{orden}{monto}COP{llave secreta}`. Se carga `checkout.bold.co/library/boldPaymentButton.js` solo al pagar | `lib/bold.ts` · `PagarReserva.tsx` |
| Webhook | `POST https://app.pawwi.co/api/bold/webhook`. Valida `x-bold-signature` = HMAC-SHA256 del cuerpo **en Base64**, con la llave secreta. Responde en menos de 2 s; los correos salen después, con `after()` | `app/api/bold/webhook/route.ts` |
| API de consulta | `GET payments.api.bold.co/v2/payment-voucher/{orden}` con la llave de identidad. Verifica el pago cuando el cliente vuelve del checkout | `lib/bold.ts` |
| El sello | `record_booking_payment`, solo `service_role`, idempotente | mig 68 · `lib/cobro.ts` |

### Para dejarlo funcionando

1. **Registrar el webhook** en el panel de Bold: Integraciones → Webhooks →
   `https://app.pawwi.co/api/bold/webhook`. Admite hasta 5 URLs; solo HTTPS
2. **Separar las llaves por entorno en Vercel**: Production con las de producción, Preview y
   Development con las de pruebas. Hoy las de producción llegan a los previews
3. ✅ **Resend**, para que el cliente se entere de que el Pawwer aceptó — hecho el 2026-09-15

### Probar sin cobrar

- **Modo de pruebas = llaves de pruebas.** Se sabe que está activo porque el checkout muestra la
  etiqueta amarilla «Modo de pruebas». Las dos llaves tienen que ser del mismo ambiente
- **Tarjetas:** Visa aprobada `4111 1111 1111 1111` · Mastercard aprobada `5100 0100 0000 0015` ·
  rechazada `4970 1100 0000 0062` · fallida `5204 7300 0000 8404`
- **En pruebas Bold no manda webhooks.** El pago se confirma por la consulta al volver del checkout
  (o con «Ya pagué»). Para probar el webhook: botón «Probar el webhook» en el comprobante, apuntando
  a una URL pública — un preview de Vercel, nunca `localhost`
- **En pruebas la firma del webhook usa una llave vacía**, y esa firma la puede fabricar cualquiera.
  `lib/bold.ts` la acepta **solo con `BOLD_ALLOW_TEST_WEBHOOK=1`**, y nunca en producción. Se
  enciende en el preview donde se prueba y se apaga al terminar
  > No basta con aceptarla «fuera de producción», que fue el primer intento (2026-09-11): los
  > previews son públicos, hablan con **la misma base que producción**, y el `order_id` se deriva del
  > id de la reserva, que el cliente ve en su propia URL. Un cliente podía firmarse un pago aprobado
  > y confirmar su reserva sin pagar. Corregido el 2026-09-15
- Las órdenes de prueba se borran a las 12 horas

### Lo que Bold no hace

**No tiene API de reembolsos.** Solo anula pagos con tarjeta de **crédito**, **el mismo día antes de
las 9 p. m.**, desde su panel; esa anulación llega por webhook (`VOID_APPROVED`) y se marca sola.
Todo lo demás es una transferencia a mano y un `refunded_at` en `booking_payment`, hasta que S3
construya la cola en `/admin`. Cada reembolso por hacer llega por correo a `PAWWI_ADMIN_EMAIL`.

---

## 🌐 DNS · inventario de `pawwi.co`

Respaldo de la zona, verificado contra los nameservers el **2026-09-15**. Indispensable si alguna
vez hay que migrarla.

| Tipo | Nombre | Valor | Qué es |
|---|---|---|---|
| NS | `@` | `miki.ns.cloudflare.com` · `uriah.ns.cloudflare.com` | Autoritativos |
| A | `@` | `104.21.66.53` · `172.67.201.77` | Landing (proxiada por Cloudflare) |
| AAAA | `@` | `2606:4700:3034::6815:4235` · `2606:4700:3033::ac43:c94d` | Landing IPv6 |
| MX | `@` | `mx1.titan.email` (prio **10**) · `mx2.titan.email` (prio **20**) | **Correo de negocio** |
| TXT | `@` | `v=spf1 include:_spf.mlsend.com include:spf.titan.email ~all` | SPF de la raíz — **se edita, nunca se duplica** |
| TXT | `@` | `mailerlite-domain-verification=a64edd…` | MailerLite |
| TXT | `resend._domainkey` | `p=MIGfMA…IDAQAB` (218 car.) | **DKIM de Resend** |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF del remitente de Resend |
| MX | `send` | `feedback-smtp.sa-east-1.amazonses.com` (prio 10) | Rebotes de Resend |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DMARC en modo monitoreo |
| A | `www`, `ftp`, `cpanel`, `webmail` | → Cloudflare | Proxiados |
| A | `mail` | `162.241.60.182` | HostGator, **sin proxy** |
| CNAME | `app` | `…vercel-dns-017.com` | La app, **sin proxy** (si no, Vercel no emite el certificado) |

> **Las prioridades del MX de la raíz cambiaron el 2026-09-15**, de `1`/`1` a `10`/`20`. No lo
> pedimos: lo hizo el asesor de HostGator al crear el MX de Resend. No rompe nada —son los valores
> que Titan documenta, y dejan `mx1` como principal— pero queda anotado, porque es el correo de la
> empresa y nadie lo pidió.
>
> **Resend va en un subdominio, y eso es lo importante:** su SPF y su MX viven en `send.pawwi.co`, así
> que **el SPF de la raíz no se tocó**. Es lo que evita el accidente de duplicarlo. Del ticket salió
> mal una vez —el MX se creó como TXT, porque «cuatro registros TXT» fue lo que leyó el asesor—, así
> que al pedir un MX conviene escribir el tipo en mayúsculas y aparte.

### 🚨 El SPF de la raíz: nunca dos

**El estándar permite un solo registro SPF por dominio.** Dos no se suman: rompen la autenticación
de todo el correo y `@pawwi.co` empieza a rebotar o a caer en spam. El de la raíz tiene a Titan y a
MailerLite, y si algún proveedor nuevo pide SPF en `pawwi.co`, se **edita** esa línea, nunca se
duplica.

> **Con Resend no hizo falta** (2026-09-15): su SPF y su MX van en el subdominio `send.pawwi.co`, y
> solo el DKIM en la raíz. La raíz no se tocó. Era el riesgo que traía este apartado desde el
> principio, y el diseño de Resend lo evita solo — conviene preguntarle lo mismo a cualquier
> proveedor futuro antes de abrir un ticket.

---

## ⚠️ Problemas conocidos

### ~~1. El CNAME de `app.pawwi.co` no llega a Cloudflare~~ · RESUELTO 2026-09-09

**Causa raíz:** el editor de «Zona avanzada de DNS» de HostGator **no escribe en la zona de
Cloudflare**, que es la autoritativa. El registro aparecía en su panel pero nunca existió.

**Cómo se demostró:** el número de serie SOA de la zona no cambió en 48 horas. Ese serial se
incrementa en cada modificación, así que su inmovilidad probó que la zona nunca fue tocada —
descartando por completo la explicación de «propagación» que daba el soporte de primera línea.

```bash
dig +short @miki.ns.cloudflare.com pawwi.co SOA | awk '{print $3}'
```

**Solución:** un asesor de HostGator creó el registro **directamente en Cloudflare**. Quedó proxiado
(nube naranja) en el primer intento y hubo que pedir un segundo ajuste a **DNS only**.

**Lección operativa:** para cualquier registro DNS futuro —incluidos los de Resend— hay que pedirle
a soporte de HostGator que lo cree **en Cloudflare**, no usar su editor de zona. Conviene solicitar
acceso directo a esa zona de Cloudflare para dejar de depender de tickets.

**Estado final verificado:**

```
app.pawwi.co → 5deb4aa6401ae0fb.vercel-dns-017.com → 64.29.17.65 · 216.198.79.65
HTTP 200 · certificado Let's Encrypt CN=app.pawwi.co · sin proxy
```

### ~~2. El repositorio vive en una carpeta sincronizada con iCloud~~ · RESUELTO 2026-09-09

**El repositorio vive ahora en `~/Proyectos/pawwi-marketplace`**, fuera de iCloud.

**Por qué se movió:** no era un riesgo teórico. El 2026-09-09, con el proyecto quieto y sin que
nadie tocara una línea, `npx tsc --noEmit` arrojaba **17 errores**. Ninguno era de código: iCloud
había dejado **~500 directorios vacíos** terminados en ` 2` dentro de `node_modules`, 17 de ellos
en `@types`. TypeScript trata cada carpeta de `@types` como librería de tipos implícita, no
encuentra su entrada, y falla:

```
error TS2688: Cannot find type definition file for 'react-dom 2'.
  Entry point for implicit type library 'react-dom 2'
```

El diagnóstico engaña: parece un problema de dependencias o de versiones de TypeScript. **Antes de
depurar un error de tipos que no corresponde a ningún archivo tuyo, revisa que no haya carpetas
fantasma.**

```bash
find node_modules -type d -name "* 2*" -empty | wc -l
```

**Cómo se movió** (con el árbol limpio y todo empujado a GitHub — `.env.local` está ignorado, así
que **no está en el remoto** y solo sobrevive porque se usó `mv`, nunca un clon nuevo):

```bash
mkdir -p ~/Proyectos
mv ~/Desktop/pawwi-marketplace ~/Proyectos/pawwi-marketplace
cd ~/Proyectos/pawwi-marketplace/pawwi-app
rm -rf node_modules .next tsconfig.tsbuildinfo && npm ci
```

Verificado tras el movimiento: `git` al día con `origin/main`, `tsc` en 0 errores, build de las 43
páginas, 0 vulnerabilidades. La regla de `.gitignore` contra los duplicados se queda como red.

> **Puente temporal.** Quedó un enlace simbólico en `~/Desktop/pawwi-marketplace` → `~/Proyectos/…`
> para que las sesiones y ventanas abiertas en la ruta vieja no se rompan. **Bórralo** cuando ya no
> tengas nada apuntando ahí: `rm ~/Desktop/pawwi-marketplace` (borra el enlace, no el repositorio).

### ~~3. El marketplace se ve vacío en el navegador~~ · RESUELTO 2026-09-15

**El síntoma real no era «en Chrome»: era «con sesión iniciada».** Sin sesión el marketplace se ve
entero; al iniciar sesión, los once Pawwers desaparecen. Como el primer diagnóstico se hizo en un
navegador que estaba logueado y las comprobaciones de contraste en otro que no, pareció cosa del
navegador durante una tarde entera.

**Causa raíz — un abrazo mortal en el candado de sesión de `supabase-js`:**

`components/ClientNav.tsx` hacía `onAuthStateChange(() => check())`, y `check()` empezaba con
`await supabase.auth.getUser()`. Supabase **avisa a los suscriptores con el candado tomado** y espera
a que cada uno termine; pedir `getUser()` desde ahí dentro vuelve a pedir ese mismo candado, con
espera infinita, y quien lo tiene está esperando al callback. El candado no se libera nunca.

Y como **toda** consulta de PostgREST pide la sesión antes de salir —para decidir si manda el JWT del
usuario o la llave anónima—, el bloqueo no se queda en la navegación: **congela todas las consultas
del navegador**. De ahí las tres cosas que no encajaban:

- **cero peticiones a `supabase.co`** — la petición nunca llega a construirse
- **ningún error en consola** — la promesa no se rechaza, simplemente no se resuelve jamás
- **botones muertos** («cerrar sesión no cerraba»), por la misma razón

**Cómo se encontró, porque la técnica sirve para cualquier cuelgue:** se puso un `console.error`
**después** del `await` y no salió nunca — lo que prueba que el problema está *en* el `await`, no en
su resultado. Un `Promise.race` con 8 segundos lo confirmó («TIMEOUT»), y `auth: { debug: … }` señaló
al culpable: `#_notifyAllSubscribers(SIGNED_IN) begin` sin su `end` y sin `lock released`.

> **Next 16 reenvía la consola del navegador al log de `next dev`**, con prefijo `[browser]`. Eso
> permite depurar un navegador ajeno sin pedir capturas ni pegar nada en la consola.

**La regla, que vale para todo el proyecto:** **nunca llamar a `supabase.*` dentro de un callback de
`onAuthStateChange`** — ni siquiera una consulta normal, porque internamente pide la sesión. Se usa
la sesión que el propio callback entrega, y si hace falta llamar a Supabase se difiere con
`setTimeout(…, 0)` para que corra ya fuera del candado. Hoy solo quedan dos suscriptores:
`ClientNav` (corregido) y `app/page.tsx`, que se limita a un `setState`.

### 3b. 🟠 `useMapsLibrary` fuera de su proveedor · ABIERTO (2026-09-15)

`app/page.tsx` llama `useMapsLibrary("geocoding")` en `PawwiHome`, pero **renderiza el `APIProvider`
como hijo suyo**. El contexto de React baja, no sube: `geocodingLib` es `null` siempre, y
`handleSearch` sale por la puerta de atrás sin geocodificar. **El buscador «¿Dónde vives?» de la home
nunca ha funcionado**, y arreglar la facturación de Maps no lo va a arreglar. El aviso
`[@googlemaps/js-api-loader] No options were set before calling importLibrary` es este bug.

El autocompletado del paso 3 y el del onboarding **sí** están bien: `AddressAutocomplete` se renderiza
dentro del `APIProvider` de cada pantalla. Esos solo esperan la facturación.

### 4. 🟠 Google Maps sin facturación · ABIERTO (2026-09-15)

`BillingNotEnabledMapError` en consola. La llave **está bien restringida por dominio** —una consulta
directa a la API de geocoding la rechaza por eso—, pero el proyecto de Google Cloud **no tiene cuenta
de facturación vinculada**. Se arregla vinculando una cuenta en Google Cloud; Maps trae crédito
mensual gratuito, así que al volumen actual no debería costar nada.

Deja el mapa gris con la marca de agua «For development purposes only» y tumba el **autocompletado de
direcciones**. **No bloquea la prueba de S2**: el paso 3 solo pide dirección si hay transporte
(`offersTransport = transportPrice > 0`), y el Pawwer de pruebas lo tiene en 0.

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

### 2026-09-09 · El dominio

Se destrabó el CNAME que llevaba dos días sin aplicarse. La causa no era propagación: **el editor de
DNS de HostGator no escribe en la zona de Cloudflare**. Lo que lo demostró fue el número de serie
SOA congelado durante 48 horas — un dato verificable que le quitó el piso a la respuesta de guion
del soporte de primera línea.

Un asesor creó el registro directamente en Cloudflare. Quedó proxiado en el primer intento y hubo
que pedir un segundo ajuste a DNS only, porque Vercel no puede emitir el certificado si Cloudflare
intercepta el tráfico.

**`https://app.pawwi.co` quedó en línea con HTTPS.** Se revirtieron los dos valores temporales
(`NEXT_PUBLIC_SITE_URL` en Vercel con su redespliegue, y el Site URL en Supabase) y se verificó que
las meta etiquetas del sitio ya sirven el dominio nuevo.

Con esto **S0 queda completo salvo Resend**, que es el único hilo paralelo que sigue abierto.

### 2026-09-09 (tarde) · Auditoría de cierre de S0 y salida de iCloud

Antes de arrancar S1 se auditó S0 **verificando**, no leyendo la tabla de estado. Todo pasó salvo
una cosa: `tsc` daba 17 errores que no existían el 7 de septiembre y que no correspondían a ningún
archivo del proyecto. Eran carpetas fantasma de iCloud dentro de `node_modules` — ver el problema 2,
ahora resuelto.

**El repositorio salió de iCloud** a `~/Proyectos/pawwi-marketplace`. Se verificó después: git al
día con el remoto, `tsc` limpio, build de 43 páginas, 0 vulnerabilidades.

**Lo que queda de S0 no es trabajo de código, son tres recados con latencia externa:** activar la
Cuenta Digital de Bold, abrir Resend y pedir sus registros DNS, y conseguir el formato de dispersión
masiva del banco. Ninguno bloquea S1.

**Hallazgo para S1:** la limpieza de PawwiProtect cubrió la interfaz, pero `lib/capacitacion.ts`
sigue enseñando el **Fondo de Asistencia** en tres preguntas del examen obligatorio
(líneas 69, 159 y 165). Es peor que un texto de marketing viejo: cada Pawwer nuevo aprende y aprueba
un examen sobre un respaldo que ya no existe, justo antes de abrir su casa. Se suma al bloque de
limpieza de S1 junto con términos y privacidad.

### 2026-09-09 (noche) · S1 completo, con dos rediseños en caliente

Se ejecutó S1 entero. Seis migraciones (60 a 65), corridas a mano y **verificadas contra la base
con consultas de lectura**, no por fe: el usuario corría el SQL y devolvía la tabla de resultados.
Ese ciclo encontró cosas que la lectura del repo no habría encontrado.

**Lo que se construyó según el plan:** transporte de Pawwi desmontado, búsqueda sin corte por
radio, capacidades unificadas con el cupo medido en perros, tope de 10 eliminado, ocupación real
del día, `friendly_dogs` cableado, y los textos (términos, privacidad y el examen del Pawwer).

**Dos rediseños que salieron de objeciones del usuario, no del plan:**

1. **La reserva instantánea se descartó.** Auto-confirmar sin que el Pawwer pueda rechazar ese
   encargo concreto es el único patrón con riesgo laboral real: la subordinación es lo que separa
   una relación civil de una laboral.
2. **Y la escalación NO se retira** — mi primer análisis dijo que sí y era erróneo. Uber, DiDi y
   Rappi ofrecen trabajo que el trabajador no pidió, y es el patrón defendible; lo que genera
   riesgo es obligar a aceptar o castigar el rechazo. Se conserva y se simplifica a **dos etapas**
   (1 h directa + 6 h bolsa = 7 h, antes 13).

**Un cambio de secuencia que ahorra un sprint de trabajo:** S2 decía que el webhook de pago mueve
la reserva a confirmada, pero S1 estableció que confirma la aceptación del Pawwer. Con la secuencia
vieja el cliente pagaba antes de que existiera un Pawwer que hubiera aceptado. Ahora **no se cobra
nada hasta que ambos aceptaron**, y el pago pasa a ser el consentimiento final del cliente. Eso
elimina de S2 el reembolso como camino habitual, la autorización y captura por separado, la
billetera de saldo a favor, y **la pregunta pendiente de si Bold soporta preautorización**.

**Tres defectos encontrados que no estaban en ningún plan:**

- **La agenda estaba vencida.** `availability` tenía 488 filas y **cero futuras**: el seed de julio
  se generó a 60 días y expiró el 2026-08-15. Con una fecha seleccionada el buscador devolvía cero
  Pawwers, y `create_booking` no podía crear ninguna reserva. Repoblada solo para los diez Pawwers
  del seed (mig 62); los dos reales quedaron intactos.
- **`find_escalation_candidates` se había quedado atrás** respecto a la unificación de capacidad:
  pedía `slots_remaining > 0` y proponía candidatos con 1 cupo para reservas de 2 perros, que
  `accept_booking` rechazaba después. Corregido en la mig 64, junto con un `v_days` al que le
  faltaba el `+1` del rango inclusivo.
- 🔒 **Fuga de la dirección del cliente.** `get_pawwer_bookings` y `get_pawwer_booking_detail`
  devolvían `client_address` y las coordenadas exactas a cualquiera que fuera Pawwer asignado **o
  candidato**. Un candidato no ha aceptado nada, y en la bolsa pueden ser muchos a la vez.
  Corregido en la mig 65: dirección exacta solo para el asignado, y al candidato el barrio con
  coordenadas redondeadas a ~1,1 km. **Verificado que nunca se materializó** — cero candidaturas
  expuestas en datos reales.

> **Cómo se encontró la fuga, porque la técnica se repite:** la página de privacidad afirmaba
> «nunca mostramos tu dirección exacta antes de que aceptes». Al ir a verificar esa frase para
> reescribirla, resultó falsa. **Negarse a escribir una afirmación sin comprobarla es un método de
> auditoría**, no un escrúpulo.

**Lección sobre las verificaciones:** una de mis consultas de comprobación dio un falso negativo
porque el `LIKE` exigía `auth.uid() THEN b.client_address` en una línea, y el SQL los tenía
separados por un salto. Postgres guarda el cuerpo verbatim, saltos incluidos. **Al verificar una
función por su texto, no dependas del formato** — busca fragmentos que quepan en una línea, o usa
expresiones regulares con `\s+`.

### 2026-09-10 · Auditoría de las tres superficies y hotfix de seguridad

Se auditó lo construido en los tres lados —cliente, Pawwer y Pawwi como operador— antes de seguir
construyendo. **El plan daba por hecho un embudo que no termina.**

**El bloqueador de lanzamiento.** `visita_pendiente → approved` **no existe en el código**: lo
escribía la migración 13 y la 14 hizo `CREATE OR REPLACE` de esa función cambiándolo a
`visita_pendiente`. Y `pawwer.verified` solo lo pone en `true` el `INSERT` del seed. Un Pawwer real
que complete el 100% del embudo **nunca aparece en el marketplace**. Publicar a alguien son hoy dos
`UPDATE` a mano en Studio, sin validación ni rastro. Lo resuelve el sprint **S3 · El operador**,
nuevo, que empujó el lanzamiento del 30 de noviembre al 12 de enero.

**La vulnerabilidad, corregida el mismo día (migraciones 66 y 67).**
`set_pawwer_exam_result` y `set_pawwer_capacitacion_result` eran `SECURITY DEFINER`, recibían del
cliente el resultado a escribir, y **no tenían `GRANT` ni `REVOKE`** — conservaban el
`EXECUTE TO PUBLIC` por defecto. Cualquier Pawwer podía saltarse la capacitación entera con un
`POST` y `p_passed: true`. Atacaba la única promesa de Pawwi.

Con ella cayeron tres defectos más del mismo embudo: `visita_domiciliaria` sin blindar, las fotos
de cédula que **nunca se guardaban** (un `UPDATE` revocado cuyo error se descartaba), y el
`INSERT` de disponibilidad del onboarding que no conocía `slots_total`.

**Y una lección de método que ya vale más que el arreglo.** La verificación de la 66 devolvió
`firmas_onboarding = 3` cuando esperaba 1. No era un fallo de esa migración:
`complete_pawwer_onboarding` arrastraba **tres firmas desde julio**, y la más vieja **no tenía el
control de mayoría de edad**. Se podía crear un Pawwer menor de 18 años llamándola directamente.

> **Mi consulta preguntaba `count(*)`, y por eso lo vi.** Si hubiera preguntado «¿existe la
> función?» —lo intuitivo— habría dado `true` con la insegura viva al lado, y habría dado el hotfix
> por bueno. Ver la regla del apartado «Al cambiar la firma de una RPC».

**Lo que la auditoría repartió en los sprints:** favoritos que no persisten, el Pasaporte con 0 de
9 columnas cableadas, editar mascota que crea duplicados, `/mis-favoritos` y `/mis-mensajes` sin
una sola query, dos enlaces a rutas 404, `needs_review` como callejón sin salida, la agenda de
visitas sin modelar, y los 10 `test_*.sql` con un UUID quemado sobre un entorno que ya no existe.

**Un aviso operativo:** el examen y la capacitación ahora dependen de `SUPABASE_SERVICE_ROLE_KEY`
en Vercel. Ya estaba desde S0. Si algún día falta, el síntoma será que un Pawwer no puede terminar
el embudo — `lib/admin.ts` lanza un error explícito en vez de caer a la clave anónima en silencio.

### 2026-09-10 y 11 · El diseño de las tres plataformas

Sin código: se diseñó lo que falta en los tres lados, pantalla por pantalla, y se dejó en
[`09-DISENO-PLATAFORMAS.md`](./09-DISENO-PLATAFORMAS.md) — navegación, mapa de pantallas, qué hace
cada una, la matriz de estados de una reserva vista por los tres, y quién recibe qué notificación.

**Lo que salió al revisar cada lado**, ya repartido en `docs/07`:

- **El embudo del Pawwer**, paso por paso: la visita no tiene herramienta, y su protocolo **no se
  puede ejecutar** porque el portal del Pawwer exige `approved` y en la visita todavía no lo está.
  Se resuelve con `/admin/visita/[id]` desde el móvil del admin
- **El portal del Pawwer** promete tres cosas que no cumple: pago «automático», «Élite 20%» con una
  regla incompleta —puede decir 20% y cobrar 25%—, y $20.000 por referido sin atribución posible
- **El portal del cliente**: el Pawwer desaparece de la tarjeta cuando la reserva pasa a la bolsa;
  el cliente nunca ve la dirección del cuidador; y la Política de Privacidad afirma que se puede
  eliminar la cuenta, **cosa que el cliente no puede hacer** — lo escribí yo el 2026-09-09
- Dos guards flojos: un cliente logueado puede abrir `/pawwer/cuenta-cobro`

**Decisiones de diseño tomadas:** la dirección de cada lado se revela con compromiso firme (el
Pawwer al aceptar, el cliente al pagar); no hay chat antes de reservar; reservar de nuevo en un
toque; los hechos observados en la visita van separados de lo que el Pawwer declaró.

**Terminología.** Nicolás aclaró que **Pawwer es siempre el cuidador, nunca el cliente**. No se
encontró ningún uso incorrecto en docs, código ni memorias, pero había frases ambiguas en la sección
del cliente. Quedó un glosario al principio del `09`.

**Las memorias estaban huérfanas.** Al mover el repo de `~/Desktop` a `~/Proyectos` el 2026-09-09,
las memorias de sesiones anteriores quedaron bajo la ruta vieja y la sesión nueva leía de una
carpeta vacía. Se migraron y se actualizaron las cuatro que estaban desfasadas.

### 2026-09-11 · Relectura completa, contra el código

Al cerrar la sesión anterior afirmé que ningún documento contradecía a otro. **No era cierto.** Una
relectura completa de `06`–`09`, del índice y de las doce memorias encontró afirmaciones que el
trabajo de esta misma semana había dejado atrás:

- **El índice** tenía dos filas de «Portal admin» que se contradecían entre sí, describía la
  reserva con «dos velocidades según nivel» —el modelo que se descartó el 2026-09-09— y contaba 59
  migraciones
- **`07`** titulaba «Tres promesas vivas» sobre una tabla de cinco, y hacía la cuenta de caja con
  «doce semanas sin ingresos», que eran las del lanzamiento de noviembre
- **`06`** seguía listando como pendiente la deuda de las dos capacidades, resuelta en la
  migración 61; decía que el embudo del Pawwer tiene un solo paso humano, cuando la revisión de
  cédula también lo es; y su sección de seguridad cerraba con «no queda deuda»
- **Cuatro memorias** conservaban el motor de tres fases, el transporte de Pawwi, la reserva
  instantánea y cifras del punto de equilibrio que `06` ya había corregido

**Y dos hallazgos de seguridad**, ninguno explotable hoy, los dos para la primera migración de S3:

1. **`delete_availability` es `SECURITY DEFINER` sin `search_path`** desde la migración 06. La
   auditoría del 2026-09-07 la dio por reemplazada porque su nombre aparecía en la 25, que solo le
   hizo `REVOKE`/`GRANT`. Riesgo práctico bajo: solo la ejecuta `authenticated` y usa nombres
   calificados. La lección está ahora en el apartado «Base de datos»
2. **`exam_results` y `capacitacion_results` siguen escribibles por el propio Pawwer.** El cambio
   de estado ya es solo de `service_role`, así que reescribirlas no le abre el embudo a nadie. Pero
   en S3 la ficha del admin va a decidir `needs_review` **leyendo esas filas**: hay que cerrarlas
   antes de construir la pantalla que confía en ellas

**Y un defecto de robustez que aparecerá con Resend:** `sendEmail` no atrapa errores de red, así que
un Resend caído tumbaría la acción que manda el correo *después* de haber cambiado el estado. Hoy
no ocurre —producción no tiene llave y la función sale antes—; va a S3 junto con el correo de
aprobación. De paso: el `RESEND_API_KEY` de `.env.local` es un marcador de 9 caracteres, no una
llave.

> **Método:** los dos hallazgos salieron de comprobar una frase de la documentación contra el
> código, igual que la fuga de la dirección el 2026-09-09. Es la misma técnica, y sigue
> funcionando.

### 2026-09-11 (tarde) · S2 arranca con diecisiete días de adelanto

Nicolás decidió empezar S2 el mismo día, en vez del 28. Todo el código quedó escrito en la sesión
—migración 68, `lib/bold.ts`, `lib/cobro.ts`, el webhook, las acciones de pago y las pantallas de los
dos lados—, con `tsc` en 0 y sin problemas de ESLint nuevos. **Falta correr la 68 y probar.**

**Antes de escribir, se leyó la documentación de Bold** y respondió la pregunta que llevaba días
pendiente: el checkout se puede abrir en cualquier momento con una firma del servidor, así que el
cobro puede esperar a la aceptación. Y trajo dos restricciones que cambian el diseño: **en pruebas
no hay webhooks**, y **no hay API de reembolsos** —solo anulación de tarjetas de crédito el mismo día—.

**Y se auditó lo existente**, que encontró más que la documentación:

- 🔴 **`paid_at` ya tenía dueño.** El plan decía «el webhook sella `paid_at`», y `paid_at` es desde la
  migración 48 el pago **al Pawwer**. Habría marcado como pagado dinero nunca transferido. El cobro
  va en `charged_at`
- **El Pawwer elegido veía la dirección del cliente antes de aceptar.** La 65 solo tapó a los
  candidatos de la bolsa; en la etapa 1 `pawwer_id` viene desde la creación. La política de
  privacidad afirmaba lo contrario
- **La bolsa ignoraba `allow_pool`** si el Pawwer abría su inicio en el minuto justo: la copia de
  `advance_booking_statuses` seguía con la lógica de la migración 40
- **El techo de precio de la bolsa medía mal**, no exigía transporte ni el tope de perros, y un
  candidato veía su ganancia con la tasa de otro Pawwer
- **Ninguna visita agendada avisó jamás al equipo**: el correo dependía de `PAWWI_ADMIN_EMAIL`, que
  nunca existió en producción. Y el respaldo de los otros avisos era `luisa@pawwi.co`
- Quedaban **tres promesas más de pago «automático»**: en Ganancias, en la cuenta de cobro y en la
  pantalla de la cuenta bancaria

**Cuatro decisiones de producto**, todas de Nicolás: dos horas para pagar; 100% de reembolso con 48
horas o más y ninguno con menos, cobrando el Pawwer; dirección del cliente al pagar; comisión del
Pawwer que acepta.

**Una corrección propia en la misma sesión:** en la política de privacidad escribí que el cliente
«ve dónde queda la casa del Pawwer cuando la reserva está pagada». Eso lo construye S4; hoy no es
cierto. Se quitó antes de confirmar — el mismo error de «eliminar tu cuenta», atrapado a tiempo esta
vez.

**Limpieza:** 18 carpetas vacías de iCloud (`nuevo 2`, `confirmada 2`…) que vinieron con el `mv` del
9 de septiembre. Eran anteriores a la mudanza y no se están creando nuevas.

### 2026-09-15 · La 68 en producción, y un hueco propio cerrado

La migración 68 se corrió y se verificó: `4 · true · false · false · 6 · 0 · 0`. Ese último cero
confirma además que **ninguna función `SECURITY DEFINER` quedó sin `search_path`** — la comprobación
que los archivos no podían dar. Push, y el despliegue quedó vivo en 60 segundos; el webhook responde
405 a un GET y **401 a un POST sin firma o con firma falsa**, comprobado contra producción.

**Y se cerró un hueco que había dejado yo el 11.** La regla «acepta la firma con llave vacía fuera de
producción» parecía inofensiva, y no lo era: los previews de Vercel son públicos, usan **la misma
base que producción** y el `order_id` sale del id de la reserva, que el cliente ve en su URL. Con un
preview vivo, un cliente podía firmarse un «pago aprobado» de su propia reserva y confirmarla sin
pagar. Ahora esa puerta está **cerrada por defecto en todas partes** y solo la abre
`BOLD_ALLOW_TEST_WEBHOOK=1`, que en producción se ignora. Verificado en los seis escenarios
—local, preview y producción, con y sin bandera—.

> **De dónde salió:** de revisar una captura del panel de Bold. No estaba buscando esto; estaba
> confirmando cuáles eran las llaves de pruebas. Mirar el propio código con la pregunta «¿y si esto
> lo hace el cliente?» encima sigue siendo la técnica que más encuentra.

**Nota de higiene:** las llaves de **pruebas** también son secretos —firman cobros en nuestro propio
sistema— y no van en un chat ni en una captura. No se rotaron: Bold advierte que generar llaves
nuevas tumba las integraciones vivas hasta actualizarlas, y con la puerta ya cerrada el riesgo real
es ninguno.

### 2026-09-15 (tarde) · Preparar la prueba encontró cuatro bugs del lado del cliente

Montar la cuenta de cliente y la agenda del Pawwer para probar el cobro sacó más defectos que el
propio cobro. Los cuatro corregidos el mismo día:

| Lo que pasó | La causa | El arreglo |
|---|---|---|
| El registro fallaba con «Ocurrió un error. Intenta de nuevo» | `profile.phone` es **UNIQUE** y el celular ya era de otra cuenta: el trigger `handle_new_user` moría con `23505`. El server action se tragaba el error sin registrarlo | Mensaje en el campo del celular, y **todo error de registro queda en el log** con código y estado |
| Mandaba a «revisa tu correo» y el correo no llegaba nunca | `mailer_autoconfirm` está en **`true`**: Supabase confirma al instante y no envía nada | Si `signUp` ya devuelve sesión, el cliente entra directo y el Pawwer va a su embudo |
| «Mis reservas» del menú no mostraba nada | Iba a `/reservas` y `/mascotas`, **dos rutas que no existen**: 404. Estaba en la auditoría para S4 | Ahora van a `/mis-reservas` y `/mis-mascotas`, más «Mi perfil» |
| No se sabía si había sesión, y «cerrar sesión» parecía no funcionar | El único indicio era un ícono genérico, idéntico a estar fuera | El header muestra **nombre e inicial**, que ya vienen en la sesión |

**Y un quinto, de capacidad:** el calendario de disponibilidad abría cada día con cupo para **un solo
perro**, fijo en el código, aunque el Pawwer hubiera declarado 4 en Tarifas. «Acepto hasta 4 perros»
quedaba en papel y una reserva de 2 se caía por falta de cupo. Ahora usa el máximo de sus servicios
activos y lo dice en pantalla. *(La pantalla sigue sin permitir un cupo distinto por día; eso es
diseño pendiente, no bug.)*

**Dos hallazgos que van a S4:**

- 🔴 **`profile.id` no tiene llave foránea hacia `auth.users`.** Borrar un usuario **deja su perfil
  vivo**, con nombre, teléfono y dirección. Es justo lo que rompe «eliminar mi cuenta», que la Ley
  1581 exige y la política de privacidad ya promete. Se comprobó creando y borrando usuarios de
  diagnóstico: el perfil sobrevive y sigue ocupando el celular único
- **¿El celular debe ser único?** Hoy lo es y no se verifica con OTP. Dos personas de una familia
  comparten número, y la segunda no puede registrarse nunca. Decisión de producto para S4

**Método, para la próxima:** casi todo el diagnóstico se hizo contra la API de Supabase con las llaves
de `.env.local` —listar usuarios, reproducir un registro que debía fallar, consultar como anónimo y
como cliente autenticado con un usuario temporal—. Es mucho más rápido que pedir capturas, y no hace
falta SQL Editor salvo para escribir en `profile`, donde `service_role` no tiene permisos.

**Y la misma tarde quedó Resend, que era lo último de S0** — llevaba abierto desde el 7 de
septiembre. Dominio `pawwi.co` verificado, con DKIM en la raíz y SPF y MX en `send.pawwi.co`, así que
**el SPF de la raíz nunca se tocó**: el riesgo que más nos preocupaba de este paso lo evita el propio
diseño de Resend. Un correo de prueba desde `hola@pawwi.co` llegó a la bandeja principal, no a spam.

Del ticket con HostGator salen dos lecciones, las dos operativas:

- **El asesor creó los cuatro registros como TXT**, incluido el que tenía que ser MX — «cuatro
  registros TXT» fue lo que leyó. Al pedir un MX conviene escribir el tipo aparte y en mayúsculas,
  y decir explícitamente qué registro hay que **eliminar** si quedó mal.
- **Cambió sin avisar las prioridades del MX de la raíz**, de `1`/`1` a `10`/`20`. No rompió nada
  —son los valores que Titan documenta— pero es el correo de la empresa. Por eso el inventario DNS
  de este documento se verifica contra los nameservers, no contra lo que dice el ticket.

### 2026-09-15 (noche) · El marketplace vacío no era el navegador

Se desbloqueó la prueba de S2. El día se había cerrado dando por hecho que el marketplace vacío era
cosa de Chrome; **era un abrazo mortal en el candado de sesión de `supabase-js`**, y el detalle que lo
destapó lo dio Nicolás: *sin sesión aparecen los hogares, con sesión desaparecen*. Causa, mecanismo y
método en el problema 3, ahora resuelto.

**Lo que hizo perder la tarde fue una asimetría invisible:** el navegador «roto» estaba logueado y los
«sanos» —iPhone y Safari— no. Con esa muestra, la hipótesis «es el navegador» explicaba todos los
datos y era falsa. **Cuando dos entornos difieren, la primera pregunta es en qué difiere el estado de
sesión, no el navegador.**

**Tres cosas que salieron de paso:**

- **Un cuelgue no deja rastro, y por eso engaña.** Ni petición, ni error, ni excepción: los tres
  síntomas que hacían el caso «imposible» son la firma de una promesa que no resuelve. Se distingue de
  un fallo poniendo un log **después** del `await`: si no sale, el problema está en la espera
- **Faltaba el `catch`.** El `.then()` del builder de Supabase no llevaba manejo de rechazo, así que
  cualquier fallo previo a la red se perdía en silencio. Los tres efectos de la home pasaron a
  `async/await` con `try/catch` — es lo que convierte un fallo mudo en un error visible
- 🆕 **`useMapsLibrary` fuera de su proveedor** (problema 3b): el buscador de ubicación de la home
  **nunca ha geocodificado**, y no es culpa de la facturación de Maps

**Higiene:** se borró el usuario de diagnóstico `diag-rls-…@example.com`. Como `profile` no tiene
llave foránea a `auth.users` —el obstáculo de S4—, **dejó un perfil huérfano más**, «Diag RLS2», que
se suma a la limpieza pendiente por SQL Editor.

### 2026-09-15 (noche, II) · Reservar era imposible, y nadie lo sabía · mig 69

Con el marketplace ya visible, el siguiente paso de la prueba —crear una mascota— falló con «No se
pudo guardar la mascota». El log del servidor dio la causa en una línea:
`[Pawwi] crearMascota: permission denied for table dog`.

**`authenticated` nunca tuvo privilegios sobre `dog`.** No se los revocó nadie: no existe un solo
`GRANT` ni `REVOKE` sobre esa tabla en todo `supabase/`. La migración 44 lo daba por hecho en su
comentario de cierre —«deberían quedar solo: dog, profile, exam_results»— pero **dar por sentado no
es conceder**. El segundo error, sobre `dog_booking`, es calcado al que resolvió la **mig 43** con
`booking`: la policy `dog_booking_visible` consulta esa tabla en un subquery, y evaluarla exige
`SELECT` sobre ella.

**Rompía los cinco accesos directos a `dog`** —`/mis-mascotas`, `/bienvenida`, crear, eliminar y el
selector de perros del paso 3—, así que **no se podía reservar**. Por eso `perros_de_clientes = 0`:
no era que nadie hubiera cargado un perro, es que no se podía. Llevaba ahí desde julio, invisible
porque nunca se había recorrido el producto como cliente.

**Lo corrige la migración 69**, verificada por REST con la sesión real del cliente: `SELECT` 200,
`INSERT` 201, `DELETE` 204. De paso se auditaron las 17 tablas —el resultado, arriba, en «Los
permisos de tabla son estado ambiental»— para no ir descubriéndolas de una en una.

> **El patrón que se repitió tres veces hoy:** el síntoma que ve el usuario («no se guarda») no
> nombra la causa, y el mensaje real estaba a una línea de distancia en el log. Con
> `next dev` reenviando la consola del navegador, **mirar el log antes que el código** dejó de ser
> una cuestión de suerte.

### 2026-09-15 (noche, III) · El circuito del dinero cerró, y el camino hasta él tenía siete trampas

**Se cobró por primera vez de punta a punta.** Reserva Express de $10.000: el cliente reserva → el
Pawwer acepta (cupo bloqueado, `charged_at` vacío, dos horas de plazo, correo real desde
`hola@pawwi.co`) → el cliente paga con la tarjeta de pruebas (`T_8PCLLRPCIQ`, APPROVED) → la consulta
a Bold sella `charged_at` → notificación a los dos lados → **el Pawwer ve la dirección exacta, y no
antes**. `pawwer_payout` 7.500: la comisión del 25% congelada al aceptar.

> La confirmación llegó **por la consulta, no por webhook** — en pruebas Bold no los manda. Ese
> camino de respaldo existe porque se leyó su documentación antes de escribir el código.

**Siete defectos entre el cliente y el cobro, ninguno del cobro.** Cinco tenían la misma forma: una
consulta mal escrita que falla en silencio y una pantalla que reacciona rindiéndose sin decir nada.

| # | Defecto | Qué rompía |
|---|---|---|
| 1 | `authenticated` **nunca tuvo permisos** sobre `dog` ni `dog_booking` | **Reservar era imposible** desde julio · mig 69 |
| 2 | **FK duplicada** `service_X_Pawwer → service_type`: embed ambiguo | El paso 1 rebotaba al home · mig 70 |
| 3 | **Cuatro pistas de FK inventadas** (`*_fkey` en vez de `fk_*`) | Detalle roto · **`/mis-reservas` vacía** · descripción genérica en el checkout |
| 4 | `booking.notes` no existe — la columna es `comments` | Tumbaba la consulta del detalle |
| 5 | `redirection-url` en `http://` | **BTN-001** de Bold, que no dice qué atributo falla |
| 6 | Express **no exigía fecha** y no mostraba calendario | Reservaba **hoy** en silencio; la etiqueta decía «hoy» siempre |
| 7 | El calendario filtraba por `week_pattern` **además** de por `availability` | **Media agenda invisible**: 8 de 16 días abiertos |

**La lección que se repitió cinco veces:** *un redirect mudo y un estado vacío que miente no se
depuran.* En cuanto cada guard registró el error antes de rendirse, el diagnóstico pasó de media hora
de sondeos a **diez segundos de leer el log**. Con `next dev` reenviando la consola del navegador, el
log es el primer sitio donde mirar, no el último.

**Y dos de producto, que salieron de usar el producto:**

- **`week_pattern` es una plantilla, no un filtro.** Genera la agenda al crear el perfil (mig 08);
  `create_booking` **no lo valida** — solo `availability`. Filtrar por él escondía días que el Pawwer
  había abierto a propósito y que el backend sí aceptaba. Ahora, **con agenda cargada manda la
  agenda**; el patrón solo decide si no hay ninguna.
- **Dos números que medían cosas distintas parecían contradecirse.** «Máx. 1 perro» (tope de *tu
  reserva*, `max_animals`) junto a «1 de 2» (peludos *en la casa ese día*, los cupos) se leía como un
  error. Ahora cada frase dice a qué se refiere, y **la ocupación se ve ya en el calendario del paso
  2** —un punto por peludo reservado—, que es cuando sirve para decidir.

---

**Pawwi S.A.S.** · NIT 901.937.952-7 · Bogotá, Colombia
