# Security – Admin Dashboard & API

This document describes security measures in place and what you must do in production.

---

## In place

### Authentication

- **Admin**: Session cookie with `httpOnly`, `secure` (in production), `sameSite: lax`, 7-day `maxAge`. Admin session is cookie-based only (no Bearer from the dashboard).
- **Fielder (API)**: Bearer token signed with HMAC-SHA256. Token contains role and `fielderName`; all fielder APIs filter data by that identity.
- **Session secret**: Fielder tokens are signed with `SESSION_SECRET` or `AUTH_SECRET`. If either is set in production, the default is not used. **You must set one of these in production.**

### Login protection

- **Rate limiting**: Login endpoint is limited to **5 attempts per IP per 15 minutes**. Uses in-memory state (resets on restart). For multi-instance deployments, use a shared store (e.g. Redis/Upstash) and implement rate limiting there.
- **CSRF**: Web login form requires a CSRF token. The token is set in a cookie when the login page is loaded and must be sent in the form body; the server rejects form POSTs without a valid token. JSON login (fielder app) does not use cookies for session, so CSRF is not required for that path.
- **Passwords**: Fielder passwords hashed with bcrypt before storage.

### HTTP and headers

- **Security headers** (via `next.config.ts`): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restricting camera/microphone/geolocation, and **Content-Security-Policy** (default-src 'self', script/style/img/font/connect scoped, frame-ancestors 'none', form-action 'self'). If you add third-party scripts or analytics, you may need to relax `script-src` and `connect-src` in `next.config.ts`.
- **HTTPS**: In production, set cookies with `secure: true`. Serve the dashboard and API over HTTPS only.

### API and data

- **Parameterized queries**: All database access uses parameterized queries (no raw string concatenation for user input).
- **Fielder data scope**: Every fielder API uses `session.fielderName` to return or modify only that fielder’s data (assignments, earnings, notifications, project access).

### Audit

- **Audit log**: Sensitive actions (e.g. project/assignment/payment changes) are written to `audit_log` with actor and details.

---

## You must do in production

1. **Set `SESSION_SECRET` or `AUTH_SECRET`**  
   Strong random value (e.g. 32+ bytes). Used to sign fielder tokens. If unset in production, a warning is logged.

2. **Use strong admin credentials**  
   `ADMIN_EMAIL` and `ADMIN_PASSWORD` must be strong and unique. Never commit them.

3. **HTTPS only**  
   Run the dashboard and API behind HTTPS (e.g. reverse proxy or host that terminates TLS). Do not serve the app over plain HTTP in production.

4. **Database**  
   Restrict DB access (network, user permissions). Use a dedicated DB user with minimal required privileges. Prefer connection over TLS if the provider supports it.

5. **Environment variables**  
   Keep `.env` out of version control. Use your host’s secret management or inject env at runtime. Do not log secrets or tokens.

6. **Rate limiting at scale**  
   The built-in login rate limit is in-memory. For multiple instances or high traffic, add an external rate limiter (e.g. Redis/Upstash) and/or a WAF.

7. **Backups**  
   Back up the database and any critical state regularly. Test restore.

---

## Fielder app security

See **fielder-app/SECURITY.md** for token storage, HTTPS enforcement, and app-side measures.
