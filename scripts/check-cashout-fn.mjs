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

// Get the full function definition
const result = await query(`
  SELECT proname, proargtypes, pronargs, proargnames, prosrc 
  FROM pg_proc WHERE proname = 'process_cash_out';
`);

if (result.length === 0) {
  console.log('Function not found!');
} else {
  console.log('Args:', result[0].proargnames);
  console.log('Nargs:', result[0].pronargs);
  console.log('\n=== Full source ===');
  console.log(result[0].prosrc);
}
