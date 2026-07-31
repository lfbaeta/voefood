-- Fix overly permissive INSERT policy on landing_page_leads
-- Replace WITH CHECK (true) with proper validation

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Leads publicly insertable" ON public.landing_page_leads;

-- Create a new INSERT policy with proper validation
-- Requires: valid email format (not empty), name, and optionally reseller_id
CREATE POLICY "Leads insertable with validation"
ON public.landing_page_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Email is required and not empty
  email IS NOT NULL AND 
  length(trim(email)) > 0 AND
  -- Name is required and not empty
  name IS NOT NULL AND 
  length(trim(name)) > 0 AND
  -- If reseller_id is provided, it must exist in resellers_public view
  (reseller_id IS NULL OR EXISTS (
    SELECT 1 FROM resellers_public rp WHERE rp.id = reseller_id AND rp.is_active = true
  )) AND
  -- If plan_id is provided, it must exist and be active
  (plan_id IS NULL OR EXISTS (
    SELECT 1 FROM subscription_plans sp WHERE sp.id = plan_id AND sp.is_active = true
  ))
);