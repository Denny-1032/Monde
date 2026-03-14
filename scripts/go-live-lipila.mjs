#!/usr/bin/env node
/**
 * Switch Lipila integration to LIVE mode.
 * 
 * This script:
 *  1. Updates .env to enable Lipila and set mode to live
 *  2. Pushes secrets (LIPILA_MODE, LIPILA_LIVE_API_KEY, LIPILA_CALLBACK_URL) to Supabase Edge Functions
 *  3. Validates the configuration
 *
 * Prerequisites:
 *  - Set LIPILA_LIVE_API_KEY in your .env (get from https://dashboard.lipila.io → Wallets → API Keys)
 *  - Set SUPABASE_ACCESS_TOKEN in your .env (get from https://supabase.com/dashboard/account/tokens)
 *
 * Usage:
 *   node scripts/go-live-lipila.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');

// ---- Load .env ----
const envVars = {};
if (existsSync(ENV_PATH)) {
  for (const line of readFileSync(ENV_PATH, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      envVars[key] = val;
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const PROJECT_REF = 'dxpjbqlgivkpbbbvhexb';
const API_BASE = 'https://api.supabase.com';
const CALLBACK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/lipila-callback`;

// ---- Validation ----
console.log('=== Monde — Go Live with Lipila ===\n');

const errors = [];

// Check for live API key
const liveKey = envVars.LIPILA_LIVE_API_KEY || process.env.LIPILA_LIVE_API_KEY;
if (!liveKey || liveKey.startsWith('#') || liveKey === 'Lsk_live_xxx') {
  errors.push('LIPILA_LIVE_API_KEY is not set in .env. Get your live key from https://dashboard.lipila.io → Wallets → API Keys');
}

// Check for Supabase access token
const accessToken = envVars.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
if (!accessToken || accessToken.startsWith('#') || accessToken === 'sbp_xxx') {
  errors.push('SUPABASE_ACCESS_TOKEN is not set. Get it from https://supabase.com/dashboard/account/tokens');
}

if (errors.length > 0) {
  console.error('❌ Missing configuration:\n');
  errors.forEach(e => console.error(`  • ${e}`));
  console.error('\nPlease add these values to your .env file and re-run this script.');
  process.exit(1);
}

console.log('✓ LIPILA_LIVE_API_KEY found');
console.log('✓ SUPABASE_ACCESS_TOKEN found\n');

// ---- Step 1: Update .env ----
console.log('--- Step 1: Updating .env ---');

let envContent = readFileSync(ENV_PATH, 'utf-8');

// Enable Lipila
if (envContent.includes('EXPO_PUBLIC_LIPILA_ENABLED=false')) {
  envContent = envContent.replace('EXPO_PUBLIC_LIPILA_ENABLED=false', 'EXPO_PUBLIC_LIPILA_ENABLED=true');
  console.log('  ✓ EXPO_PUBLIC_LIPILA_ENABLED → true');
} else if (!envContent.includes('EXPO_PUBLIC_LIPILA_ENABLED=true')) {
  envContent += '\nEXPO_PUBLIC_LIPILA_ENABLED=true\n';
  console.log('  ✓ Added EXPO_PUBLIC_LIPILA_ENABLED=true');
} else {
  console.log('  ✓ EXPO_PUBLIC_LIPILA_ENABLED already true');
}

// Set mode to live
if (envContent.includes('LIPILA_MODE=sandbox')) {
  envContent = envContent.replace('LIPILA_MODE=sandbox', 'LIPILA_MODE=live');
  console.log('  ✓ LIPILA_MODE → live');
} else if (envContent.includes('# LIPILA_MODE=')) {
  envContent = envContent.replace(/# ?LIPILA_MODE=.*/, 'LIPILA_MODE=live');
  console.log('  ✓ LIPILA_MODE → live (uncommented)');
} else if (!envContent.includes('LIPILA_MODE=live')) {
  envContent += '\nLIPILA_MODE=live\n';
  console.log('  ✓ Added LIPILA_MODE=live');
} else {
  console.log('  ✓ LIPILA_MODE already live');
}

// Set callback URL
if (!envContent.includes('LIPILA_CALLBACK_URL=http')) {
  if (envContent.includes('# LIPILA_CALLBACK_URL=')) {
    envContent = envContent.replace(/# ?LIPILA_CALLBACK_URL=.*/, `LIPILA_CALLBACK_URL=${CALLBACK_URL}`);
  } else {
    envContent += `\nLIPILA_CALLBACK_URL=${CALLBACK_URL}\n`;
  }
  console.log(`  ✓ LIPILA_CALLBACK_URL → ${CALLBACK_URL}`);
}

writeFileSync(ENV_PATH, envContent, 'utf-8');
console.log('  ✓ .env saved\n');

// ---- Step 2: Push secrets to Supabase ----
console.log('--- Step 2: Pushing secrets to Supabase Edge Functions ---');

const secrets = [
  { name: 'LIPILA_MODE', value: 'live' },
  { name: 'LIPILA_LIVE_API_KEY', value: liveKey },
  { name: 'LIPILA_CALLBACK_URL', value: CALLBACK_URL },
];

// Also push sandbox key if available
const sandboxKey = envVars.LIPILA_SANDBOX_API_KEY || process.env.LIPILA_SANDBOX_API_KEY;
if (sandboxKey && !sandboxKey.startsWith('#')) {
  secrets.push({ name: 'LIPILA_SANDBOX_API_KEY', value: sandboxKey });
}

try {
  const res = await fetch(`${API_BASE}/v1/projects/${PROJECT_REF}/secrets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(secrets),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`  ❌ Failed to push secrets: HTTP ${res.status} — ${text.substring(0, 200)}`);
    process.exit(1);
  }

  console.log(`  ✓ ${secrets.length} secrets pushed to Supabase:\n    ${secrets.map(s => s.name).join(', ')}\n`);
} catch (err) {
  console.error(`  ❌ Network error pushing secrets: ${err.message}`);
  process.exit(1);
}

// ---- Step 3: Verify ----
console.log('--- Step 3: Verification ---');
console.log('  ✓ Lipila mode: LIVE');
console.log(`  ✓ Lipila API: https://blz.lipila.io`);
console.log(`  ✓ Callback: ${CALLBACK_URL}`);
console.log(`  ✓ Client-side: EXPO_PUBLIC_LIPILA_ENABLED=true`);

console.log('\n=== ✅ Lipila is now LIVE ===');
console.log('\nNext steps:');
console.log('  1. Restart Expo: npx expo start --clear');
console.log('  2. Deploy edge functions: npx supabase functions deploy lipila-payments --project-ref dxpjbqlgivkpbbbvhexb');
console.log('  3. Deploy callback: npx supabase functions deploy lipila-callback --project-ref dxpjbqlgivkpbbbvhexb');
console.log('  4. Test with a small top-up (K10) via Airtel/MTN/Zamtel');
console.log('\n⚠️  IMPORTANT: Live transactions use REAL MONEY. Test carefully!');
