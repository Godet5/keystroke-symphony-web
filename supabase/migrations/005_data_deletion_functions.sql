-- Migration 005: Data Deletion Flow
-- Created: 2025-11-25
-- Purpose: COPPA compliance - allow parents to request child data deletion

-- ======================
-- DELETED ACCOUNTS ARCHIVE
-- ======================

-- Archive table for compliance (retain for legal requirements)
CREATE TABLE IF NOT EXISTS deleted_accounts_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL,
  original_email text,
  birthdate date,
  subscription_tier text,
  deletion_requested_at timestamptz,
  deletion_completed_at timestamptz DEFAULT now(),
  requested_by text, -- 'parent', 'user', 'admin'
  reason text,
  full_profile jsonb,
  associated_data jsonb
);

-- Enable RLS
ALTER TABLE deleted_accounts_archive ENABLE ROW LEVEL SECURITY;

-- Only admins can view deleted accounts
CREATE POLICY "admin_view_deleted_accounts"
  ON deleted_accounts_archive
  FOR SELECT
  USING (is_admin());

-- Only service role can insert (via deletion function)
CREATE POLICY "service_role_insert_deleted_accounts"
  ON deleted_accounts_archive
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Prevent any updates or deletes (permanent archive)
CREATE POLICY "prevent_deleted_account_modification"
  ON deleted_accounts_archive
  FOR UPDATE
  USING (false);

CREATE POLICY "prevent_deleted_account_deletion"
  ON deleted_accounts_archive
  FOR DELETE
  USING (false);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_original_id
  ON deleted_accounts_archive(original_user_id);

CREATE INDEX IF NOT EXISTS idx_deleted_accounts_deleted_at
  ON deleted_accounts_archive(deletion_completed_at DESC);

-- ======================
-- DATA DELETION REQUESTS TABLE
-- ======================

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  requester_email text NOT NULL,
  requester_type text NOT NULL, -- 'parent', 'user', 'admin'
  verification_token text UNIQUE,
  verified boolean DEFAULT false,
  verified_at timestamptz,
  status text DEFAULT 'pending', -- 'pending', 'verified', 'processing', 'completed', 'failed'
  reason text,
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb
);

-- Enable RLS
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own deletion requests
CREATE POLICY "view_own_deletion_requests"
  ON data_deletion_requests
  FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

-- Users can create deletion requests
CREATE POLICY "create_deletion_request"
  ON data_deletion_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user
  ON data_deletion_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_token
  ON data_deletion_requests(verification_token)
  WHERE verified = false;

CREATE INDEX IF NOT EXISTS idx_deletion_requests_pending
  ON data_deletion_requests(requested_at DESC)
  WHERE status = 'pending' OR status = 'verified';

-- ======================
-- DATA DELETION FUNCTION
-- ======================

CREATE OR REPLACE FUNCTION delete_user_account(
  target_user_id uuid,
  requester_type text DEFAULT 'user',
  deletion_reason text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  user_profile record;
  deletion_data jsonb;
  archive_id uuid;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile
  FROM profiles
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Collect associated data for archive
  deletion_data := jsonb_build_object(
    'consultations', (SELECT json_agg(row_to_json(c)) FROM consultations c WHERE c.user_id = target_user_id),
    'addons', (SELECT json_agg(row_to_json(a)) FROM user_addons a WHERE a.user_id = target_user_id),
    'forum_posts', (SELECT json_agg(row_to_json(f)) FROM forum_posts f WHERE f.user_id = target_user_id),
    'parental_consents', (SELECT json_agg(row_to_json(p)) FROM parental_consents p WHERE p.child_id = target_user_id),
    'audit_log_entries', (SELECT COUNT(*) FROM audit_log WHERE user_id = target_user_id)
  );

  -- Archive the account
  INSERT INTO deleted_accounts_archive (
    original_user_id,
    original_email,
    birthdate,
    subscription_tier,
    requested_by,
    reason,
    full_profile,
    associated_data
  ) VALUES (
    user_profile.id,
    user_profile.email,
    user_profile.birthdate,
    user_profile.subscription_tier,
    requester_type,
    deletion_reason,
    row_to_json(user_profile)::jsonb,
    deletion_data
  )
  RETURNING id INTO archive_id;

  -- Log the deletion
  PERFORM log_audit(
    'account_deleted',
    'profiles',
    target_user_id,
    row_to_json(user_profile)::jsonb,
    NULL,
    jsonb_build_object(
      'requested_by', requester_type,
      'reason', deletion_reason,
      'archive_id', archive_id
    )
  );

  -- Delete associated data (cascading order)
  DELETE FROM consultations WHERE user_id = target_user_id;
  DELETE FROM user_addons WHERE user_id = target_user_id;
  DELETE FROM forum_posts WHERE user_id = target_user_id;
  DELETE FROM parental_consents WHERE child_id = target_user_id;
  DELETE FROM data_deletion_requests WHERE user_id = target_user_id;
  -- Note: audit_log entries are kept (SET NULL on user_id via FK)

  -- Delete profile
  DELETE FROM profiles WHERE id = target_user_id;

  -- Delete auth user
  -- Note: This requires service role. In practice, call auth.admin.deleteUser()
  -- from Edge Function after this completes

  RETURN json_build_object(
    'success', true,
    'archive_id', archive_id,
    'message', 'Account deleted and archived successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- DATA EXPORT FUNCTION (for parental access)
-- ======================

CREATE OR REPLACE FUNCTION export_user_data(target_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  user_data jsonb;
BEGIN
  -- Compile all user data
  SELECT jsonb_build_object(
    'profile', (SELECT row_to_json(p) FROM profiles p WHERE p.id = target_user_id),
    'parental_consents', (SELECT json_agg(row_to_json(pc)) FROM parental_consents pc WHERE pc.child_id = target_user_id),
    'consultations', (SELECT json_agg(row_to_json(c)) FROM consultations c WHERE c.user_id = target_user_id),
    'addons', (SELECT json_agg(row_to_json(a)) FROM user_addons a WHERE a.user_id = target_user_id),
    'forum_posts', (SELECT json_agg(row_to_json(f)) FROM forum_posts f WHERE f.user_id = target_user_id),
    'audit_log', (SELECT json_agg(row_to_json(al)) FROM audit_log al WHERE al.user_id = target_user_id ORDER BY al.created_at DESC LIMIT 100),
    'exported_at', now()
  ) INTO user_data;

  -- Log the export
  PERFORM log_audit(
    'data_exported',
    'profiles',
    target_user_id,
    NULL,
    NULL,
    jsonb_build_object('export_timestamp', now())
  );

  RETURN user_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- PARENTAL DATA ACCESS FUNCTIONS
-- ======================

-- Get child data for parent (COPPA right to access)
CREATE OR REPLACE FUNCTION get_child_data_for_parent(
  parent_email_input text,
  child_id_input uuid
)
RETURNS jsonb AS $$
DECLARE
  is_verified boolean;
  child_data jsonb;
BEGIN
  -- Verify parent relationship
  SELECT EXISTS (
    SELECT 1 FROM parental_consents
    WHERE child_id = child_id_input
    AND parent_email = parent_email_input
    AND approved = true
  ) INTO is_verified;

  IF NOT is_verified THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parent verification failed'
    );
  END IF;

  -- Return child data
  child_data := export_user_data(child_id_input);

  RETURN jsonb_build_object(
    'success', true,
    'data', child_data
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke parental consent (parent can withdraw)
CREATE OR REPLACE FUNCTION revoke_parental_consent(
  parent_email_input text,
  child_id_input uuid
)
RETURNS json AS $$
DECLARE
  consent_record record;
BEGIN
  -- Find and validate consent
  SELECT * INTO consent_record
  FROM parental_consents
  WHERE child_id = child_id_input
  AND parent_email = parent_email_input
  AND approved = true;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No approved consent found'
    );
  END IF;

  -- Update child profile (revoke access)
  UPDATE profiles
  SET
    parent_approved = false,
    subscription_tier = 'public',
    subscription_status = 'inactive',
    is_subscriber = false
  WHERE id = child_id_input;

  -- Mark consent as revoked
  UPDATE parental_consents
  SET approved = false
  WHERE id = consent_record.id;

  -- Log the revocation
  PERFORM log_audit(
    'parental_consent_revoked',
    'parental_consents',
    consent_record.id,
    NULL,
    NULL,
    jsonb_build_object(
      'parent_email', parent_email_input,
      'child_id', child_id_input
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Parental consent revoked. Child account downgraded to public access.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- COMMENTS
-- ======================

COMMENT ON TABLE deleted_accounts_archive IS
  'Permanent archive of deleted accounts for COPPA compliance (legal retention)';

COMMENT ON TABLE data_deletion_requests IS
  'Tracks data deletion requests from parents/users (COPPA right to delete)';

COMMENT ON FUNCTION delete_user_account IS
  'Deletes user account and archives data. Returns success/error JSON. Call from Edge Function.';

COMMENT ON FUNCTION export_user_data IS
  'Exports all user data as JSON (COPPA right to access)';

COMMENT ON FUNCTION get_child_data_for_parent IS
  'Allows verified parent to access child data (COPPA requirement)';

COMMENT ON FUNCTION revoke_parental_consent IS
  'Allows parent to revoke consent and downgrade child account';
