import 'dotenv/config';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';
let passed = 0, failed = 0;

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  return res.json();
}

function assert(name, condition, detail) {
  if (condition) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}: ${detail || 'FAILED'}`); failed++; }
}

// 1. Tier columns exist
console.log('\n🔍 TEST 1: Tier & limit columns');
const cols = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('account_tier', 'daily_deposit_limit', 'daily_withdraw_limit');`);
const colNames = cols.map(c => c.column_name);
assert('account_tier column exists', colNames.includes('account_tier'));
assert('daily_deposit_limit column exists', colNames.includes('daily_deposit_limit'));
assert('daily_withdraw_limit column exists', colNames.includes('daily_withdraw_limit'));

// 2. process_payment blocks agent recipients
console.log('\n🔍 TEST 2: process_payment agent recipient block');
const pp = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_payment';`);
const ppSrc = pp[0]?.prosrc || '';
assert('Blocks sends to agents', ppSrc.includes('is_agent') && ppSrc.includes('Cannot send money to agent'));
assert('Has tier daily cap check', ppSrc.includes('get_tier_limits') && ppSrc.includes('daily_cap'));
assert('Has tier balance cap for recipient', ppSrc.includes('balance_cap') && ppSrc.includes('balance limit'));

// 3. process_topup has frozen check
console.log('\n🔍 TEST 3: process_topup frozen + tier');
const pt = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_topup';`);
const ptSrc = pt[0]?.prosrc || '';
assert('Has frozen check', ptSrc.includes('is_frozen'));
assert('Has tier balance cap', ptSrc.includes('balance_cap'));

// 4. process_withdraw has frozen check + tier
console.log('\n🔍 TEST 4: process_withdraw frozen + tier');
const pw = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_withdraw';`);
const pwSrc = pw[0]?.prosrc || '';
assert('Has frozen check', pwSrc.includes('is_frozen'));
assert('Has tier daily cap', pwSrc.includes('daily_cap'));

// 5. process_agent_cash_in per-agent limit
console.log('\n🔍 TEST 5: process_agent_cash_in per-agent limit + tier');
const ci = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_agent_cash_in';`);
const ciSrc = ci[0]?.prosrc || '';
assert('Per-agent limit (recipient_id = v_agent_id)', ciSrc.includes('recipient_id = v_agent_id'));
assert('Uses customer daily_deposit_limit override', ciSrc.includes('daily_deposit_limit'));
assert('Has tier balance cap for customer', ciSrc.includes('balance_cap'));

// 6. create_cash_out_request has frozen check + tier
console.log('\n🔍 TEST 6: create_cash_out_request frozen + tier');
const ccor = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'create_cash_out_request';`);
const ccorSrc = ccor[0]?.prosrc || '';
assert('Has frozen check', ccorSrc.includes('is_frozen'));
assert('Has tier daily cap', ccorSrc.includes('daily_cap'));

// 7. process_cash_out has frozen check for agent + per-agent limit
console.log('\n🔍 TEST 7: process_cash_out agent frozen + per-agent limit');
const co = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_cash_out';`);
const coSrc = co[0]?.prosrc || '';
assert('Has agent frozen check', coSrc.includes('is_frozen'));
assert('Per-agent withdraw limit', coSrc.includes('agent_id = v_agent_id') && coSrc.includes('daily_withdraw_limit'));

// 8. admin_list_agents includes cashin commissions
console.log('\n🔍 TEST 8: admin_list_agents commission fix');
const ala = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'admin_list_agents';`);
const alaSrc = ala[0]?.prosrc || '';
assert('Includes cashin_fee in total', alaSrc.includes('cashin_fee'));

// 9. Admin RPCs exist
console.log('\n🔍 TEST 9: Admin tier/limit RPCs');
const tierRpc = await query(`SELECT proname FROM pg_proc WHERE proname = 'admin_set_user_tier';`);
assert('admin_set_user_tier exists', tierRpc.length > 0);
const limitRpc = await query(`SELECT proname FROM pg_proc WHERE proname = 'admin_set_user_limits';`);
assert('admin_set_user_limits exists', limitRpc.length > 0);

// 10. Helper functions exist
console.log('\n🔍 TEST 10: Helper functions');
const helpers = await query(`SELECT proname FROM pg_proc WHERE proname IN ('get_tier_limits', 'get_daily_outgoing');`);
const helperNames = helpers.map(h => h.proname);
assert('get_tier_limits exists', helperNames.includes('get_tier_limits'));
assert('get_daily_outgoing exists', helperNames.includes('get_daily_outgoing'));

console.log('\n' + '='.repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed === 0) console.log('🎉 All tests PASSED!');
else { console.log('⚠️  Some tests FAILED'); process.exit(1); }
