import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Payment System Rules', 'Operating Rules, Clearing Rules\nand Failure-to-Settle Arrangements', '1.0', TODAY),
  ...disclaimer(),

  heading('1. INTRODUCTION'),
  para('This document sets out the Payment System Rules governing the operation of the Monde digital payment system. These rules establish the framework for transaction processing, clearing, settlement, dispute resolution, and failure-to-settle arrangements. They are prepared in compliance with Section 1.6.1(e) of the Bank of Zambia Requirements for Designation of a Payment System, February 2025.'),

  heading('2. DEFINITIONS'),
  bullet('Agent: A person or entity authorised by Monde to facilitate cash-in and cash-out transactions on behalf of customers.'),
  bullet('Customer: An individual who has registered for and maintains a Monde wallet account.'),
  bullet('Fee Ledger: The internal system account that collects transaction fees and disburses agent commissions.'),
  bullet('Monde Wallet: The digital wallet maintained by Monde for each customer, denominated in Zambian Kwacha (ZMW).'),
  bullet('P2P Payment: A person-to-person payment between two Monde wallet holders.'),
  bullet('Payment Gateway: The third-party service (Lipila) that facilitates external payment processing.'),
  bullet('Settlement: The final and irrevocable transfer of value to discharge an obligation.'),
  bullet('Trust Account: The designated bank account holding aggregated customer funds.'),

  heading('3. MEMBERSHIP AND PARTICIPATION'),

  subheading('3.1 Customer Membership'),
  para('Any individual with a valid Zambian mobile phone number may become a Monde customer by completing the registration process, which includes:'),
  bullet('Providing their full legal name and phone number'),
  bullet('Verifying phone ownership via SMS OTP'),
  bullet('Creating a 4-digit PIN'),
  bullet('Agreeing to the Monde Terms of Service'),
  para('Monde reserves the right to refuse registration or terminate membership where there are reasonable grounds, including but not limited to suspected fraud, money laundering, or non-compliance with KYC requirements.'),

  subheading('3.2 Agent Membership'),
  para('Agent status is granted exclusively by Monde administrators after the agent has:'),
  bullet('Completed the agent onboarding process including enhanced due diligence'),
  bullet('Executed the Agent Agreement'),
  bullet('Completed mandatory AML/CFT training'),
  bullet('Demonstrated adequate float for cash-in/cash-out operations'),
  para('Agent status may be revoked by Monde at any time for non-compliance with these rules, the Agent Agreement, or applicable regulations.'),

  heading('4. TRANSACTION PROCESSING RULES'),

  subheading('4.1 General Rules'),
  bullet('All transactions are denominated in Zambian Kwacha (ZMW)'),
  bullet('All financial transactions require PIN authentication'),
  bullet('Transactions are subject to tier-based limits (balance and daily)'),
  bullet('Frozen accounts are prohibited from all financial transactions'),
  bullet('Transaction records are immutable and retained for a minimum of 10 years'),

  subheading('4.2 P2P Payment Rules'),
  bullet('Sender must have sufficient balance (amount + fee)'),
  bullet('Recipient must be a registered Monde customer'),
  bullet('Agent accounts may not use P2P payment functions'),
  bullet('Customers may not send payments to themselves'),
  bullet('Transactions are final and irrevocable once confirmed'),
  bullet('Fee: Free for amounts up to K500; 0.5% for amounts above K500'),

  subheading('4.3 Top-Up Rules'),
  bullet('Users may top up from linked mobile money accounts or bank cards'),
  bullet('Top-up creates a pending transaction until payment gateway confirmation'),
  bullet('Pending top-ups expire after 30 minutes if no callback is received'),
  bullet('Customer wallet is credited only upon successful payment gateway callback'),
  bullet('Failed collections do not result in any balance change'),
  bullet('Fee: 3% of top-up amount (mobile money); 4% of top-up amount (bank card)'),

  subheading('4.4 Withdrawal Rules'),
  bullet('Users may withdraw to linked mobile money accounts or bank accounts'),
  bullet('Wallet is debited immediately upon confirmation'),
  bullet('If the external disbursement fails, the wallet debit is reversed'),
  bullet('Fee: 3% of withdrawal amount'),

  subheading('4.5 Agent Cash-In Rules'),
  bullet('Agent must have sufficient float balance to cover the deposit amount'),
  bullet('Maximum 3 deposits per customer per agent per 24-hour period'),
  bullet('Agents may not deposit to their own accounts'),
  bullet('Customer pays no fee; agent earns 0.5% commission from Monde'),
  bullet('Transaction is settled instantly on the internal ledger'),

  subheading('4.6 Agent Cash-Out Rules'),
  bullet('Customer must have sufficient balance (amount + tiered fee)'),
  bullet('Maximum 3 cash-outs per customer per agent per 24-hour period'),
  bullet('Circular fraud check: cash-out is rejected if the same agent deposited to the same customer within 24 hours'),
  bullet('Tiered fees apply (K2.50 to K50.00) with 70/30 agent/Monde split'),
  bullet('Transaction is settled instantly on the internal ledger'),

  subheading('4.7 Agent-to-Agent Transfer Rules'),
  bullet('Only agent accounts may use this function'),
  bullet('Free of charge'),
  bullet('Daily cap of K50,000 per agent'),
  bullet('Settled instantly on the internal ledger'),

  pageBreak(),
  heading('5. CLEARING AND SETTLEMENT RULES'),

  subheading('5.1 Internal Settlement (P2P, Agent Transactions)'),
  para('Internal transactions are settled in real-time through atomic database transactions:'),
  bullet('All balance changes within a transaction are executed as an indivisible unit'),
  bullet('Either all changes succeed or none are applied (ACID compliance)'),
  bullet('Settlement is final and irrevocable upon database commit'),
  bullet('No netting or batch processing — each transaction is settled individually'),

  subheading('5.2 External Settlement (Top-Up, Withdrawal)'),
  para('External transactions involve the Lipila payment gateway:'),
  bullet('Collections (top-up): Lipila collects from the customer external account and settles to Monde trust account on a T+1 basis'),
  bullet('Disbursements (withdrawal): Monde initiates disbursement through Lipila, which processes to the customer external account typically within minutes'),
  bullet('Daily reconciliation: Monde reconciles Lipila settlement reports against internal records'),

  subheading('5.3 Fee Settlement'),
  bullet('Fees are collected into the fee ledger account at the time of each transaction'),
  bullet('Agent commissions (cash-in 0.5%) are disbursed from the fee ledger at the time of each deposit'),
  bullet('Agent cash-out fee shares (70%) are credited to the agent at the time of each cash-out'),
  bullet('Net fee revenue is transferred from the fee ledger to Monde operational account periodically'),

  heading('6. FAILURE-TO-SETTLE ARRANGEMENTS'),

  subheading('6.1 Internal Settlement Failure'),
  para('Internal settlement failure is extremely unlikely due to the atomic transaction model. However, in the event of a database failure during transaction processing:'),
  bullet('The atomic transaction is rolled back — no partial settlement occurs'),
  bullet('The customer receives an error message and may retry the transaction'),
  bullet('Database recovery procedures restore the last consistent state'),
  bullet('Point-in-time recovery capability ensures no committed transactions are lost'),

  subheading('6.2 External Settlement Failure — Top-Up'),
  para('If a top-up collection fails:'),
  bullet('Scenario 1: Collection declined by mobile money provider — Pending transaction marked as failed, no balance change'),
  bullet('Scenario 2: Collection successful but callback not received — Daily reconciliation identifies the discrepancy; customer is credited manually after verification'),
  bullet('Scenario 3: Lipila gateway unavailable — Top-up service temporarily suspended; P2P and agent transactions continue'),

  subheading('6.3 External Settlement Failure — Withdrawal'),
  para('If a withdrawal disbursement fails:'),
  bullet('Scenario 1: Disbursement declined by recipient provider — Callback triggers automatic reversal of wallet debit'),
  bullet('Scenario 2: Disbursement sent but callback not received — Daily reconciliation identifies the discrepancy; manual investigation and resolution within 24 hours'),
  bullet('Scenario 3: Lipila gateway unavailable — Withdrawal service temporarily suspended; P2P and agent transactions continue'),

  subheading('6.4 Trust Account Shortfall'),
  para('In the unlikely event that the trust account balance falls below the aggregate customer wallet balance:'),
  bullet('Immediate alert to the CFO and CEO'),
  bullet('Investigation to identify the cause (reconciliation error, fraud, system error)'),
  bullet('Notification to the Bank of Zambia within 24 hours'),
  bullet('Remediation plan implemented immediately, including injection of funds from operational reserves if necessary'),
  bullet('Affected services may be temporarily suspended to prevent further divergence'),

  heading('7. DISPUTE RESOLUTION'),
  para('Disputes arising from transactions on the Monde platform are resolved in accordance with the Complaints Handling and Resolution Policy (Document 16). Key principles:'),
  bullet('Customers may raise disputes within 30 days of the transaction date'),
  bullet('Monde will investigate and respond within 5 business days (standard) or 15 business days (complex)'),
  bullet('Where a system error is confirmed, the customer will be made whole'),
  bullet('Unresolved disputes may be escalated to the Bank of Zambia'),

  heading('8. AMENDMENT OF RULES'),
  para('These Payment System Rules may be amended by Monde with:'),
  bullet('Approval of the Board of Directors'),
  bullet('Notification to the Bank of Zambia'),
  bullet('30 days advance notice to customers for material changes'),
  bullet('Immediate effect for changes required by law or regulation'),

  heading('9. GOVERNING LAW'),
  para('These Payment System Rules are governed by the laws of the Republic of Zambia, including the National Payment Systems Act, 2007, and all regulations and directives issued thereunder by the Bank of Zambia.'),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/13_Payment_System_Rules.docx');
