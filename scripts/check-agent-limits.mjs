import 'dotenv/config';
import { readFileSync } from 'fs';

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

// Get full source of process_agent_cash_in
const cashin = await query("SELECT prosrc FROM pg_proc WHERE proname = 'process_agent_cash_in';");
const cashinSrc = cashin[0]?.prosrc || '';
console.log('=== process_agent_cash_in - deposit limit lines ===');
cashinSrc.split('\n').forEach((l, i) => {
  if (/daily|limit|count|v_daily|deposit.*per|per.*day/i.test(l.trim())) {
    console.log(`  ${i}: ${l.trim()}`);
  }
});

// Get full source of process_cash_out
const cashout = await query("SELECT prosrc FROM pg_proc WHERE proname = 'process_cash_out';");
const cashoutSrc = cashout[0]?.prosrc || '';
console.log('\n=== process_cash_out - limit lines ===');
cashoutSrc.split('\n').forEach((l, i) => {
  if (/daily|limit|count|v_daily|deposit.*per|per.*day|circular|24/i.test(l.trim())) {
    console.log(`  ${i}: ${l.trim()}`);
  }
});

// Show full cashin source for context
console.log('\n=== Full process_agent_cash_in source ===');
console.log(cashinSrc);
