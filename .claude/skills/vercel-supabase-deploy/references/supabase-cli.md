# Supabase CLI Reference

Command reference for the Supabase CLI as used in a Next.js deployment workflow. All commands run from the project root unless otherwise noted.

---

## Installation

```bash
# macOS / Linux (Homebrew)
brew install supabase/tap/supabase

# Windows (winget)
winget install Supabase.CLI

# Any platform (npm — slightly slower to invoke)
npm install -g supabase

# Verify installation
supabase --version
```

To update the CLI:

```bash
brew upgrade supabase          # macOS/Linux
winget upgrade Supabase.CLI    # Windows
npm update -g supabase         # npm
```

---

## Authentication

```bash
# Log in (opens browser)
supabase login

# Log out
supabase logout

# Verify current session
supabase projects list
```

The CLI stores the access token in `~/.supabase/access-token`.

---

## Project Management

```bash
# List all Supabase projects in your account
supabase projects list

# Link local repo to a Supabase project
supabase link --project-ref PROJECT_REF
# Prompts for database password

# Show linked project info (URL, anon key, service_role key)
supabase status

# Unlink
supabase unlink
```

`PROJECT_REF` is the 20-character Reference ID shown in `supabase projects list` and in Dashboard → Settings → General.

---

## Database

```bash
# Execute a SQL file against the linked database
supabase db execute --file supabase/schema.sql

# Push all migrations in supabase/migrations/ to the remote database
supabase db push

# Pull remote schema into local migration files
supabase db pull

# Show diff between local migrations and remote schema
supabase db diff

# Reset the remote database (runs all migrations from scratch)
# WARNING: deletes all data
supabase db reset --linked

# Open interactive psql shell connected to the linked database
supabase db execute --interactive
```

### Schema file vs migrations directory

| Approach | When to use |
|---|---|
| `supabase/schema.sql` + `db execute` | Single-file schema, early-stage projects, no migration history needed |
| `supabase/migrations/` + `db push` | Multi-file versioned migrations, team environments, production-grade projects |

This project uses `supabase/schema.sql`. To migrate to the versioned approach later:

```bash
supabase db pull        # generates supabase/migrations/ from current remote schema
supabase db push        # future schema changes go through migration files
```

---

## Storage

```bash
# List all buckets
supabase storage ls

# List objects in a bucket
supabase storage ls ss:///product-images/

# Upload a file to a bucket
supabase storage cp ./local-file.jpg ss:///product-images/filename.jpg

# Download a file
supabase storage cp ss:///product-images/filename.jpg ./local-file.jpg

# Remove a file
supabase storage rm ss:///product-images/filename.jpg
```

---

## Edge Functions

```bash
# List deployed functions
supabase functions list

# Deploy a function
supabase functions deploy FUNCTION_NAME

# Serve functions locally
supabase functions serve

# Delete a function
supabase functions delete FUNCTION_NAME
```

---

## Local Development

```bash
# Start the local Supabase stack (requires Docker)
supabase start

# Stop the local stack
supabase stop

# Show status of local stack
supabase status

# Open Supabase Studio for the local stack
# Automatically opens http://localhost:54323
supabase studio
```

When the local stack is running, `supabase status` shows local URLs and keys to use in `.env.local`.

---

## Secrets (Edge Functions)

```bash
# Set a secret for Edge Functions
supabase secrets set MY_SECRET=value

# List all secrets
supabase secrets list

# Unset a secret
supabase secrets unset MY_SECRET
```

---

## Common Flags

| Flag | Description |
|---|---|
| `--project-ref REF` | Specify project ref (avoids prompt) |
| `--linked` | Target the linked project (as opposed to local) |
| `--debug` | Verbose output for troubleshooting |
| `--output json` | Output as JSON (for scripting) |
| `-h` / `--help` | Show help for any command |

---

## Useful One-liners

```bash
# Get your project ref quickly
supabase projects list --output json | jq '.[0].id'

# Show the anon key for the linked project
supabase status --output json | jq '.ANON_KEY'

# Apply schema and confirm table count
supabase db execute --file supabase/schema.sql && \
  supabase db execute --sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Verify storage bucket is public
supabase storage ls --output json | jq '.[] | select(.name == "product-images") | .public'
```
