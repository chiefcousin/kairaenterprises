import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const raw = readFileSync(".env.local", "utf8");
const env = {};
raw.split(/\r?\n/).forEach(line => {
  line = line.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) return;
  const idx = line.indexOf("=");
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
});

const vars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

// Verify all present
for (const k of vars) {
  if (!env[k] || env[k].includes("your-")) {
    console.error(`Missing: ${k}`);
    process.exit(1);
  }
  console.log(`Found: ${k} = ${env[k].slice(0, 20)}...`);
}

// Add each var to both production and preview using stdin
for (const envName of ["production", "preview"]) {
  for (const k of vars) {
    try {
      // Remove existing first (ignore errors if not present)
      try { execSync(`vercel env rm ${k} ${envName} --yes`, { stdio: "pipe" }); } catch {}
      // Add new value via stdin
      const proc = execSync(`vercel env add ${k} ${envName}`, {
        input: env[k] + "\n",
        stdio: ["pipe", "pipe", "pipe"],
      });
      console.log(`Set ${k} → ${envName}`);
    } catch (e) {
      console.error(`Failed ${k} → ${envName}: ${e.message}`);
    }
  }
}

console.log("\nDone! Run: vercel --prod");
