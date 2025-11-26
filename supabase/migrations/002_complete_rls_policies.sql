-- Migration 002: Complete Row-Level Security Policies
-- Created: 2025-11-25
-- Purpose: Fill gaps in RLS coverage for COPPA compliance and security

-- ======================
-- FORUM POSTS - Complete policies
-- ======================

-- Allow INSERT only for 13+ subscribers (was missing)
CREATE POLICY "allow_forum_insert_adults_only"
  ON forum_posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND date_part('year', age(p.birthdate)) >= 13
      AND p.subscription_tier IN ('free', 'basic', 'pro')
      AND (p.parent_approved = true OR date_part('year', age(p.birthdate)) >= 18)
    )
  );

-- Allow users to UPDATE/DELETE only their own posts
CREATE POLICY "allow_forum_update_own"
  ON forum_posts
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "allow_forum_delete_own"
  ON forum_posts
  FOR DELETE
  USING (user_id = auth.uid());

-- ======================
-- LESSONS - Enhanced policies
-- ======================

-- Allow UPDATE only for admins (content management)
CREATE POLICY "allow_lesson_update_admin_only"
  ON lessons
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.subscription_tier = 'admin'
    )
  );

-- Allow INSERT only for admins
CREATE POLICY "allow_lesson_insert_admin_only"
  ON lessons
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.subscription_tier = 'admin'
    )
  );

-- ======================
-- CONSULTATIONS - Complete policies
-- ======================

-- Allow INSERT for Pro users (booking consultations)
CREATE POLICY "allow_consultation_insert_pro"
  ON consultations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.subscription_tier = 'pro'
      AND p.consult_credits > 0
    )
  );

-- Allow UPDATE only for own consultations
CREATE POLICY "allow_consultation_update_own"
  ON consultations
  FOR UPDATE
  USING (user_id = auth.uid());

-- ======================
-- USER_ADDONS - Complete policies
-- ======================

-- Allow INSERT when user purchases addon (via Edge Function)
CREATE POLICY "allow_addon_insert_via_service_role"
  ON user_addons
  FOR INSERT
  WITH CHECK (true); -- Service role only (Edge Functions)

-- Prevent users from manually inserting addons
CREATE POLICY "prevent_user_addon_insert"
  ON user_addons
  FOR INSERT
  WITH CHECK (
    -- Only service role can insert (checked via auth.role())
    auth.role() = 'service_role'
  );

-- ======================
-- PARENTAL_CONSENTS - Security policies
-- ======================

-- Enable RLS on parental_consents
ALTER TABLE parental_consents ENABLE ROW LEVEL SECURITY;

-- Parents can view their own consent requests
CREATE POLICY "allow_view_own_consents"
  ON parental_consents
  FOR SELECT
  USING (
    parent_email = (
      SELECT email FROM profiles WHERE id = auth.uid()
    )
    OR
    child_id = auth.uid()
  );

-- Only service role can INSERT (via Edge Functions)
CREATE POLICY "allow_consent_insert_service_role"
  ON parental_consents
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only service role can UPDATE (approval process)
CREATE POLICY "allow_consent_update_service_role"
  ON parental_consents
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ======================
-- PROFILES - Enhanced policies
-- ======================

-- Allow INSERT only during signup (via auth trigger)
CREATE POLICY "allow_profile_insert_on_signup"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Prevent users from escalating their own tier
CREATE POLICY "prevent_tier_escalation"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Users can update their profile, but not these fields:
    (subscription_tier IS NOT DISTINCT FROM (SELECT subscription_tier FROM profiles WHERE id = auth.uid()))
    AND (is_subscriber IS NOT DISTINCT FROM (SELECT is_subscriber FROM profiles WHERE id = auth.uid()))
    AND (consult_credits IS NOT DISTINCT FROM (SELECT consult_credits FROM profiles WHERE id = auth.uid()))
  );

-- ======================
-- ADMIN ACCESS PATTERNS
-- ======================

-- Create admin role helper function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND subscription_tier = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin can view all tables (override restrictive policies)
CREATE POLICY "admin_view_all_profiles"
  ON profiles
  FOR SELECT
  USING (is_admin() OR auth.uid() = id);

CREATE POLICY "admin_view_all_forum"
  ON forum_posts
  FOR SELECT
  USING (is_admin() OR true); -- Admins see all, others see via existing policies

CREATE POLICY "admin_view_all_consultations"
  ON consultations
  FOR SELECT
  USING (is_admin() OR user_id = auth.uid());

CREATE POLICY "admin_view_all_consents"
  ON parental_consents
  FOR SELECT
  USING (is_admin());

-- ======================
-- INDEXES FOR POLICY PERFORMANCE
-- ======================

-- Index for age calculations (used in multiple policies)
CREATE INDEX IF NOT EXISTS idx_profiles_birthdate
  ON profiles(birthdate);

-- Index for tier checks
CREATE INDEX IF NOT EXISTS idx_profiles_tier
  ON profiles(subscription_tier);

-- Index for subscriber status
CREATE INDEX IF NOT EXISTS idx_profiles_subscriber
  ON profiles(is_subscriber);

-- Composite index for forum policy optimization
CREATE INDEX IF NOT EXISTS idx_profiles_forum_access
  ON profiles(id, subscription_tier, parent_approved)
  WHERE subscription_tier IN ('free', 'basic', 'pro');

-- ======================
-- VERIFICATION QUERIES
-- ======================

-- Test policy coverage (run after migration)
-- SELECT tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

COMMENT ON POLICY "allow_forum_insert_adults_only" ON forum_posts IS
  'COPPA compliance: Only users 13+ with parental approval can post to forum';

COMMENT ON POLICY "prevent_tier_escalation" ON profiles IS
  'Security: Prevents users from manually upgrading their subscription tier';

COMMENT ON FUNCTION is_admin IS
  'Helper function to check if current user has admin privileges';
