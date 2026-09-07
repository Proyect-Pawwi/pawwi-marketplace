-- ============================================================
-- PAWWI — PARTE 2: Tablas faltantes (reviews + messages)
-- ============================================================

-- ── availability (per-date, slots_remaining = Opción A del spec) ──
-- Complementa pawwer_availability (horario semanal de Diego)
-- Esta tabla es la que usa el calendar picker de reservas
CREATE TABLE IF NOT EXISTS public.availability (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pawwer_id     uuid NOT NULL REFERENCES public.pawwer(id) ON DELETE CASCADE,
  date          date NOT NULL,
  slots_remaining integer NOT NULL DEFAULT 1 CHECK (slots_remaining >= 0),
  UNIQUE (pawwer_id, date)
);

-- ── reviews ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES public.booking(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES public.profile(id),
  pawwer_id   uuid NOT NULL REFERENCES public.pawwer(id),
  rating      numeric(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     text,
  would_return boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)  -- una reseña por reserva
);

-- ── messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid NOT NULL REFERENCES public.booking(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES public.profile(id),
  content          text NOT NULL,
  is_daily_report  boolean NOT NULL DEFAULT false,
  photo_url        text,
  seen_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
