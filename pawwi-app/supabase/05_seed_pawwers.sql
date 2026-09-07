-- ============================================================
-- PAWWI — PARTE 5: Seed 10 Pawwers
-- UUIDs fijos para consistencia con el frontend mock data
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
INSERT INTO public.profile (id, name, phone, role, neighborhood, latitude, longitude, address) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Juliana M.',  '3001111111', 'pawwer', 'Colina Campestre', 4.7320, -74.0498, 'Cra 58 #147-20, Colina Campestre'),
  ('a1000000-0000-0000-0000-000000000002', 'Andrés C.',   '3002222222', 'pawwer', 'Cedritos',         4.7140, -74.0494, 'Cll 140 #14-23, Cedritos'),
  ('a1000000-0000-0000-0000-000000000003', 'Maria F.',    '3003333333', 'pawwer', 'Rosales',          4.6590, -74.0560, 'Cra 7 #75-30, Rosales'),
  ('a1000000-0000-0000-0000-000000000004', 'Carla R.',    '3004444444', 'pawwer', 'Chicó Norte',      4.6870, -74.0480, 'Cll 97 #11-45, Chicó Norte'),
  ('a1000000-0000-0000-0000-000000000005', 'Felipe T.',   '3005555555', 'pawwer', 'Usaquén',          4.6970, -74.0300, 'Cra 6 #118-52, Usaquén'),
  ('a1000000-0000-0000-0000-000000000006', 'Sara M.',     '3006666666', 'pawwer', 'Niza',             4.6990, -74.0630, 'Cll 127 #54-10, Niza'),
  ('a1000000-0000-0000-0000-000000000007', 'David L.',    '3007777777', 'pawwer', 'Pontevedra',       4.7010, -74.0658, 'Cra 55 #131-22, Pontevedra'),
  ('a1000000-0000-0000-0000-000000000008', 'Laura P.',    '3008888888', 'pawwer', 'Santa Bárbara',    4.7050, -74.0470, 'Cll 119 #12-34, Santa Bárbara'),
  ('a1000000-0000-0000-0000-000000000009', 'Camila V.',   '3009999999', 'pawwer', 'Los Cedros',       4.7170, -74.0470, 'Cra 18 #142-60, Los Cedros'),
  ('a1000000-0000-0000-0000-000000000010', 'Tomás G.',    '3010000000', 'pawwer', 'Mazurén',          4.7350, -74.0620, 'Cll 159 #52-15, Mazurén')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, phone = EXCLUDED.phone, role = EXCLUDED.role,
  neighborhood = EXCLUDED.neighborhood, latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude, address = EXCLUDED.address;

-- ── pawwers ──────────────────────────────────────────────────
INSERT INTO public.pawwer (id, price, profession, response_time, bio, lat, lng, verified, rating, reviews_count, badge, neighborhood,
  experience, week_pattern, faqs) VALUES

('a1000000-0000-0000-0000-000000000001', 45000, 'Veterinaria', '< 1 hora',
 'Cuido perros en mi hogar como si fueran propios. Tengo patio amplio y zona de juegos. Veterinaria de profesión.',
 4.7320, -74.0498, true, 4.9, 23, 'Súper', 'Colina Campestre',
 ARRAY['3 años cuidando perros', 'Certificada en primeros auxilios', 'Espacio pet-friendly'],
 '{"Mon":true,"Tue":true,"Wed":true,"Thu":true,"Fri":true,"Sat":false,"Sun":false}'::jsonb,
 '[{"q":"¿Tienes mascotas propias?","a":"Sí, una Golden Retriever llamada Luna."},{"q":"¿Cuántos perros puedes cuidar?","a":"Máximo 2 a la vez para atención personalizada."}]'::jsonb),

('a1000000-0000-0000-0000-000000000002', 50000, 'Biólogo', '< 2 horas',
 'Apasionado por los animales. Mi apartamento es amplio y tranquilo. Los perros tienen su espacio dedicado.',
 4.7140, -74.0494, true, 5.0, 41, 'Ranger', 'Cedritos',
 ARRAY['5 años de experiencia', 'Especialista en razas grandes', 'Espacio tranquilo y silencioso'],
 '{"Mon":true,"Tue":true,"Wed":false,"Thu":true,"Fri":true,"Sat":true,"Sun":false}'::jsonb,
 '[{"q":"¿Aceptas cachorros?","a":"Sí, con gusto. Tengo experiencia con cachorros desde 3 meses."}]'::jsonb),

('a1000000-0000-0000-0000-000000000003', 60000, 'Diseñadora', '< 3 horas',
 'Trabajo desde casa y puedo darle atención continua a tu perro. Tengo jardín y zona verde.',
 4.6590, -74.0560, true, 4.8, 15, 'Nuevo', 'Rosales',
 ARRAY['2 años de experiencia', 'Trabajo desde casa', 'Jardín privado'],
 '{"Mon":true,"Tue":true,"Wed":true,"Thu":false,"Fri":true,"Sat":true,"Sun":true}'::jsonb,
 '[]'::jsonb),

('a1000000-0000-0000-0000-000000000004', 55000, 'Administradora', '< 1 hora',
 'Mi hogar es el hogar de tu perro. Zona residencial tranquila con parque a una cuadra.',
 4.6870, -74.0480, true, 4.9, 38, 'Súper', 'Chicó Norte',
 ARRAY['4 años de experiencia', 'Parque cercano para paseos', 'Hogar sin otros animales'],
 '{"Mon":true,"Tue":true,"Wed":true,"Thu":true,"Fri":true,"Sat":false,"Sun":false}'::jsonb,
 '[{"q":"¿Haces paseos?","a":"Sí, dos paseos diarios incluidos."}]'::jsonb),

('a1000000-0000-0000-0000-000000000005', 52000, 'Ingeniero', '< 2 horas',
 'Casa con patio grande en Usaquén. Puedo cuidar perros de cualquier tamaño.',
 4.6970, -74.0300, true, 5.0, 62, 'Ranger', 'Usaquén',
 ARRAY['6 años de experiencia', 'Patio de 80m²', 'Acepta razas grandes'],
 '{"Mon":false,"Tue":true,"Wed":true,"Thu":true,"Fri":false,"Sat":true,"Sun":true}'::jsonb,
 '[{"q":"¿Tienes experiencia con perros grandes?","a":"Sí, mi especialidad son los Labradores y Golden Retrievers."}]'::jsonb),

('a1000000-0000-0000-0000-000000000006', 48000, 'Psicóloga', '< 1 hora',
 'Entorno familiar y cálido. Vivo con mi familia y todos amamos a los perros.',
 4.6990, -74.0630, true, 4.7, 28, 'Súper', 'Niza',
 ARRAY['3 años de experiencia', 'Entorno familiar', 'Zona tranquila'],
 '{"Mon":true,"Tue":true,"Wed":true,"Thu":true,"Fri":true,"Sat":true,"Sun":false}'::jsonb,
 '[]'::jsonb),

('a1000000-0000-0000-0000-000000000007', 43000, 'Estudiante', '< 4 horas',
 'Estudiante en casa la mayor parte del día. Atención continua para tu peludo.',
 4.7010, -74.0658, true, 4.8, 19, 'Nuevo', 'Pontevedra',
 ARRAY['1 año de experiencia', 'Disponibilidad alta', 'Zona residencial'],
 '{"Mon":true,"Tue":true,"Wed":true,"Thu":true,"Fri":true,"Sat":false,"Sun":false}'::jsonb,
 '[]'::jsonb),

('a1000000-0000-0000-0000-000000000008', 65000, 'Médica', '< 1 hora',
 'Profesional de la salud con amor por los animales. Casa amplia con jardín y área de juegos.',
 4.7050, -74.0470, true, 5.0, 84, 'Ranger', 'Santa Bárbara',
 ARRAY['7 años de experiencia', 'Conocimiento en salud animal', 'Jardín privado', 'Reseñas verificadas'],
 '{"Mon":true,"Tue":false,"Wed":true,"Thu":false,"Fri":true,"Sat":true,"Sun":true}'::jsonb,
 '[{"q":"¿Qué incluye el servicio?","a":"Alimentación, paseos, juego y reporte diario con foto."},{"q":"¿Aceptas mascotas enfermas?","a":"Depende del caso, escríbeme y lo evaluamos."}]'::jsonb),

('a1000000-0000-0000-0000-000000000009', 42000, 'Contadora', '< 3 horas',
 'Hogar tranquilo para perros pequeños y medianos. Trabajo híbrido, siempre hay alguien en casa.',
 4.7170, -74.0470, true, 4.6, 11, 'Nuevo', 'Los Cedros',
 ARRAY['1 año de experiencia', 'Ideal para razas pequeñas', 'Trabajo híbrido'],
 '{"Mon":true,"Tue":true,"Wed":false,"Thu":true,"Fri":true,"Sat":false,"Sun":false}'::jsonb,
 '[]'::jsonb),

('a1000000-0000-0000-0000-000000000010', 58000, 'Arquitecto', '< 2 horas',
 'Apartamento moderno con terraza amplia. Zona norte de Bogotá, cerca a parques.',
 4.7350, -74.0620, true, 4.8, 33, 'Súper', 'Mazurén',
 ARRAY['4 años de experiencia', 'Terraza amplia', 'Parque a 200m'],
 '{"Mon":false,"Tue":true,"Wed":true,"Thu":true,"Fri":false,"Sat":true,"Sun":true}'::jsonb,
 '[{"q":"¿Haces reportes diarios?","a":"Sí, mando foto y video cada día."}]'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  price = EXCLUDED.price, profession = EXCLUDED.profession,
  response_time = EXCLUDED.response_time, bio = EXCLUDED.bio,
  lat = EXCLUDED.lat, lng = EXCLUDED.lng, verified = EXCLUDED.verified,
  rating = EXCLUDED.rating, reviews_count = EXCLUDED.reviews_count,
  badge = EXCLUDED.badge, neighborhood = EXCLUDED.neighborhood,
  experience = EXCLUDED.experience, week_pattern = EXCLUDED.week_pattern,
  faqs = EXCLUDED.faqs;

-- ── servicios por Pawwer ──────────────────────────────────────
-- service_type: 1=DayCare, 2=Night, 3=Travel, 4=Express

-- Juliana (DayCare + Night)
INSERT INTO public."service_X_Pawwer" (id_service, id_pawwer, price, max_animals, is_active) VALUES
  (1, 'a1000000-0000-0000-0000-000000000001', 45000, 2, true),
  (2, 'a1000000-0000-0000-0000-000000000001', 50000, 1, true)
ON CONFLICT DO NOTHING;

-- Andrés (DayCare)
INSERT INTO public."service_X_Pawwer" (id_service, id_pawwer, price, max_animals, is_active) VALUES
  (1, 'a1000000-0000-0000-0000-000000000002', 50000, 2, true)
ON CONFLICT DO NOTHING;

-- Maria (Night + Travel)
INSERT INTO public."service_X_Pawwer" (id_service, id_pawwer, price, max_animals, is_active) VALUES
  (2, 'a1000000-0000-0000-0000-000000000003', 60000, 1, true),
  (3, 'a1000000-0000-0000-0000-000000000003', 70000, 1, true)
ON CONFLICT DO NOTHING;

-- Carla (DayCare + Night)
INSERT INTO public."service_X_Pawwer" (id_service, id_pawwer, price, max_animals, is_active) VALUES
  (1, 'a1000000-0000-0000-0000-000000000004', 55000, 2, true),
  (2, 'a1000000-0000-0000-0000-000000000004', 60000, 1, true)
ON CONFLICT DO NOTHING;

-- Felipe (Night + Travel)
INSERT INTO public."service_X_Pawwer" (id_service, id_pawwer, price, max_animals, is_active) VALUES
  (2, 'a1000000-0000-0000-0000-000000000005', 52000, 2, true),
  (3, 'a1000000-0000-0000-0000-000000000005', 65000, 1, true)
ON CONFLICT DO NOTHING;

-- Sara (DayCare + Night)
INSERT INTO public."service_X_Pawwer" (id_service, id_pawwer, price, max_animals, is_active) VALUES
  (1, 'a1000000-0000-0000-0000-000000000006', 48000, 2, true),
  (2, 'a1000000-0000-0000-0000-000000000006', 53000, 1, true)
ON CONFLICT DO NOTHING;

-- David (DayCare)
INSERT INTO public."service_X_Pawwer" (id_service, id_pawwer, price, max_animals, is_active) VALUES
  (1, 'a1000000-0000-0000-0000-000000000007', 43000, 1, true)
ON CONFLICT DO NOTHING;

-- Laura (DayCare + Night + Travel)
INSERT INTO public."service_X_Pawwer" (id_service, id_pawwer, price, max_animals, is_active) VALUES
  (1, 'a1000000-0000-0000-0000-000000000008', 65000, 2, true),
  (2, 'a1000000-0000-0000-0000-000000000008', 70000, 1, true),
  (3, 'a1000000-0000-0000-0000-000000000008', 80000, 1, true)
ON CONFLICT DO NOTHING;

-- Camila (DayCare)
INSERT INTO public."service_X_Pawwer" (id_service, id_pawwer, price, max_animals, is_active) VALUES
  (1, 'a1000000-0000-0000-0000-000000000009', 42000, 1, true)
ON CONFLICT DO NOTHING;

-- Tomás (Night + Travel)
INSERT INTO public."service_X_Pawwer" (id_service, id_pawwer, price, max_animals, is_active) VALUES
  (2, 'a1000000-0000-0000-0000-000000000010', 58000, 2, true),
  (3, 'a1000000-0000-0000-0000-000000000010', 68000, 1, true)
ON CONFLICT DO NOTHING;
