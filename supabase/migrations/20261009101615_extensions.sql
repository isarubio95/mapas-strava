-- PostGIS: route geometry and the geographic reference tables.
create extension if not exists postgis with schema extensions;

-- pg_cron + pg_net: daily refresh of the 7-day Strava cache and hourly purge.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
