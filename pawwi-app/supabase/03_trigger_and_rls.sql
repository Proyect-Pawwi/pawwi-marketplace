-- ============================================================
-- PAWWI — PARTE 3: Trigger handle_new_user + RLS
-- ============================================================

-- ── Trigger: crear profile al registrar usuario ───────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile (id, name, phone, role, neighborhood)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'neighborhood', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Eliminar trigger si ya existe para recrearlo limpio
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── RLS ───────────────────────────────────────────────────────

-- profile
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_own" ON public.profile;
CREATE POLICY "profile_own" ON public.profile
  FOR ALL USING (auth.uid() = id);

-- pawwer: lectura pública, escritura solo el propio pawwer
ALTER TABLE public.pawwer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pawwer_public_read" ON public.pawwer;
DROP POLICY IF EXISTS "pawwer_own_write" ON public.pawwer;
CREATE POLICY "pawwer_public_read" ON public.pawwer
  FOR SELECT USING (true);
CREATE POLICY "pawwer_own_write" ON public.pawwer
  FOR ALL USING (auth.uid() = id);

-- Pawwer_images: lectura pública
ALTER TABLE public."Pawwer_images" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pawwer_images_public_read" ON public."Pawwer_images";
CREATE POLICY "pawwer_images_public_read" ON public."Pawwer_images"
  FOR SELECT USING (true);

-- service_X_Pawwer: lectura pública, escritura solo el pawwer
ALTER TABLE public."service_X_Pawwer" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "services_public_read" ON public."service_X_Pawwer";
DROP POLICY IF EXISTS "services_own_write" ON public."service_X_Pawwer";
CREATE POLICY "services_public_read" ON public."service_X_Pawwer"
  FOR SELECT USING (true);
CREATE POLICY "services_own_write" ON public."service_X_Pawwer"
  FOR ALL USING (auth.uid() = id_pawwer);

-- availability: lectura pública, escritura solo el pawwer
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "availability_public_read" ON public.availability;
DROP POLICY IF EXISTS "availability_own_write" ON public.availability;
CREATE POLICY "availability_public_read" ON public.availability
  FOR SELECT USING (true);
CREATE POLICY "availability_own_write" ON public.availability
  FOR ALL USING (auth.uid() = pawwer_id);

-- pawwer_availability: lectura pública
ALTER TABLE public.pawwer_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pawwer_avail_public_read" ON public.pawwer_availability;
CREATE POLICY "pawwer_avail_public_read" ON public.pawwer_availability
  FOR SELECT USING (true);

-- booking: cliente ve las suyas, pawwer ve las suyas
ALTER TABLE public.booking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_client" ON public.booking;
DROP POLICY IF EXISTS "booking_pawwer" ON public.booking;
CREATE POLICY "booking_client" ON public.booking
  FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "booking_pawwer" ON public.booking
  FOR ALL USING (auth.uid() = pawwer_id);

-- dog: solo el dueño
ALTER TABLE public.dog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dog_owner" ON public.dog;
CREATE POLICY "dog_owner" ON public.dog
  FOR ALL USING (auth.uid() = owner_id);

-- favourite: solo el cliente
ALTER TABLE public.favourite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "favourite_owner" ON public.favourite;
CREATE POLICY "favourite_owner" ON public.favourite
  FOR ALL USING (auth.uid() = client_id);

-- reviews: lectura pública, escritura solo el cliente de la reserva
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_public_read" ON public.reviews;
DROP POLICY IF EXISTS "reviews_client_write" ON public.reviews;
CREATE POLICY "reviews_public_read" ON public.reviews
  FOR SELECT USING (true);
CREATE POLICY "reviews_client_write" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = client_id);

-- messages: solo las partes de la reserva
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_parties" ON public.messages;
CREATE POLICY "messages_parties" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.booking b
      WHERE b.id = messages.booking_id
        AND (b.client_id = auth.uid() OR b.pawwer_id = auth.uid())
    )
  );

-- Lookup tables: lectura pública sin restricción
ALTER TABLE public.service_type      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_size          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_day          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_booking       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lookup_public_read_service_type"   ON public.service_type;
DROP POLICY IF EXISTS "lookup_public_read_booking_status" ON public.booking_status;
DROP POLICY IF EXISTS "lookup_public_read_dog_size"       ON public.dog_size;
DROP POLICY IF EXISTS "lookup_public_read_place"          ON public.place;
DROP POLICY IF EXISTS "lookup_public_read_week_day"       ON public.week_day;

CREATE POLICY "lookup_public_read_service_type"   ON public.service_type   FOR SELECT USING (true);
CREATE POLICY "lookup_public_read_booking_status" ON public.booking_status FOR SELECT USING (true);
CREATE POLICY "lookup_public_read_dog_size"       ON public.dog_size       FOR SELECT USING (true);
CREATE POLICY "lookup_public_read_place"          ON public.place          FOR SELECT USING (true);
CREATE POLICY "lookup_public_read_week_day"       ON public.week_day       FOR SELECT USING (true);
