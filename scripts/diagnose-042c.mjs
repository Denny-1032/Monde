import 'dotenv/config';
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';
async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
  return res.json();
}

console.log('=== create_cash_out_request ===');
const ccor = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'create_cash_out_request';`);
console.log(ccor[0]?.prosrc || 'NOT FOUND');

console.log('\n=== agent_to_agent_transfer ===');
const aat = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'agent_to_agent_transfer';`);
console.log(aat[0]?.prosrc || 'NOT FOUND');

console.log('\n=== process_payment - full source (checking agent block on recipient) ===');
const pp = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_payment';`);
const src = pp[0]?.prosrc || '';
// Show lines around is_agent
src.split('\n').forEach((l, i) => {
  if (/is_agent/i.test(l)) console.log(`  ${i}: ${l.trim()}`);
});
