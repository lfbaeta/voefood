
CREATE OR REPLACE FUNCTION public.encrypt_ai_credential(p_key text, p_plain text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.pgp_sym_encrypt(p_plain, p_key), 'base64');
$$;

CREATE OR REPLACE FUNCTION public.decrypt_ai_credential(p_key text, p_cipher text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.pgp_sym_decrypt(decode(p_cipher, 'base64'), p_key);
$$;

REVOKE ALL ON FUNCTION public.encrypt_ai_credential(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_ai_credential(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_ai_credential(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_ai_credential(text, text) TO service_role;
