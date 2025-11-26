-- Migration 004: Performance Indexes
-- Created: 2025-11-25
-- Purpose: Optimize query performance for production scale

-- ======================
-- PROFILES TABLE INDEXES
-- ======================

-- Already created in migration 002, but adding additional performance indexes

-- Index for email lookups (login, password reset)
CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON profiles(email);

-- Index for subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription
  ON profiles(subscription_status, subscription_tier)
  WHERE is_subscriber = true;

-- Index for parent approval checks
CREATE INDEX IF NOT EXISTS idx_profiles_parent_approval
  ON profiles(parent_approved, birthdate)
  WHERE parent_approved = false;

-- Partial index for active subscribers
CREATE INDEX IF NOT EXISTS idx_profiles_active_subscribers
  ON profiles(id, subscription_tier)
  WHERE subscription_status = 'active' AND is_subscriber = true;

-- ======================
-- USER_ADDONS TABLE INDEXES
-- ======================

-- Index for user addon lookups
CREATE INDEX IF NOT EXISTS idx_addons_user_id
  ON user_addons(user_id, purchased_at DESC);

-- Index for addon type reporting
CREATE INDEX IF NOT EXISTS idx_addons_addon_id
  ON user_addons(addon_id, purchased_at DESC);

-- ======================
-- CONSULTATIONS TABLE INDEXES
-- ======================

-- Index for user consultation history
CREATE INDEX IF NOT EXISTS idx_consultations_user
  ON consultations(user_id, scheduled_at DESC);

-- Index for upcoming consultations
CREATE INDEX IF NOT EXISTS idx_consultations_upcoming
  ON consultations(scheduled_at)
  WHERE scheduled_at > now();

-- ======================
-- FORUM_POSTS TABLE INDEXES
-- ======================

-- Index for user posts
CREATE INDEX IF NOT EXISTS idx_forum_user
  ON forum_posts(user_id, created_at DESC);

-- Index for recent posts (homepage feed)
CREATE INDEX IF NOT EXISTS idx_forum_recent
  ON forum_posts(created_at DESC);

-- Full-text search on content (if needed later)
-- CREATE INDEX IF NOT EXISTS idx_forum_content_search
--   ON forum_posts USING gin(to_tsvector('english', content));

-- ======================
-- LESSONS TABLE INDEXES
-- ======================

-- Index for public lessons
CREATE INDEX IF NOT EXISTS idx_lessons_public
  ON lessons(created_at DESC)
  WHERE public = true;

-- Index for all lessons (admin view)
CREATE INDEX IF NOT EXISTS idx_lessons_all
  ON lessons(title, created_at DESC);

-- ======================
-- WEBHOOK EVENTS TABLE (for idempotency)
-- ======================

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  payload jsonb,
  result jsonb
);

-- Index for event ID lookups (idempotency check)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_stripe_id
  ON webhook_events(stripe_event_id);

-- Index for event type reporting
CREATE INDEX IF NOT EXISTS idx_webhook_events_type
  ON webhook_events(event_type, processed_at DESC);

-- Enable RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook events
CREATE POLICY "service_role_access_webhooks"
  ON webhook_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- ======================
-- RATE LIMITING TABLE
-- ======================

CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  attempts int DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  last_attempt timestamptz DEFAULT now()
);

-- Index for rate limit key lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key
  ON rate_limits(key);

-- Index for cleanup of expired windows
CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON rate_limits(window_start);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limits
CREATE POLICY "service_role_access_rate_limits"
  ON rate_limits
  FOR ALL
  USING (auth.role() = 'service_role');

-- Rate limit function
CREATE OR REPLACE FUNCTION check_rate_limit(
  limit_key text,
  max_attempts int DEFAULT 5,
  window_minutes int DEFAULT 60
)
RETURNS json AS $$
DECLARE
  current_attempts int;
  window_expired boolean;
BEGIN
  -- Get existing rate limit record
  SELECT
    attempts,
    (now() - window_start) > (window_minutes || ' minutes')::interval
  INTO current_attempts, window_expired
  FROM rate_limits
  WHERE key = limit_key;

  -- If no record or window expired, create/reset
  IF NOT FOUND OR window_expired THEN
    INSERT INTO rate_limits (key, attempts, window_start, last_attempt)
    VALUES (limit_key, 1, now(), now())
    ON CONFLICT (key)
    DO UPDATE SET
      attempts = 1,
      window_start = now(),
      last_attempt = now();

    RETURN json_build_object(
      'allowed', true,
      'attempts', 1,
      'remaining', max_attempts - 1
    );
  END IF;

  -- Check if limit exceeded
  IF current_attempts >= max_attempts THEN
    RETURN json_build_object(
      'allowed', false,
      'attempts', current_attempts,
      'remaining', 0,
      'retry_after', window_minutes * 60
    );
  END IF;

  -- Increment attempts
  UPDATE rate_limits
  SET
    attempts = attempts + 1,
    last_attempt = now()
  WHERE key = limit_key;

  RETURN json_build_object(
    'allowed', true,
    'attempts', current_attempts + 1,
    'remaining', max_attempts - (current_attempts + 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old rate limit records (run via cron or periodically)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS int AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < (now() - interval '24 hours');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- DATABASE PERFORMANCE SETTINGS
-- ======================

-- Analyze tables for query planner optimization
ANALYZE profiles;
ANALYZE parental_consents;
ANALYZE consultations;
ANALYZE user_addons;
ANALYZE forum_posts;
ANALYZE lessons;
ANALYZE audit_log;

-- ======================
-- MONITORING VIEWS
-- ======================

-- View for slow queries (admin dashboard)
CREATE OR REPLACE VIEW slow_queries AS
SELECT
  'profiles' as table_name,
  COUNT(*) as total_rows,
  pg_size_pretty(pg_total_relation_size('profiles')) as total_size
FROM profiles
UNION ALL
SELECT
  'forum_posts',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('forum_posts'))
FROM forum_posts
UNION ALL
SELECT
  'audit_log',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('audit_log'))
FROM audit_log;

-- View for subscription metrics
CREATE OR REPLACE VIEW subscription_metrics AS
SELECT
  subscription_tier,
  subscription_status,
  COUNT(*) as user_count,
  COUNT(CASE WHEN parent_approved THEN 1 END) as parent_approved_count,
  COUNT(CASE WHEN date_part('year', age(birthdate)) < 13 THEN 1 END) as under_13_count
FROM profiles
GROUP BY subscription_tier, subscription_status;

-- ======================
-- COMMENTS
-- ======================

COMMENT ON TABLE webhook_events IS
  'Stores processed Stripe webhook events for idempotency checking';

COMMENT ON TABLE rate_limits IS
  'Rate limiting storage for API endpoints (parental consent, etc.)';

COMMENT ON FUNCTION check_rate_limit IS
  'Check and enforce rate limits. Returns JSON with allowed status and remaining attempts.';

COMMENT ON FUNCTION cleanup_rate_limits IS
  'Remove rate limit records older than 24 hours. Returns count of deleted records.';
