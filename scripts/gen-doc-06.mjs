import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Product Pricing &\nFee Structure', 'Comprehensive Fee Schedule\nfor All Monde Services', '1.0', TODAY),
  ...disclaimer(),

  heading('1. INTRODUCTION'),
  para('This document provides a comprehensive description of the product pricing and fee structure for the Monde digital payment system. Monde is committed to transparent and competitive pricing that ensures affordability for customers while sustaining the business operations and incentivising the agent network.'),
  para('All fees are denominated in Zambian Kwacha (ZMW). Fees are clearly displayed to customers before transaction confirmation, ensuring full transparency.'),

  heading('2. PRICING PHILOSOPHY'),
  para('Monde pricing is guided by the following principles:'),
  bullet('Transparency: All fees are disclosed to the user before transaction confirmation. No hidden charges.'),
  bullet('Competitiveness: Fees are set at or below market rates for comparable mobile money services in Zambia.'),
  bullet('Inclusivity: Basic P2P transfers under K500 are free to encourage adoption among low-income users.'),
  bullet('Sustainability: Fees are structured to cover operational costs, payment gateway charges, and agent commissions while generating sustainable margins.'),
  bullet('Simplicity: Fee structures are straightforward and easy for customers to understand.'),

  heading('3. FEE SCHEDULE'),

  subheading('3.1 Person-to-Person (P2P) Payments'),
  para('P2P payments allow Monde users to send money to other Monde users instantly.'),
  createTable(
    ['Transaction Amount', 'Fee', 'Who Pays'],
    [
      ['K0.01 - K500.00', 'FREE', 'N/A'],
      ['K500.01 - K50,000.00', '0.5% of transaction amount', 'Sender'],
    ]
  ),
  spacer(),
  para('Examples:'),
  bullet('Sending K200: Fee = K0.00 (free). Total deducted from sender: K200.00'),
  bullet('Sending K1,000: Fee = K5.00 (0.5% of K1,000). Total deducted from sender: K1,005.00'),
  bullet('Sending K5,000: Fee = K25.00 (0.5% of K5,000). Total deducted from sender: K5,025.00'),
  para('Rationale: Free transfers under K500 encourage adoption and serve unbanked and low-income populations. The 0.5% fee on larger amounts is significantly lower than traditional mobile money P2P fees (typically 1-3%).'),

  subheading('3.2 Wallet Top-Up (Loading Funds)'),
  para('Wallet top-up allows users to load funds into their Monde wallet from external mobile money accounts or bank cards.'),
  createTable(
    ['Funding Source', 'Fee', 'Who Pays'],
    [
      ['Airtel Money', '3% of top-up amount', 'User'],
      ['MTN Money', '3% of top-up amount', 'User'],
      ['Zamtel Kwacha', '3% of top-up amount', 'User'],
      ['Bank Card (Visa/Mastercard)', '4% of top-up amount', 'User'],
    ]
  ),
  spacer(),
  para('Examples:'),
  bullet('Top-up K500 from Airtel Money: Fee = K15.00 (3%). Amount credited to wallet: K485.00'),
  bullet('Top-up K2,000 from MTN Money: Fee = K60.00 (3%). Amount credited to wallet: K1,940.00'),
  bullet('Top-up K1,000 from Bank Card: Fee = K40.00 (4%). Amount credited to wallet: K960.00'),
  para('Fee breakdown: Mobile money top-up fees (3%) cover the Lipila payment gateway processing fee (2.5%) and Monde operational margin (0.5%). Card top-up fees (4%) cover the Lipila card processing fee (4%) at cost, with no Monde margin on card collections — this encourages mobile money usage while still providing card convenience.'),

  subheading('3.3 Wallet Withdrawal (Cashing Out)'),
  para('Wallet withdrawal allows users to transfer funds from their Monde wallet to their mobile money account or bank account.'),
  createTable(
    ['Destination', 'Fee', 'Who Pays'],
    [
      ['Airtel Money', '3% of withdrawal amount', 'User'],
      ['MTN Money', '3% of withdrawal amount', 'User'],
      ['Zamtel Kwacha', '3% of withdrawal amount', 'User'],
      ['Bank Account', '3% of withdrawal amount', 'User'],
    ]
  ),
  spacer(),
  para('Examples:'),
  bullet('Withdraw K1,000 to MTN Money: Fee = K30.00. Total deducted from wallet: K1,030.00. Amount received: K1,000.00'),
  bullet('Withdraw K5,000 to Bank: Fee = K150.00. Total deducted from wallet: K5,150.00. Amount received: K5,000.00'),
  para('Fee breakdown: The 3% fee covers the Lipila payment gateway disbursement fee (1.5% for mobile money) and Monde operational margin.'),

  pageBreak(),
  subheading('3.4 Agent Cash-In (Deposit) Fees'),
  para('Agent cash-in allows customers to deposit physical cash through a Monde agent, who credits the customer Monde wallet.'),
  createTable(
    ['Transaction', 'Customer Fee', 'Agent Commission', 'Paid By'],
    [
      ['Any amount', 'FREE (K0.00)', '0.5% of deposit amount', 'Monde (from fee ledger)'],
    ]
  ),
  spacer(),
  para('Examples:'),
  bullet('Customer deposits K1,000 via agent: Customer pays K0.00 fee. Agent earns K5.00 commission (paid by Monde).'),
  bullet('Customer deposits K10,000 via agent: Customer pays K0.00 fee. Agent earns K50.00 commission (paid by Monde).'),
  para('Rationale: Free deposits for customers encourage wallet loading and platform usage. Agent commissions are funded by Monde from the fee ledger to incentivise agent participation and network growth.'),

  subheading('3.5 Agent Cash-Out Fees'),
  para('Agent cash-out allows customers to withdraw physical cash through a Monde agent. A tiered fee structure applies based on the transaction amount.'),
  createTable(
    ['Transaction Amount (ZMW)', 'Total Fee (ZMW)', 'Agent Share (70%)', 'Monde Share (30%)'],
    [
      ['K1 - K50', 'K2.50', 'K1.75', 'K0.75'],
      ['K51 - K100', 'K5.00', 'K3.50', 'K1.50'],
      ['K101 - K500', 'K10.00', 'K7.00', 'K3.00'],
      ['K501 - K1,000', 'K15.00', 'K10.50', 'K4.50'],
      ['K1,001 - K2,500', 'K20.00', 'K14.00', 'K6.00'],
      ['K2,501 - K5,000', 'K30.00', 'K21.00', 'K9.00'],
      ['K5,001 - K10,000', 'K40.00', 'K28.00', 'K12.00'],
      ['K10,001 and above', 'K50.00', 'K35.00', 'K15.00'],
    ]
  ),
  spacer(),
  para('Examples:'),
  bullet('Customer withdraws K200 cash from agent: Fee = K10.00. Agent earns K7.00. Monde earns K3.00.'),
  bullet('Customer withdraws K3,000 cash from agent: Fee = K30.00. Agent earns K21.00. Monde earns K9.00.'),
  para('Rationale: Tiered flat fees are simpler for customers to understand compared to percentage-based fees. The 70/30 split in favour of agents incentivises agent network growth and retention.'),
  para('Volume Bonus: Agents processing more than 50 cash-out transactions per day qualify for a 75/25 revenue split, further incentivising high-volume agents.'),

  subheading('3.6 Agent-to-Agent Transfers'),
  createTable(
    ['Transaction', 'Fee'],
    [
      ['Agent-to-Agent float transfer', 'FREE (K0.00)'],
    ]
  ),
  spacer(),
  para('Agent-to-agent transfers are free to facilitate liquidity management within the agent network. A daily cap of K50,000 per agent applies to prevent misuse.'),

  pageBreak(),
  heading('4. ACCOUNT LIMITS BY TIER'),
  createTable(
    ['Tier', 'Maximum Wallet Balance', 'Maximum Daily Transactions', 'Upgrade Requirement'],
    [
      ['Copper (Default)', 'K100,000', 'K20,000', 'Automatic on registration'],
      ['Gold', 'K250,000', 'K50,000', 'Admin approval + Standard CDD'],
      ['Platinum', 'K500,000', 'K100,000', 'Admin approval + Enhanced CDD'],
    ]
  ),
  spacer(),

  heading('5. FEE COMPARISON WITH MARKET'),
  para('The following table compares Monde fees with prevailing mobile money fees in Zambia:'),
  createTable(
    ['Service', 'Monde', 'Airtel Money', 'MTN MoMo', 'Zamtel Kwacha'],
    [
      ['P2P (K500)', 'FREE', '1.5% - 3%', '1.5% - 3%', '1.5% - 3%'],
      ['P2P (K1,000)', 'K5.00 (0.5%)', 'K15 - K30', 'K15 - K30', 'K15 - K30'],
      ['Top-Up (MoMo)', '3%', 'N/A (native)', 'N/A (native)', 'N/A (native)'],
      ['Top-Up (Card)', '4%', 'N/A', 'N/A', 'N/A'],
      ['Withdrawal', '3%', '2% - 5%', '2% - 5%', '2% - 5%'],
      ['Cash-In via Agent', 'FREE', 'FREE', 'FREE', 'FREE'],
      ['Cash-Out via Agent', 'K2.50 - K50', 'K3 - K75', 'K3 - K75', 'K3 - K75'],
    ]
  ),
  spacer(),
  para('Note: Competitor fees are approximate and may vary. Monde offers a significant cost advantage, particularly for P2P payments where transactions under K500 are completely free.'),

  heading('6. FEE DISCLOSURE'),
  para('Monde ensures full fee transparency through the following mechanisms:'),
  bullet('Pre-Transaction Display: Before confirming any transaction, the user is shown the exact fee amount, the total amount to be deducted, and the net amount to be received/credited.'),
  bullet('Transaction History: All fees are recorded and visible in the user transaction history.'),
  bullet('Fee Schedule Publication: The complete fee schedule is published on the Monde website and within the app settings.'),
  bullet('Agent Fee Display: Agents are required to display the cash-out fee schedule at their service points.'),

  heading('7. FEE CHANGES'),
  para('Any changes to the fee structure will be:'),
  bullet('Communicated to customers at least 30 days in advance via in-app notification and SMS'),
  bullet('Submitted to the Bank of Zambia for approval before implementation'),
  bullet('Updated in all customer-facing materials and documentation'),
  bullet('Effective only after the notification period has elapsed'),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/06_Product_Pricing_and_Fee_Structure.docx');
