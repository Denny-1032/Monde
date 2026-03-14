# Mobile Money Agent Integration — Research & Implementation Plan

## 1. Market Overview

### What is a Mobile Money Agent?
Mobile Money Agents (MMAs) are individuals or small businesses authorized by Mobile Network Operators (MNOs) to facilitate **Cash-In** (deposit) and **Cash-Out** (withdrawal) transactions for mobile money users. They serve as the physical bridge between cash and digital money — the "human ATMs" of Zambia's financial ecosystem.

### The Zambia Landscape
- **53.6%** of Zambians can access a mobile money agent within 30 minutes on foot (vs. only 17.8% for bank branches)
- Three MNO agent networks: **Airtel Money**, **MTN MoMo**, **Zamtel Kwacha**
- Agents operate as individual shops, kiosks, or multi-service outlets
- Typical agent handles **50-200 transactions/day** in urban areas, fewer in rural
- Agent commissions are the primary revenue source — paid monthly by MNOs
- **Float/liquidity management** is the #1 challenge: agents frequently "bounce" (turn away) customers due to insufficient cash or e-float

### Agent Hierarchy
```
MNO (Airtel/MTN/Zamtel)
  └── Super Agent / Distributor / Aggregator
        └── Agent (individual/shop)
              └── Sub-Agent (teller/employee)
```

### Current Commission Structure (Approximate, 2024-2025)

#### Airtel Money Agent Commissions
| Transaction Range | Cash-In (CI) | Cash-Out (CO) |
|---|---|---|
| K1 - K100 | K0.50 | K1.00 |
| K101 - K500 | K1.50 | K3.00 |
| K501 - K1,000 | K3.00 | K6.00 |
| K1,001 - K5,000 | K5.00 | K10.00 |
| K5,001 - K10,000 | K8.00 | K15.00 |

*MTN and Zamtel have similar tiered structures with slight variations.*
*Commissions are accumulated daily and paid out monthly.*

### Key Pain Points for Agents
1. **Float/Liquidity Crisis** — #1 challenge. Agents run out of either cash or e-float mid-day, forcing them to "bounce" customers. 86% of agents in Zambia expressed willingness to use a liquidity management solution (UNCDF/FINCA research).
2. **Single-Network Lock-in** — Most agents operate lines for 1-2 providers. Customers wanting other networks get turned away.
3. **Manual Float Rebalancing** — Agents travel to bank branches or super-agents to rebalance, losing business time.
4. **Commission Tracking** — No easy way to track earnings across multiple provider lines.
5. **Security** — Cash handling risks; fraud from fake deposits/withdrawals.
6. **Rural Access** — Rural agents face worse float shortages and fewer rebalancing options.

---

## 2. Opportunity for Monde

### The Value Proposition
Monde can become a **cross-network agent aggregator platform** — enabling agents to:
1. Process Cash-In/Cash-Out for **all three networks** (Airtel, MTN, Zamtel) from one app
2. **Manage float digitally** — rebalance between networks without visiting banks
3. **Track commissions** across all providers in one dashboard
4. **Earn Monde commissions** on top of MNO commissions
5. **Access float loans** (future feature) — instant liquidity when running low

### How It Fits With What We Have
Monde already has:
- ✅ Lipila API integration (collections + disbursements for all three MNOs)
- ✅ Wallet system with balance management
- ✅ Transaction processing with fee calculations
- ✅ User authentication with PIN security
- ✅ Real-time balance and transaction updates
- ✅ Supabase backend with RLS security

**The agent feature extends the existing architecture** — agents are power users who process transactions on behalf of others.

### Revenue Model
| Revenue Stream | Description | Estimated Rate |
|---|---|---|
| **Agent Transaction Fee** | Small fee per Cash-In/Cash-Out on top of MNO commission | 0.25-0.5% |
| **Float Management Fee** | Fee when agents rebalance float between networks via Monde | K2-5 flat |
| **Premium Agent Tools** | Monthly subscription for advanced analytics, multi-teller | K50-200/month |
| **Float Lending** (Phase 2) | Interest on short-term float loans to agents | 2-5% per loan |

---

## 3. Regulatory Considerations

### Bank of Zambia Requirements
- **National Payment Systems (Electronic Money Issuance) Directives 2015** governs mobile money
- **Agent registration**: Agents must be registered with the MNO and comply with KYC
- **Monde's role**: As an aggregator/technology platform (NOT an e-money issuer), Monde facilitates agent operations using existing MNO infrastructure via Lipila
- **No separate e-money license needed** if Monde acts as a technology intermediary — money flows through Lipila (licensed payment provider) to MNOs
- **KYC requirement**: Agents must verify customer identity for transactions above certain thresholds
- **Transaction limits**: Follow MNO-defined limits (already enforced in our RPCs)

### Compliance Checklist
- [ ] Register as a Payment System Business with BoZ (if not already)
- [ ] Ensure Lipila's merchant agreement covers agent-facilitated transactions
- [ ] Implement agent KYC collection and storage
- [ ] Add transaction reporting capabilities for regulatory compliance
- [ ] Implement AML monitoring for high-value/suspicious agent transactions

---

## 4. Technical Architecture

### New Concepts

#### Agent Profile
An agent is a Monde user with `role = 'agent'` who has additional capabilities:
- Process Cash-In/Cash-Out on behalf of customers
- Maintain float balances per provider
- View commission tracking dashboard
- Access agent-specific tools

#### Agent Float
Float is the working capital an agent needs. Two types:
- **E-Float**: Digital balance in MoMo wallets (used for Cash-Out to customers)
- **Cash Float**: Physical cash on hand (received from Cash-In customers)
Monde tracks e-float per provider for each agent.

#### Agent Transaction
An agent transaction has a **customer** (the person depositing/withdrawing cash) and the **agent** (the Monde user facilitating it):
```
Cash-In:  Customer gives CASH to Agent → Agent sends E-MONEY to Customer's MoMo
Cash-Out: Customer sends E-MONEY from MoMo → Agent gives CASH to Customer
```

### Database Schema Extensions

```sql
-- Agent profiles extension
ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user' 
  CHECK (role IN ('user', 'agent', 'admin'));
ALTER TABLE public.profiles ADD COLUMN agent_status TEXT DEFAULT NULL
  CHECK (agent_status IN ('pending', 'active', 'suspended', NULL));
ALTER TABLE public.profiles ADD COLUMN business_name TEXT;
ALTER TABLE public.profiles ADD COLUMN business_location TEXT;

-- Agent float balances (per provider)
CREATE TABLE public.agent_float (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'airtel', 'mtn', 'zamtel'
  e_float NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_float NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, provider)
);

-- Agent transactions (CICO)
CREATE TABLE public.agent_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('cash_in', 'cash_out')),
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  provider TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  agent_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  monde_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  lipila_reference_id TEXT,
  reference TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Agent commission tracking
CREATE TABLE public.agent_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  transaction_id UUID REFERENCES public.agent_transactions(id),
  provider TEXT NOT NULL,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('cash_in', 'cash_out', 'bonus')),
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled')),
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent KYC documents
CREATE TABLE public.agent_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('nrc', 'business_reg', 'tpin', 'photo')),
  document_url TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### API Flow: Cash-In (Customer deposits cash with agent)

```
1. Agent enters customer phone + amount in app
2. App validates inputs, calculates fees
3. App calls Lipila API: collect from customer's MoMo (customer confirms on phone)
4. On success: 
   - Agent's cash_float += amount (received physical cash)
   - Agent's e_float -= amount (sent e-money to customer)
   - Record agent_transaction with commission
   - Credit Monde fee to admin account
5. Agent hands receipt/confirmation to customer
```

### API Flow: Cash-Out (Customer withdraws cash from agent)

```
1. Customer initiates withdrawal on their phone (sends to agent's MoMo)
   OR Agent enters customer phone + amount
2. App calls Lipila API: disburse to customer's MoMo from Lipila wallet
   (OR the customer sends directly to agent's number)
3. On success:
   - Agent's cash_float -= amount (gave physical cash)
   - Agent's e_float += amount (received e-money)
   - Record agent_transaction with commission
   - Credit Monde fee to admin account
4. Agent gives cash to customer
```

### Float Rebalancing Flow

```
Agent has too much e-float on Airtel, needs MTN e-float:
1. Agent taps "Rebalance" in app
2. Selects: From Airtel K5,000 → To MTN K5,000
3. App calls Lipila:
   a. Disburse K5,000 from Lipila to Agent's Airtel number (cash out)
   b. Collect K5,000 from Agent's MTN number (cash in)
4. Agent float updated across both providers
5. Monde charges rebalancing fee (K2-5)
```

---

## 5. Implementation Plan

### Phase 1: Agent Foundation (2-3 weeks)
**Goal**: Agent registration, basic profile, and float tracking

| # | Task | Priority |
|---|---|---|
| 1.1 | Migration: Add `role`, `agent_status`, `business_name`, `business_location` to `profiles` | High |
| 1.2 | Migration: Create `agent_float` table with RLS | High |
| 1.3 | Migration: Create `agent_kyc` table with storage bucket | High |
| 1.4 | Agent registration flow screen (business info + KYC upload) | High |
| 1.5 | Admin approval flow for agent applications | High |
| 1.6 | Agent dashboard screen (float balances, daily summary) | High |
| 1.7 | Float top-up: agent loads e-float from their MoMo via Lipila | High |

### Phase 2: CICO Transactions (2-3 weeks)
**Goal**: Cash-In and Cash-Out transaction processing

| # | Task | Priority |
|---|---|---|
| 2.1 | Migration: Create `agent_transactions` table with RLS | High |
| 2.2 | RPC: `process_agent_cash_in` — validate, call Lipila collect, update float, record tx | High |
| 2.3 | RPC: `process_agent_cash_out` — validate, call Lipila disburse, update float, record tx | High |
| 2.4 | Cash-In screen: enter customer phone, amount, confirm | High |
| 2.5 | Cash-Out screen: enter customer phone, amount, confirm | High |
| 2.6 | Agent transaction history with filters (cash-in/cash-out/all) | High |
| 2.7 | Transaction receipt screen with share capability | Medium |
| 2.8 | Real-time float balance updates after each transaction | High |

### Phase 3: Commission Tracking (1-2 weeks)
**Goal**: Track and display agent earnings

| # | Task | Priority |
|---|---|---|
| 3.1 | Migration: Create `agent_commissions` table | High |
| 3.2 | Commission calculation logic (tiered, per-provider) | High |
| 3.3 | Commission dashboard: daily/weekly/monthly earnings, per-provider breakdown | High |
| 3.4 | Commission payout tracking (pending vs paid) | Medium |
| 3.5 | Commission history with export capability | Low |

### Phase 4: Float Management (1-2 weeks)
**Goal**: Advanced float tools for agents

| # | Task | Priority |
|---|---|---|
| 4.1 | Float rebalancing between providers (cross-network swap) | High |
| 4.2 | Float alerts: low balance warnings per provider | Medium |
| 4.3 | Float analytics: daily peaks, recommended float levels | Medium |
| 4.4 | Float top-up from bank account (via linked accounts) | Medium |

### Phase 5: Agent Network Management (2-3 weeks)
**Goal**: Super-agent and multi-teller support

| # | Task | Priority |
|---|---|---|
| 5.1 | Super-agent role: manage sub-agents | Medium |
| 5.2 | Multi-teller support: agent can add employees as tellers | Medium |
| 5.3 | Agent location mapping (find nearest agent) | Medium |
| 5.4 | Agent ratings and reviews from customers | Low |
| 5.5 | Agent-to-agent float transfers | Medium |

### Phase 6: Advanced Features (Future)
| # | Task | Priority |
|---|---|---|
| 6.1 | Float lending: instant liquidity loans for agents | Low |
| 6.2 | Bulk disbursements: process multiple withdrawals at once | Low |
| 6.3 | Agent onboarding automation (auto-KYC verification) | Low |
| 6.4 | Regulatory reporting dashboard | Medium |
| 6.5 | Agent performance leaderboard and incentives | Low |

---

## 6. UI/UX Design Notes

### Agent Tab (New)
When a user's `role = 'agent'`, the app shows an **Agent tab** in the bottom navigation (replacing or adding to the existing tabs):

```
[Home] [CICO] [History] [Agent] [Profile]
```

### Agent Dashboard Screen
```
┌──────────────────────────┐
│  Agent Dashboard         │
├──────────────────────────┤
│  Today's Summary         │
│  ┌────────┐ ┌──────────┐ │
│  │Cash-In │ │ Cash-Out │ │
│  │ K12,500│ │  K8,200  │ │
│  │ 23 txns│ │  15 txns │ │
│  └────────┘ └──────────┘ │
│                          │
│  Float Balances          │
│  ● Airtel  K5,200 (e)   │
│  ● MTN     K3,100 (e)   │
│  ● Zamtel  K1,800 (e)   │
│  Cash on hand: K15,400   │
│                          │
│  Today's Commission      │
│  K285.50                 │
│                          │
│  [Cash-In] [Cash-Out]    │
│  [Rebalance] [Top Up]    │
└──────────────────────────┘
```

### CICO Transaction Screen
```
┌──────────────────────────┐
│  Cash-In                 │
├──────────────────────────┤
│  Customer Phone          │
│  ┌──────────────────────┐│
│  │ 097 XXX XXXX         ││
│  └──────────────────────┘│
│  Provider: [Airtel ▼]    │
│                          │
│  Amount                  │
│        K 500             │
│                          │
│  Commission: K3.00       │
│  Monde fee:  K1.25       │
│                          │
│  [Process Cash-In]       │
└──────────────────────────┘
```

---

## 7. Integration with Existing Codebase

### Files to Modify
- `constants/types.ts` — Add AgentProfile, AgentTransaction, AgentFloat types
- `lib/api.ts` — Add agent API functions (CICO processing, float management)
- `store/useStore.ts` — Add agent state and actions
- `app/(tabs)/_layout.tsx` — Conditionally show Agent tab for agent users
- `constants/theme.ts` — Add agent-specific colors and styling

### New Files
- `app/agent/` — Agent screens directory
  - `dashboard.tsx` — Agent dashboard
  - `cash-in.tsx` — Cash-In flow
  - `cash-out.tsx` — Cash-Out flow
  - `float.tsx` — Float management
  - `commissions.tsx` — Commission tracking
  - `register.tsx` — Agent registration flow
- `components/AgentFloatCard.tsx` — Float balance display
- `components/AgentTransactionItem.tsx` — CICO transaction list item
- `supabase/migrations/026_agent_tables.sql` — All agent-related schema

### Lipila API Usage
All agent CICO transactions flow through the existing Lipila integration:
- **Cash-In**: Lipila `collect` API (same as user top-up)
- **Cash-Out**: Lipila `disburse` API (same as user withdrawal)
- The existing `lipila-payments` Edge Function handles both — no changes needed
- Agent transactions just need a different RPC that tracks agent-specific data

---

## 8. Competitive Analysis

### Existing Solutions in Zambia
| Platform | What They Do | Monde Advantage |
|---|---|---|
| Individual MNO apps (Airtel, MTN, Zamtel) | Single-network agent tools | Monde: cross-network aggregation |
| Tola Mobile | API aggregator for merchants | Monde: consumer-facing + agent tools |
| Zoona (defunct 2023) | Was the dominant agent network | Market gap since Zoona's exit |

### Key Differentiators for Monde
1. **Cross-network in one app** — Agents handle Airtel, MTN, Zamtel from one interface
2. **Integrated float management** — Rebalance between networks digitally
3. **Lower barrier to entry** — Register as agent through the app (vs. complex MNO process)
4. **Consumer + Agent** — Same app for personal use AND agent business
5. **Zoona replacement** — Fill the gap left by Zoona's exit from Zambia

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Regulatory rejection | High | Start with Lipila as licensed intermediary; consult BoZ early |
| MNO resistance | Medium | Position as channel expansion, not competition; negotiate via Lipila |
| Agent fraud | High | KYC verification, transaction limits, anomaly detection |
| Float liquidity | Medium | Float lending feature (Phase 6), bank integrations |
| Low adoption | Medium | Competitive commission rates, easy onboarding, marketing |
| Technical complexity | Medium | Phased rollout, extensive testing per phase |

---

## 10. Success Metrics

| Metric | Target (6 months) | Target (12 months) |
|---|---|---|
| Registered agents | 500 | 2,000 |
| Monthly CICO transactions | 10,000 | 50,000 |
| Monthly CICO volume | K5M | K25M |
| Agent retention rate | 70% | 80% |
| Average agent daily transactions | 20 | 40 |
| Monde revenue from agent fees | K50,000/month | K250,000/month |

---

## 11. Recommended Next Steps

1. **Validate with agents**: Talk to 10-20 real mobile money agents in Lusaka to validate the value proposition and commission expectations
2. **Confirm Lipila support**: Verify with Lipila that agent-facilitated transactions are supported under your merchant agreement
3. **BoZ consultation**: Brief the Bank of Zambia on the planned agent aggregator model to get early guidance
4. **Start Phase 1**: Begin with database schema and agent registration flow
5. **Pilot with 10 agents**: Recruit a small test group before full launch
