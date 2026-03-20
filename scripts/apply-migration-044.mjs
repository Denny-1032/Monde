#!/usr/bin/env node
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const accessToken = env.SUPABASE_ACCESS_TOKEN;
if (!accessToken) {
  console.error('SUPABASE_ACCESS_TOKEN not set in .env');
  process.exit(1);
}

const ref = 'dxpjbqlgivkpbbbvhexb';
const sql = 'DROP POLICY IF EXISTS "Service role full access on lipila_callbacks" ON public.lipila_callbacks;';

console.log('Applying migration 044 to', ref, '...');

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (res.ok) {
  console.log('Migration 044 applied successfully.');
  console.log(text);
} else {
  console.error('Failed:', res.status, text);
  process.exit(1);
}
