ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS enabled_features text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.subscription_plans
SET enabled_features = ARRAY[
  'pdv','cash-register','kitchen','waiters',
  'orders','products','categories','addons','coupons','fiscal','image-enhancer',
  'delivery-zones','hours',
  'chat','whatsapp-connections','ai-agents'
]::text[]
WHERE enabled_features = '{}'::text[];