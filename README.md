# GreCyberSec

The public website for GreCyberSec, the Cybersecurity Society at the University of Greenwich. It presents the society, workshops, events, CTF activities, projects, committee roles and resources.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- ESLint
- Supabase Auth email/password authentication using `@supabase/ssr` cookie sessions
- Static TypeScript content; no custom database tables, social login, courses or admin dashboard

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

Copy `.env.example` to `.env.local` and set the following values from the Supabase project Connect dialog:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Values prefixed `NEXT_PUBLIC_` are visible to browsers and must never be secrets. The publishable key is safe for this purpose; a service-role or secret key must never be added to the project.

In Supabase, enable Email authentication and enable **Confirm email**. Under **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` for local development and add `http://localhost:3000/**` to Redirect URLs. For production, set the Site URL and an exact Redirect URL to the deployed HTTPS domain.

For the server-side token flow, update the templates under **Authentication → Email Templates**. During local development, a successful email confirmation redirects to `http://localhost:3000/auth/confirmed`:

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm email address</a>

<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

Never commit `.env.local`, API keys, tokens, passwords or service-role credentials.

## Architecture and security

The site is mostly Server Components with a small client component only for contact-form status. Content is static in `lib/site-data.ts`, keeping the attack surface small. Supabase Auth is used only for email/password identity management; passwords are never stored or hashed by this application.

`lib/supabase/client.ts` and `lib/supabase/server.ts` create browser and server clients with `@supabase/ssr`. `proxy.ts` refreshes cookie sessions with `getClaims()`. The `/dashboard` page independently validates claims server-side, and the confirmation route accepts only Supabase `email` and `recovery` token types before redirecting to fixed internal paths.

The contact form validates all fields in a server action, enforces length limits, uses a honeypot field and never stores or sends submissions. It is intentionally a validation-only demonstration until an approved contact delivery service and rate-limiting approach are in place.

`next.config.ts` applies a CSP, HSTS, clickjacking protections, `nosniff`, a restrictive referrer policy and a restrictive permissions policy. The CSP permits only same-origin scripts, styles and connections; it includes no third-party hosts or unsafe CSP exceptions. Revisit it before adding integrations, analytics, fonts or images.

## Deployment

The project is compatible with Vercel. Connect the GitHub repository, supply `NEXT_PUBLIC_SITE_URL` in the deployment configuration if required, and deploy using the build command `npm run build`.

For Cloudflare, point DNS to the deployment, enforce HTTPS/TLS, use a managed WAF and rate limits where appropriate, and review caching rules after deployment. Cloudflare complements but does not replace secure application code.

## Future data and access control

If persistent events or member administration becomes necessary, use Supabase/PostgreSQL with Row Level Security and least-privilege roles. An admin area must use server-side authorisation checks, CSRF-aware state changes, rate limits and preferably MFA. Do not expose a service-role key to the client.

## Contributing

Create focused changes, keep dependencies minimal, run the checks above and do not include personal data or secrets. Review each feature for user-controlled input, trust boundaries, authorisation and abuse cases before merging.
