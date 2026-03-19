import 'dotenv/config';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';

const sql = `SELECT id, full_name, handle, left(lower(full_name), 1) as expected_first FROM public.profiles WHERE full_name IS NOT NULL AND length(full_name) > 0 ORDER BY created_at DESC LIMIT 20;`;

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const data = await res.json();
console.log('Handles after fix:');
if (Array.isArray(data)) {
  data.forEach(r => {
    const match = r.handle && r.expected_first && r.handle.startsWith(r.expected_first) ? '✅' : '❌';
    console.log(`${match} "${r.full_name}" → @${r.handle}`);
  });
} else {
  console.log(JSON.stringify(data, null, 2));
}
