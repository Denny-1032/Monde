import 'dotenv/config';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';
let passed = 0;
let failed = 0;

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

// ============================================
// TEST 1: Phone normalization in profiles
// ============================================
console.log('\n🔍 TEST 1: Phone normalization');
const phones = await query(`SELECT phone, full_name FROM profiles WHERE phone NOT LIKE '+%' AND phone != '';`);
assert('All phones have + prefix', phones.length === 0, 
  phones.map(p => `${p.full_name}: ${p.phone}`).join(', '));

// ============================================
// TEST 2: process_payment normalizes phone + uses 'monde' provider
// ============================================
console.log('\n🔍 TEST 2: process_payment function');
const ppSrc = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_payment';`);
const ppCode = ppSrc[0]?.prosrc || '';
assert('Has phone normalization', ppCode.includes('v_normalized_phone'));
assert('Normalizes 0xx to +260', ppCode.includes("+260' || substring(v_normalized_phone from 2)"));
assert('Normalizes 260xx to +260xx', ppCode.includes("'+' || v_normalized_phone"));
assert('Flexible phone lookup (with and without +)', ppCode.includes("regexp_replace(v_normalized_phone, '^\\+'"));
assert('Provider is monde for P2P', ppCode.includes("'monde'") && !ppCode.includes("v_sender.provider"));
assert('Stores normalized phone in transaction', ppCode.includes('v_normalized_phone') && ppCode.includes('recipient_phone'));

// ============================================
// TEST 3: process_agent_cash_in daily limit = 5
// ============================================
console.log('\n🔍 TEST 3: Agent deposit limit');
const ciSrc = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_agent_cash_in';`);
const ciCode = ciSrc[0]?.prosrc || '';
assert('Daily limit is 5 (not 3)', ciCode.includes('v_daily_deposits >= 5'));
assert('Error message says max 5', ciCode.includes('max 5 per day'));

// ============================================
// TEST 4: process_cash_out has customer daily limit = 3
// ============================================
console.log('\n🔍 TEST 4: Cash-out customer daily limit');
const coSrc = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_cash_out';`);
const coCode = coSrc[0]?.prosrc || '';
assert('Has customer_daily_cashouts variable', coCode.includes('v_customer_daily_cashouts'));
assert('Customer limit is 3', coCode.includes('v_customer_daily_cashouts >= 3'));
assert('Error message says max 3', coCode.includes('max 3 per day'));
assert('Still has circular fraud check', coCode.includes('v_recent_deposit'));

// ============================================
// TEST 5: Transaction phone normalization in DB
// ============================================
console.log('\n🔍 TEST 5: Transaction phone normalization');
const badPhones = await query(`SELECT count(*) as cnt FROM transactions WHERE recipient_phone LIKE '260%' AND recipient_phone NOT LIKE '+%';`);
assert('No legacy 260xxx phones in transactions', parseInt(badPhones[0]?.cnt || '0') === 0,
  `${badPhones[0]?.cnt} records still have no + prefix`);

// ============================================
// Summary
// ============================================
console.log('\n' + '='.repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed === 0) {
  console.log('🎉 All E2E tests PASSED!');
} else {
  console.log('⚠️  Some tests FAILED — review above');
  process.exit(1);
}
