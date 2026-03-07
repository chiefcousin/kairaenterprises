---
name: vercel-supabase-deploy
description: This skill should be used when the user asks to "deploy to Vercel", "deploy my app", "push to production", "set up Vercel", "configure Supabase for production", "deploy Next.js", or mentions "Vercel deployment", "production deploy", "go live", "launch my app", or "ship to Vercel".
version: 0.1.0
tools: Bash, Read, Glob, Edit
---

# Vercel + Supabase Deployment

Deploy a Next.js 14 App Router project with Supabase to Vercel. Handle first-time deployments and redeployments. Cover Supabase project setup, schema migration, environment variable injection, Vercel project linking, and post-deploy verification.

---

## Phase 1: Pre-flight Checks

### 1.1 Detect operating system and shell

Note the current shell. On Windows, Vercel CLI and Supabase CLI accept the same commands in bash (Git Bash, WSL) and PowerShell. Proceed with bash-compatible commands. If the user is in PowerShell, note flag differences where they arise (e.g., `$env:VAR` vs `export VAR=`).

### 1.2 Verify required tools are installed

Run each check and report what is missing before proceeding:

```bash
vercel --version
supabase --version
git --version
node --version && npm --version
```

If Vercel CLI is missing:

```bash
npm install -g vercel
```

If Supabase CLI is missing, install via the appropriate method for the OS:

```bash
# macOS / Linux
brew install supabase/tap/supabase

# Windows (winget)
winget install Supabase.CLI

# Cross-platform fallback
npm install -g supabase
```

### 1.3 Confirm git state

```bash
git status --short
git log --oneline -5
git remote -v
```

If the working tree is dirty, warn the user. Recommend committing or stashing before deploying so the live code matches the repository. Confirm a remote named `origin` exists and points to GitHub.

### 1.4 Detect project framework

Confirm `next.config.mjs` (or `next.config.js`) and `package.json` both exist. Read `package.json` and verify the `next` dependency is present. Confirm `vercel.json` exists and contains `"framework": "nextjs"`.

### 1.5 Confirm required config files exist

Before continuing, verify these files are present:

- `supabase/schema.sql` — database schema, RLS policies, and storage setup
- `vercel.json` — Vercel build configuration
- `middleware.ts` — Supabase SSR auth guard
- `next.config.mjs` — image remote patterns for Supabase Storage
- `.env.example` — environment variable reference template

Abort with a clear error message if any critical file is missing.

---

## Phase 2: Supabase Setup

### 2.1 Authenticate with Supabase

Check whether the user is already logged in:

```bash
supabase projects list
```

If the command fails or returns an auth error, prompt login:

```bash
supabase login
```

This opens a browser to generate an access token. Wait for the user to confirm login succeeded before continuing.

### 2.2 Determine: new project or existing project

Ask the user: "Do you have an existing Supabase project for this app, or do you need to create a new one?"

**If creating a new project:**

Instruct the user to open https://supabase.com/dashboard and:

1. Click "New Project"
2. Choose an organization
3. Name the project (match the repo name, e.g., `toybox`)
4. Set a strong database password — save it immediately, it cannot be recovered
5. Select the region closest to the Vercel deployment region (`us-east-1` / N. Virginia aligns with Vercel `iad1`; `eu-west-1` aligns with `fra1`)
6. Wait approximately 2 minutes for provisioning to complete

**If using an existing project:**

```bash
supabase projects list
```

Note the `Reference ID` (20-character string, e.g., `abcdefghijklmnopqrst`).

### 2.3 Link the local project to Supabase

Run from the project root:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Enter the database password when prompted. This creates `supabase/.temp/` with the linked project config. Confirm success with:

```bash
supabase status
```

### 2.4 Retrieve API credentials

Navigate to the linked Supabase project in the Dashboard → Settings → API. Retrieve and record all three values:

| Variable | Location |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (e.g., `https://abcdefgh.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key (starts with `eyJ`) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (starts with `eyJ`) — keep secret |

Alternatively, after linking, the CLI shows these values:

```bash
supabase status
```

### 2.5 Apply the database schema

Determine whether the database is fresh (no tables) or already has the schema applied.

**For a fresh database**, apply the schema. Two options:

Option A — Supabase Dashboard SQL Editor (recommended for first-time):
Read the contents of `supabase/schema.sql` and instruct the user to paste and run it in the SQL Editor in the Dashboard.

Option B — CLI (if `supabase db execute` is available):

```bash
supabase db execute --file supabase/schema.sql
```

If the project uses a migrations directory (`supabase/migrations/`), use:

```bash
supabase db push
```

**For an existing database**, skip this step unless the schema has changed. If tables already exist, `CREATE TABLE` statements will produce "already exists" errors — this is safe and expected.

Verify the schema was applied by confirming these six tables exist in Dashboard → Table Editor:
`categories`, `products`, `product_images`, `whatsapp_orders`, `product_views`, `store_settings`

### 2.6 Verify Supabase Storage bucket

Navigate to Dashboard → Storage. Confirm the `product-images` bucket exists and is marked as **Public**.

If the bucket is missing, run in the SQL Editor:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO NOTHING;
```

Then confirm the four storage RLS policies for `product-images` are present (public SELECT, authenticated INSERT/UPDATE/DELETE). These are included at the bottom of `supabase/schema.sql`.

---

## Phase 3: Vercel Setup

### 3.1 Authenticate with Vercel

```bash
vercel whoami
```

If not authenticated:

```bash
vercel login
```

Choose GitHub login (recommended — enables automatic deploy triggers on push). This opens a browser tab.

### 3.2 Link the project to Vercel

**First-time deployment** — run from the project root:

```bash
vercel
```

Answer the interactive prompts:
- "Set up and deploy?" → Y
- "Which scope?" → select the correct team or personal account
- "Link to existing project?" → N (new project) or Y (if already created on Vercel Dashboard)
- "Project name?" → match the repo name (e.g., `toybox`)
- "In which directory is your code located?" → `./`
- Vercel auto-detects Next.js — confirm the framework detection

This creates `.vercel/project.json` with the org and project IDs.

**Relinking an existing project:**

```bash
vercel link
```

Select the existing project from the list.

### 3.3 Set environment variables

Set all three required variables for both `production` and `preview` environments. The CLI prompts interactively for each value (preventing secrets from appearing in shell history):

```bash
# Production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Preview (branch deploys)
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
```

Paste each value carefully — no leading or trailing spaces.

Verify all variables are set:

```bash
vercel env ls
```

Confirm all three appear under both `production` and `preview`. If a variable needs updating:

```bash
vercel env rm VARIABLE_NAME production
vercel env add VARIABLE_NAME production
```

### 3.4 Validate vercel.json

Read `vercel.json` and confirm it contains:

```json
{
  "buildCommand": "next build",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

The `iad1` region (US East, N. Virginia) aligns with Supabase's `us-east-1` region to minimize latency on server components and middleware that make synchronous Supabase Auth calls. If the user's Supabase project is in a different region, note the mismatch and suggest updating `regions` (e.g., `"fra1"` for Frankfurt / EU West).

---

## Phase 4: Deploy

### 4.1 Commit any pending changes

```bash
git status --short
```

If there are uncommitted changes that should be deployed:

```bash
git add -A
git commit -m "chore: prepare for production deployment"
git push origin main
```

### 4.2 Run the production deployment

**Direct deploy** (deploys current local code):

```bash
vercel --prod
```

Vercel outputs a deployment URL like `https://toybox-abc123.vercel.app` and eventually the production alias.

**GitHub-triggered deploy** (recommended for teams — deploys the pushed commit):

```bash
git push origin main
```

Monitor progress at https://vercel.com/dashboard.

### 4.3 Handle common build errors

Watch the build log for these patterns and apply the corresponding fix:

**TypeScript errors**: Run `npm run build` locally to reproduce. Fix type errors before redeploying — do not disable type checking in `tsconfig.json` or `next.config.mjs` as a shortcut.

**Missing environment variables** (build log shows `undefined` for `NEXT_PUBLIC_SUPABASE_URL`): Re-run Phase 3.3 to set vars. Trigger a fresh deploy afterward — env vars set after a deploy do not apply to it retroactively.

**Module not found**: Run `npm install` locally, commit the updated `package-lock.json`, and redeploy.

**`next.config.mjs` ESM parse error**: Ensure the config file uses `export default` syntax, not `module.exports`.

**Build passes locally but fails on Vercel**: Usually caused by missing env vars or a dependency not listed in `package.json`. Run `vercel env ls` to verify, and check `package.json` for `devDependencies` that should be in `dependencies`.

---

## Phase 5: Post-Deploy Verification

### 5.1 Confirm the deployment URL is live

Once Vercel reports "Production: https://..." open the URL. The homepage should render.

Check the HTTP status:

```bash
curl -s -o /dev/null -w "%{http_code}" https://YOUR_APP.vercel.app
```

Expect `200`. Any `5xx` response means a runtime crash — check Vercel function logs immediately.

### 5.2 Check Vercel runtime logs

```bash
vercel logs --prod
```

Look for Supabase connection errors:

- `Invalid API key` → `SUPABASE_SERVICE_ROLE_KEY` is wrong or missing
- `relation "products" does not exist` → schema was not applied (repeat Phase 2.5)
- `JWT expired` or `invalid JWT` → anon key is malformed; re-copy from Supabase Dashboard

### 5.3 Verify Supabase connection in the browser

Open the production URL in a browser. Open DevTools → Network tab. Filter requests for `supabase.co`. Confirm they return `200` responses, not:

- `401` — bad or missing API key
- `CORS error` — check `NEXT_PUBLIC_SUPABASE_URL` has no trailing slash

### 5.4 Test admin authentication flow

Navigate to `https://YOUR_APP.vercel.app/admin`. The middleware at `middleware.ts` should redirect unauthenticated users to `/admin/login`. Sign in with Supabase Auth credentials. Confirm redirect to the admin dashboard.

If `/admin/login` returns a 404, the route was not included in the build — check Vercel build output for missing pages.

If auth redirects loop infinitely, `NEXT_PUBLIC_SUPABASE_ANON_KEY` is likely wrong — the session cookie cannot be set without a valid anon key.

### 5.5 Verify Supabase Storage image loading

If products with images exist, confirm images render on the storefront. The `next.config.mjs` should already allow `*.supabase.co` as a remote image hostname:

```js
{
  protocol: "https",
  hostname: "*.supabase.co",
  pathname: "/storage/v1/object/public/**",
}
```

If images return a `400` or fail to load with a hostname error, confirm this pattern exists in `next.config.mjs`. If images return a `403`, confirm the `product-images` bucket is set to **Public** in Supabase → Storage.

### 5.6 Print deployment summary

Output a summary to the user:

```
Deployment complete.

Production URL:   https://YOUR_APP.vercel.app
Admin panel:      https://YOUR_APP.vercel.app/admin/login
Supabase project: https://supabase.com/dashboard/project/YOUR_PROJECT_REF
Vercel dashboard: https://vercel.com/dashboard

Recommended next steps:
- Add an admin user: Supabase Dashboard → Authentication → Users → Invite user
- Add products via the admin panel at /admin
- Configure WhatsApp number in admin Settings
- Set a custom domain: Vercel Dashboard → Project → Settings → Domains
```

---

## Redeployment (Subsequent Deploys)

When redeploying after code changes:

1. Verify env vars are still set: `vercel env ls`
2. Confirm `vercel.json` is unchanged
3. Push to GitHub (triggers auto-deploy) or run `vercel --prod`
4. Monitor at https://vercel.com/dashboard

For environment variable changes only (no code change):

```bash
vercel env rm VARIABLE_NAME production
vercel env add VARIABLE_NAME production
vercel redeploy --prod
```

---

## References

See the `references/` subdirectory for detailed documentation:

- `references/env-vars.md` — full environment variable reference with where to find each value
- `references/supabase-cli.md` — complete Supabase CLI command reference
- `references/vercel-cli.md` — Vercel CLI flags and options reference
- `references/troubleshooting.md` — expanded error catalog with phase, cause, and fix
