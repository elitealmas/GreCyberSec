# GreCyberSec

The public website for GreCyberSec, the Cybersecurity Society at the University of Greenwich. It presents the society, events, projects, committee roles and resources.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- ESLint
- Supabase Auth email/password authentication using `@supabase/ssr` cookie sessions
- Supabase-backed member learning system with RLS-protected progress and quizzes

## Local development

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Before a release, run:

```bash
npm run lint
npm run typecheck
npm run build
npm audit
```

## Environment variables

Copy `.env.example` to `.env.local`. The event flow reuses the existing Supabase, Turnstile and Resend projects:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
SUPABASE_EVENT_WORKER_JWT=
RESEND_API_KEY=
EVENT_EMAIL_FROM=
PRIVACY_CONTACT_EMAIL=
CRON_SECRET=
```

Values prefixed `NEXT_PUBLIC_` are visible to browsers and must never contain secrets. Keep the restricted Supabase worker JWT, Turnstile secret, Resend key and cron secret in server-only local or Vercel environment settings. Never commit them or pass them to browser components. Production deliberately refuses a Supabase service-role or secret key for the public forms.

In Supabase, enable Email authentication and enable **Confirm email**. Under **Authentication → URL Configuration**, use the public production URL as the Site URL and allow the exact `/auth/confirm` callback URL for each environment. For example, add `http://localhost:3000/auth/confirm` for local development and `https://www.grecybersec.co.uk/auth/confirm` for production.

For authentication emails, do not hard-code `/auth/confirmed` in any Supabase template. The application supplies the correct callback as `RedirectTo`: signup uses `/auth/confirm` and password recovery uses `/auth/confirm?next=recovery`.

The standard Supabase email templates work with this application and are the recommended option. The link opens a no-store confirmation page; the token is consumed only after the person presses the button, so mail scanners cannot use it with a background GET request:

```html
<!-- Confirm signup -->
<a href="{{ .ConfirmationURL }}">Confirm email address</a>

<!-- Reset password -->
<a href="{{ .ConfirmationURL }}">Reset password</a>
```

If you intentionally use the alternative server-side token-hash template flow, use these URLs instead. Do not mix the two template styles:

```html
<!-- Confirm signup -->
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirm email address</a>

<!-- Reset password -->
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

Never commit `.env.local`, API keys, tokens, passwords or service-role credentials.

## Turnstile registration protection

Registration, login, password reset, event registration and private contact use Cloudflare Turnstile. In the Cloudflare dashboard, add `localhost` to the widget's allowed hostnames for local development and add the production hostname before deployment. Put the widget site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and its secret key in `TURNSTILE_SECRET_KEY`; the latter is sent only from the server to Cloudflare's Siteverify endpoint and must never use a `NEXT_PUBLIC_` name. The server validates both the Turnstile action and expected hostname before consuming an application rate-limit bucket.

## Learning system migrations

The member learning area needs all four migrations, in filename order, before visiting `/courses`:

```bash
supabase db push
```

Or, in **Supabase Dashboard → SQL Editor**, run these files in order:

1. `supabase/migrations/20260816190000_create_learning_system.sql`
2. `supabase/migrations/20260827110000_replace_sample_courses_with_networking_course.sql`
3. `supabase/migrations/20260828210000_require_published_course_for_quiz_attempts.sql`
4. `supabase/migrations/20261030121000_quiz_security_hardening.sql`

The second migration removes only the three disposable sample courses and their dependent sample progress and quiz attempts; it never deletes `auth.users` or unrelated course data. It creates the production **Networking for Cybersecurity** course, module quizzes, safe Markdown lesson content, course metadata and post-submission quiz feedback. The third migration prevents scoring an unpublished course. The fourth bounds answer payloads and enforces a per-member cooldown plus hourly and daily attempt quotas inside the database, including for direct RPC calls.

The migrations give authenticated members read-only access to published content and limit lesson progress, attempts and answers to their own `auth.users.id`. MCQ answer keys (and feedback explanations) are stored in a private table and are scored inside the database function, so correct answers and client-supplied scores are never trusted. Written responses are stored for review; they are never executed by the application.

## Architecture and security

The site uses Server Components for its public content and small client components only where browser interaction is necessary. Public content is static in `lib/site-data.ts`, keeping the attack surface small. Supabase Auth is used only for email/password identity management; passwords are never stored or hashed by this application.

`lib/supabase/server.ts` creates the server client with `@supabase/ssr`; authentication is not exposed through a browser Supabase client. `proxy.ts` refreshes HttpOnly, Secure, SameSite=Lax cookie sessions with `getClaims()` and redirects unauthenticated requests for member routes before those routes render. Member pages independently validate claims server-side as defence in depth. The confirmation page accepts only Supabase `email` and `recovery` token types, consumes them only through a user-initiated POST, and redirects to fixed internal paths. Password-reset requests include an allow-listed `next=recovery` intent so both PKCE and token-hash callbacks reach `/update-password`.

The contact page keeps the GreCyberSec WhatsApp QR community channel for non-sensitive discussion and clearly labels it as public. Account, privacy and photography requests use a Turnstile-protected private form that emails `PRIVACY_CONTACT_EMAIL`; the application does not store those messages in its database.

`next.config.ts` applies HSTS, clickjacking protections, `nosniff`, a restrictive referrer policy and a restrictive permissions policy. `proxy.ts` applies a per-request nonce-based CSP in production, with the explicit Cloudflare Turnstile host allowed for its script, frame and connection. Revisit it before adding integrations, analytics, fonts or images.

## Deployment

The project is compatible with Vercel. Connect the GitHub repository, set `NEXT_PUBLIC_SITE_URL=https://www.grecybersec.co.uk` in the Production environment, and deploy using the build command `npm run build`.

For Cloudflare, point DNS to the deployment, enable Always Use HTTPS, set **Minimum TLS Version** to **TLS 1.2**, use a managed WAF and rate limits where appropriate, and review caching rules after deployment. Cloudflare complements but does not replace secure application code.

## Beyond the Firewall registration

The site contains one event-specific flow for **Thursday 29 October 2026, 2:00–4:00 PM Europe/London**. The listing, event page, registration action and verification action all check the event end time on the server, so registration closes even if maintenance has not run.

The form collects only full name, email and an explicit Yes or No photography preference. It verifies Cloudflare Turnstile on the server, rate-limits requests in Supabase, stores only a hash of each random verification token, and requires a user-initiated confirmation POST. Verified attendees receive a Resend confirmation with Google, Outlook and ICS calendar links. Duplicate and resend responses do not reveal whether an address is registered.

Run the read-only checks in [`docs/event-registration-deployment.md`](docs/event-registration-deployment.md), then apply [`supabase/migrations/20261021090000_event_registration.sql`](supabase/migrations/20261021090000_event_registration.sql) followed by [`supabase/migrations/20261030120000_security_hardening.sql`](supabase/migrations/20261030120000_security_hardening.sql). Both are transactional and rerunnable. They preserve existing rows, keep the private schema behind RLS, make duplicate submissions immutable, and grant only the required RPCs to the non-login `gcs_event_worker` role.

The existing daily Vercel cron calls `/api/cron/event-maintenance` with `CRON_SECRET`. Cleanup is fixed to this event and permanently deletes its registration and photography data seven days after it ends. Expired pending tokens are invalidated sooner. The job is idempotent and does not delete other events.

Required production settings are `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `SUPABASE_EVENT_WORKER_JWT`, `RESEND_API_KEY`, `EVENT_EMAIL_FROM`, `PRIVACY_CONTACT_EMAIL`, and `CRON_SECRET`. The worker JWT must have `role: gcs_event_worker` and a future `exp`, be signed by a key trusted by the Supabase project, and be used with the publishable key. Rotate it periodically and remove `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` from Vercel after verification. See [Supabase JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys) for minting a custom bearer JWT. `TURNSTILE_EXPECTED_HOSTNAME`, `CONTACT_EMAIL_FROM`, `EVENT_ORGANISER_NAME`, `EVENT_PRIVACY_CONTACT`, `EVENT_VERIFICATION_MINUTES`, and `EVENT_SECURITY_KEY` are optional.

Automated tests use mocked HTTP and Supabase boundaries plus an isolated PGlite database. They do not send email or touch the live database. Verify one full registration with test attendee data after applying the migration and deploying.

Pull requests and `main` pushes run dependency auditing, linting, type checking, database/action tests and a production build through `.github/workflows/security-ci.yml`.

## Contributing

Create focused changes, keep dependencies minimal, run the checks above and do not include personal data or secrets. Review each feature for user-controlled input, trust boundaries, authorisation and abuse cases before merging.
