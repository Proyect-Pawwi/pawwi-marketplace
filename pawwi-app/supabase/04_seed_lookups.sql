-- ============================================================
-- PAWWI — PARTE 4: Seed lookup tables
-- ============================================================

-- service_type (incluye Express según spec)
INSERT INTO public.service_type (id, name) VALUES
  (1, 'DayCare'),
  (2, 'Night'),
  (3, 'Travel'),
  (4, 'Express')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- booking_status
INSERT INTO public.booking_status (id, name) VALUES
  (1, 'pending'),
  (2, 'confirmed'),
  (3, 'active'),
  (4, 'completed'),
  (5, 'cancelled')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- dog_size
INSERT INTO public.dog_size (id, size) VALUES
  (1, 'Pequeño'),
  (2, 'Mediano'),
  (3, 'Grande'),
  (4, 'Extra grande')
ON CONFLICT (id) DO UPDATE SET size = EXCLUDED.size;

-- week_day
INSERT INTO public.week_day (id, day) VALUES
  (0, 'Domingo'),
  (1, 'Lunes'),
  (2, 'Martes'),
  (3, 'Miércoles'),
  (4, 'Jueves'),
  (5, 'Viernes'),
  (6, 'Sábado')
ON CONFLICT (id) DO UPDATE SET day = EXCLUDED.day;
