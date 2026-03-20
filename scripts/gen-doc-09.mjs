import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Customer Transaction\nPolicies and Procedures', 'Policies Governing Customer\nTransactions on the Monde Platform', '1.0', TODAY),
  ...disclaimer(),

  heading('1. INTRODUCTION'),
  para('This document sets out the policies and procedures governing transactions between Monde and its customers. These policies ensure that all transactions are conducted in a fair, transparent, and secure manner, in compliance with the National Payment Systems Act, 2007, and the Bank of Zambia regulatory requirements.'),

  heading('2. GENERAL TRANSACTION POLICIES'),

  subheading('2.1 Transaction Currency'),
  para('All transactions on the Monde platform are denominated in Zambian Kwacha (ZMW). Monde does not support multi-currency transactions at this time.'),

  subheading('2.2 Transaction Confirmation'),
  para('Every financial transaction requires explicit customer confirmation:'),
  bullet('The customer must review the transaction details (recipient, amount, fees) before confirming'),
  bullet('PIN verification is required for all financial transactions (send, top-up, withdraw, cash-out request)'),
  bullet('Once confirmed and processed, P2P transactions are final and irrevocable'),
  bullet('Top-up and withdrawal transactions are subject to external payment gateway processing and may be reversed if the external transaction fails'),

  subheading('2.3 Transaction Limits'),
  para('Transaction limits are enforced based on the customer account tier:'),
  createTable(
    ['Tier', 'Maximum Wallet Balance', 'Maximum Daily Transaction Volume', 'Maximum Single Transaction'],
    [
      ['Copper', 'K100,000', 'K20,000', 'K50,000'],
      ['Gold', 'K250,000', 'K50,000', 'K50,000'],
      ['Platinum', 'K500,000', 'K100,000', 'K50,000'],
    ]
  ),
  spacer(),
  para('Limits are enforced at the database level and cannot be circumvented through the application. Exceeding a limit will result in the transaction being rejected with a clear error message to the customer.'),

  subheading('2.4 Transaction Fees'),
  para('All applicable fees are disclosed to the customer before transaction confirmation. Fee details are provided in the separate document: "Product Pricing and Fee Structure." Key principles:'),
  bullet('Fees are deducted from the sender wallet at the time of transaction'),
  bullet('The customer sees the exact fee amount and total deduction before confirming'),
  bullet('Fee records are maintained in a dedicated fee tracking table for audit purposes'),
  bullet('No hidden or undisclosed fees are charged'),

  heading('3. P2P PAYMENT POLICIES'),

  subheading('3.1 Sending Money'),
  para('To send money, the customer must:'),
  bullet('Have sufficient balance to cover the payment amount plus any applicable fee'),
  bullet('Provide the recipient phone number, scan their QR code, or use NFC'),
  bullet('Confirm the transaction with their PIN'),
  para('Restrictions:'),
  bullet('Customers cannot send money to themselves'),
  bullet('Agent accounts are blocked from using P2P send (agents must use agent-specific functions)'),
  bullet('Frozen accounts cannot send money'),
  bullet('The recipient must be a registered Monde user'),

  subheading('3.2 Receiving Money'),
  para('Receiving money is automatic and requires no action from the recipient. When a P2P payment is received:'),
  bullet('The recipient wallet balance is credited immediately'),
  bullet('A push notification is sent to the recipient (if enabled)'),
  bullet('The transaction appears in the recipient transaction history'),
  bullet('Frozen accounts cannot receive P2P payments'),

  subheading('3.3 Transaction Records'),
  para('Both sender and recipient receive a transaction record that includes:'),
  bullet('Transaction ID (unique identifier)'),
  bullet('Date and time'),
  bullet('Amount sent/received'),
  bullet('Fee charged (for sender)'),
  bullet('Counterparty name and phone number'),
  bullet('Transaction status (completed, pending, failed)'),
  bullet('Optional note attached by the sender'),

  pageBreak(),
  heading('4. TOP-UP POLICIES'),

  subheading('4.1 Wallet Top-Up Procedure'),
  bullet('1. Customer selects the top-up amount and funding source (mobile money or bank card)'),
  bullet('2. System displays the fee and net amount to be credited'),
  bullet('3. Customer confirms with PIN'),
  bullet('4. A collection request is sent to the payment gateway (Lipila)'),
  bullet('5. Customer approves the deduction on their mobile money provider (USSD prompt) or card'),
  bullet('6. On successful collection, the wallet is credited with the net amount (amount minus fee)'),
  bullet('7. If the collection fails, no changes are made to the wallet'),

  subheading('4.2 Top-Up Limits'),
  bullet('Minimum top-up: K1.00'),
  bullet('Maximum single top-up: K50,000.00'),
  bullet('Subject to daily transaction limits per account tier'),
  bullet('Subject to maximum wallet balance per account tier'),

  subheading('4.3 Pending Top-Ups'),
  para('Top-up transactions have a pending state while awaiting payment gateway confirmation. Pending transactions:'),
  bullet('Are visible in the customer transaction history with "pending" status'),
  bullet('Can be cancelled by the customer before the payment is approved'),
  bullet('Expire automatically after 30 minutes if no callback is received'),
  bullet('Do not affect the customer available balance until confirmed'),

  heading('5. WITHDRAWAL POLICIES'),

  subheading('5.1 Wallet Withdrawal Procedure'),
  bullet('1. Customer selects the withdrawal amount and destination (mobile money or bank account)'),
  bullet('2. System displays the fee and total amount to be deducted from the wallet'),
  bullet('3. Customer confirms with PIN'),
  bullet('4. Wallet is debited immediately (amount plus fee)'),
  bullet('5. A disbursement request is sent to the payment gateway (Lipila)'),
  bullet('6. Funds are delivered to the customer mobile money or bank account'),
  bullet('7. If the disbursement fails, funds are reversed to the customer wallet'),

  subheading('5.2 Withdrawal Limits'),
  bullet('Minimum withdrawal: K1.00'),
  bullet('Maximum single withdrawal: K50,000.00'),
  bullet('Subject to daily transaction limits per account tier'),
  bullet('Customer must have sufficient balance to cover withdrawal amount plus fee'),

  heading('6. AGENT TRANSACTION POLICIES'),

  subheading('6.1 Agent Cash-In (Deposit)'),
  para('Customers can deposit cash through Monde agents:'),
  bullet('Customer presents cash and their phone number to the agent'),
  bullet('Agent enters the customer phone number and deposit amount in the Monde app'),
  bullet('System verifies: agent status, agent float balance, customer existence, customer account status'),
  bullet('Customer wallet is credited; agent float is debited'),
  bullet('Customer pays no fee; agent earns 0.5% commission from Monde'),
  para('Safety controls:'),
  bullet('Maximum 3 deposits per customer per agent per 24-hour period'),
  bullet('Agents cannot deposit to their own accounts'),
  bullet('Circular fraud detection prevents same-day deposit-and-cashout at same agent'),

  subheading('6.2 Agent Cash-Out'),
  para('Customers can withdraw cash through Monde agents:'),
  bullet('Customer initiates a cash-out request through the Monde app'),
  bullet('Agent confirms the request and disburses physical cash'),
  bullet('Customer wallet is debited (amount plus tiered fee)'),
  bullet('Agent wallet is credited with the amount plus 70% of the fee'),
  para('Safety controls:'),
  bullet('Maximum 3 cash-outs per customer per agent per 24-hour period'),
  bullet('PIN verification required for cash-out request creation'),
  bullet('Agent must confirm they have disbursed the cash before the transaction is processed'),

  pageBreak(),
  heading('7. DISPUTE RESOLUTION'),

  subheading('7.1 Transaction Disputes'),
  para('Customers can raise transaction disputes through:'),
  bullet('In-app customer support (planned feature)'),
  bullet('Phone/WhatsApp support line'),
  bullet('Email: support@monde.co.zm (to be activated)'),

  subheading('7.2 Dispute Resolution Process'),
  bullet('1. Customer reports the dispute with transaction details'),
  bullet('2. Support team acknowledges receipt within 24 hours'),
  bullet('3. Investigation conducted using transaction logs and system records'),
  bullet('4. Resolution provided within 5 business days for straightforward cases'),
  bullet('5. Complex cases may take up to 15 business days'),
  bullet('6. Customer is informed of the outcome and any remedial action'),
  bullet('7. If the customer is unsatisfied, they may escalate to the CCO or the Bank of Zambia'),

  subheading('7.3 Refund Policy'),
  para('Refunds may be issued in the following circumstances:'),
  bullet('System error resulting in incorrect transaction processing'),
  bullet('Failed external transaction where funds were debited but not delivered'),
  bullet('Fraudulent transaction (subject to investigation)'),
  para('P2P transactions between Monde users are generally non-refundable as they are processed instantly and irreversibly. In cases of alleged fraud, Monde will cooperate with law enforcement and may freeze accounts pending investigation.'),

  heading('8. CUSTOMER COMMUNICATION'),
  para('Monde communicates with customers through the following channels:'),
  bullet('In-App Notifications: Real-time transaction alerts and account updates'),
  bullet('SMS: OTP verification, critical account alerts'),
  bullet('Push Notifications: Transaction confirmations, promotional messages (with customer consent)'),
  bullet('Email: Account statements, policy updates (when email is provided)'),
  para('Customers can manage their notification preferences within the app settings.'),

  heading('9. CUSTOMER DATA PROTECTION'),
  para('Monde handles customer data in accordance with data protection principles:'),
  bullet('Data Minimisation: Only essential data is collected for service delivery and compliance'),
  bullet('Purpose Limitation: Customer data is used only for the stated purposes'),
  bullet('Security: All data is encrypted in transit and at rest'),
  bullet('Access Control: Customer data is accessible only through authenticated, authorised requests enforced by Row-Level Security'),
  bullet('Retention: Data is retained as required by law and securely disposed of when no longer needed'),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/09_Customer_Transaction_Policies.docx');
