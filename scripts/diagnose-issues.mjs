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

// 1. Check phone formats in profiles
console.log('=== Phone formats in profiles ===');
const phones = await query(`SELECT id, phone, full_name FROM profiles ORDER BY full_name;`);
phones.forEach(p => console.log(`  ${p.full_name}: "${p.phone}"`));

// 2. Check recent "External" transactions
console.log('\n=== Recent transactions with "External" recipient ===');
const extTxns = await query(`
  SELECT id, sender_id, recipient_id, recipient_name, recipient_phone, type, amount, status, method, created_at
  FROM transactions
  WHERE recipient_name = 'External'
  ORDER BY created_at DESC
  LIMIT 10;
`);
extTxns.forEach(t => console.log(`  ${t.created_at}: ${t.type} ${t.amount} to "${t.recipient_phone}" (method: ${t.method}, recipient_id: ${t.recipient_id})`));

// 3. Check recent send transactions to see phone format mismatch
console.log('\n=== Recent send transactions ===');
const sends = await query(`
  SELECT t.id, t.sender_id, t.recipient_id, t.recipient_name, t.recipient_phone, t.amount, t.method, t.provider, t.created_at,
         p.phone as sender_phone, p.full_name as sender_name
  FROM transactions t
  JOIN profiles p ON p.id = t.sender_id
  WHERE t.type = 'send'
  ORDER BY t.created_at DESC
  LIMIT 10;
`);
sends.forEach(t => console.log(`  ${t.created_at}: ${t.sender_name} -> "${t.recipient_name}" phone="${t.recipient_phone}" method=${t.method} provider=${t.provider} amt=${t.amount}`));

// 4. Check agent cash-in limits
console.log('\n=== process_agent_cash_in daily deposit limit ===');
const cashinSrc = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_agent_cash_in';`);
const src = cashinSrc?.[0]?.prosrc || '';
// Find the daily limit check
const limitMatch = src.match(/v_daily_count\s*>=?\s*(\d+)/);
console.log(`  Daily deposit limit per customer: ${limitMatch ? limitMatch[1] : 'NOT FOUND'}`);
// Find the withdraw limit too
const cashoutSrc = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_cash_out';`);
const coSrc = cashoutSrc?.[0]?.prosrc || '';
const coLimit = coSrc.match(/daily.*deposit.*(\d+)/i) || coSrc.match(/v_daily_count.*>=?\s*(\d+)/);
console.log(`  Cash-out daily limit reference: ${coLimit ? coLimit[0] : 'checking...'}`);

// 5. Check provider field in transactions
console.log('\n=== Provider values in recent transactions ===');
const provs = await query(`
  SELECT type, provider, method, count(*) as cnt
  FROM transactions
  WHERE type IN ('send', 'receive')
  GROUP BY type, provider, method
  ORDER BY type, cnt DESC;
`);
provs.forEach(p => console.log(`  ${p.type}: provider="${p.provider}" method="${p.method}" count=${p.cnt}`));
