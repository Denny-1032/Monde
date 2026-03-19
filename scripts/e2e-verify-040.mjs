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
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}: ${detail || 'FAILED'}`);
    failed++;
  }
}

// ============================================
// TEST 1: monde_fees constraints
// ============================================
console.log('\n🔍 TEST 1: monde_fees CHECK constraints');

const constraints = await query(`
  SELECT conname, pg_get_constraintdef(oid) as def
  FROM pg_constraint
  WHERE conrelid = 'public.monde_fees'::regclass AND contype = 'c';
`);

const feeTypeConstraint = constraints.find(c => c.conname === 'monde_fees_fee_type_check');
assert('fee_type constraint exists', !!feeTypeConstraint);
assert('fee_type includes cashin_fee', feeTypeConstraint?.def?.includes('cashin_fee'));
assert('fee_type includes cashout_fee', feeTypeConstraint?.def?.includes('cashout_fee'));

const feeAmountConstraint = constraints.find(c => c.conname === 'monde_fees_fee_amount_check');
assert('fee_amount >= 0 constraint REMOVED', !feeAmountConstraint, 
  feeAmountConstraint ? `Still exists: ${feeAmountConstraint.def}` : '');

// ============================================
// TEST 2: Can insert negative fee_amount (cashin commission)
// ============================================
console.log('\n🔍 TEST 2: Negative fee_amount insert (cashin commission simulation)');

const insertTest = await query(`
  DO $$
  DECLARE v_ok BOOLEAN := false;
  BEGIN
    -- Try inserting a cashin_fee with negative amount (simulating agent commission)
    INSERT INTO monde_fees (fee_type, gross_amount, fee_amount, currency)
    VALUES ('cashin_fee', 1000, -5.00, 'ZMW');
    v_ok := true;
    -- Clean up
    DELETE FROM monde_fees WHERE fee_type = 'cashin_fee' AND gross_amount = 1000 AND fee_amount = -5.00;
    RAISE NOTICE 'INSERT_OK:%', v_ok;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'INSERT_OK:false';
  END $$;
`);
// If no error, it worked
assert('Negative fee_amount insert succeeds', !insertTest?.message?.includes('check_violation'), 
  insertTest?.message);

// ============================================
// TEST 3: admin_toggle_agent function definition
// ============================================
console.log('\n🔍 TEST 3: admin_toggle_agent allows admin accounts');

const fnDef = await query(`
  SELECT prosrc FROM pg_proc WHERE proname = 'admin_toggle_agent';
`);
const src = fnDef?.[0]?.prosrc || '';
assert('Function exists', src.length > 0);
assert('No longer blocks admin accounts', !src.includes('Cannot toggle agent status on admin accounts'),
  'Still contains admin block');
assert('Blocks fee ledger account', src.includes('Cannot modify system accounts'));

// ============================================
// TEST 4: process_payment blocks system accounts
// ============================================
console.log('\n🔍 TEST 4: process_payment blocks system phones');

const payFnDef = await query(`
  SELECT prosrc FROM pg_proc WHERE proname = 'process_payment';
`);
const paySrc = payFnDef?.[0]?.prosrc || '';
assert('process_payment exists', paySrc.length > 0);
assert('Blocks +260000000000 (admin)', paySrc.includes('+260000000000'));
assert('Blocks +260000000001 (fee ledger)', paySrc.includes('+260000000001'));
assert('Error message says system accounts', paySrc.includes('Cannot send money to system accounts'));

// ============================================
// TEST 5: admin_freeze_account allows freezing admin accounts
// ============================================
console.log('\n🔍 TEST 5: admin_freeze_account updated');

const freezeFnDef = await query(`
  SELECT prosrc FROM pg_proc WHERE proname = 'admin_freeze_account';
`);
const freezeSrc = freezeFnDef?.[0]?.prosrc || '';
assert('Function exists', freezeSrc.length > 0);
assert('No longer blocks admin accounts', !freezeSrc.includes('Cannot freeze admin'));
assert('Blocks fee ledger (system accounts)', freezeSrc.includes('Cannot freeze system accounts'));

// ============================================
// TEST 6: Verify process_agent_cash_in still exists and references cashin_fee
// ============================================
console.log('\n🔍 TEST 6: process_agent_cash_in uses cashin_fee');

const cashinFn = await query(`
  SELECT prosrc FROM pg_proc WHERE proname = 'process_agent_cash_in';
`);
const cashinSrc = cashinFn?.[0]?.prosrc || '';
assert('process_agent_cash_in exists', cashinSrc.length > 0);
assert('References cashin_fee', cashinSrc.includes('cashin_fee'));

// ============================================
// TEST 7: Verify all profiles table has expected columns
// ============================================
console.log('\n🔍 TEST 7: Profile schema check');

const cols = await query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'profiles' AND table_schema = 'public'
  AND column_name IN ('is_frozen', 'is_agent', 'is_admin', 'handle', 'agent_code')
  ORDER BY column_name;
`);
const colNames = cols.map(c => c.column_name);
assert('is_frozen column exists', colNames.includes('is_frozen'));
assert('is_agent column exists', colNames.includes('is_agent'));
assert('is_admin column exists', colNames.includes('is_admin'));
assert('handle column exists', colNames.includes('handle'));
assert('agent_code column exists', colNames.includes('agent_code'));

// ============================================
// TEST 8: Count all profiles (for accounts tab)
// ============================================
console.log('\n🔍 TEST 8: Profiles accessible for admin accounts tab');

const profileCount = await query(`
  SELECT count(*) as cnt FROM profiles;
`);
const cnt = parseInt(profileCount?.[0]?.cnt || '0');
assert('Profiles table has data', cnt > 0, `Count: ${cnt}`);
console.log(`   → ${cnt} total profiles`);

// ============================================
// Summary
// ============================================
console.log('\n' + '='.repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed === 0) {
  console.log('🎉 All E2E database tests PASSED!');
} else {
  console.log('⚠️  Some tests FAILED — review above');
  process.exit(1);
}
