-- Migration 003: Audit Logging System
-- Created: 2025-11-25
-- Purpose: COPPA compliance - track all sensitive operations for compliance defense

-- ======================
-- AUDIT LOG TABLE
-- ======================

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id uuid,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins and service role can view audit logs
CREATE POLICY "admin_view_audit_logs"
  ON audit_log
  FOR SELECT
  USING (is_admin() OR auth.role() = 'service_role');

-- Only service role can insert audit logs (via triggers)
CREATE POLICY "service_role_insert_audit"
  ON audit_log
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Prevent any updates or deletes (immutable audit trail)
CREATE POLICY "prevent_audit_modification"
  ON audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY "prevent_audit_deletion"
  ON audit_log
  FOR DELETE
  USING (false);

-- ======================
-- AUDIT LOGGING FUNCTION
-- ======================

CREATE OR REPLACE FUNCTION log_audit(
  action_name text,
  resource_name text,
  resource_uuid uuid DEFAULT NULL,
  old_data jsonb DEFAULT NULL,
  new_data jsonb DEFAULT NULL,
  extra_metadata jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_log (
    user_id,
    action,
    resource,
    resource_id,
    old_values,
    new_values,
    metadata
  ) VALUES (
    auth.uid(),
    action_name,
    resource_name,
    resource_uuid,
    old_data,
    new_data,
    extra_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- AUDIT TRIGGERS FOR SENSITIVE TABLES
-- ======================

-- Trigger function for profile changes
CREATE OR REPLACE FUNCTION audit_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log significant profile changes
  IF (TG_OP = 'UPDATE') THEN
    -- Only log if sensitive fields changed
    IF (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier) OR
       (OLD.subscription_status IS DISTINCT FROM NEW.subscription_status) OR
       (OLD.parent_approved IS DISTINCT FROM NEW.parent_approved) OR
       (OLD.consult_credits IS DISTINCT FROM NEW.consult_credits) THEN

      INSERT INTO audit_log (
        user_id,
        action,
        resource,
        resource_id,
        old_values,
        new_values
      ) VALUES (
        NEW.id,
        'profile_update',
        'profiles',
        NEW.id,
        jsonb_build_object(
          'subscription_tier', OLD.subscription_tier,
          'subscription_status', OLD.subscription_status,
          'parent_approved', OLD.parent_approved,
          'consult_credits', OLD.consult_credits
        ),
        jsonb_build_object(
          'subscription_tier', NEW.subscription_tier,
          'subscription_status', NEW.subscription_status,
          'parent_approved', NEW.parent_approved,
          'consult_credits', NEW.consult_credits
        )
      );
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (
      user_id,
      action,
      resource,
      resource_id,
      new_values
    ) VALUES (
      NEW.id,
      'profile_created',
      'profiles',
      NEW.id,
      row_to_json(NEW)::jsonb
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (
      user_id,
      action,
      resource,
      resource_id,
      old_values
    ) VALUES (
      OLD.id,
      'profile_deleted',
      'profiles',
      OLD.id,
      row_to_json(OLD)::jsonb
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for parental consent changes
CREATE OR REPLACE FUNCTION audit_consent_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.approved = false AND NEW.approved = true) THEN
    INSERT INTO audit_log (
      user_id,
      action,
      resource,
      resource_id,
      metadata,
      ip_address,
      user_agent
    ) VALUES (
      NEW.child_id,
      'parental_consent_approved',
      'parental_consents',
      NEW.id,
      jsonb_build_object(
        'parent_email', NEW.parent_email,
        'child_id', NEW.child_id,
        'approved_at', NEW.approved_at
      ),
      NEW.ip_address,
      NEW.user_agent
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for consultation bookings
CREATE OR REPLACE FUNCTION audit_consultation_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (
      user_id,
      action,
      resource,
      resource_id,
      new_values
    ) VALUES (
      NEW.user_id,
      'consultation_booked',
      'consultations',
      NEW.id,
      jsonb_build_object(
        'scheduled_at', NEW.scheduled_at,
        'survey', NEW.survey
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for addon purchases
CREATE OR REPLACE FUNCTION audit_addon_purchases()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (
      user_id,
      action,
      resource,
      resource_id,
      new_values
    ) VALUES (
      NEW.user_id,
      'addon_purchased',
      'user_addons',
      NEW.id,
      jsonb_build_object(
        'addon_id', NEW.addon_id,
        'purchased_at', NEW.purchased_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- ATTACH TRIGGERS
-- ======================

-- Profiles audit trigger
DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_profile_changes();

-- Parental consents audit trigger
DROP TRIGGER IF EXISTS audit_consents ON parental_consents;
CREATE TRIGGER audit_consents
  AFTER UPDATE ON parental_consents
  FOR EACH ROW
  EXECUTE FUNCTION audit_consent_changes();

-- Consultations audit trigger
DROP TRIGGER IF EXISTS audit_consultations ON consultations;
CREATE TRIGGER audit_consultations
  AFTER INSERT ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION audit_consultation_changes();

-- User addons audit trigger
DROP TRIGGER IF EXISTS audit_addons ON user_addons;
CREATE TRIGGER audit_addons
  AFTER INSERT ON user_addons
  FOR EACH ROW
  EXECUTE FUNCTION audit_addon_purchases();

-- ======================
-- INDEXES FOR AUDIT QUERIES
-- ======================

CREATE INDEX IF NOT EXISTS idx_audit_user_id
  ON audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_action
  ON audit_log(action);

CREATE INDEX IF NOT EXISTS idx_audit_resource
  ON audit_log(resource, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit_log(created_at DESC);

-- Composite index for user activity reports
CREATE INDEX IF NOT EXISTS idx_audit_user_activity
  ON audit_log(user_id, created_at DESC);

-- ======================
-- HELPER FUNCTIONS
-- ======================

-- Get user activity log
CREATE OR REPLACE FUNCTION get_user_audit_log(
  target_user_id uuid,
  limit_rows int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  action text,
  resource text,
  created_at timestamptz,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.resource,
    al.created_at,
    jsonb_build_object(
      'old_values', al.old_values,
      'new_values', al.new_values,
      'metadata', al.metadata
    ) as metadata
  FROM audit_log al
  WHERE al.user_id = target_user_id
  ORDER BY al.created_at DESC
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get recent sensitive actions (for compliance reporting)
CREATE OR REPLACE FUNCTION get_sensitive_actions(
  since timestamptz DEFAULT (now() - interval '30 days')
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  action text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.user_id,
    p.email as user_email,
    al.action,
    al.created_at
  FROM audit_log al
  LEFT JOIN profiles p ON al.user_id = p.id
  WHERE al.created_at >= since
  AND al.action IN (
    'profile_deleted',
    'parental_consent_approved',
    'subscription_tier_changed',
    'data_export_requested'
  )
  ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- COMMENTS
-- ======================

COMMENT ON TABLE audit_log IS
  'Immutable audit trail for COPPA compliance and security monitoring';

COMMENT ON FUNCTION log_audit IS
  'Manual audit logging function for Edge Functions and custom operations';

COMMENT ON FUNCTION get_user_audit_log IS
  'Retrieve activity log for a specific user (for parental dashboard)';

COMMENT ON FUNCTION get_sensitive_actions IS
  'Retrieve sensitive actions for compliance reporting (COPPA, FERPA)';
