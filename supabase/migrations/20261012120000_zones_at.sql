-- Zones that contain a point, so the poster can name the region it frames.

create or replace function public.zones_at(lng float8, lat float8)
returns table (id text, name text, level text)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select z.id, z.name, z.level
  from public.zones z
  where extensions.st_covers(
    z.geom,
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)
  );
$$;

revoke all on function public.zones_at(float8, float8) from public, anon;
grant execute on function public.zones_at(float8, float8) to authenticated, service_role;
