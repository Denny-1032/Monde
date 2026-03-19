import 'dotenv/config';
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';
async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
  return res.json();
}

for (const fn of ['process_topup', 'process_withdraw']) {
  const r = await query(`SELECT p.proname, pg_get_function_arguments(p.oid) as args, p.pronargs
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = '${fn}' AND n.nspname = 'public';`);
  r.forEach(row => console.log(`${row.proname}(${row.args}) [${row.pronargs} args]`));
}
