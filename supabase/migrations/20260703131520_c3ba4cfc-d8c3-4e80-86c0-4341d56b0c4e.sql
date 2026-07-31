ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_code_key;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_restaurant_code_unique UNIQUE (restaurant_id, code);