# Environment Variable Reference

This document describes every environment variable required by a Next.js + Supabase app deployed to Vercel. Set all variables in both the `production` and `preview` Vercel environments.

---

## Required Variables

### `NEXT_PUBLIC_SUPABASE_URL`

| Property | Value |
|---|---|
| **Where to find it** | Supabase Dashboard → Project → Settings → API → Project URL |
| **Example value** | `https://abcdefghijklmnop.supabase.co` |
| **Visibility** | Public — safe to expose in browser bundles (prefixed with `NEXT_PUBLIC_`) |
| **Format** | Must begin with `https://`. Must NOT have a trailing slash. |
| **Used by** | Browser Supabase client (`lib/supabase/client.ts`), Server Supabase client (`lib/supabase/server.ts`), middleware (`middleware.ts`) |
| **What breaks if wrong** | All Supabase requests fail with network errors or CORS errors. The entire app breaks. |

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

| Property | Value |
|---|---|
| **Where to find it** | Supabase Dashboard → Project → Settings → API → Project API Keys → anon / public |
| **Example value** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...` |
| **Visibility** | Public — safe to expose in browser bundles. Row Level Security (RLS) enforces access control. |
| **Format** | Long JWT string starting with `eyJ`. No spaces. |
| **Used by** | Browser Supabase client (`lib/supabase/client.ts`), SSR client in middleware and server components |
| **What breaks if wrong** | Auth sign-in fails. Middleware cannot set session cookies → infinite redirect loop on `/admin`. Public data reads may also fail if RLS policies require a valid JWT. |

### `SUPABASE_SERVICE_ROLE_KEY`

| Property | Value |
|---|---|
| **Where to find it** | Supabase Dashboard → Project → Settings → API → Project API Keys → service_role |
| **Example value** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...` (different from anon key) |
| **Visibility** | **Secret — never expose in browser bundles.** Never commit to git. Only used in server-side code. |
| **Format** | Long JWT string starting with `eyJ`. No spaces. |
| **Used by** | Admin Supabase client only (`lib/supabase/admin.ts`) — bypasses Row Level Security |
| **What breaks if wrong** | Admin operations fail (product CRUD, order management, file uploads via API routes). Regular user-facing pages are unaffected. |

---

## How Vercel Handles These Variables

### `NEXT_PUBLIC_` prefix behaviour

Variables prefixed with `NEXT_PUBLIC_` are inlined into client-side JavaScript bundles at build time by Next.js. They are visible to anyone who inspects the browser bundle. This is intentional for `SUPABASE_URL` and `SUPABASE_ANON_KEY` because Supabase Row Level Security is the access control layer.

Variables WITHOUT the `NEXT_PUBLIC_` prefix (like `SUPABASE_SERVICE_ROLE_KEY`) are available only during server-side rendering, API routes, and Server Actions. They are never sent to the browser.

### Setting variables in Vercel

Set each variable for each environment:

```bash
# For production deployments (main branch)
vercel env add VARIABLE_NAME production

# For preview deployments (feature branches, PRs)
vercel env add VARIABLE_NAME preview

# For local development via `vercel dev`
vercel env add VARIABLE_NAME development
```

To use Vercel environment variables locally (pulls them into `.env.local`):

```bash
vercel env pull .env.local
```

**Do not commit `.env.local` to git.** It is already in `.gitignore`.

---

## Local Development

For local development, copy `.env.example` to `.env.local` and fill in real values:

```bash
cp .env.example .env.local
```

The `.env.local` file takes precedence over all other `.env` files in Next.js and is never committed to git.

Do not create `.env.production` — use `vercel env add` for production values to keep secrets out of the repository.

---

## Checking Variable Values at Runtime

To confirm which values Vercel has in the current environment, list them:

```bash
vercel env ls
```

To inspect the value of a specific variable (output is masked for secrets):

```bash
vercel env get SUPABASE_SERVICE_ROLE_KEY production
```

To update a value, remove the old one first then re-add:

```bash
vercel env rm SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

After changing environment variables, a new deployment is required for the changes to take effect. Trigger one with:

```bash
vercel redeploy --prod
```
