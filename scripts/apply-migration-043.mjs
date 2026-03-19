import 'dotenv/config';
import { readFileSync } from 'fs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';

const sql = readFileSync('supabase/migrations/043_fix_handle_generation.sql', 'utf8');

console.log('Applying migration 043 (fix handle generation)...');
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
  console.log('✅ Migration 043 applied successfully');
}
