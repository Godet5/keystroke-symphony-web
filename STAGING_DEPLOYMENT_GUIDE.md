# Staging Deployment Guide

**Date:** November 25, 2025
**Branch:** `staging`
**Purpose:** Deploy COPPA-compliant backend infrastructure to staging environment

---

## Overview

This guide covers deploying the Keystroke Symphony platform with full Supabase backend, Stripe payments, and COPPA compliance to a staging environment.

**What's New in Staging:**
- ✅ Supabase Auth + Database (user profiles, subscriptions)
- ✅ COPPA parental consent workflow
- ✅ Stripe payment integration
- ✅ Row-Level Security (RLS) policies
- ✅ Audit logging for compliance
- ✅ Parental dashboard for data rights

---

## Prerequisites

### 1. Create Supabase Staging Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. **Name:** `keystroke-symphony-staging`
4. **Database Password:** (Generate and save securely)
5. **Region:** (Choose closest to your users)
6. Wait ~2 minutes for provisioning

### 2. Get API Keys

**Supabase:**
- Go to Project Settings → API
- Copy `URL` and `anon` key

**Stripe Test Keys:**
- Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
- Copy "Publishable key" (starts with `pk_test_`)
- Copy "Secret key" (starts with `sk_test_`)

**Resend API Key** (for parental consent emails):
- Go to [Resend Dashboard](https://resend.com/api-keys)
- Create API key with "Sending access"

---

## Step 1: Install Dependencies

```bash
cd ~/keystroke-symphony-web
git checkout staging
npm install
```

This installs:
- `@supabase/supabase-js` - Supabase client
- `@stripe/stripe-js` - Stripe client
- `react-query` - Data fetching/caching
- `zod` - Schema validation

---

## Step 2: Configure Environment Variables

### Local Development (.env.local)

Create `.env.local` (not tracked in git):

```bash
# Gemini API
GEMINI_API_KEY=AIza_your_key

# Supabase (Staging Project)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Stripe (Test Mode)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key

# Site URL
VITE_SITE_URL=http://localhost:5173
```

### Cloudflare Pages (Staging Branch)

Add environment variables in Cloudflare Dashboard:
1. Go to Cloudflare Pages → keystroke-symphony-web → Settings → Environment Variables
2. Add variables for **Preview** deployments:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRIPE_PUBLISHABLE_KEY`
   - `VITE_SITE_URL` (your staging URL)
   - `GEMINI_API_KEY` (for serverless functions)

---

## Step 3: Deploy Database Migrations

### Option A: Via Supabase Dashboard (Recommended for Termux)

1. Go to Supabase Dashboard → SQL Editor
2. Run each migration in order:

```sql
-- 001_add_token_expiration.sql
-- (Copy content from supabase/migrations/001_add_token_expiration.sql)

-- 002_complete_rls_policies.sql
-- (Copy content from supabase/migrations/002_complete_rls_policies.sql)

-- ... Continue with 003, 004, 005
```

**Verify:**
```sql
-- Check tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Should see: profiles, parental_consents, audit_log, webhook_events, rate_limits
```

### Option B: Via Supabase CLI (if available)

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

---

## Step 4: Deploy Edge Functions

### Option A: Via Supabase Dashboard

1. Go to Edge Functions → "New Function"
2. Create each function manually:

**parental-consent-v2:**
- Copy `supabase/functions/parental-consent-v2/index.ts`
- Set secrets: `RESEND_API_KEY`, `SITE_URL`, `EMAIL_SENDER`

**parental-approve-v2:**
- Copy `supabase/functions/parental-approve-v2/index.ts`

**stripe-webhook-v2:**
- Copy `supabase/functions/stripe-webhook-v2/index.ts`
- Set secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

### Option B: Via Supabase CLI

```bash
# Set secrets first
npx supabase secrets set RESEND_API_KEY=re_xxx
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
npx supabase secrets set SITE_URL=https://staging.yourdomain.com
npx supabase secrets set EMAIL_SENDER=no-reply@yourdomain.com

# Deploy functions
npm run functions:deploy
```

---

## Step 5: Configure Stripe Webhook

1. Go to [Stripe Developers → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. **Endpoint URL:** `https://your-project.supabase.co/functions/v1/stripe-webhook-v2`
4. **Events to send:**
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy "Signing secret" (`whsec_xxx`)
6. Update Edge Function secret:
   ```bash
   npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

---

## Step 6: Deploy Frontend to Cloudflare Pages

### Automatic (via GitHub)

```bash
git add .
git commit -m "feat: Add COPPA-compliant backend infrastructure

- Supabase auth + database integration
- Parental consent workflow (COPPA)
- Stripe payment integration
- RLS policies for data security
- Audit logging for compliance
- Parental dashboard components

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin staging
```

Cloudflare Pages will automatically:
1. Detect push to `staging` branch
2. Build app (`npm run build`)
3. Deploy to preview URL (e.g., `staging.keystroke-symphony.pages.dev`)

### Manual (via Wrangler)

```bash
npm run deploy:preview
```

---

## Step 7: Verification Tests

### Test 1: Adult Signup
```bash
# Visit your staging site
# Sign up with birthdate > 18 years old
# Verify: subscription_tier = 'public', no parental consent required
```

### Test 2: Child Signup + Parental Consent
```bash
# Sign up with birthdate < 13 years old
# Enter parent email
# Check parent's email for consent link
# Click approval link
# Verify: subscription_tier = 'free', parent_approved = true
```

### Test 3: Check Database
```sql
-- In Supabase SQL Editor
SELECT id, email, subscription_tier, parent_approved
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

-- Check audit log
SELECT user_id, action, created_at
FROM audit_log
ORDER BY created_at DESC
LIMIT 10;
```

### Test 4: Rate Limiting
```bash
# Try sending 6 parental consent requests in 1 minute
# 6th request should return 429 Too Many Requests
```

---

## Step 8: Monitor Staging Environment

### Supabase Dashboard
- **Database:** Check tables, RLS policies enabled
- **Auth:** Monitor signup/login attempts
- **Edge Functions:** Check invocation logs, error rates
- **API:** Monitor request volume

### Cloudflare Analytics
- **Performance:** Page load times
- **Errors:** 4xx/5xx rates
- **Traffic:** Request distribution

### Stripe Dashboard (Test Mode)
- **Webhooks:** Delivery success rate
- **Payments:** Test transactions

---

## Troubleshooting

### Issue: Supabase client errors
**Error:** "Invalid API key" or "Failed to fetch"
**Fix:** Check environment variables in `.env.local` and Cloudflare Pages settings

### Issue: Parental consent emails not sending
**Fix:**
1. Check `RESEND_API_KEY` secret in Supabase
2. Verify `EMAIL_SENDER` domain is verified in Resend
3. Check Edge Function logs in Supabase Dashboard

### Issue: Stripe webhook not working
**Fix:**
1. Verify webhook endpoint URL is correct
2. Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
3. Test with `stripe trigger checkout.session.completed` (Stripe CLI)

### Issue: RLS policy blocking operations
**Error:** "new row violates row-level security policy"
**Fix:** Check if user is authenticated (`auth.uid()` exists)

---

## Rollback Plan

If critical issues occur:

```bash
# Revert frontend
cd ~/keystroke-symphony-web
git checkout main
git push origin staging --force

# Database rollback
# In Supabase SQL Editor, run backup SQL if needed
```

---

## Next Steps

After staging validation:

1. [ ] Complete end-to-end testing (all user flows)
2. [ ] Review Privacy Policy with legal counsel
3. [ ] Sign DPAs (Supabase, Stripe, Resend)
4. [ ] Perform security audit
5. [ ] Create production environment
6. [ ] Migrate to production Supabase project
7. [ ] Switch Stripe to live mode
8. [ ] Deploy to production Cloudflare Pages

---

## Contact

**Staging Issues:** Create issue in GitHub repo
**COPPA Compliance Questions:** Review `compliance/COPPA_CHECKLIST.md`
**Technical Architecture:** See `docs/DEPLOYMENT.md` (from blueprint)

**Generated:** 2025-11-25
**Claude Session:** a0dd6224-1f65-4b8c-adc4-058e55b9b396
