import 'dotenv/config';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  return res.json();
}

// Full source of process_payment - check if agent recipient is blocked
console.log('=== process_payment - agent recipient lines ===');
const pp = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_payment';`);
const ppSrc = pp[0]?.prosrc || '';
ppSrc.split('\n').forEach((l, i) => {
  if (/is_agent|agent|recipient/i.test(l.trim()) && !/v_sender/.test(l)) {
    console.log(`  ${i}: ${l.trim()}`);
  }
});

// Full source of process_topup
console.log('\n=== process_topup full source ===');
const pt = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_topup';`);
console.log(pt[0]?.prosrc || 'NOT FOUND');

// Full source of process_withdraw
console.log('\n=== process_withdraw full source ===');
const pw = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_withdraw';`);
console.log(pw[0]?.prosrc || 'NOT FOUND');

// Check cash_out_requests schema
console.log('\n=== cash_out_requests columns ===');
const corCols = await query(`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'cash_out_requests' ORDER BY ordinal_position;`);
corCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (default: ${c.column_default || 'none'})`));

// Check for request_cash_out RPC with different name
console.log('\n=== All RPCs with cash_out ===');
const coRpcs = await query(`SELECT proname FROM pg_proc WHERE proname LIKE '%cash_out%' OR proname LIKE '%cashout%';`);
coRpcs.forEach(r => console.log(`  ${r.proname}`));
