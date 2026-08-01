INSERT INTO public.restaurant_admins (user_id, restaurant_id)
SELECT 'ad04e6d2-9fca-4436-83f1-450b262f0da4'::uuid, '6f019803-67a9-4c23-a8a7-54c97564017a'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.restaurant_admins
  WHERE user_id = 'ad04e6d2-9fca-4436-83f1-450b262f0da4'::uuid
    AND restaurant_id = '6f019803-67a9-4c23-a8a7-54c97564017a'::uuid
);