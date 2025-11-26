-- Migration 001: Add token expiration and enhanced parental consent security
-- Created: 2025-11-25
-- Purpose: COPPA compliance - secure parental consent with expiring tokens

-- Add expiration and attempt tracking to parental_consents
ALTER TABLE parental_consents
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS attempts int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- Add index for token lookups (performance)
CREATE INDEX IF NOT EXISTS idx_parental_consents_token
  ON parental_consents(consent_token)
  WHERE approved = false AND expires_at > now();

-- Add index for child_id lookups
CREATE INDEX IF NOT EXISTS idx_parental_consents_child
  ON parental_consents(child_id);

-- Create function to validate consent token
CREATE OR REPLACE FUNCTION validate_consent_token(token_input text)
RETURNS TABLE (
  consent_id uuid,
  child_id uuid,
  parent_email text,
  is_valid boolean,
  error_message text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id as consent_id,
    pc.child_id,
    pc.parent_email,
    CASE
      WHEN pc.approved = true THEN false
      WHEN pc.expires_at < now() THEN false
      WHEN pc.attempts >= 3 THEN false
      ELSE true
    END as is_valid,
    CASE
      WHEN pc.approved = true THEN 'Already approved'
      WHEN pc.expires_at < now() THEN 'Token expired'
      WHEN pc.attempts >= 3 THEN 'Too many attempts'
      ELSE 'Valid'
    END as error_message
  FROM parental_consents pc
  WHERE pc.consent_token = token_input
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to approve consent (with safety checks)
CREATE OR REPLACE FUNCTION approve_parental_consent(
  token_input text,
  ip_addr inet DEFAULT NULL,
  ua text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  validation_result record;
  result json;
BEGIN
  -- Validate token
  SELECT * INTO validation_result
  FROM validate_consent_token(token_input);

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid token'
    );
  END IF;

  IF validation_result.is_valid = false THEN
    -- Increment attempts
    UPDATE parental_consents
    SET attempts = attempts + 1
    WHERE id = validation_result.consent_id;

    RETURN json_build_object(
      'success', false,
      'error', validation_result.error_message
    );
  END IF;

  -- Approve consent
  UPDATE parental_consents
  SET
    approved = true,
    approved_at = now(),
    ip_address = ip_addr,
    user_agent = ua
  WHERE id = validation_result.consent_id;

  -- Update child profile
  UPDATE profiles
  SET
    parent_approved = true,
    subscription_tier = 'free',
    subscription_status = 'active',
    is_subscriber = true
  WHERE id = validation_result.child_id;

  RETURN json_build_object(
    'success', true,
    'child_id', validation_result.child_id,
    'parent_email', validation_result.parent_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION approve_parental_consent IS
  'Approves parental consent with validation and security tracking. Returns success/error JSON.';

COMMENT ON FUNCTION validate_consent_token IS
  'Validates consent token against expiration, attempts, and approval status.';
