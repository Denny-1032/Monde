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

// 1. Get admin_list_agents source to understand commission calculation
console.log('=== admin_list_agents RPC ===');
const ala = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'admin_list_agents';`);
console.log(ala[0]?.prosrc || 'NOT FOUND');

// 2. Check ALL RPCs for is_frozen checks
console.log('\n=== RPCs and their is_frozen checks ===');
const rpcs = ['process_payment', 'process_topup', 'process_withdraw', 'process_agent_cash_in', 
              'process_cash_out', 'agent_to_agent_transfer', 'request_cash_out'];
for (const fn of rpcs) {
  const res = await query(`SELECT prosrc FROM pg_proc WHERE proname = '${fn}';`);
  const src = res[0]?.prosrc || '';
  const hasFrozen = src.includes('is_frozen');
  const hasRecipientFrozen = src.includes('recipient') && src.includes('frozen') || src.includes('customer') && src.includes('frozen');
  console.log(`  ${fn}: sender_frozen=${hasFrozen}, recipient_frozen=${hasRecipientFrozen}`);
}

// 3. Check profiles schema for tier columns
console.log('\n=== Profiles columns ===');
const cols = await query(`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'profiles' ORDER BY ordinal_position;`);
cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (default: ${c.column_default || 'none'})`));

// 4. Check process_payment for is_agent block on recipient
console.log('\n=== process_payment recipient agent check ===');
const pp = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_payment';`);
const ppSrc = pp[0]?.prosrc || '';
console.log('  Has recipient is_agent check:', ppSrc.includes('v_recipient') && ppSrc.includes('is_agent'));

// 5. Check request_cash_out source for frozen check
console.log('\n=== request_cash_out full source ===');
const rco = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'request_cash_out';`);
console.log(rco[0]?.prosrc || 'NOT FOUND');
