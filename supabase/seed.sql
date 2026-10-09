-- Local-only Vault entries. Cloud gets its own values in the SQL editor.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'project_url') then
    perform vault.create_secret('http://api.supabase.internal:8000', 'project_url');
  end if;
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret('local-cron-secret', 'cron_secret');
  end if;
end $$;
