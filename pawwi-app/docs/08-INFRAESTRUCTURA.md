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
| **Resend** | Correo transaccional | ⏳ **sin configurar** |

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
| `RESEND_API_KEY` | — | ⏳ pendiente. **Sin la variable**, `lib/email.ts` omite el envío y sigue; con un valor inválido, Resend lo rechaza y solo queda un error en el log. En `.env.local` hay hoy un **marcador de 9 caracteres**, no una llave: reemplazarlo al abrir la cuenta |

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

**Y dos hallazgos de seguridad**, ninguno explotable hoy, los dos para la migración 68 de S3:

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

---

**Pawwi S.A.S.** · NIT 901.937.952-7 · Bogotá, Colombia
