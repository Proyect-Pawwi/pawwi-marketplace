# Pawwi — Contrato de Queries Supabase

Todas las queries usan el cliente de Supabase JS (`@supabase/ssr`).
Tablas principales: `pawwer`, `profile`, `service_X_Pawwer`, `service_type`, `Pawwer_images`, `availability`, `reviews`, `booking`, `dog`, `messages`, `favourite`.

---

## 1. Home — Listado de Pawwers verificados

**Usado en:** `app/page.tsx` (useEffect al montar)

```typescript
supabase
  .from("pawwer")
  .select(`
    id, price, rating, reviews_count, lat, lng, badge, neighborhood,
    profile!pawwer_profile_fk ( name, avatar_url ),
    services:service_X_Pawwer ( price, service_type ( name ) ),
    images:Pawwer_images ( image )
  `)
  .eq("verified", true)
  .not("lat", "is", null)
```

**Respuesta ejemplo:**
```json
{
  "id": "a1000000-0000-0000-0000-000000000001",
  "price": 45000,
  "rating": 4.90,
  "reviews_count": 23,
  "lat": 4.732,
  "lng": -74.0498,
  "badge": "Súper",
  "neighborhood": "Colina Campestre",
  "profile": { "name": "Juliana M.", "avatar_url": null },
  "services": [
    { "price": 45000, "service_type": { "name": "DayCare" } },
    { "price": 50000, "service_type": { "name": "Night" } }
  ],
  "images": []
}
```

**Filtros aplicados en frontend (Haversine):**
- Por radio: `haversineKm(searchCoords, {lat, lng}) <= radiusKm`
- Por servicio: `p.services.includes(serviceType)`
- Auto-expand: si 0 resultados en radio elegido → intenta 3km → muestra todos

---

## 2. Perfil Pawwer completo

**Usado en:** `app/pawwer/[id]/page.tsx` (useEffect)

```typescript
// Query principal
supabase
  .from("pawwer")
  .select(`
    id, price, rating, reviews_count, badge, neighborhood,
    bio, profession, response_time, experience, week_pattern, faqs,
    profile!pawwer_profile_fk ( name, avatar_url ),
    services:service_X_Pawwer ( price, is_active, service_type ( name ) ),
    images:Pawwer_images ( image ),
    reviews ( id, rating, comment, created_at, reviewer:profile!reviews_client_id_fkey ( name ) )
  `)
  .eq("id", pawwerId)
  .single()

// Query paralela: disponibilidad próximos 60 días
supabase
  .from("availability")
  .select("date")
  .eq("pawwer_id", pawwerId)
  .gte("date", today)          // ISO: "2026-06-05"
  .lte("date", in60days)       // ISO: "2026-08-04"
  .gt("slots_remaining", 0)
```

**Respuesta ejemplo (perfil):**
```json
{
  "id": "a1000000-0000-0000-0000-000000000001",
  "price": 45000,
  "rating": 4.90,
  "badge": "Súper",
  "neighborhood": "Colina Campestre",
  "bio": "Cuido perros en mi hogar como si fueran propios.",
  "profession": "Veterinaria",
  "response_time": "< 1 hora",
  "experience": ["3 años cuidando perros", "Certificada en primeros auxilios"],
  "week_pattern": { "Mon": true, "Tue": true, "Wed": true, "Thu": true, "Fri": true, "Sat": false, "Sun": false },
  "faqs": [{ "q": "¿Tienes mascotas propias?", "a": "Sí, una Golden Retriever." }],
  "profile": { "name": "Juliana M.", "avatar_url": null },
  "services": [
    { "price": 45000, "is_active": true, "service_type": { "name": "DayCare" } },
    { "price": 50000, "is_active": true, "service_type": { "name": "Night" } }
  ],
  "images": [],
  "reviews": []
}
```

**Respuesta ejemplo (availability):**
```json
[
  { "date": "2026-06-10" },
  { "date": "2026-06-11" },
  { "date": "2026-06-15" }
]
```

**Lógica del calendario:**
- Si `availableDates.length > 0` → solo esas fechas son seleccionables
- Si `availableDates` vacío → se usa el `week_pattern` para bloquear por día de semana

---

## 3. Login Cliente

**Usado en:** `app/actions/auth.ts → iniciarSesion`

```typescript
supabase.auth.signInWithPassword({ email, password })
// Redirect → "/"
```

---

## 4. Registro Cliente

**Usado en:** `app/actions/auth.ts → registrarCliente`

```typescript
supabase.auth.signUp({
  email, password,
  options: {
    data: { full_name, phone, neighborhood, lat, lng },
    emailRedirectTo: `${SITE_URL}/auth/confirm`,
  }
})
// Trigger handle_new_user crea el profile automáticamente
// Redirect → "/registro/confirmar"
```

---

## 5. Login Pawwer

**Usado en:** `app/actions/auth.ts → iniciarSesionPawwer`

```typescript
// 1. Auth
supabase.auth.signInWithPassword({ email, password })

// 2. Verificar rol
supabase.from("profile").select("role").eq("id", userId).single()
// Si role !== "pawwer" → error

// 3. Verificar onboarding
supabase.from("pawwer").select("id").eq("id", userId).single()
// Si existe → redirect "/pawwer/dashboard"
// Si no existe → redirect "/pawwer/bienvenida"
```

---

## 6. Verificación de email

**Usado en:** `app/auth/confirm/route.ts`

```typescript
supabase.auth.verifyOtp({ token_hash, type: "email" | "recovery" })
// Redirect → "/" o "/nueva-contrasena"
```

---

## 7. Recuperar contraseña

**Usado en:** `app/actions/auth.ts → recuperarContrasena`

```typescript
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${SITE_URL}/auth/confirm?type=recovery&next=/nueva-contrasena`
})
```

---

## Tablas y RLS — Resumen

| Tabla | Lectura pública | Escritura |
|-------|----------------|-----------|
| `pawwer` | ✅ todos (verified=true) | Solo el propio Pawwer |
| `profile` | ✅ solo role='pawwer' | Solo el propio usuario |
| `service_X_Pawwer` | ✅ todos | Solo el propio Pawwer |
| `Pawwer_images` | ✅ todos | Solo el propio Pawwer |
| `availability` | ✅ todos | Solo el propio Pawwer |
| `reviews` | ✅ todos | Solo el cliente de la reserva |
| `booking` | ❌ privado | Cliente o Pawwer de la reserva |
| `dog` | ❌ privado | Solo el dueño |
| `messages` | ❌ privado | Solo las partes de la reserva |
| `favourite` | ❌ privado | Solo el cliente |

---

## Pendiente S3

```typescript
// Crear reserva
supabase.from("booking").insert({
  client_id, pawwer_id, start_date, end_date,
  service_type_id, status_id: 1, // pending
  total, commission, pawwer_payout, hours_count
})

// Decrementar slot de disponibilidad
supabase.from("availability")
  .update({ slots_remaining: slots_remaining - 1 })
  .eq("pawwer_id", pawwerId)
  .eq("date", date)
```
