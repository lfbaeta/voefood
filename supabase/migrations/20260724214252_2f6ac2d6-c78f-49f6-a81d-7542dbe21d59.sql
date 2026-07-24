UPDATE public.reseller_evolution_config
SET server_url = regexp_replace(rtrim(server_url, '/'), '/(manager|admin|dashboard|api)(/.*)?$', '', 'i')
WHERE server_url ~* '/(manager|admin|dashboard|api)(/|$)';