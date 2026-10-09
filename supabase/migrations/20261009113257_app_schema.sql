-- Trazo cache (7 days) and the user's own preferences.
-- Strava tokens stay in `private`, which is not exposed by the Data API.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

-- ---------------------------------------------------------------- preferences

create table public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  sport_colors jsonb not null default '{}'::jsonb,
  map_labels boolean not null default false,
  poster jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.preferences enable row level security;

create policy preferences_select on public.preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy preferences_insert on public.preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy preferences_update on public.preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy preferences_delete on public.preferences
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- strava account (no tokens)

create table public.strava_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id bigint not null,
  username text,
  firstname text,
  lastname text,
  scope text not null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  consent_at timestamptz not null default now()
);

create unique index strava_accounts_athlete_idx on public.strava_accounts (athlete_id);

alter table public.strava_accounts enable row level security;

create policy strava_accounts_select on public.strava_accounts
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- activities

create table public.activities (
  id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sport_type text not null,
  start_date timestamptz not null,
  start_date_local timestamp not null,
  distance_m double precision not null default 0,
  moving_time_s integer not null default 0,
  elapsed_time_s integer not null default 0,
  elevation_gain_m double precision not null default 0,
  summary_polyline text,
  geom extensions.geometry (LineString, 4326),
  zones text[] not null default '{}',
  start_zones text[] not null default '{}',
  fetched_at timestamptz not null default now()
);

create index activities_user_start_idx on public.activities (user_id, start_date desc);
create index activities_geom_gix on public.activities using gist (geom);
create index activities_zones_gin on public.activities using gin (zones);
create index activities_fetched_idx on public.activities (fetched_at);

alter table public.activities enable row level security;

create policy activities_select on public.activities
  for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.activity_streams (
  activity_id bigint primary key references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  distance double precision[],
  altitude double precision[],
  fetched_at timestamptz not null default now()
);

create index activity_streams_user_idx on public.activity_streams (user_id);

alter table public.activity_streams enable row level security;

create policy activity_streams_select on public.activity_streams
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- places
-- Simplified reference geometry (not Strava data). Cities are buffered points;
-- countries are coarse outlines so a route can be tagged by intersection.

create table public.zones (
  id text primary key,
  name text not null,
  level text not null check (level in ('country', 'region', 'city')),
  parent_id text references public.zones (id),
  geom extensions.geometry (MultiPolygon, 4326) not null
);

create index zones_geom_gix on public.zones using gist (geom);
create index zones_parent_idx on public.zones (parent_id);

alter table public.zones enable row level security;

create policy zones_select on public.zones
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------- private tokens

create table private.strava_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null
);

revoke all on private.strava_tokens from public, anon, authenticated;
grant select, insert, update, delete on private.strava_tokens to service_role;

create table private.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

revoke all on private.oauth_states from public, anon, authenticated;
grant select, insert, update, delete on private.oauth_states to service_role;

alter table private.strava_tokens enable row level security;
alter table private.oauth_states enable row level security;

-- ---------------------------------------------------------------- new user

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.preferences (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

-- ---------------------------------------------------------------- cache purge (hourly)

create or replace function private.purge_stale_cache()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.activities
  where fetched_at < now() - interval '7 days';

  delete from private.oauth_states
  where expires_at < now();
$$;

revoke all on function private.purge_stale_cache() from public, anon, authenticated;

select cron.schedule(
  'purge-strava-cache',
  '15 * * * *',
  $$select private.purge_stale_cache()$$
);

-- Daily reconcile. The URL and secret live in Vault (see seed.sql).
select cron.schedule(
  'reconcile-strava-cache',
  '15 4 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/strava-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{"reconcile":true}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);

-- ---------------------------------------------------------------- zone tagging

create or replace function public.assign_activity_zones(target_id bigint)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  route extensions.geometry;
  start_pt extensions.geometry;
begin
  select geom into route from public.activities where id = target_id;
  if route is null then
    return;
  end if;
  start_pt := extensions.st_startpoint(route);

  update public.activities
  set
    zones = coalesce((
      select array_agg(z.id)
      from public.zones z
      where extensions.st_intersects(z.geom, route)
    ), '{}'),
    start_zones = coalesce((
      select array_agg(z.id)
      from public.zones z
      where extensions.st_covers(z.geom, start_pt)
    ), '{}')
  where id = target_id;
end;
$$;

revoke all on function public.assign_activity_zones(bigint) from public, anon, authenticated;
grant execute on function public.assign_activity_zones(bigint) to service_role;

grant select, insert, update, delete on public.preferences to authenticated, service_role;
grant select on public.strava_accounts to authenticated;
grant select, insert, update, delete on public.strava_accounts to service_role;
grant select on public.activities to authenticated;
grant select, insert, update, delete on public.activities to service_role;
grant select on public.activity_streams to authenticated;
grant select, insert, update, delete on public.activity_streams to service_role;
grant select on public.zones to authenticated, service_role;

-- ---------------------------------------------------------------- reference places

insert into public.zones (id, name, level, parent_id, geom) values
  (
    'country:ES', 'España', 'country', null,
    extensions.st_multi(extensions.st_geomfromtext(
      'MULTIPOLYGON(((-9.30 42.90,-8.90 43.70,-7.70 43.70,-6.80 43.60,-4.80 43.50,-3.20 43.40,-1.80 43.40,-1.20 43.30,1.50 42.70,3.10 42.40,3.20 41.80,1.80 41.00,0.20 40.50,0.50 39.80,-0.20 38.70,-0.60 37.60,-1.80 36.80,-3.50 36.50,-5.30 36.00,-5.90 36.10,-6.50 36.70,-7.40 37.10,-8.90 37.00,-9.20 38.00,-9.50 39.30,-9.40 41.20,-8.90 41.90,-9.30 42.90)),((1.20 39.00,2.00 38.60,3.40 39.30,3.20 40.10,1.50 40.10,1.20 39.00)))',
      4326
    ))
  ),
  (
    'country:PT', 'Portugal', 'country', null,
    extensions.st_multi(extensions.st_geomfromtext(
      'POLYGON((-9.50 42.15,-8.20 42.15,-6.20 41.90,-6.20 37.00,-7.40 37.00,-9.00 37.00,-9.50 38.70,-9.50 42.15))',
      4326
    ))
  ),
  (
    'country:FR', 'Francia', 'country', null,
    extensions.st_multi(extensions.st_geomfromtext(
      'POLYGON((-1.80 43.40,3.10 42.40,7.70 43.50,7.60 46.40,5.20 48.50,2.50 51.10,-1.50 49.60,-1.80 46.00,-1.80 43.40))',
      4326
    ))
  );

-- Regions start as a point buffer and are replaced by the union of their cities.
insert into public.zones (id, name, level, parent_id, geom)
select
  id,
  name,
  'region',
  parent,
  extensions.st_multi(
    extensions.st_buffer(
      extensions.st_setsrid(extensions.st_makepoint(0, 0), 4326)::extensions.geography,
      1000
    )::extensions.geometry
  )
from (
  values
    ('region:ES-MD', 'Comunidad de Madrid', 'country:ES'),
    ('region:ES-CT', 'Cataluña', 'country:ES'),
    ('region:ES-VC', 'Comunitat Valenciana', 'country:ES'),
    ('region:ES-AN', 'Andalucía', 'country:ES'),
    ('region:ES-PV', 'País Vasco', 'country:ES'),
    ('region:ES-AR', 'Aragón', 'country:ES'),
    ('region:ES-CB', 'Cantabria', 'country:ES'),
    ('region:ES-AS', 'Principado de Asturias', 'country:ES'),
    ('region:ES-IB', 'Illes Balears', 'country:ES'),
    ('region:ES-NC', 'Comunidad Foral de Navarra', 'country:ES'),
    ('region:ES-CL', 'Castilla y León', 'country:ES'),
    ('region:ES-GA', 'Galicia', 'country:ES'),
    ('region:PT-11', 'Lisboa', 'country:PT'),
    ('region:FR-ARA', 'Auvergne-Rhône-Alpes', 'country:FR')
) as region(id, name, parent);

insert into public.zones (id, name, level, parent_id, geom)
select
  id,
  name,
  'city',
  parent,
  extensions.st_multi(
    extensions.st_buffer(
      extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
      radius
    )::extensions.geometry
  )
from (
  values
    ('city:28079', 'Madrid', 'region:ES-MD', -3.7038::float8, 40.4168::float8, 9000::float8),
    ('city:28006', 'Alcobendas', 'region:ES-MD', -3.6413, 40.5475, 4000),
    ('city:28115', 'Pozuelo de Alarcón', 'region:ES-MD', -3.8136, 40.4351, 4000),
    ('city:28127', 'Las Rozas de Madrid', 'region:ES-MD', -3.8738, 40.4929, 4500),
    ('city:28065', 'Getafe', 'region:ES-MD', -3.7327, 40.3083, 4000),
    ('city:28123', 'Rivas-Vaciamadrid', 'region:ES-MD', -3.5182, 40.3534, 4000),
    ('city:28903', 'Tres Cantos', 'region:ES-MD', -3.7134, 40.6009, 3500),
    ('city:28045', 'Colmenar Viejo', 'region:ES-MD', -3.7656, 40.6590, 6000),
    ('city:28082', 'Manzanares el Real', 'region:ES-MD', -3.8617, 40.7272, 5000),
    ('city:28038', 'Cercedilla', 'region:ES-MD', -4.0573, 40.7409, 5000),
    ('city:08019', 'Barcelona', 'region:ES-CT', 2.1686, 41.3874, 7000),
    ('city:46250', 'València', 'region:ES-VC', -0.3763, 39.4699, 7000),
    ('city:41091', 'Sevilla', 'region:ES-AN', -5.9845, 37.3891, 7000),
    ('city:29067', 'Málaga', 'region:ES-AN', -4.4214, 36.7213, 7000),
    ('city:18134', 'Monachil', 'region:ES-AN', -3.3986, 37.0952, 7000),
    ('city:48020', 'Bilbao', 'region:ES-PV', -2.9349, 43.263, 5000),
    ('city:20069', 'Donostia / San Sebastián', 'region:ES-PV', -1.9812, 43.3183, 5000),
    ('city:50297', 'Zaragoza', 'region:ES-AR', -0.8891, 41.6488, 7000),
    ('city:22199', 'Sallent de Gállego', 'region:ES-AR', -0.3313, 42.7739, 7000),
    ('city:39075', 'Santander', 'region:ES-CB', -3.8044, 43.4623, 5000),
    ('city:33044', 'Oviedo', 'region:ES-AS', -5.8494, 43.3603, 5000),
    ('city:07040', 'Palma', 'region:ES-IB', 2.6502, 39.5696, 6000),
    ('city:31201', 'Pamplona / Iruña', 'region:ES-NC', -1.6432, 42.8125, 4500),
    ('city:37274', 'Salamanca', 'region:ES-CL', -5.6635, 40.9701, 4500),
    ('city:15030', 'A Coruña', 'region:ES-GA', -8.4115, 43.3623, 4500),
    ('city:PT-1106', 'Lisboa', 'region:PT-11', -9.1393, 38.7223, 6000),
    ('city:FR-74056', 'Chamonix-Mont-Blanc', 'region:FR-ARA', 6.8694, 45.9237, 7000)
) as city(id, name, parent, lng, lat, radius);

update public.zones as region
set geom = city_union.geom
from (
  select
    parent_id,
    extensions.st_multi(
      extensions.st_buffer(extensions.st_union(geom)::extensions.geography, 15000)::extensions.geometry
    ) as geom
  from public.zones
  where level = 'city'
  group by parent_id
) as city_union
where region.id = city_union.parent_id;
