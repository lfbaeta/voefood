ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_number_key;
ALTER TABLE public.tables ADD CONSTRAINT tables_restaurant_number_unique UNIQUE (restaurant_id, number);