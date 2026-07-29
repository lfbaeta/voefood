select cron.schedule(
  'agent-outreach-tick-5m',
  '*/5 * * * *',
  $$ select net.http_post(
    url:='https://rswirrxcubtlnvszemzu.supabase.co/functions/v1/agent-outreach-tick',
    headers:='{"Content-Type":"application/json","apikey":"sb_publishable_pFR3TaQFR5rwEMLgPeHJnQ_OKCSDIgs"}'::jsonb,
    body:='{}'::jsonb
  ); $$
);