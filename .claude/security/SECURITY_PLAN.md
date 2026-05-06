# Spendo Security Plan v1.0

**Status:** DRAFT  
**Last Updated:** May 5, 2026  
**Owner:** [SECURITY] Agent  
**Classification:** CONFIDENTIAL — Internal Use Only

---

## Executive Summary

Spendo is a **fintech personal finance platform** that processes sensitive financial data (credit card statements, transaction histories, merchant information). This security plan establishes the controls, threat models, and compliance frameworks necessary to protect user data and maintain trust.

**Risk Level:** HIGH (financial data, PII, payment information)

**Security Posture Target:** SOC 2 Type II compliant (by Q3 2026)

---

## 1. Security Principles

All security decisions at Spendo follow these core principles:

### 1.1 Defense in Depth
- **Multiple security layers** — no single point of failure
- **Layered validation** — input at client, API gateway, database
- **Encryption at rest AND in transit** — not one or the other
- **Example**: User credentials → TLS transport → bcrypt hashing → database encryption

### 1.2 Least Privilege
- Every service, user, API token gets **minimum required permissions**
- OAuth 2.0 scoped tokens (not blanket access)
- Database roles restricted by function (parser role ≠ reporting role)
- **Example**: JWT tokens for API access only, not database admin

### 1.3 Assume Breach
- Design systems so **compromise of one component doesn't cascade**
- Secrets rotation even if not breached (quarterly)
- Audit logs immutable (tamper-evident)
- **Example**: If AWS S3 bucket compromised, rotated keys limit damage window

### 1.4 Privacy by Design
- Only collect data that **serves a direct user purpose**
- Data minimization — no unnecessary retention
- User controls — export/delete anytime
- **Example**: Claude API gets merchant name + amount only (no user ID, no date, no account info)

### 1.5 Secure by Default
- Production settings **most restrictive**
- Debug mode OFF in production
- HTTPS enforced (no fallback to HTTP)
- Default passwords removed
- **Example**: Database connections require SSL; no plaintext auth tokens in logs

---

## 2. Threat Model

### 2.1 Threat Actors & Motivations

| Threat Actor | Motivation | Capability | Target | Risk |
|---|---|---|---|---|
| **Opportunistic Attacker** | Financial gain (card fraud) | Low | User financial data | HIGH |
| **Competitor** | Market intelligence | Medium | User spending patterns | MEDIUM |
| **Malicious Insider** | Data theft, extortion | High | Database, keys | CRITICAL |
| **Nation-State** | Surveillance | Very High | User behavior patterns | LOW (unlikely, not valuable) |
| **Automated Bot** | Mass account takeover | Medium | Authentication system | HIGH |

### 2.2 High-Risk Attack Surfaces

#### A. File Upload (Excel/CSV Parser)
**Threat**: Malicious files, zip bombs, code injection

**Specific Attacks:**
- Upload Excel with macro payload → RCE
- Upload 10GB CSV → resource exhaustion (DoS)
- Upload Excel with formula injection → =cmd|'/c calc'!A1
- Upload file claiming .xlsx but actually binary payload

**Mitigation:**
- File size limits: Max 50MB per upload
- Strict MIME type validation (whitelist .xlsx, .csv only)
- File scanning with ClamAV (antivirus) before processing
- No macro execution (use openpyxl, not Excel engine)
- Sandbox file processing in isolated container
- Checksum verification (SHA-256) to detect tampering

#### B. Authentication & Session Management
**Threat**: Credential stuffing, brute force, session hijacking

**Specific Attacks:**
- Attacker tries 1000 common passwords/email combos
- Session token stolen via XSS → attacker logs in as user
- Refresh token reused (attacker replays old token)
- JWT token expires but user keeps using it

**Mitigation:**
- Rate limiting: 5 failed login attempts → 15 min lockout
- JWT access tokens: 15 min expiry (short-lived)
- Refresh token rotation: single-use, rotated on each use
- Session storage: `HttpOnly, Secure, SameSite=Strict` cookies
- Password hashing: bcrypt cost factor 12 (≈250ms per hash)
- TOTP-based MFA (optional, encouraged)
- Anomaly detection: Flag login from new device/location

#### C. API Authorization
**Threat**: Unauthorized data access, privilege escalation

**Specific Attacks:**
- User A modifies URL `/api/user/123/transactions` → `/api/user/456/transactions`
- Attacker forges JWT token with `"admin": true`
- API key leaked in GitHub → attacker calls endpoints

**Mitigation:**
- **Every endpoint checks user context** (who is making the request?)
- **Verify ownership** before returning data (User 123 can only see User 123's data)
- **JWT signature verification** (RS256, public key pinned)
- **API tokens scoped** by resource type (read-only, write-only, etc.)
- **Token storage**: Never in localStorage, only secure cookies or session storage
- **Token revocation list** (Redis) for leaked/suspicious tokens

#### D. SQL Injection
**Threat**: Database compromise, data exfiltration

**Specific Attacks:**
- Input: `merchant_name = "'; DROP TABLE users; --"`
- Raw SQL: `f"SELECT * FROM users WHERE name = '{merchant_name}'"`
- Result: Database corrupted, data stolen

**Mitigation:**
- **Parameterized queries ONLY** (SQLAlchemy ORM)
- **No string concatenation** of SQL
- **Input validation** via Pydantic models (type-safe)
- **Prepared statements** at database level
- **Example (✓ SAFE)**:
  ```python
  # Using SQLAlchemy ORM (safe)
  session.query(Merchant).filter(Merchant.name == user_input).all()
  ```
- **Example (✗ UNSAFE)**:
  ```python
  # Raw SQL (NEVER do this)
  query = f"SELECT * FROM merchants WHERE name = '{user_input}'"
  ```

#### E. Data Exposure (Logs, Error Messages, Cache)
**Threat**: PII/sensitive data leaked in plaintext

**Specific Attacks:**
- Stack trace logged with full merchant names and amounts
- Error message: `"Failed to parse card: visa ****1234"`
- Cache stores transaction with user ID as key
- Database backup includes unencrypted card data

**Mitigation:**
- **Structured logging** with correlation IDs, no sensitive fields
- **Error messages generic** ("Processing failed" not "Card number invalid")
- **Cache keys hashed** (never store user ID in cache key plaintext)
- **Database backups encrypted** with separate KMS key
- **Log retention**: 90 days, then auto-deleted
- **Example (✓ SAFE LOG)**:
  ```python
  logger.info("transaction_processed", {
    "user_id": hash(user_id),  # Hash, not plaintext
    "category": "Dining",
    "correlation_id": "abc-123"
  })
  ```

#### F. Claude API Data Leakage
**Threat**: Sending too much PII to third-party AI service

**Specific Attacks:**
- Send full merchant string + user ID to Claude → Claude logs it
- Claude service logs retained for 30 days → data exposed if Claude breached
- Attacker requests Claude to retrieve training data from Spendo

**Mitigation:**
- **Minimal data philosophy**: Only merchant name + amount to Claude
- **Never send**: User ID, dates, account info, card details, full addresses
- **Data encryption**: Transactions encrypted end-to-end before sending to Claude
- **Requests anonymized**: User ID hashed, dates omitted
- **Clauses in API contract**: Anthropic agrees not to retain data beyond processing
- **Example (✓ SAFE PAYLOAD)**:
  ```python
  # What we send to Claude:
  {
    "merchant": "SQ *COFFEE SHOP",
    "amount": 45.50
  }
  # What we DON'T send:
  # - User ID, user email, user name
  # - Transaction date
  # - Card details
  # - Full address or location
  ```

#### G. Wallet Extension
**Threat**: Man-in-the-middle, token theft, malicious extension impersonation

**Specific Attacks:**
- User installs malicious "Spendo Wallet" lookalike from Chrome Web Store
- Extension intercepts transactions before sending to backend
- Attacker exfiltrates transaction data to their server
- Extension downgraded to older version with known vulnerabilities

**Mitigation:**
- **Manifest V3 isolated context**: Extension can't access page DOM without permission
- **JWT stored in secure storage**: `chrome.storage.session` (cleared on browser close)
- **WSS only**: Extension communicates over WebSocket Secure (TLS + HMAC)
- **Token pinning**: Extension verifies backend certificate
- **Code signing**: Extension signed by official developer account (hard to spoof)
- **Automatic updates**: Extension auto-updates daily (no old versions)
- **Permissions transparent**: User sees exactly what extension can access
- **User opt-in**: "Install Spendo Wallet?" → user grants camera/location if needed

#### H. Brute Force & Account Takeover
**Threat**: Attacker guesses password, takes over account

**Specific Attacks:**
- Try 100,000 passwords/minute against login endpoint
- Use leaked password database (from other breaches) to try credential stuffing
- Social engineering to reset password

**Mitigation:**
- **Rate limiting**: 5 failed attempts per minute per IP → 15 min lockout
- **Progressive delays**: 1st fail (1s), 2nd (2s), 5th (15 min)
- **Account lockout monitoring**: Alert user if multiple failed attempts
- **Password breach check**: Verify against Have I Been Pwned DB on signup
- **Password rules**: Min 12 chars, must include uppercase/number/symbol
- **MFA mandatory** (TOTP or email-based OTP)
- **Login notifications**: Email user when new device logs in
- **Device fingerprint**: Track browser/device; flag unusual login patterns

### 2.3 Data Classification

| Data Type | Examples | Risk | Storage | Encryption |
|---|---|---|---|---|
| **Public** | Category names, help docs | Low | Cache, CDN | No |
| **Internal** | Aggregated stats, performance logs | Low | Database | Optional |
| **Confidential** | Transaction data, merchant names, amounts | **HIGH** | Encrypted DB | AES-256 at rest |
| **Restricted** | User passwords, API keys, JWT secrets | **CRITICAL** | KMS, HSM | AES-256 + KMS |

---

## 3. Security Controls

### 3.1 Authentication & Authorization

#### Access Control Matrix

| Role | Permissions | Token Type | Expiry |
|---|---|---|---|
| **User** | Read own data, categorize, budget, delete account | JWT access + refresh | 15 min / 7 days |
| **Admin** | All user actions + user support, account recovery | JWT access + refresh | 15 min / 7 days |
| **Service Account** | Parse/classify, API calls (scoped) | OAuth 2.0 token | As configured |
| **Extension** | Read transaction event stream (WebSocket) | JWT access token | 15 min |

#### JWT Token Structure

```json
{
  "header": {
    "alg": "RS256",      // RS256 (asymmetric, not HS256)
    "typ": "JWT",
    "kid": "2024-05-01"  // Key ID for rotation
  },
  "payload": {
    "sub": "user_abc123",                // Subject (user ID)
    "iat": 1714876800,                   // Issued at
    "exp": 1714877700,                   // Expires in 15 min
    "scope": "read:transactions",        // What token grants access to
    "device_id": "fingerprint_hash"      // Device fingerprint
  },
  "signature": "RS256(header.payload, private_key)"
}
```

#### Refresh Token Rotation

```
User logs in
  ↓
Backend issues: access_token (15 min) + refresh_token (7 days)
  ↓
[15 min passes]
  ↓
User calls /auth/refresh with refresh_token
  ↓
Backend verifies refresh_token in Redis whitelist
  ↓
Backend issues: NEW access_token + NEW refresh_token
  ↓
OLD refresh_token marked as used in Redis
  ↓
If OLD token used again → SECURITY ALERT (replay attack)
```

#### MFA Implementation (TOTP)

```
User enables MFA
  ↓
Backend generates secret (base32 encoded)
  ↓
User scans QR code with authenticator app (Google Authenticator, Authy)
  ↓
User confirms with 6-digit code
  ↓
On login:
  ├─ Email + password verified
  ├─ "Enter 6-digit code from authenticator"
  ├─ User enters code
  ├─ Backend verifies with TOTP library
  └─ Access granted
```

### 3.2 Encryption

#### Data at Rest: PostgreSQL

**Database Column Encryption** (AES-256):

```sql
-- Sensitive columns encrypted
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL (encrypted),      -- AES-256
  merchant_name TEXT NOT NULL (encrypted), -- AES-256
  amount DECIMAL NOT NULL (encrypted),     -- AES-256
  category TEXT NOT NULL,                  -- Not sensitive
  created_at TIMESTAMP NOT NULL
);

-- Encryption/Decryption at application layer
-- Before INSERT:
encrypted_merchant = encrypt(merchant_name, encryption_key)

-- After SELECT:
decrypted_merchant = decrypt(encrypted_merchant, encryption_key)
```

**Backup Encryption:**

```
1. Database backup taken (automated daily)
   ↓
2. Backup encrypted with separate KMS key (different from DB key)
   ↓
3. Stored in secure S3 bucket (versioned, MFA delete)
   ↓
4. Key stored in AWS KMS (hardware security module)
   ↓
5. Audit logged (who accessed backup, when)
```

#### Data in Transit: TLS 1.3

**All traffic encrypted:**
- API endpoints: HTTPS (TLS 1.3)
- WebSocket: WSS (WebSocket Secure, TLS 1.3)
- Extension connection: WSS (TLS 1.3)

**HSTS Headers** (Strict-Transport-Security):

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

Tells browser: "Always use HTTPS for this domain for 1 year"

**Certificate Pinning** (for mobile/extension):

```
// Extension stores backend certificate hash
const expectedCertHash = "abc123def456..."

// Before WebSocket connection:
if (certHash !== expectedCertHash) {
  throw new Error("Certificate mismatch - possible MITM attack")
}
```

### 3.3 Input Validation & Sanitization

#### Pydantic Models (Backend Validation)

```python
from pydantic import BaseModel, EmailStr, Field

class TransactionUpload(BaseModel):
    file_content: bytes = Field(..., max_length=50 * 1024 * 1024)  # Max 50MB
    filename: str = Field(..., regex=r'^[a-zA-Z0-9._-]+\.(xlsx|csv|xls)$')
    
    class Config:
        # Reject unknown fields (no extra data)
        extra = 'forbid'
```

#### Input Encoding (Frontend - React)

```typescript
// React auto-escapes by default (no dangerouslySetInnerHTML)
<div>{userInput}</div>  // ✓ SAFE - auto-escaped

// Do NOT do this:
<div dangerouslySetInnerHTML={{__html: userInput}} />  // ✗ DANGEROUS
```

#### OWASP Top 10 Checks

| Vulnerability | Example Attack | Our Mitigation |
|---|---|---|
| **Injection** | SQL injection: `'; DROP TABLE` | Parameterized queries, Pydantic validation |
| **Broken Auth** | Credential stuffing | Rate limiting, account lockout, MFA |
| **Sensitive Data** | Card numbers in logs | Data minimization, encryption, log masking |
| **XSS** | `<script>steal()</script>` | React auto-escape, CSP headers, no eval |
| **CSRF** | Form forgery | SameSite cookies, CSRF tokens |
| **Misc Config** | Debug mode enabled | Hardened prod settings, secrets in KMS |
| **Deserialization** | Pickle payload RCE | Pydantic validation, no pickle |
| **Components** | Outdated vulnerable lib | `pip-audit`, automated CI checks |
| **Logging** | PII in logs | Structured logging, field masking |
| **API** | Missing access control | Every endpoint checks user context |

### 3.4 Audit Logging

**Immutable Audit Log** (PostgreSQL):

```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,  -- "file_uploaded", "data_accessed", "account_deleted"
  resource_type TEXT,    -- "transaction", "budget", "account"
  resource_id UUID,
  details JSONB,         -- Extra context
  ip_address INET,       -- IP that made request
  user_agent TEXT,       -- Browser/client info
  
  -- Tamper evidence
  previous_hash BYTEA,   -- Hash of previous row
  current_hash BYTEA,    -- Hash of this row (chained)
  
  CONSTRAINT audit_immutable CHECK (timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 year')
);
```

**Audit Log Example:**

```json
{
  "timestamp": "2026-05-05T14:23:45Z",
  "user_id": "user_abc123",
  "action": "file_uploaded",
  "resource_type": "transaction_batch",
  "resource_id": "batch_xyz789",
  "details": {
    "filename": "statement_may_2026.xlsx",
    "file_size_bytes": 245000,
    "transaction_count": 89,
    "duration_seconds": 2.5
  },
  "ip_address": "203.0.113.45",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}
```

**Audit Log Access Rules:**
- Users can view their own audit log (for transparency)
- Admins can view audit logs for support/investigations
- Logs cannot be modified/deleted (immutable)
- Logs retained for **7 years** (per financial regulations)

### 3.5 Secrets Management

**AWS Secrets Manager / HashiCorp Vault:**

```
Secrets stored:
├─ Database password
├─ JWT signing key (RSA private key)
├─ API keys (Anthropic, SendGrid, etc.)
├─ Encryption key (for AES-256)
├─ Refresh token signing key
└─ SSL certificates (private key)

Access pattern:
1. Service starts
2. Authenticates to Secrets Manager (via IAM role, not stored creds)
3. Retrieves secret
4. Stores in memory (NOT on disk)
5. Uses for duration of runtime
6. Auto-rotated every 90 days (seamless, no downtime)
```

**Secret Rotation Policy:**

| Secret | Rotation Frequency | Impact | Procedure |
|---|---|---|---|
| Database password | 90 days | Zero downtime | New password configured, old one deprecation period |
| JWT signing key | 90 days | Client refreshes tokens | New key issued, old key still validates for 24h grace period |
| Encryption key | 365 days | Transparent | Old encrypted data can still be decrypted with old key |
| API keys | 180 days | Service restarts | Quick restart to load new key from Secrets Manager |

---

## 4. Compliance & Regulations

### 4.1 GDPR (EU General Data Protection Regulation)

**Applies to**: Any EU resident users

**Key Requirements:**

| Requirement | Implementation |
|---|---|
| **Lawful Basis** | Legitimate interest (user finance management) |
| **Right to Access** | `/api/user/export` endpoint returns all user data as JSON |
| **Right to Erasure** | `/api/user/delete` endpoint purges all data (transactions, budgets, account) |
| **Data Portability** | Export as JSON, CSV (user owns their data) |
| **DPA (Data Processing Agreement)** | Signed with any third parties (Anthropic, hosting provider, etc.) |
| **Privacy Policy** | Clear, accessible, updated annually |
| **Consent** | Explicit opt-in on signup |
| **Breach Notification** | Inform affected users within 72 hours |

**Data Retention Policy:**

```
Active User:
  ├─ Transactions: Kept indefinitely (user's financial history)
  ├─ Budgets: Kept indefinitely
  ├─ Account: Kept while active

Inactive User (no login for 24 months):
  ├─ Soft delete first: Account marked inactive, data hidden
  ├─ 3-month grace period: User can re-activate
  ├─ Hard delete: All data purged if no re-activation
  └─ Audit log entry created with deletion date

Deleted User:
  ├─ Immediate: Account + transactions + budgets deleted
  ├─ Anonymization: Remaining audit log entries anonymized (user_id → hash)
  └─ Retention: Audit logs kept for 7 years (financial compliance)
```

### 4.2 Financial Data Protection

**PCI DSS (Payment Card Industry Data Security Standard):**

**Applies to**: If Spendo processes/stores card data

**Current Status**: ✓ NOT APPLICABLE
- Spendo does NOT store card numbers, CVV, or expiry dates
- Users upload bank statements (CSV/Excel) with merchant data
- No direct card processing

**If future feature adds card processing:**
- Achieve PCI DSS Level 1 compliance
- Use certified payment processor (Stripe, not homegrown)
- Regular security assessments + penetration testing

### 4.3 SOC 2 Type II

**Target**: Achieve by Q3 2026

**Controls Audit:**

| Control Area | Status | Target Date |
|---|---|---|
| **CC (Change Control)** | In progress | June 2026 |
| **SC (System Configuration)** | In progress | June 2026 |
| **A (Access & Authentication)** | In progress | June 2026 |
| **L (Logical & Physical)** | Planned | July 2026 |
| **P (Availability & Resilience)** | Planned | August 2026 |

---

## 5. Incident Response

### 5.1 Incident Classification

| Severity | Definition | Response Time | Examples |
|---|---|---|---|
| **Critical** | Active data breach, RCE, user data exposed | 15 minutes | Ransomware, SQL injection in production, mass account takeover |
| **High** | Vulnerability allowing unauthorized access | 1 hour | Broken auth, missing CSRF token, unencrypted backup |
| **Medium** | Security issue with limited impact | 4 hours | Weak password rules, expired certificate, outdated library |
| **Low** | Minor security concern, no immediate risk | 1 week | Typo in security header, audit log gap, dev environment issue |

### 5.2 Incident Response Procedure

**Step 1: Detect & Report (15 min)**
```
Incident detected
  ↓
Log in incident tracking system (Jira)
  ↓
Notify Security team + CTO (Slack alert)
  ↓
Assess severity (Critical/High/Medium/Low)
```

**Step 2: Containment (1 hour)**
```
Critical incident:
  ├─ Isolate affected system (take offline if necessary)
  ├─ Revoke compromised credentials
  ├─ Increase monitoring/logging
  ├─ Notify legal team
  └─ Prepare for user notification

High incident:
  ├─ Patch deployed within 4 hours
  ├─ Monitoring increased
  └─ Internal notification sent
```

**Step 3: Investigation (ongoing)**
```
Root cause analysis:
  ├─ Collect logs (audit, access, application)
  ├─ Forensics (what data accessed, how)
  ├─ Timeline reconstruction
  └─ Document in incident report
```

**Step 4: Remediation (varies)**
```
Fix the root cause:
  ├─ Patch deployed
  ├─ Configuration corrected
  ├─ Credentials rotated
  └─ Monitoring validated
```

**Step 5: Notification (varies by law)**
```
If user data breach AND high risk:
  ├─ Legal review: Is notification required?
  ├─ Notify affected users within 72h (GDPR)
  ├─ Notify regulators if required
  ├─ Notify credit bureaus (if payment data)
  └─ Post-mortem + public statement
```

**Step 6: Post-Mortem (1 week)**
```
Document lessons learned:
  ├─ What happened?
  ├─ How did we detect it?
  ├─ What failed in our controls?
  ├─ How do we prevent this?
  ├─ Action items + owners
  └─ Timeline for fixes
```

### 5.3 Communication Plan

| Stakeholder | Notification | Timing | Channel |
|---|---|---|---|
| **Users** | Data breach | Within 72h | Email + in-app notification |
| **Regulators** | Data breach | Within 72h | Email to relevant authority |
| **Security community** | 0-day vulnerability | After patch released | Public advisory |
| **Media** | Major breach | Coordinated | Press release |
| **Employees** | All incidents | Immediately | Slack #security channel |

---

## 6. Security Testing & Validation

### 6.1 Testing Strategy

| Test Type | Frequency | Tool | Owner |
|---|---|---|---|
| **Dependency scan** | Every PR | pip-audit, npm audit | Dev team (CI) |
| **Static analysis** | Every PR | Bandit (Python), ESLint | Dev team (CI) |
| **Dynamic testing** | Monthly | OWASP ZAP, Burp Suite | Security team |
| **Penetration test** | Annually | Third-party firm | Security team + CTO |
| **Red team exercise** | Annually | Internal/external | Security team |

### 6.2 Code Security Checklist

**Before every merge to main:**

```markdown
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user input validated (Pydantic models)
- [ ] All SQL parameterized (no string concatenation)
- [ ] HTTPS/WSS only (no plaintext endpoints)
- [ ] CORS configured correctly (not wildcard in prod)
- [ ] CSP headers set
- [ ] CSRF tokens on state-changing endpoints
- [ ] Authentication required on protected endpoints
- [ ] Rate limiting applied (auth, API, file upload)
- [ ] No PII in logs
- [ ] Error messages generic (no sensitive details)
- [ ] Dependencies scanned (pip-audit, npm audit)
- [ ] Tests passing (unit + integration + E2E)
```

---

## 7. Key Metrics & Monitoring

### 7.1 Security KPIs

| KPI | Target | Measurement |
|---|---|---|
| **Mean Time to Detect (MTTD)** | < 1 hour | Incident logs |
| **Mean Time to Remediate (MTTR)** | < 4 hours | Incident logs |
| **Vulnerability fix rate** | 100% critical, 90% high | Git/Jira |
| **Failed login attempts (daily)** | < 100 per system | Auth logs |
| **Failed auth rate** | < 0.1% of total logins | Auth logs |
| **Certificate validity** | 100% (no expired certs) | Certificate monitoring |
| **Encryption key rotation** | On schedule (90/365 days) | Secrets Manager audit |
| **Audit log completeness** | 100% (no gaps) | Audit log analysis |

### 7.2 Security Monitoring Alerts

**Real-time alerts:**

```
IF failed_login_count > 5 in 1 minute per user
  THEN lock account + notify user

IF database_connection_outside_IP_whitelist
  THEN alert security team + block connection

IF api_response_time > 5 seconds
  THEN investigate (possible DoS attack)

IF certificate_expiry < 30 days
  THEN alert ops team

IF unauthorized_file_access
  THEN security event + log + investigate

IF token_reuse_detected
  THEN revoke token + security alert

IF large_data_export (> 10MB in 1 min)
  THEN ask user to confirm + log
```

---

## 8. Vendor & Third-Party Security

### 8.1 Third-Party Risk Assessment

| Vendor | Service | Data Shared | Assessment | Status |
|---|---|---|---|---|
| **Anthropic** | Claude API | Merchant name + amount (anonymized) | APPROVED | ✓ Active |
| **AWS** | Infrastructure, S3, RDS | Encrypted data | APPROVED | ✓ Active |
| **SendGrid** | Email delivery | User email + template (no PII) | APPROVED | ✓ Active |
| **Twilio** | SMS (if MFA) | Phone number only | APPROVED | ✓ Planned |

### 8.2 Vendor Contract Requirements

**All vendors must agree to:**

1. **Data Processing Agreement (DPA)**
   - How they process data
   - Data retention policy
   - Deletion on termination

2. **Security Requirements**
   - ISO 27001 certification OR SOC 2 audit
   - Encryption at rest & in transit
   - Regular security assessments

3. **Breach Notification**
   - Notify within 24 hours of breach discovery
   - Cooperate with investigation
   - Provide forensics data

4. **Compliance**
   - GDPR compliance
   - No sub-processors without approval
   - Audit rights (we can audit them)

---

## 9. Security Roadmap

### Q2 2026 (Now - June)
- [ ] Implement all core controls (auth, encryption, audit logging)
- [ ] Pass internal security review
- [ ] Dependency audit in CI/CD
- [ ] GDPR privacy policy finalized
- [ ] User policy documentation complete

### Q3 2026 (July - September)
- [ ] SOC 2 Type II audit kickoff
- [ ] Third-party penetration test
- [ ] Security training for team
- [ ] Incident response plan tested
- [ ] Backup & disaster recovery tested

### Q4 2026 (Oct - Dec)
- [ ] SOC 2 Type II certification achieved
- [ ] Red team exercise
- [ ] Bug bounty program launch
- [ ] Annual security review
- [ ] Next year's security roadmap

---

## 10. Appendix: Security Configuration

### A. Environment Variables (.env)

```bash
# Database (encrypted at rest)
DATABASE_URL=postgresql://user:pass@host/spendo
DATABASE_ENCRYPTION_KEY=<from KMS>

# JWT signing (RSA private key)
JWT_PRIVATE_KEY=<from Secrets Manager>
JWT_PUBLIC_KEY=<from Secrets Manager>
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Encryption
ENCRYPTION_KEY=<from KMS>  # AES-256 key

# Rate limiting
RATE_LIMIT_LOGIN_ATTEMPTS=5
RATE_LIMIT_LOGIN_WINDOW_MINUTES=1
RATE_LIMIT_API_REQUESTS=1000 per hour

# Security headers
CORS_ALLOWED_ORIGINS=https://app.spendo.com
CSRF_TOKEN_LENGTH=32

# Logging
LOG_LEVEL=INFO
AUDIT_LOG_RETENTION_DAYS=2555  # 7 years

# External services
ANTHROPIC_API_KEY=<from KMS>
SENDGRID_API_KEY=<from KMS>
```

### B. Security Headers (All Responses)

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### C. Database Security

```sql
-- Role: minimal permissions
CREATE ROLE parser_service WITH ENCRYPTED PASSWORD '<strong_password>';
GRANT USAGE ON SCHEMA public TO parser_service;
GRANT SELECT, INSERT ON transactions TO parser_service;
-- DENY: UPDATE, DELETE, ALTER (parser can only add data)

-- Backups encrypted
pg_dump --format=custom --file=backup.dump spendo
# Then encrypt with:
openssl enc -aes-256-cbc -in backup.dump -out backup.dump.enc

-- SSL enforcement
-- postgresql.conf:
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
```

---

## 11. Document Control

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | May 5, 2026 | [SECURITY] | Initial draft |
| TBD | TBD | [SECURITY] | Post-review updates |

---

**Document Classification:** CONFIDENTIAL  
**Next Review Date:** August 5, 2026  
**Owner:** Security & Compliance Team
