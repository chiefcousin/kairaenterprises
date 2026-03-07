# Troubleshooting Reference

Error catalog for Vercel + Supabase deployments, organized by phase. Each entry includes the symptom, likely cause, and the fix.

---

## Phase 1: Pre-flight

### `vercel: command not found` / `'vercel' is not recognized`

**Cause:** Vercel CLI not installed, or npm global bin directory not in PATH.

**Fix:**
```bash
npm install -g vercel

# If still not found, check npm global bin path
npm config get prefix
# Add <prefix>/bin to your PATH (Linux/macOS) or <prefix> to PATH (Windows)
```

### `supabase: command not found`

**Cause:** Supabase CLI not installed.

**Fix:**
```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows
winget install Supabase.CLI

# Cross-platform
npm install -g supabase
```

### `git: command not found`

**Cause:** Git not installed.

**Fix:** Download and install from https://git-scm.com. On Windows, install Git for Windows which includes Git Bash.

### `fatal: not a git repository`

**Cause:** Running commands outside the project root, or git was not initialized.

**Fix:**
```bash
git init
git remote add origin https://github.com/YOUR_ORG/YOUR_REPO.git
```

---

## Phase 2: Supabase Setup

### `supabase projects list` returns auth error or empty

**Cause:** Not logged in to Supabase CLI.

**Fix:**
```bash
supabase login
```

### `supabase link` fails with "Invalid project ref"

**Cause:** Wrong project ref (should be 20 alphanumeric characters), or the project does not belong to the logged-in account.

**Fix:** Run `supabase projects list` to get the correct ref. Confirm you are logged in as the right user with `supabase projects list`.

### `supabase link` fails with "incorrect password"

**Cause:** Wrong database password. Supabase database passwords cannot be recovered.

**Fix:** In Supabase Dashboard → Project → Settings → Database → Reset database password. Use the new password.

### `supabase db execute` fails with `relation already exists`

**Cause:** Running `schema.sql` on a database that already has some or all tables.

**Fix:** This is safe to ignore if the existing tables have the correct schema. The `CREATE TABLE IF NOT EXISTS` pattern avoids errors if the file uses it. If the file uses plain `CREATE TABLE`, wrap tables in:
```sql
DROP TABLE IF EXISTS table_name CASCADE;
CREATE TABLE table_name (...);
```
Only do this on a fresh database — it deletes existing data.

### `supabase db execute` fails with `permission denied`

**Cause:** The Supabase CLI is connecting as a restricted role.

**Fix:** Run the SQL directly in the Supabase Dashboard SQL Editor, which runs as the `postgres` superuser.

### `product-images` bucket missing after schema run

**Cause:** The storage bucket INSERT in `schema.sql` failed silently, or the schema file was not run completely.

**Fix:**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO NOTHING;
```
Run this in the Supabase Dashboard SQL Editor.

### Images return 403 (bucket exists but is private)

**Cause:** `product-images` bucket exists but was not set to Public.

**Fix:** In Supabase Dashboard → Storage → Buckets → click `product-images` → toggle "Public bucket" → Save.

Or via SQL Editor:
```sql
UPDATE storage.buckets SET public = TRUE WHERE id = 'product-images';
```

---

## Phase 3: Vercel Setup

### `vercel whoami` returns "Error: Not authenticated"

**Cause:** Not logged in, or auth token expired.

**Fix:**
```bash
vercel login
```

### `vercel link` lists no projects / wrong projects

**Cause:** Logged in to the wrong Vercel account or team.

**Fix:**
```bash
vercel whoami
vercel teams ls
vercel teams switch CORRECT_TEAM_SLUG
vercel link
```

### Environment variable not appearing after `vercel env add`

**Cause:** Added to the wrong environment scope, or the command timed out.

**Fix:**
```bash
vercel env ls
# If missing, re-add:
vercel env add VARIABLE_NAME production
```

### `NEXT_PUBLIC_SUPABASE_URL` shows as `undefined` in build log

**Cause:** The variable was not set before the build was triggered, or was set in `preview` but not `production`.

**Fix:**
```bash
vercel env ls | grep SUPABASE_URL
# Should show both production and preview rows
# If missing:
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel redeploy --prod
```

---

## Phase 4: Build / Deploy Errors

### TypeScript error during build

**Symptom:** Build fails with `Type error: ...` in the Vercel build log.

**Cause:** Type errors that pass locally with `ts-ignore` or lenient settings fail on Vercel's strict build.

**Fix:** Run `npm run build` locally to reproduce. Fix the type error in the source file. Do not disable `typescript.ignoreBuildErrors` in `next.config.mjs` — it masks real bugs.

### `Error: Cannot find module 'some-package'`

**Cause:** Package is in `devDependencies` but required at runtime, or `package-lock.json` is out of sync.

**Fix:**
```bash
npm install some-package --save   # move to dependencies
npm install                       # regenerate lock file
git add package.json package-lock.json
git commit -m "fix: move package to dependencies"
vercel --prod
```

### `Error: Invalid src prop on next/image` / hostname not configured

**Symptom:** Images fail to load, console shows "hostname not configured".

**Cause:** `next.config.mjs` is missing the `*.supabase.co` remote image pattern.

**Fix:** Add to `next.config.mjs`:
```js
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "*.supabase.co",
      pathname: "/storage/v1/object/public/**",
    },
  ],
},
```
Redeploy after saving.

### Build succeeds but deployment shows a blank page

**Cause:** A JavaScript runtime error on the client. Missing environment variables or a failed data fetch during SSR.

**Fix:**
1. Open browser DevTools → Console and look for errors
2. Check `vercel logs --prod` for server-side errors
3. Confirm all three env vars are set: `vercel env ls`

### Build passes locally, fails on Vercel

**Cause:** Usually one of:
- Missing env vars in Vercel (locally they are in `.env.local`)
- Case-sensitive import paths (Windows is case-insensitive, Vercel Linux servers are not)
- A package in `devDependencies` that should be in `dependencies`

**Fix:** Check `vercel env ls`. Check import paths for exact casing. Run `npm run build` locally and look for warnings.

---

## Phase 5: Post-Deploy Issues

### `/admin` causes an infinite redirect loop

**Cause:** `middleware.ts` cannot create a valid session because `NEXT_PUBLIC_SUPABASE_ANON_KEY` is wrong or missing.

**Fix:**
```bash
vercel env ls | grep ANON_KEY
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Re-copy the anon key exactly from Supabase Dashboard → Settings → API
vercel redeploy --prod
```

### `/admin/login` returns 404

**Cause:** The route `app/admin/login/page.tsx` was not included in the build, or there is a file path issue.

**Fix:** Confirm `app/admin/login/page.tsx` exists locally. Run `npm run build` locally and check for build output referencing this route. If missing from the build, check for import errors in the route file.

### `relation "products" does not exist` in logs

**Cause:** `supabase/schema.sql` was not fully applied to the database.

**Fix:** Run the schema again via the Supabase Dashboard SQL Editor. Verify all six tables exist in Table Editor.

### `Invalid API key` in logs

**Cause:** `SUPABASE_SERVICE_ROLE_KEY` is wrong, truncated, or copied with extra whitespace.

**Fix:** Re-copy the service_role key directly from Supabase Dashboard → Settings → API. Set it again:
```bash
vercel env rm SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel redeploy --prod
```

### CORS error on `*.supabase.co` requests

**Cause:** `NEXT_PUBLIC_SUPABASE_URL` has a trailing slash (e.g., `https://abc.supabase.co/` instead of `https://abc.supabase.co`).

**Fix:** Remove the trailing slash:
```bash
vercel env rm NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Enter: https://abc.supabase.co  (no trailing slash)
vercel redeploy --prod
```

### `StorageApiError: Bucket not found`

**Cause:** The `product-images` bucket was not created, or the bucket name in code does not match the actual bucket name.

**Fix:** In Supabase Dashboard → Storage, confirm the bucket name is exactly `product-images` (lowercase, hyphenated). If missing, create it via SQL Editor (see Phase 2.6 in SKILL.md).

### Images load in development but not in production

**Cause:** `next.config.mjs` remote patterns are correct but the `product-images` bucket is private.

**Fix:** Set the bucket to Public in Supabase Dashboard → Storage → Buckets → product-images → Public bucket toggle.

### `vercel logs` shows no output

**Cause:** No recent traffic to the production deployment, or logs have expired (Vercel retains logs for a limited time on free plans).

**Fix:** Visit the production URL to generate traffic, then re-run `vercel logs --prod`. For persistent logging, integrate a log drain service (Datadog, Logtail, etc.) via Vercel Dashboard → Project → Settings → Log Drains.

---

## Quick Diagnostic Checklist

Run through this list when a deployment is broken:

1. `vercel env ls` — confirm all 3 Supabase variables are set for `production`
2. `vercel logs --prod` — check for runtime errors
3. Supabase Dashboard → Table Editor — confirm 6 tables exist
4. Supabase Dashboard → Storage — confirm `product-images` bucket is Public
5. Browser DevTools → Network — check Supabase requests for 4xx/5xx
6. `curl -I https://YOUR_APP.vercel.app` — check HTTP status code
7. `next.config.mjs` — confirm `*.supabase.co` is in `remotePatterns`
