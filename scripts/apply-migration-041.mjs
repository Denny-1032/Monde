import 'dotenv/config';
import { readFileSync } from 'fs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';

const sql = readFileSync('supabase/migrations/041_fix_payment_phone_lookup_and_limits.sql', 'utf8');

console.log('Applying migration 041...');
const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const data = await res.json();
console.log('Status:', res.status);
if (res.status !== 201) {
  console.error('Error:', JSON.stringify(data, null, 2));
} else {
  console.log('✅ Migration 041 applied successfully');
}

// Verify phone normalization
const verify = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `SELECT id, phone, full_name FROM profiles ORDER BY full_name;` }),
});
const vdata = await verify.json();
console.log('\nPhone formats after normalization:');
vdata.forEach(p => console.log(`  ${p.full_name}: "${p.phone}"`));
