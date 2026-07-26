ALTER TABLE public.wa_messages
  ADD COLUMN IF NOT EXISTS send_error text;