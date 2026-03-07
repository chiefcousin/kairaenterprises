# Vercel CLI Reference

Command reference for the Vercel CLI as used in a Next.js + Supabase deployment workflow. All commands run from the project root unless otherwise noted.

---

## Installation

```bash
# Install globally via npm
npm install -g vercel

# Verify installation
vercel --version

# Update to the latest version
npm update -g vercel
```

---

## Authentication

```bash
# Log in (opens browser — use GitHub for automatic deploy triggers)
vercel login

# Log out
vercel logout

# Show current logged-in user
vercel whoami

# Switch between teams/accounts
vercel switch
```

---

## Project Linking

```bash
# Initialize and deploy a new project (interactive)
vercel

# Link to an existing Vercel project without deploying
vercel link

# Show the linked project info
vercel project ls

# Pull environment variables from Vercel to .env.local
vercel env pull .env.local
```

`vercel link` creates `.vercel/project.json` with the org ID and project ID. This file should be committed to git so the project stays linked across machines.

---

## Deploying

```bash
# Deploy to preview (creates a unique preview URL, does not affect production)
vercel

# Deploy to production
vercel --prod

# Deploy a specific directory (if code is not in project root)
vercel ./path/to/app --prod

# Redeploy the last successful deployment without a code change
vercel redeploy --prod

# Deploy without local file upload (use only with Git integration)
vercel --skip-domain
```

### Preview vs Production deployments

| Command | Environment | URL |
|---|---|---|
| `vercel` | preview | `https://PROJECT-HASH.vercel.app` |
| `vercel --prod` | production | Your configured production domain |
| `git push origin main` | production (via Git integration) | Your configured production domain |
| Push to any other branch | preview | `https://PROJECT-BRANCH.vercel.app` |

---

## Environment Variables

```bash
# List all environment variables across all environments
vercel env ls

# Add a variable to a specific environment (prompts for value)
vercel env add VARIABLE_NAME production
vercel env add VARIABLE_NAME preview
vercel env add VARIABLE_NAME development

# Add to all environments at once
vercel env add VARIABLE_NAME

# Get the current value of a variable (masked for secrets)
vercel env get VARIABLE_NAME production

# Remove a variable from a specific environment
vercel env rm VARIABLE_NAME production

# Pull all variables into a local .env file
vercel env pull .env.local
```

### Environment scopes

| Scope | When it applies |
|---|---|
| `production` | Deployments from the production branch (usually `main`) |
| `preview` | Deployments from non-production branches and PRs |
| `development` | Local development via `vercel dev` |

Set the three Supabase variables for both `production` and `preview`. Set them for `development` too if using `vercel dev` locally (otherwise use `.env.local` directly).

---

## Logs

```bash
# Stream real-time logs from the production deployment
vercel logs --prod

# Stream logs from the latest preview deployment
vercel logs

# Stream logs from a specific deployment URL
vercel logs https://your-deployment-url.vercel.app

# Filter logs by type
vercel logs --prod --filter error

# Show build logs for the most recent deployment
vercel inspect --logs
```

---

## Inspecting Deployments

```bash
# Inspect the latest production deployment
vercel inspect --prod

# Inspect a specific deployment URL
vercel inspect https://your-deployment-url.vercel.app

# List all deployments for the project
vercel ls

# List deployments for a specific project
vercel ls PROJECT_NAME

# Show deployment aliases (domains)
vercel alias ls
```

---

## Domains

```bash
# List all domains on the account
vercel domains ls

# Add a custom domain to the project
vercel domains add yourdomain.com

# Remove a domain
vercel domains rm yourdomain.com

# Check DNS configuration for a domain
vercel domains inspect yourdomain.com
```

---

## Teams

```bash
# List teams
vercel teams ls

# Switch active team
vercel teams switch TEAM_SLUG

# Show current team
vercel teams list
```

---

## Local Development

```bash
# Run the app locally with Vercel environment variables injected
vercel dev

# Equivalent to `next dev` but uses Vercel's local environment
# Requires `.vercel/project.json` (created by `vercel link`)
```

`vercel dev` pulls the `development` environment variables from Vercel automatically. Alternatively, use `vercel env pull .env.local` once and then run `next dev` directly.

---

## Common Flags

| Flag | Description |
|---|---|
| `--prod` | Target the production environment |
| `--yes` / `-y` | Skip all confirmation prompts |
| `--token TOKEN` | Authenticate with a token instead of browser login |
| `--scope TEAM` | Specify the team/account scope |
| `--debug` | Verbose output for troubleshooting |
| `--no-wait` | Exit after triggering deploy, don't wait for completion |
| `--force` | Force a new deployment even if nothing changed |

---

## Useful One-liners

```bash
# Check if the production deployment is live
curl -s -o /dev/null -w "%{http_code}" $(vercel inspect --prod --json | jq -r '.url')

# Get the production URL of the linked project
vercel inspect --prod --json | jq -r '.url'

# List env vars that are missing from production
vercel env ls | grep production

# Trigger a redeploy after env var changes
vercel env rm NEXT_PUBLIC_SUPABASE_URL production && \
  vercel env add NEXT_PUBLIC_SUPABASE_URL production && \
  vercel redeploy --prod
```

---

## CI/CD Integration

For automated deployments from GitHub Actions or other CI systems, use a Vercel token instead of browser login:

```bash
# Create a token at https://vercel.com/account/tokens
vercel --token $VERCEL_TOKEN --prod
```

Set `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as CI environment variables. The org and project IDs are found in `.vercel/project.json`.
