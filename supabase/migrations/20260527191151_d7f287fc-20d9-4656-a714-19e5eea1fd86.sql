CREATE TABLE public.wa_quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, shortcut)
);

CREATE INDEX idx_wa_quick_replies_restaurant ON public.wa_quick_replies(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_quick_replies TO authenticated;
GRANT ALL ON public.wa_quick_replies TO service_role;

ALTER TABLE public.wa_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage quick replies of their restaurant"
ON public.wa_quick_replies
FOR ALL
TO authenticated
USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id))
WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Resellers view quick replies of their restaurants"
ON public.wa_quick_replies
FOR SELECT
TO authenticated
USING (public.is_reseller_of_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER update_wa_quick_replies_updated_at
BEFORE UPDATE ON public.wa_quick_replies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();