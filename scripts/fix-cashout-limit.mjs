import 'dotenv/config';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'dxpjbqlgivkpbbbvhexb';

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const data = await res.json();
  if (res.status !== 201) {
    console.error('Error:', JSON.stringify(data, null, 2));
    return null;
  }
  return data;
}

// 1. Drop the incorrect 2-arg overload I accidentally created
console.log('Dropping incorrect 2-arg overload...');
await query(`DROP FUNCTION IF EXISTS public.process_cash_out(UUID, UUID);`);

// 2. Replace the correct 1-arg version with customer daily cashout limit
console.log('Replacing process_cash_out with customer daily limit...');
const result = await query(`
CREATE OR REPLACE FUNCTION public.process_cash_out(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_agent_id UUID := auth.uid();
  v_agent RECORD;
  v_customer RECORD;
  v_agent_daily_count INT;
  v_customer_daily_cashouts INT;
  v_fee_info JSON;
  v_fee NUMERIC(12,2);
  v_agent_commission NUMERIC(12,2);
  v_monde_fee NUMERIC(12,2);
  v_reference TEXT;
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_customer_txn_id UUID;
  v_recent_deposit INT;
BEGIN
  IF v_agent_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify agent
  SELECT * INTO v_agent FROM profiles WHERE id = v_agent_id;
  IF NOT v_agent.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Only Monde agents can process cash-outs');
  END IF;

  -- Lock and fetch the request
  SELECT * INTO v_req FROM cash_out_requests
  WHERE id = p_request_id AND status = 'pending' AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found, already processed, or expired');
  END IF;

  -- Cannot process own request
  IF v_req.customer_id = v_agent_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot process your own request');
  END IF;

  -- ANTI-FRAUD: Block circular deposit->cashout
  SELECT COUNT(*) INTO v_recent_deposit FROM transactions
  WHERE type = 'cash_in'
    AND sender_id = v_req.customer_id
    AND recipient_id = v_agent_id
    AND status = 'completed'
    AND completed_at > now() - INTERVAL '24 hours';

  IF v_recent_deposit > 0 THEN
    RETURN json_build_object('success', false, 'error',
      'Cannot process cash-out: you deposited to this customer recently. Please wait 24 hours.');
  END IF;

  -- Daily cash-out limit per customer (max 3 per day)
  SELECT COUNT(*) INTO v_customer_daily_cashouts FROM cash_out_requests
  WHERE customer_id = v_req.customer_id
    AND status = 'completed'
    AND completed_at >= CURRENT_DATE;

  IF v_customer_daily_cashouts >= 3 THEN
    RETURN json_build_object('success', false, 'error',
      'This customer has reached their daily cash-out limit (max 3 per day)');
  END IF;

  -- Lock and verify customer balance
  SELECT * INTO v_customer FROM profiles WHERE id = v_req.customer_id FOR UPDATE;
  IF v_customer.balance < (v_req.amount + v_req.fee) THEN
    RETURN json_build_object('success', false, 'error', 'Customer has insufficient balance');
  END IF;

  -- Calculate fee split with volume bonus
  v_agent_daily_count := (
    SELECT COUNT(*) FROM cash_out_requests
    WHERE agent_id = v_agent_id AND status = 'completed'
    AND completed_at >= CURRENT_DATE
  );
  v_fee_info := calc_get_cash_fee(v_req.amount, v_agent_daily_count);
  v_fee := (v_fee_info->>'fee')::NUMERIC;
  v_agent_commission := (v_fee_info->>'agent_commission')::NUMERIC;
  v_monde_fee := (v_fee_info->>'monde_fee')::NUMERIC;

  -- Generate reference
  v_reference := 'CO-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 8));

  -- === ATOMIC TRANSFERS ===
  UPDATE profiles SET balance = balance - (v_req.amount + v_fee) WHERE id = v_req.customer_id;
  UPDATE profiles SET balance = balance + v_req.amount + v_agent_commission WHERE id = v_agent_id;
  IF v_monde_fee > 0 THEN
    UPDATE profiles SET balance = balance + v_monde_fee WHERE id = v_monde_admin_id;
  END IF;

  -- === TRANSACTION RECORDS ===
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_req.customer_id, v_agent_id, 'cash_out', v_req.amount, v_customer.currency,
    v_agent.full_name, v_agent.phone, v_customer.provider, 'completed', 'agent',
    'Get Cash via Monde Agent', v_reference, v_fee, now()
  ) RETURNING id INTO v_customer_txn_id;

  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_agent_id, v_req.customer_id, 'receive', v_req.amount + v_agent_commission, v_agent.currency,
    v_customer.full_name, v_customer.phone, v_agent.provider, 'completed', 'agent',
    'Get Cash — Agent commission K' || v_agent_commission::TEXT, v_reference || '-A', 0, now()
  );

  -- === FEE LEDGER ===
  IF v_monde_fee > 0 THEN
    INSERT INTO monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
    VALUES (v_customer_txn_id, 'cashout_fee', v_req.amount, v_monde_fee, v_customer.currency, v_req.customer_id);
  END IF;

  -- === UPDATE REQUEST ===
  UPDATE cash_out_requests SET
    status = 'completed',
    agent_id = v_agent_id,
    agent_commission = v_agent_commission,
    monde_fee = v_monde_fee,
    completed_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'reference', v_reference,
    'amount', v_req.amount,
    'fee', v_fee,
    'agent_commission', v_agent_commission,
    'monde_fee', v_monde_fee,
    'customer_name', v_customer.full_name,
    'volume_bonus', v_agent_daily_count >= 50
  );
END;
$$;
`);

if (result !== null) {
  console.log('✅ process_cash_out updated with customer daily limit');
}

// Verify
const verify = await query(`SELECT prosrc FROM pg_proc WHERE proname = 'process_cash_out';`);
const src = verify[0]?.prosrc || '';
console.log('\nVerification:');
console.log('  Has v_customer_daily_cashouts:', src.includes('v_customer_daily_cashouts'));
console.log('  Limit >= 3:', src.includes('v_customer_daily_cashouts >= 3'));
console.log('  Error msg max 3:', src.includes('max 3 per day'));
