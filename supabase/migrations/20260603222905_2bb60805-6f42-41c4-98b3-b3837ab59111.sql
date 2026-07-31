REVOKE EXECUTE ON FUNCTION public.claim_due_bot_debounce(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_due_bot_debounce(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_due_bot_debounce(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_bot_debounce(INTEGER) TO service_role;