#!/usr/bin/env node
// Diagnose admin sign-in + fix all issues
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let accessToken = env.SUPABASE_ACCESS_TOKEN;
const projectRef = env.SUPABASE_PROJECT_REF || 'dxpjbqlgivkpbbbvhexb';

// SECURITY: Admin credentials from environment — never hardcode
const ADMIN_PHONE = env.MONDE_ADMIN_PHONE || '+260000000000';
const ADMIN_PIN = env.MONDE_ADMIN_PIN;
if (!ADMIN_PIN) { console.error('MONDE_ADMIN_PIN not set in .env — refusing to run with default credentials'); process.exit(1); }
function pinToPassword(pin) { return `Mn!${pin}#Zk`; }
const ADMIN_PASSWORD = pinToPassword(ADMIN_PIN);

// Prompt for access token if not set
if (!accessToken) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  accessToken = await new Promise(r => rl.question('Enter SUPABASE_ACCESS_TOKEN (from https://supabase.com/dashboard/account/tokens): ', a => { rl.close(); r(a.trim()); }));
}
if (!accessToken) { console.error('No token provided'); process.exit(1); }

async function runSQL(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`SQL error ${res.status}: ${t}`); }
  return res.json();
}

console.log('\n=== 1. DIAGNOSE ADMIN ===\n');

// Check auth.users
const users = await runSQL(`
  SELECT id, phone,
         encrypted_password IS NOT NULL as has_password,
         LENGTH(encrypted_password) as pw_len
  FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000000';
`);
console.log('auth.users:', JSON.stringify(users, null, 2));

// Check password match
const pwCheck = await runSQL(`
  SELECT encrypted_password = crypt('${ADMIN_PASSWORD}', encrypted_password) as pw_matches
  FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000000';
`);
console.log('Password matches:', JSON.stringify(pwCheck, null, 2));

// Check identities
const ids = await runSQL(`
  SELECT id, provider, provider_id FROM auth.identities
  WHERE user_id = '00000000-0000-0000-0000-000000000000';
`);
console.log('Identities:', JSON.stringify(ids, null, 2));

// Check profile
const prof = await runSQL(`
  SELECT id, phone, is_admin FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000000';
`);
console.log('Profile:', JSON.stringify(prof, null, 2));

console.log('\n=== 2. FIX: CREATE REAL ADMIN USER ===\n');
console.log('Root cause: UUID 00000000... is treated as invalid by Supabase GoTrue.');
console.log('Fix: Create a real admin user with a proper UUID. Keep UUID 0 as ledger-only.\n');

// Get service role key
const serviceKeyRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
  headers: { 'Authorization': `Bearer ${accessToken}` },
});
const apiKeys = await serviceKeyRes.json();
const serviceRoleKey = apiKeys.find(k => k.name === 'service_role')?.api_key;
if (!serviceRoleKey) { console.error('Could not get service_role key'); process.exit(1); }
console.log('Got service_role key');

const adminClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Step 1: Check if UUID 0 still exists in auth.users (may have been deleted by previous run)
const uuid0exists = await runSQL(`
  SELECT count(*) as cnt FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000000';
`);
const uuid0InAuth = uuid0exists?.[0]?.cnt > 0;

if (uuid0InAuth) {
  // Free up +260000000000 phone from UUID 0 so we can use it for real admin
  console.log('Freeing phone +260000000000 from UUID 0...');
  await runSQL(`
    UPDATE auth.users SET phone = '+260000000001', phone_change = ''
    WHERE id = '00000000-0000-0000-0000-000000000000';
  `);
  // Remove its identity so there's no conflict
  await runSQL(`
    DELETE FROM auth.identities WHERE user_id = '00000000-0000-0000-0000-000000000000';
  `);
  console.log('UUID 0 auth entry neutered (phone changed, identities removed)');
} else {
  // UUID 0 was deleted (e.g. by previous run). Re-insert it for FK integrity.
  console.log('Re-inserting UUID 0 into auth.users for FK integrity...');
  await runSQL(`
    INSERT INTO auth.users (id, instance_id, phone, encrypted_password, aud, role, created_at, updated_at, confirmation_sent_at)
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000000',
      '+260000000001',
      crypt('DISABLED_ACCOUNT', gen_salt('bf')),
      'authenticated', 'authenticated',
      now(), now(), now()
    ) ON CONFLICT (id) DO NOTHING;
  `);
  console.log('UUID 0 re-inserted into auth.users');
}

// Step 2: Ensure profiles ledger entry for UUID 0 is ledger-only
await runSQL(`
  UPDATE public.profiles SET
    full_name = 'Monde Fee Ledger',
    phone = '+260000000001',
    is_admin = false
  WHERE id = '00000000-0000-0000-0000-000000000000';
`);
console.log('Fee ledger profile (UUID 0) updated: ledger-only, is_admin=false');

// Step 3: Check if a real admin user already exists
const existingAdmin = await runSQL(`
  SELECT id FROM auth.users WHERE phone = '${ADMIN_PHONE}' AND id != '00000000-0000-0000-0000-000000000000';
`);

let adminUserId = existingAdmin?.[0]?.id;

if (adminUserId) {
  console.log('Real admin auth user already exists:', adminUserId);
  // Update password
  const { error: updErr } = await adminClient.auth.admin.updateUserById(adminUserId, { password: ADMIN_PASSWORD });
  if (updErr) console.error('Password update error:', updErr.message);
  else console.log('Password updated');
} else {
  // Create new admin user
  const { data: newAdmin, error: createErr } = await adminClient.auth.admin.createUser({
    phone: ADMIN_PHONE,
    password: ADMIN_PASSWORD,
    phone_confirm: true,
    user_metadata: { full_name: 'System Admin' },
  });
  if (createErr) {
    console.error('Failed to create admin user:', createErr.message);
  } else {
    adminUserId = newAdmin.user.id;
    console.log('Created new admin user:', adminUserId);
  }
}

// Step 4: Ensure admin profile exists
if (adminUserId) {
  await runSQL(`
    INSERT INTO public.profiles (id, phone, full_name, provider, balance, currency, is_admin)
    VALUES ('${adminUserId}', '${ADMIN_PHONE}', 'System Admin', 'monde', 0, 'ZMW', true)
    ON CONFLICT (id) DO UPDATE SET is_admin = true, phone = '${ADMIN_PHONE}', full_name = 'System Admin';
  `);
  console.log('Admin profile ensured with is_admin=true, ID:', adminUserId);
}

console.log('\n=== 3. VERIFY FIX ===\n');

const supabase = createClient(url, anonKey);
const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
  phone: ADMIN_PHONE,
  password: ADMIN_PASSWORD,
});
if (signInErr) {
  console.error('Sign-in STILL FAILING:', signInErr.message);
} else {
  console.log('Sign-in SUCCESS! User ID:', signIn.user?.id);
  console.log('Session:', !!signIn.session);
}

// Verify admin access
if (signIn?.user) {
  const { data: adminProf } = await supabase
    .from('profiles')
    .select('is_admin, full_name')
    .eq('id', signIn.user.id)
    .single();
  console.log('Profile is_admin:', adminProf?.is_admin);
}

console.log('\nDone.');
process.exit(0);
