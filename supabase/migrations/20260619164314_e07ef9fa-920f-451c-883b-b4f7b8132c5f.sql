CREATE TABLE public.unknown_address_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text,
  raw_address text NOT NULL,
  neighborhood text,
  note text,
  conversation_id uuid,
  agent_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unknown_address_requests TO authenticated;
GRANT ALL ON public.unknown_address_requests TO service_role;

ALTER TABLE public.unknown_address_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage their restaurant unknown addresses"
ON public.unknown_address_requests FOR ALL
TO authenticated
USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id))
WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Resellers view their restaurants unknown addresses"
ON public.unknown_address_requests FOR SELECT
TO authenticated
USING (public.is_reseller_of_restaurant(auth.uid(), restaurant_id));

CREATE INDEX idx_unknown_addr_restaurant ON public.unknown_address_requests(restaurant_id, created_at DESC);

CREATE TRIGGER update_unknown_addr_updated_at
BEFORE UPDATE ON public.unknown_address_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();