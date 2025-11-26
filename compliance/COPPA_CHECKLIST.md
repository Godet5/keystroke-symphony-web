# COPPA Compliance Checklist

## Pre-Launch Requirements

### ✅ Privacy Notice
- [ ] Privacy Policy posted prominently on website
- [ ] Privacy Policy link visible on signup page
- [ ] Privacy Policy written in clear, understandable language
- [ ] Privacy Policy includes all required COPPA elements:
  - [ ] Types of information collected
  - [ ] How information is used
  - [ ] Whether information is disclosed to third parties
  - [ ] Parental rights (access, deletion, revocation)
  - [ ] Contact information for privacy inquiries

### ✅ Parental Consent Mechanism
- [ ] Age gate implemented (birthdate collection)
- [ ] Users under 13 automatically routed to parental consent flow
- [ ] Consent request sent to parent/guardian email
- [ ] Email includes clear description of what consent grants
- [ ] Email includes link to Privacy Policy
- [ ] Consent link expires after 7 days
- [ ] Consent token is cryptographically secure (32+ characters)
- [ ] IP address and timestamp logged for consent approval

### ✅ Parental Rights Implementation
- [ ] Parent dashboard allows viewing child data
- [ ] Parent can export all child data
- [ ] Parent can delete child account
- [ ] Parent can revoke consent
- [ ] Data access requests fulfilled within 10 business days
- [ ] Data deletion completed within 30 days

### ✅ Data Minimization
- [ ] Only collect data necessary for service operation
- [ ] No collection of full names for under-13 users
- [ ] No collection of addresses, phone numbers, or photos
- [ ] No persistent identifiers for behavioral advertising
- [ ] No geolocation beyond general region (if needed for service)

### ✅ Feature Restrictions for Under-13 Users
- [ ] Forum/community features disabled
- [ ] Cannot purchase subscriptions independently
- [ ] Cannot share content publicly
- [ ] Cannot connect with other users directly
- [ ] No third-party integrations requiring additional data

### ✅ Security Measures
- [ ] Data encrypted in transit (HTTPS)
- [ ] Data encrypted at rest
- [ ] Row-level security (RLS) enforced in database
- [ ] Access controls limit staff access to child data
- [ ] Audit logging tracks all access to child records
- [ ] Regular security audits scheduled

### ✅ Third-Party Service Compliance
- [ ] All service providers are COPPA-compliant
- [ ] Data Processing Agreements (DPAs) signed with:
  - [ ] Hosting provider (Supabase)
  - [ ] Payment processor (Stripe)
  - [ ] Email provider (Resend)
- [ ] Third parties prohibited from using child data for marketing

### ✅ Staff Training
- [ ] All staff trained on COPPA requirements
- [ ] Privacy Officer designated
- [ ] Incident response plan documented
- [ ] Annual COPPA compliance review scheduled

## Post-Launch Monitoring

### Monthly
- [ ] Review parental consent approval rate
- [ ] Check for failed consent emails
- [ ] Audit data deletion requests (response time < 30 days)
- [ ] Review access logs for anomalies

### Quarterly
- [ ] Security audit of child data access
- [ ] Review third-party compliance
- [ ] Test parental controls functionality
- [ ] Review and update Privacy Policy if needed

### Annually
- [ ] Full COPPA compliance audit
- [ ] Staff retraining
- [ ] Update technical safeguards
- [ ] Consider Safe Harbor certification

## Incident Response

If a data breach occurs involving children under 13:

1. **Immediate (within 24 hours):**
   - [ ] Contain the breach
   - [ ] Assess scope of affected children
   - [ ] Notify FTC (if required)

2. **Within 72 hours:**
   - [ ] Notify all affected parents via email
   - [ ] Provide clear explanation and remediation steps
   - [ ] Offer free data deletion if requested

3. **Within 30 days:**
   - [ ] Complete incident report
   - [ ] Implement preventive measures
   - [ ] Update security documentation

## Useful Resources

- **FTC COPPA Page:** https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa
- **COPPA FAQs:** https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- **Safe Harbor Program:** https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-approves-coppa-safe-harbor-program

## Legal Review

- [ ] Privacy Policy reviewed by attorney
- [ ] Terms of Service reviewed by attorney
- [ ] Parental consent mechanism reviewed by attorney
- [ ] Data retention policy reviewed by attorney

---

**Compliance Officer:** [Name]
**Last Review Date:** November 25, 2025
**Next Review Date:** [30 days from launch]
