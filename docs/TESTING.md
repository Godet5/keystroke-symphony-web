# Testing Guide - Platform-Wide COPPA Compliance

**Scope:** All website features and educational products
**Framework:** Playwright (E2E), Vitest (Unit), Supabase Test Helpers
**Coverage Target:** >80% for critical paths

---

## Quick Start

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test                  # Run all tests
npm run test:e2e          # E2E tests only
npm run test:unit         # Unit tests only
npm run test:coppa        # COPPA compliance tests
npm run test:rls          # Database security tests
```

### Interactive Testing
```bash
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:debug    # Debug mode with browser
npm run test:unit:watch   # Watch mode for unit tests
```

---

## Test Suites Overview

### 1. E2E Tests (`tests/e2e/`)

**Parental Consent Flow** (`parental-consent.spec.ts`)
- ✅ Complete signup → consent → approval → access flow
- ✅ Token expiration (7 days)
- ✅ Rate limiting (5 requests/hour)
- ✅ Email validation
- ✅ Duplicate approval prevention
- **Run:** `playwright test tests/e2e/parental-consent.spec.ts`

**Authentication Flow** (TODO)
- Adult signup (13+ no consent required)
- Child signup (under-13 requires consent)
- Login/logout
- Password reset

**Subscription Flow** (TODO)
- Stripe checkout
- Tier upgrades/downgrades
- Cancellation
- Add-on purchases

### 2. Compliance Tests (`tests/compliance/`)

**COPPA Compliance** (`coppa-compliance.spec.ts`)
- ✅ Data minimization (no prohibited PII collection)
- ✅ Forum access blocked for under-13
- ✅ Purchase restrictions for minors
- ✅ Audit trail maintenance
- ✅ Parental data export
- ✅ Parental account deletion
- ✅ Consent revocation
- ✅ Privacy Policy accessibility
- **Run:** `npm run test:coppa`

### 3. Integration Tests (`tests/integration/`)

**RLS Policies** (`rls-policies.spec.ts`)
- ✅ Profile access isolation (users can't view other profiles)
- ✅ Tier escalation prevention
- ✅ Service role privileges
- ✅ Forum INSERT restrictions (age 13+)
- ✅ Forum UPDATE/DELETE (own posts only)
- ✅ Audit log immutability
- ✅ Parent-child data access verification
- **Run:** `npm run test:rls`

**Stripe Webhook** (TODO)
- Idempotency verification
- Subscription activation
- Payment failures
- Cancellation handling

### 4. Unit Tests (`tests/unit/`) - TODO
- Custom hook logic (useProfile, useAuditLog)
- Utility functions (calculateAge, canAccessFeature)
- Validation schemas (Zod)
- Rate limiting logic

---

## Environment Setup

### Required Environment Variables
Create `.env.test` file:
```bash
# Supabase
SUPABASE_URL=https://your-test-project.supabase.co
SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key

# Testing
BASE_URL=http://localhost:3000
CI=false

# Email (for testing)
RESEND_API_KEY=re_test_xxx

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_test_xxx
```

### Test Database Setup
```bash
# Create separate test project in Supabase
# Run migrations
supabase link --project-ref your-test-project
supabase db push

# Seed test data (optional)
psql $TEST_DATABASE_URL < tests/fixtures/seed.sql
```

---

## Writing Tests

### E2E Test Template
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/feature');

    // Interact with page
    await page.fill('[name="field"]', 'value');
    await page.click('button[type="submit"]');

    // Assert outcome
    await expect(page).toHaveURL('/success');
    await expect(page.locator('.message')).toContainText('Success');
  });

  // Cleanup
  test.afterEach(async () => {
    // Delete test data from database
  });
});
```

### Unit Test Template (Vitest)
```typescript
import { describe, it, expect } from 'vitest';
import { calculateAge } from '../hooks/useProfile';

describe('calculateAge', () => {
  it('should calculate age correctly', () => {
    const birthdate = '2000-01-01';
    const age = calculateAge(birthdate);
    expect(age).toBeGreaterThanOrEqual(24);
  });

  it('should handle invalid dates', () => {
    const age = calculateAge('invalid');
    expect(age).toBeNull();
  });
});
```

### Database Test Template
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test('should enforce RLS policy', async () => {
  const { data, error } = await supabase
    .from('protected_table')
    .select('*');

  expect(error).toBeDefined(); // Should fail without auth
});
```

---

## Test Data Management

### Fixtures (`tests/fixtures/`)
```
tests/fixtures/
├── users.json          # Test user accounts
├── profiles.json       # Profile variations (child, adult, admin)
├── subscriptions.json  # Different subscription tiers
└── seed.sql            # Database seed script
```

### Factories (Recommended)
```typescript
// tests/helpers/factories.ts
export function createTestUser(overrides = {}) {
  return {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    birthdate: '2000-01-01',
    ...overrides,
  };
}

export function createTestChild(overrides = {}) {
  return {
    ...createTestUser(),
    birthdate: '2015-01-01',
    parent_email: `parent-${Date.now()}@example.com`,
    ...overrides,
  };
}
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - run: npm ci
      - run: npm run test:unit
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Coverage Reports

### Generate Coverage
```bash
# Unit test coverage
npm run test:unit -- --coverage

# E2E coverage (requires instrumentation)
npm run test:e2e -- --coverage
```

### View Reports
- HTML Report: `playwright-report/index.html`
- JUnit XML: `test-results/junit.xml` (for CI)
- JSON: `test-results/results.json`

---

## Debugging Tests

### Playwright Inspector
```bash
npm run test:e2e:debug
```

### Visual Debugging
```bash
# Run with headed browser
npx playwright test --headed

# Run specific test
npx playwright test -g "parental consent"

# Step through with debugger
PWDEBUG=1 npx playwright test
```

### Vitest Debugging
```typescript
import { test } from 'vitest';

test('debug this', () => {
  debugger; // Use Chrome DevTools
  expect(true).toBe(true);
});
```

---

## COPPA Compliance Checklist

Before production, run these tests and verify:

- [ ] `npm run test:coppa` passes 100%
- [ ] No PII leaks in error messages (test: coppa-compliance.spec.ts)
- [ ] Forum blocked for under-13 (test: coppa-compliance.spec.ts)
- [ ] Parental consent flow works end-to-end (test: parental-consent.spec.ts)
- [ ] Token expiration enforced (test: parental-consent.spec.ts)
- [ ] Rate limiting works (test: parental-consent.spec.ts)
- [ ] Audit logs capture all consent events (test: coppa-compliance.spec.ts)
- [ ] Parent can export child data (test: coppa-compliance.spec.ts)
- [ ] Parent can delete child account (test: coppa-compliance.spec.ts)
- [ ] Privacy Policy accessible (test: coppa-compliance.spec.ts)
- [ ] RLS policies block unauthorized access (test: rls-policies.spec.ts)

---

## Performance Testing (TODO)

### Load Testing
```bash
# Use k6 or Artillery for load testing
npm run test:load
```

### Database Query Performance
```sql
-- Check slow queries
EXPLAIN ANALYZE SELECT * FROM profiles WHERE subscription_tier = 'pro';

-- Verify indexes used
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM audit_log WHERE user_id = '...';
```

---

## Security Testing

### Penetration Testing Checklist
- [ ] SQL injection attempts (use sqlmap)
- [ ] XSS attacks (test all input fields)
- [ ] CSRF protection (verify tokens)
- [ ] Rate limiting bypasses
- [ ] Session hijacking
- [ ] RLS policy bypasses

### Recommended Tools
- **OWASP ZAP** - Automated security scanning
- **Burp Suite** - Manual penetration testing
- **sqlmap** - SQL injection detection
- **npm audit** - Dependency vulnerability scanning

---

## Maintenance

### Regular Test Updates
- **Monthly**: Review and update test data
- **Quarterly**: Add new test cases for new features
- **Annually**: Full security audit + penetration test

### Test Hygiene
```bash
# Remove obsolete tests
git grep -l "test.skip" tests/

# Update snapshots
npm run test:unit -- -u

# Clean test database
npm run db:reset
```

---

## Troubleshooting

### Common Issues

**Tests failing locally but passing in CI:**
- Check environment variables
- Verify database state
- Clear browser cache: `npx playwright clean`

**RLS policy tests failing:**
- Ensure using correct Supabase keys (service role vs anon)
- Check policies enabled: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`

**Timeouts:**
- Increase timeout in `playwright.config.ts`
- Check for slow database queries
- Verify network connectivity

**Flaky tests:**
- Add explicit waits: `await page.waitForSelector()`
- Use `test.retry(2)`
- Check for race conditions

---

## Resources

- **Playwright Docs:** https://playwright.dev
- **Vitest Docs:** https://vitest.dev
- **Supabase Testing:** https://supabase.com/docs/guides/getting-started/local-development#testing
- **COPPA Requirements:** https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa

---

**Last Updated:** November 25, 2025
**Maintained By:** Development Team
**Next Review:** [30 days from launch]
