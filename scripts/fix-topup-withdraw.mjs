import 'dotenv/config';
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';
async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
  if (res.status !== 201) { const d = await res.json(); console.error('SQL Error:', JSON.stringify(d)); return null; }
  return res.json();
}

// Drop the OLD 4-arg process_topup (has default on p_provider)
console.log('Dropping old process_topup(4 args)...');
await query(`DROP FUNCTION IF EXISTS public.process_topup(UUID, NUMERIC, TEXT, TEXT);`);

// Drop the OLD 5-arg process_withdraw (has default on p_provider)
console.log('Dropping old process_withdraw(5 args)...');
await query(`DROP FUNCTION IF EXISTS public.process_withdraw(UUID, NUMERIC, TEXT, TEXT, TEXT);`);

// Verify only new versions remain
console.log('\nVerifying signatures...');
for (const fn of ['process_topup', 'process_withdraw']) {
  const r = await query(`SELECT pg_get_function_arguments(p.oid) as args FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = '${fn}' AND n.nspname = 'public';`);
  if (r) r.forEach(row => console.log(`  ${fn}(${row.args})`));
}

// Verify frozen check exists in remaining functions
for (const fn of ['process_topup', 'process_withdraw']) {
  const r = await query(`SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = '${fn}' AND n.nspname = 'public';`);
  if (r && r[0]) {
    const has = r[0].prosrc.includes('is_frozen');
    console.log(`  ${fn} has frozen check: ${has}`);
  }
}
