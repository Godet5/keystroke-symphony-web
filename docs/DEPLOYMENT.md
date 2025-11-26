# Deployment Runbook

## Pre-Deployment Checklist

### 1. Environment Setup

**Supabase:**
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref your-project-ref
```

**Environment Variables:**
Create `.env` file with:
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_FREE=price_...
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PRO=price_...

# Email
RESEND_API_KEY=re_...
EMAIL_SENDER=no-reply@yourdomain.com

# Site
SITE_URL=https://yourdomain.com
```

### 2. Database Migrations

**Run in order:**
```bash
# Navigate to project
cd ~/temp/website_blueprint_implementation

# Run migrations
supabase db push

# Or manually:
psql $DATABASE_URL < supabase/migrations/001_add_token_expiration.sql
psql $DATABASE_URL < supabase/migrations/002_complete_rls_policies.sql
psql $DATABASE_URL < supabase/migrations/003_add_audit_logging.sql
psql $DATABASE_URL < supabase/migrations/004_add_indexes.sql
psql $DATABASE_URL < supabase/migrations/005_data_deletion_functions.sql
```

**Verification:**
```sql
-- Check tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN
('profiles', 'parental_consents', 'audit_log', 'webhook_events');

-- Check indexes
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public';

-- Test functions
SELECT validate_consent_token('test_token');
SELECT check_rate_limit('test_key', 5, 60);
```

### 3. Deploy Edge Functions

```bash
# Deploy parental consent
supabase functions deploy parental-consent-v2

# Deploy parental approval
supabase functions deploy parental-approve-v2

# Deploy Stripe webhook
supabase functions deploy stripe-webhook-v2

# Deploy data deletion (optional - can be triggered manually)
supabase functions deploy data-deletion
```

**Set secrets:**
```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SITE_URL=https://yourdomain.com
```

### 4. Configure Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook-v2`
3. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 5. React Frontend Deployment

**Cloudflare Pages:**
```bash
# Build React app
cd react/
npm install
npm run build

# Deploy via Wrangler
npx wrangler pages deploy dist --project-name=keystroke-symphony

# Or connect GitHub repo for automatic deployments
```

**Environment variables in Cloudflare:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL`

### 6. DNS Configuration

Point your domain to Cloudflare Pages:
```
A record: @  →  Cloudflare Pages IP
CNAME: www  →  your-project.pages.dev
```

### 7. SSL/TLS

- Ensure SSL certificate is active (automatic with Cloudflare)
- Set SSL mode to "Full (strict)"
- Enable HSTS
- Force HTTPS redirects

## Post-Deployment Verification

### Smoke Tests

**1. User Signup Flow:**
```bash
# Test adult signup (age 18+)
curl -X POST https://yourdomain.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123","birthdate":"2000-01-01"}'

# Verify account created
# Check subscription_tier = 'public'
```

**2. Child Signup + Parental Consent:**
```bash
# Test child signup (age 10)
curl -X POST https://yourdomain.com/api/auth/signup \
  -d '{"email":"child@example.com","password":"TestPass123","birthdate":"2014-01-01"}'

# Trigger parental consent
curl -X POST https://your-project.supabase.co/functions/v1/parental-consent-v2 \
  -d '{"child_id":"user-uuid","parent_email":"parent@example.com"}'

# Check email sent
# Click approval link
# Verify subscription_tier = 'free', parent_approved = true
```

**3. Stripe Webhook:**
```bash
# Use Stripe CLI to test
stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook-v2

# Trigger test event
stripe trigger checkout.session.completed

# Verify subscription_tier updated in database
```

**4. RLS Policies:**
```sql
-- Test as non-admin user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'test-user-id';

-- Should only see own profile
SELECT * FROM profiles;

-- Should not see other users' data
SELECT * FROM consultations WHERE user_id != 'test-user-id'; -- Returns empty

-- Reset
RESET ROLE;
```

**5. Rate Limiting:**
```bash
# Send 6 requests in 1 minute
for i in {1..6}; do
  curl -X POST https://your-project.supabase.co/functions/v1/parental-consent-v2 \
    -d '{"child_id":"test","parent_email":"test@example.com"}'
done

# 6th request should return 429 Too Many Requests
```

## Monitoring Setup

### 1. Supabase Dashboard
- Enable "Realtime" for critical tables
- Set up alerts for:
  - Failed Edge Function invocations
  - Database errors
  - High query latency (>1s)

### 2. Stripe Dashboard
- Monitor webhook delivery success rate
- Set up email alerts for failed payments

### 3. Cloudflare Analytics
- Track page load times
- Monitor 4xx/5xx error rates
- Set up alerts for traffic spikes

### 4. Audit Log Monitoring
```sql
-- Daily audit review (run via cron)
SELECT action, COUNT(*) as count
FROM audit_log
WHERE created_at > now() - interval '24 hours'
GROUP BY action
ORDER BY count DESC;

-- Flag suspicious activity
SELECT user_id, action, created_at
FROM audit_log
WHERE action IN ('profile_deleted', 'parental_consent_revoked')
AND created_at > now() - interval '7 days';
```

## Rollback Plan

If critical issues occur:

**1. Database Rollback:**
```bash
# Revert migrations
supabase db reset

# Or manually:
psql $DATABASE_URL < backups/pre_migration_backup.sql
```

**2. Edge Function Rollback:**
```bash
# Deploy previous version
supabase functions deploy parental-consent --version v1
```

**3. Frontend Rollback:**
```bash
# Cloudflare Pages - revert to previous deployment
wrangler pages deployments list
wrangler pages deployments rollback <deployment-id>
```

## Maintenance Windows

**Scheduled Maintenance:**
- Database migrations: Sundays 2-4 AM UTC
- Edge Function updates: Can be deployed anytime (zero downtime)
- Frontend updates: Continuous deployment (zero downtime)

**Emergency Maintenance:**
1. Post status update on status page
2. Email active subscribers
3. Deploy fix
4. Verify with smoke tests
5. Update status page

## Contact Information

**On-Call Rotation:**
- Primary: [Name] - [Phone] - [Email]
- Secondary: [Name] - [Phone] - [Email]

**Escalation:**
- Privacy Officer: privacy@yourdomain.com
- Security Team: security@yourdomain.com
- FTC Compliance: [If needed]

---

**Last Updated:** November 25, 2025
**Next Review:** [30 days from deployment]
