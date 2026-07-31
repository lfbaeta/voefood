CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

select cron.schedule(
  'bot-debounce-tick',
  '10 seconds',
  $$
  select net.http_post(
    url := 'https://hmpfoxxlaebxzakdmopj.supabase.co/functions/v1/bot-debounce-tick',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_KnSFhRq7pgzc_YbgA6_qHQ_uEY6itfY","Authorization":"Bearer sb_publishable_KnSFhRq7pgzc_YbgA6_qHQ_uEY6itfY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'agent-outreach-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hmpfoxxlaebxzakdmopj.supabase.co/functions/v1/agent-outreach-tick',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_KnSFhRq7pgzc_YbgA6_qHQ_uEY6itfY","Authorization":"Bearer sb_publishable_KnSFhRq7pgzc_YbgA6_qHQ_uEY6itfY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);