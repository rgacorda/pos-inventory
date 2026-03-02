# TODO: Email Notifications

## Overview
This document outlines features that require email notification implementation for the POS system.

## Priority Tasks

### 1. **Organization Creation - Admin Welcome Email** 🔴 High Priority
**Status:** Not Implemented
**Location:** `apps/backend-api/src/modules/organizations/organizations.service.ts` (line ~89)

**Requirements:**
- Send welcome email to newly created organization admin
- Include:
  - Organization name and details
  - Admin login credentials (email + temporary password)
  - Link to inventory dashboard login page
  - Instructions for first login and password change
  - Support contact information

**Current Implementation:**
```typescript
// TODO: Send email notification with credentials
// For now, credentials are logged to console
console.log(`[Organization Created] Admin credentials:`, {
  email: adminEmail,
  temporaryPassword: tempPassword,
  organizationId: savedOrg.id,
});
```

**Recommended Email Service:**
- SendGrid
- AWS SES
- Mailgun
- Resend
- Nodemailer (for basic SMTP)

**Template Example:**
```
Subject: Welcome to [POS System Name] - Your Admin Account

Hi [Admin Name],

Your organization "[Organization Name]" has been successfully set up!

Login Details:
- Dashboard URL: https://inventory.yourpos.com
- Email: [admin@email.com]
- Temporary Password: [generated-password]

For security reasons, you'll be required to change your password on first login.

If you have any questions, contact our support team.

Best regards,
[POS System Name] Team
```

---

### 2. **Password Reset Email** 🟡 Medium Priority
**Status:** Not Implemented
**Location:** `apps/backend-api/src/auth/auth.service.ts` (line ~114)

**Requirements:**
- Send password reset link when user requests it
- Include:
  - Reset token link with expiration time (1 hour)
  - Security notice
  - Link should redirect to password reset page

**Current Implementation:**
```typescript
// TODO: Send password reset email
console.log(`[Password Reset] Token for ${email}: ${resetToken}`);
```

**Reset URL Format:**
```
https://inventory.yourpos.com/reset-password?token=[RESET_TOKEN]
```

---

### 3. **User Creation Notification** 🟢 Low Priority
**Status:** Not Implemented

**Requirements:**
- Notify newly created users (MANAGER, CASHIER) about their account
- Include login credentials and role information
- Link to appropriate app (POS or Inventory)

---

### 4. **Subscription Notifications** 🟢 Low Priority
**Status:** Not Implemented

**Requirements:**
- Trial ending reminder (7 days before, 1 day before)
- Subscription expiration notice
- Payment failure alerts
- Plan upgrade/downgrade confirmation

---

## Implementation Steps

### Phase 1: Email Service Setup
1. Choose and configure email service provider
2. Set up email templates
3. Create email service module in backend
4. Add environment variables for email configuration

### Phase 2: Integration
1. Implement organization admin welcome email
2. Implement password reset email
3. Create email templates (HTML + plain text)
4. Add email queue for reliability (optional: Bull, BullMQ)

### Phase 3: Testing
1. Test email delivery in development
2. Test email rendering across clients
3. Implement email sending logs
4. Set up monitoring and alerts

---

## Environment Variables Needed

```env
# Email Configuration
EMAIL_SERVICE=sendgrid  # or ses, mailgun, smtp
EMAIL_FROM=noreply@yourpos.com
EMAIL_FROM_NAME=POS System

# Service-specific
SENDGRID_API_KEY=your-sendgrid-key
# OR
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# Frontend URLs
INVENTORY_APP_URL=http://localhost:3002
POS_APP_URL=http://localhost:3001
```

---

## Email Templates Structure

```
apps/backend-api/src/email/
├── templates/
│   ├── welcome-admin.html
│   ├── password-reset.html
│   ├── user-created.html
│   └── subscription-alert.html
├── email.module.ts
├── email.service.ts
└── dto/
    └── send-email.dto.ts
```

---

## Security Considerations

1. **Rate Limiting:** Prevent email abuse (e.g., password reset spam)
2. **Token Expiration:** All email tokens should expire
3. **No Sensitive Data:** Never include full passwords in emails
4. **Unsubscribe:** Add unsubscribe links for non-critical emails
5. **SPF/DKIM:** Configure proper email authentication
6. **Logging:** Log all email events for audit trail

---

## Monitoring & Analytics

- Track email delivery rates
- Monitor bounce rates
- Track open rates (optional)
- Alert on delivery failures
- Dashboard for email statistics

---

## Estimated Implementation Time

- Phase 1 (Setup): 2-4 hours
- Phase 2 (Integration): 4-6 hours
- Phase 3 (Testing): 2-3 hours
- **Total: 8-13 hours**

---

## Related Files

- `apps/backend-api/src/modules/organizations/organizations.service.ts`
- `apps/backend-api/src/auth/auth.service.ts`
- `apps/backend-api/src/modules/users/users.service.ts`

---

**Last Updated:** March 2, 2026
**Status:** Awaiting prioritization and resource allocation
