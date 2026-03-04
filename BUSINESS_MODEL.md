# Monde Business Model & Revenue Implementation Plan

> Last updated: 2026-03-04

## Revenue Streams

### 1. Transaction Fees (Primary Revenue)

| Transaction Type | Fee Structure | Who Pays | Notes |
|---|---|---|---|
| **Top-Up** (deposit) | 1% + K1.00 flat | User | Covers provider integration costs |
| **Withdrawal** | 1.5% + K2.00 flat | User | Higher due to provider payout costs |
| **P2P Payment** (send) | Free under K500, 0.5% above K500 | Sender | Free small transfers drive adoption |
| **QR Payment** (merchant) | 1.5% of transaction | Merchant | Competitive with card processing fees |
| **NFC/Tap to Pay** | 1.5% of transaction | Merchant | Same as QR for consistency |

### 2. Float Interest (Passive Revenue)

- User balances held in a pooled trust account at a Zambian bank
- Monde earns overnight/short-term interest on the float
- At scale (e.g., K50M total float), even 5% annual interest = **K2.5M/year**
- Users don't earn interest (standard for mobile money in Zambia)

### 3. Premium Features (Future)

| Feature | Price | Notes |
|---|---|---|
| **Monde Business** account | K99/month | Higher limits, analytics dashboard, multi-user |
| **Instant withdrawals** | K5 per transaction | Standard withdrawals take 1-24h; instant = premium |
| **Custom QR codes** (branded) | K49 one-time | For businesses wanting branded payment QR |
| **API access** | K499/month | For businesses integrating Monde into their systems |

---

## Fee Collection Architecture

### How Fees Are Deducted

Fees are deducted **on top of the specified amount** (mobile money style). The user always gets or sends the exact amount they chose — the fee is charged separately from their balance.

```
Top-up K1,000   → Fee: K11.00 (1% + K1)     → Wallet credited K1,000, fee deducted from balance → Net +K989
Withdraw K1,000 → Fee: K17.00 (1.5% + K2)   → K1,000 sent to provider, fee from balance      → Net -K1,017
Send K1,000     → Fee: K5.00 (0.5%)          → Recipient gets K1,000, fee from sender balance  → Net -K1,005
Send K300       → Fee: K0.00 (free ≤ K500)   → Recipient gets K300                             → Net -K300
```

All fees are credited atomically to the Monde admin account and recorded in the `monde_fees` ledger.

### Where Fees Go: The Monde Admin Account

A dedicated **Monde system account** (not a regular user) collects all fees:

1. **`monde_fees` table** — records every fee with transaction reference
2. **`monde_admin` profile** — system account with `id = '00000000-0000-0000-0000-000000000000'`
3. Fees are atomically transferred in the same DB transaction as the payment
4. No fee is "lost" — every deduction has a matching record

### Implementation Steps

#### Step 1: Create Monde Admin Account (Migration)

```sql
-- Insert system admin profile for fee collection
INSERT INTO profiles (id, phone, full_name, handle, provider, balance, currency)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '+260000000000',
  'Monde',
  'monde',
  'monde',
  0.00,
  'ZMW'
) ON CONFLICT (id) DO NOTHING;
```

#### Step 2: Create Fee Ledger Table

```sql
CREATE TABLE monde_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  fee_type TEXT NOT NULL, -- 'topup_fee', 'withdraw_fee', 'payment_fee', 'merchant_fee'
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'ZMW',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_monde_fees_created ON monde_fees(created_at);
CREATE INDEX idx_monde_fees_type ON monde_fees(fee_type);
```

#### Step 3: Update RPCs to Collect Fees

Each RPC (`process_payment`, `process_topup`, `process_withdraw`) already calculates fees. They need to be updated to:

1. Deduct fee from the transaction amount (or add to sender's charge)
2. Credit the fee to the Monde admin account balance
3. Insert a record into `monde_fees`

Example for `process_payment`:
```sql
-- Calculate fee
v_fee := CASE
  WHEN p_amount <= 500 THEN 0
  ELSE ROUND(p_amount * 0.005, 2)
END;

-- Debit sender (amount + fee)
UPDATE profiles SET balance = balance - (p_amount + v_fee) WHERE id = p_sender_id;

-- Credit recipient (full amount)
UPDATE profiles SET balance = balance + p_amount WHERE id = p_recipient_id;

-- Credit Monde admin (fee)
UPDATE profiles SET balance = balance + v_fee
WHERE id = '00000000-0000-0000-0000-000000000000';

-- Record the fee
INSERT INTO monde_fees (transaction_id, fee_type, amount)
VALUES (v_txn_id, 'payment_fee', v_fee);
```

#### Step 4: Admin Dashboard (Future)

- View total fees collected (daily/weekly/monthly)
- View fee breakdown by type
- View total float (sum of all user balances)
- Export reports for accounting

---

## Regulatory Considerations (Zambia)

1. **Bank of Zambia (BOZ)** — Monde needs an Electronic Money Issuer (EMI) license
2. **ZICTA** — Telecommunications license if processing mobile money
3. **Trust Account** — User funds must be held in a regulated trust account (100% backed)
4. **KYC/AML** — Must verify user identity for transactions above BOZ thresholds
5. **Data Protection** — Comply with Zambia Data Protection Act 2021

## Competitive Positioning

| Feature | Monde | Airtel Money | MTN MoMo | Banks |
|---|---|---|---|---|
| Cross-provider transfers | Yes | No | No | Limited |
| QR payments | Yes | No | Limited | Some |
| NFC/Tap to Pay | Yes | No | No | Card only |
| P2P fees (small amounts) | Free | K1-3 | K1-3 | K5-15 |
| Merchant fees | 1.5% | 2-3% | 2-3% | 2.5-4% |
| Real-time transfers | Yes | Within network | Within network | T+1 |

## Revenue Projections (Conservative)

| Metric | Month 1 | Month 6 | Month 12 |
|---|---|---|---|
| Active users | 500 | 5,000 | 25,000 |
| Avg transactions/user/month | 8 | 12 | 15 |
| Avg transaction value | K200 | K350 | K500 |
| Monthly transaction volume | K800K | K21M | K187.5M |
| Monthly fee revenue | K8K | K210K | K1.87M |
| Float interest (annual equiv) | K2K | K50K | K450K |

---

## Implementation Priority

1. ~~**Now**: Test deposits (fake money) for app testing~~ ✅ DONE
2. ~~**Phase 1**: Monde admin account + fee ledger migration~~ ✅ DONE (`020_monde_admin_fees.sql`)
3. ~~**Phase 2**: Update RPCs to collect fees atomically~~ ✅ DONE (all 3 RPCs updated)
4. ~~**Phase 2b**: Client-side fee display + mock paths~~ ✅ DONE
5. **Phase 3**: Provider API integration (Airtel Money, MTN MoMo)
6. **Phase 4**: Admin dashboard for fee monitoring
7. **Phase 5**: BOZ EMI license application + compliance
