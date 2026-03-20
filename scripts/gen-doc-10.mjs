import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Customer Funds\nSafeguarding Measures', 'Arrangements for Protecting\nCustomer Funds and Ensuring Continuity', '1.0', TODAY),
  ...disclaimer(),

  heading('1. INTRODUCTION'),
  para('This document describes the measures implemented by Monde Limited to safeguard customer funds, ensure the continuity and reliability of the payment system, and protect the interests of Monde users. These measures are designed in compliance with Section 1.4.14 of the Bank of Zambia Requirements for Designation of a Payment System, February 2025.'),
  para('Monde recognises that the safeguarding of customer funds is of paramount importance to maintaining public trust in the payment system and ensuring the stability of the financial ecosystem.'),

  heading('2. FUND SEGREGATION'),

  subheading('2.1 Trust Account'),
  para('Monde will maintain all customer funds in a designated trust account held at a licensed commercial bank in Zambia, separate and distinct from Monde operational funds. This trust account:'),
  bullet('Is held in the name of Monde Limited, designated as a trust account for customer funds'),
  bullet('Is used exclusively for holding customer funds — no operational expenses are paid from this account'),
  bullet('Is subject to restrictions that prevent Monde from using customer funds for its own business purposes'),
  bullet('Is reconciled daily against the aggregate of all customer wallet balances in the Monde system'),

  subheading('2.2 Operational Account'),
  para('Monde maintains a separate operational bank account for:'),
  bullet('Revenue from transaction fees (transferred from the fee ledger)'),
  bullet('Payment of salaries, rent, and other operational expenses'),
  bullet('Payment of third-party service provider fees (Lipila, Supabase, Twilio)'),
  bullet('Capital expenditure'),
  para('There is a strict separation between the trust account (customer funds) and the operational account (Monde funds). No transfers from the trust account to the operational account are permitted except for fee revenue that has been properly recorded and reconciled.'),

  subheading('2.3 Fee Ledger Separation'),
  para('Within the Monde system, fees collected from transactions are tracked in a dedicated fee ledger account (a system-controlled account that is separate from all customer accounts). This account:'),
  bullet('Cannot be accessed by any user through the application'),
  bullet('Cannot sign in or perform transactions — it exists purely as a ledger entry'),
  bullet('Accumulates fees from all transaction types (P2P, top-up, withdrawal, cash-out)'),
  bullet('Disburses agent commissions for cash-in transactions'),
  bullet('Revenue can only be withdrawn by an authorised administrator through a controlled admin function'),

  heading('3. FUND PROTECTION MEASURES'),

  subheading('3.1 Real-Time Balance Integrity'),
  para('The Monde system ensures that customer funds are always fully backed:'),
  bullet('Atomic Transactions: All balance changes are executed within database transactions that ensure either all changes succeed or none are applied. This prevents any state where debits do not equal credits.'),
  bullet('Non-Negative Balance Constraint: Database constraints prevent any customer wallet balance from going below zero. Transactions that would result in a negative balance are rejected.'),
  bullet('Immutable Transaction Records: All transaction records are insert-only — they cannot be modified or deleted after creation, providing a complete and tamper-proof audit trail.'),

  subheading('3.2 Daily Reconciliation'),
  para('Monde performs daily reconciliation to ensure fund integrity:'),
  bullet('Internal Reconciliation: Sum of all customer wallet balances + fee ledger balance = total system float. Any discrepancy triggers an immediate alert to the CFO and CITO.'),
  bullet('External Reconciliation: Trust account bank statement is reconciled against the total system float. Lipila settlement reports are reconciled against pending and completed external transactions.'),
  bullet('Fee Reconciliation: Total fees recorded in the monde_fees table are reconciled against expected fees based on transaction amounts and types.'),

  subheading('3.3 Access Controls'),
  para('Access to customer funds is strictly controlled:'),
  bullet('Database Level: Row-Level Security (RLS) policies ensure that no user can access or modify another user balance or transaction records.'),
  bullet('Application Level: All financial operations are performed through server-side Remote Procedure Calls (RPCs) that enforce business rules and access controls.'),
  bullet('Administrative Level: Only designated administrators can perform system-level operations, and all admin actions are logged.'),
  bullet('Banking Level: Trust account signatories require dual authorisation for any withdrawals or transfers.'),

  pageBreak(),
  heading('4. INSOLVENCY PROTECTION'),

  subheading('4.1 Fund Priority'),
  para('In the event of Monde insolvency or wind-down:'),
  bullet('Customer funds held in the trust account are ring-fenced and not available to Monde creditors'),
  bullet('Customer funds take priority over all other claims against Monde'),
  bullet('The trust account structure ensures that customer funds can be identified and returned to their rightful owners'),

  subheading('4.2 Wind-Down Plan'),
  para('Monde maintains a wind-down plan that includes:'),
  bullet('Notification to the Bank of Zambia at the earliest indication of financial difficulty'),
  bullet('Customer notification with at least 30 days notice before any service discontinuation'),
  bullet('Orderly return of all customer funds through the withdrawal mechanism or direct bank transfer'),
  bullet('Preservation of all transaction records for the legally required retention period'),
  bullet('Cooperation with the Bank of Zambia in managing the wind-down process'),

  heading('5. CONTINUITY MEASURES'),

  subheading('5.1 Service Availability'),
  para('Monde implements the following measures to ensure service continuity:'),
  bullet('Cloud infrastructure with 99.9% uptime SLA (Supabase/AWS)'),
  bullet('Automated database backups with point-in-time recovery capability'),
  bullet('Edge Function redundancy with automatic failover'),
  bullet('Payment gateway failover procedures (detailed in BCP/DR document)'),

  subheading('5.2 Data Protection'),
  bullet('Automated daily database backups retained for 7 days'),
  bullet('Point-in-time recovery capability for the PostgreSQL database'),
  bullet('All backups are encrypted with AES-256'),
  bullet('Backup integrity is verified through automated testing'),

  subheading('5.3 Dispute Resolution Fund'),
  para('Monde will establish a reserve fund within the operational account to cover:'),
  bullet('Transaction reversals and refunds'),
  bullet('Dispute resolution costs'),
  bullet('Regulatory penalties (if any)'),
  para('The reserve fund will be maintained at a minimum of 2% of the monthly transaction volume or K100,000, whichever is greater.'),

  heading('6. REPORTING AND OVERSIGHT'),

  subheading('6.1 Internal Reporting'),
  bullet('Daily: Trust account reconciliation report (CFO)'),
  bullet('Weekly: Transaction volume and fee summary (CEO, CFO)'),
  bullet('Monthly: Comprehensive financial report including fund adequacy assessment (Board)'),
  bullet('Quarterly: Independent reconciliation review (external auditor)'),

  subheading('6.2 Regulatory Reporting'),
  para('Monde will provide the Bank of Zambia with:'),
  bullet('Quarterly reports on customer fund holdings and reconciliation status'),
  bullet('Annual audited financial statements prepared by a ZICA-registered auditor'),
  bullet('Immediate notification of any material discrepancy in customer funds'),
  bullet('Any other reports as required by the Bank of Zambia'),

  heading('7. CUSTOMER RIGHTS'),
  para('Monde customers have the following rights regarding their funds:'),
  bullet('Right to Withdraw: Customers can withdraw their full balance at any time through the available withdrawal channels (mobile money, bank transfer, or agent cash-out), subject to standard processing times and fees.'),
  bullet('Right to Information: Customers can view their full transaction history and current balance at any time through the app.'),
  bullet('Right to Dispute: Customers can dispute any transaction and receive a response within the timeframes specified in the Complaints Handling Policy.'),
  bullet('Right to Closure: Customers can close their account at any time. Any remaining balance will be returned to the customer through their preferred withdrawal method.'),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/10_Customer_Funds_Safeguarding.docx');
