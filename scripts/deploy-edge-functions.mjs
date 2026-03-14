#!/usr/bin/env node
/**
 * Deploy Supabase Edge Functions + set secrets via Management API.
 * Bypasses the Supabase CLI entirely.
 *
 * Usage:
 *   node scripts/deploy-edge-functions.mjs
 *
 * Required: SUPABASE_ACCESS_TOKEN env var or pass as first argument.
 * Get your access token from: https://supabase.com/dashboard/account/tokens
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load .env manually (no dotenv dependency needed)
const envPath = resolve(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const PROJECT_REF = 'dxpjbqlgivkpbbbvhexb';
const API_BASE = 'https://api.supabase.com';

const accessToken = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
if (!accessToken) {
  console.error('ERROR: No access token provided.');
  console.error('Usage: node scripts/deploy-edge-functions.mjs <supabase_access_token>');
  console.error('  OR: set SUPABASE_ACCESS_TOKEN in .env');
  console.error('Get your token from: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const authHeaders = {
  'Authorization': `Bearer ${accessToken}`,
};

// ---- Secrets Management ----

async function setSecrets() {
  console.log('--- Setting Edge Function Secrets ---');

  // Secrets to push from .env to Supabase Edge Functions
  const secretKeys = [
    'LIPILA_MODE',
    'LIPILA_SANDBOX_API_KEY',
    'LIPILA_LIVE_API_KEY',
    'LIPILA_SANDBOX_URL',
    'LIPILA_LIVE_URL',
    'LIPILA_CALLBACK_URL',
  ];

  const secrets = [];
  for (const key of secretKeys) {
    const val = process.env[key];
    if (val && !val.startsWith('#')) {
      secrets.push({ name: key, value: val });
      console.log(`  ${key} = ${val.substring(0, 8)}...`);
    }
  }

  if (secrets.length === 0) {
    console.log('  No Lipila secrets found in .env — skipping.');
    return;
  }

  const res = await fetch(`${API_BASE}/v1/projects/${PROJECT_REF}/secrets`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(secrets),
  });

  if (!res.ok) {
    console.error(`  Failed to set secrets: HTTP ${res.status}`, await res.text());
  } else {
    console.log(`  ✓ ${secrets.length} secrets pushed to Supabase`);
  }
}

// ---- Function Deployment ----

async function listFunctions() {
  const res = await fetch(`${API_BASE}/v1/projects/${PROJECT_REF}/functions`, {
    headers: authHeaders,
  });
  if (!res.ok) return [];
  return res.json();
}

async function deployFunction(slug, verifyJwt) {
  const funcDir = resolve(ROOT, 'supabase', 'functions', slug);
  const indexPath = resolve(funcDir, 'index.ts');

  if (!existsSync(indexPath)) {
    console.error(`  ✗ ${slug}: index.ts not found at ${indexPath}`);
    return false;
  }

  const code = readFileSync(indexPath, 'utf-8');
  const existing = await listFunctions();
  const exists = existing.some(f => f.slug === slug);

  const payload = {
    slug,
    name: slug,
    verify_jwt: verifyJwt,
    body: code,
  };

  const url = exists
    ? `${API_BASE}/v1/projects/${PROJECT_REF}/functions/${slug}`
    : `${API_BASE}/v1/projects/${PROJECT_REF}/functions`;
  const method = exists ? 'PATCH' : 'POST';

  console.log(`  ${exists ? 'Updating' : 'Creating'} ${slug}...`);

  const res = await fetch(url, {
    method,
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`  ✗ ${slug}: HTTP ${res.status} — ${text.substring(0, 200)}`);
    return false;
  }

  console.log(`  ✓ ${slug} deployed`);
  return true;
}

// ---- Main ----

async function main() {
  console.log('=== Monde Edge Function Deployer ===');
  console.log(`Project: ${PROJECT_REF}\n`);

  // Verify access token
  const testRes = await fetch(`${API_BASE}/v1/projects/${PROJECT_REF}`, {
    headers: authHeaders,
  });
  if (!testRes.ok) {
    console.error('Authentication failed. Check your access token.');
    console.error('Get a new token from: https://supabase.com/dashboard/account/tokens');
    process.exit(1);
  }
  const project = await testRes.json();
  console.log(`Connected to project: ${project.name}\n`);

  // Step 1: Push secrets
  await setSecrets();
  console.log();

  // Step 2: Deploy functions
  console.log('--- Deploying Edge Functions ---');
  const functions = [
    { slug: 'lipila-payments', verifyJwt: true },
    { slug: 'lipila-callback', verifyJwt: false },
  ];

  let allOk = true;
  for (const fn of functions) {
    const ok = await deployFunction(fn.slug, fn.verifyJwt);
    if (!ok) allOk = false;
  }

  console.log(allOk
    ? '\n✓ All done! Edge Functions deployed with latest code.'
    : '\n⚠ Some functions failed. Check errors above.'
  );

  if (allOk) {
    console.log('\nNext steps:');
    console.log('  1. Restart Expo: npx expo start --clear');
    console.log('  2. Ensure EXPO_PUBLIC_LIPILA_ENABLED=true in .env');
    console.log('  3. Try a top-up from a linked MoMo account');
  }
}

main().catch(err => {
  console.error('Deploy error:', err.message);
  process.exit(1);
});
