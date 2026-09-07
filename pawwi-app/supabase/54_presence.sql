-- 54_presence.sql — Presencia en tiempo real (verde/amarillo/rojo) + métricas de actividad.
--
--   🟢 online  = heartbeat reciente + app en foco  → "Activo ahora"
--   🟡 away    = app abierta pero sin foco (idle)   → "Ausente"
--   🔴 offline = sin heartbeat reciente             → "Activo hace X"
--
-- Se llavea por user_id = auth.uid(), así sirve para pawwers hoy y para clientes
-- cuando tengan portal (basta con montar el mismo heartbeat en su layout).
--
-- Idempotente. Correr en el SQL Editor.

-- ── Estado actual (1 fila por usuario) — alimenta la UI + realtime ────────────
create table if not exists public.presence (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  status       text        not null default 'active' check (status in ('active','idle')),
  last_seen_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.presence enable row level security;

-- La presencia es pública: se muestra en el perfil público que ve el cliente
-- (incluso si el cliente no ha iniciado sesión). No expone PII.
drop policy if exists "presence_select_all" on public.presence;
create policy "presence_select_all" on public.presence
  for select using (true);
-- Sin políticas de INSERT/UPDATE/DELETE → sólo escribe el RPC heartbeat (SECURITY DEFINER).

grant select on public.presence to anon, authenticated;

-- Realtime: el que mira el perfil/chat ve el cambio en vivo.
-- REPLICA IDENTITY FULL para que el payload del UPDATE traiga status + last_seen_at.
alter table public.presence replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'presence'
  ) then
    alter publication supabase_realtime add table public.presence;
  end if;
end $$;

-- ── Log append-only de actividad (para métricas de "tiempo activo") ───────────
-- 1 fila por (usuario, minuto): "minutos activos" = count(*) where status='active'.
-- No lo lee el cliente (sin políticas → sólo service_role para métricas internas).
create table if not exists public.presence_ping (
  user_id uuid        not null references auth.users(id) on delete cascade,
  minute  timestamptz not null,
  status  text        not null,
  primary key (user_id, minute)
);

alter table public.presence_ping enable row level security;

create index if not exists presence_ping_minute_idx on public.presence_ping (minute);

-- ── Heartbeat: lo llama el navegador cada ~30s y en cambios de visibilidad ────
create or replace function public.heartbeat(p_status text default 'active')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_status text := lower(coalesce(p_status, 'active'));
begin
  if v_uid is null then
    return;
  end if;
  if v_status not in ('active', 'idle') then
    v_status := 'active';
  end if;

  insert into public.presence (user_id, status, last_seen_at, updated_at)
  values (v_uid, v_status, now(), now())
  on conflict (user_id) do update
    set status       = excluded.status,
        last_seen_at = excluded.last_seen_at,
        updated_at   = excluded.updated_at;

  -- Registro de actividad por minuto (idempotente dentro del minuto).
  insert into public.presence_ping (user_id, minute, status)
  values (v_uid, date_trunc('minute', now()), v_status)
  on conflict (user_id, minute) do nothing;
end;
$$;

revoke all on function public.heartbeat(text) from public;
grant execute on function public.heartbeat(text) to authenticated;
