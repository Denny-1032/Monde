import 'dotenv/config';
import { readFileSync } from 'fs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';

const sql = readFileSync('supabase/migrations/040_fix_fees_and_agent_toggle.sql', 'utf8');

console.log('Applying migration 040...');
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
  console.log('✅ Migration 040 applied successfully');
}

// Verify
const verify = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.monde_fees'::regclass
    AND contype = 'c';
  ` }),
});
const vdata = await verify.json();
console.log('\nCurrent monde_fees CHECK constraints:');
vdata.forEach(c => console.log(`  ${c.conname}: ${c.def}`));
