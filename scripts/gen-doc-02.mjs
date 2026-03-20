import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Business Plan', 'Three-Year Financial Projections\nand Strategic Overview', '1.0', TODAY),
  ...disclaimer(),

  heading('1. EXECUTIVE SUMMARY'),
  para('Monde is a Zambian-founded fintech company that operates a digital payment system enabling individuals and businesses to send, receive, and manage money through a mobile application. Monde addresses the growing demand for affordable, accessible, and efficient digital financial services in Zambia.'),
  para('The Zambian mobile money market has experienced significant growth, with mobile money transactions reaching over K300 billion annually. However, many existing solutions are operator-locked, expensive, or lack interoperability. Monde bridges this gap by providing a network-agnostic platform that works across all major mobile money providers (Airtel Money, MTN Money, Zamtel Kwacha) and banking institutions (FNB, Zanaco, Absa).'),
  para('Monde aims to become the leading interoperable digital wallet in Zambia within three years, targeting 500,000 registered users and processing K2 billion in monthly transaction volume by Year 3.'),

  heading('2. COMPANY INFORMATION'),
  subheading('2.1 Legal Entity'),
  createTable(
    ['Item', 'Details'],
    [
      ['Legal Name', 'Monde Limited (to be registered with PACRA)'],
      ['Trade Name', 'Monde'],
      ['Product Name', 'Monde Digital Wallet'],
      ['Type of Entity', 'Private Limited Company'],
      ['Country of Incorporation', 'Republic of Zambia'],
      ['Head Office Address', 'Lusaka, Zambia (address to be confirmed upon office lease)'],
      ['Business Address', 'Lusaka, Zambia'],
      ['Website', 'www.monde.co.zm (to be launched)'],
      ['Currency of Operation', 'Zambian Kwacha (ZMW)'],
    ]
  ),
  spacer(),

  subheading('2.2 Mission Statement'),
  para('To democratise digital financial services in Zambia by providing an affordable, secure, and interoperable mobile payment platform that empowers every Zambian to participate in the digital economy.'),

  subheading('2.3 Vision Statement'),
  para('To be Zambia\'s most trusted and widely used digital payment platform, connecting people and businesses through seamless, instant financial transactions.'),

  subheading('2.4 Core Values'),
  bullet('Accessibility: Making digital payments available to all Zambians regardless of network operator or bank'),
  bullet('Security: Protecting customer funds and data with industry-leading security measures'),
  bullet('Transparency: Clear and fair pricing with no hidden fees'),
  bullet('Innovation: Continuously improving our platform with modern technology'),
  bullet('Compliance: Full adherence to all regulatory requirements set by the Bank of Zambia'),

  pageBreak(),
  heading('3. MARKET ANALYSIS'),

  subheading('3.1 Market Overview'),
  para('Zambia has a population of approximately 20 million people, with mobile phone penetration exceeding 100% (multiple SIM ownership). The Bank of Zambia and ZICTA have been active in promoting digital financial inclusion, creating a favourable regulatory environment for fintech innovation.'),
  para('Key market indicators:'),
  bullet('Mobile money accounts: Over 15 million registered accounts across all operators'),
  bullet('Mobile money agents: Over 100,000 registered agents nationwide'),
  bullet('Smartphone penetration: Approximately 35% and growing rapidly'),
  bullet('Internet penetration: Over 50% of the population'),
  bullet('Financial inclusion rate: Approximately 69% of adults have access to some form of financial service'),

  subheading('3.2 Target Market'),
  para('Monde targets the following market segments:'),
  boldPara('Primary Market (Year 1-2):'),
  bullet('Urban youth and young professionals (18-35 years) in Lusaka and Copperbelt'),
  bullet('Small-scale traders and market vendors'),
  bullet('University and college students'),
  boldPara('Secondary Market (Year 2-3):'),
  bullet('Small and medium enterprises (SMEs)'),
  bullet('Peri-urban and rural communities via agent network'),
  bullet('Cross-border workers (Zambia-DRC, Zambia-Tanzania corridors)'),

  subheading('3.3 Competitive Landscape'),
  para('The Zambian digital payments market includes:'),
  createTable(
    ['Competitor', 'Type', 'Monde Advantage'],
    [
      ['Airtel Money', 'Operator-locked mobile money', 'Network-agnostic, lower fees, modern UX'],
      ['MTN MoMo', 'Operator-locked mobile money', 'Network-agnostic, QR/NFC payments'],
      ['Zamtel Kwacha', 'Operator-locked mobile money', 'Network-agnostic, wider coverage'],
      ['SparkPay', 'Third-party wallet', 'Lower fees, agent network, faster onboarding'],
      ['Kazang', 'Agent platform', 'Consumer-focused, P2P capability, digital-first'],
    ]
  ),
  spacer(),

  subheading('3.4 Competitive Advantages'),
  bullet('Interoperability: Works across all mobile money providers and banks'),
  bullet('Modern User Experience: Clean, intuitive mobile app with QR code and NFC payments'),
  bullet('Competitive Pricing: Lower fees than traditional mobile money services'),
  bullet('Agent Network: Cash-in/cash-out services for users who prefer cash'),
  bullet('Real-time Processing: Instant P2P payments with live balance updates'),
  bullet('Three-Click Transactions: Maximum of three taps to complete any transaction'),

  pageBreak(),
  heading('4. PRODUCTS AND SERVICES'),
  subheading('4.1 Service Portfolio'),
  createTable(
    ['Service', 'Description', 'Target Users'],
    [
      ['P2P Payments', 'Send/receive money via phone, QR code, or NFC', 'All users'],
      ['Wallet Top-Up', 'Load funds from mobile money or bank card', 'All users'],
      ['Wallet Withdrawal', 'Cash out to mobile money or bank account', 'All users'],
      ['Agent Cash-In', 'Deposit cash via agent', 'Cash-preferring users'],
      ['Agent Cash-Out', 'Withdraw cash via agent', 'Cash-preferring users'],
      ['QR Payments', 'Scan-to-pay for quick transfers', 'All users'],
      ['NFC Payments', 'Tap-to-pay contactless transfers', 'Smartphone users'],
    ]
  ),
  spacer(),

  subheading('4.2 Fee Structure Summary'),
  createTable(
    ['Transaction Type', 'Fee', 'Who Pays', 'Revenue Model'],
    [
      ['P2P Payment (up to K500)', 'Free', 'N/A', 'User acquisition'],
      ['P2P Payment (above K500)', '0.5% of amount', 'Sender', 'Transaction fee'],
      ['Wallet Top-Up (MoMo)', '3% of amount', 'User', 'Collection fee'],
      ['Wallet Top-Up (Card)', '4% of amount', 'User', 'Collection fee (at cost)'],
      ['Wallet Withdrawal', '3% of amount', 'User', 'Disbursement fee'],
      ['Agent Cash-In (Deposit)', '0.5% of amount', 'Monde (to agent)', 'Agent commission'],
      ['Agent Cash-Out', 'K2.50 - K50.00 (tiered)', 'Customer', '30% to Monde, 70% to agent'],
    ]
  ),
  spacer(),
  para('Detailed fee tables are provided in the separate document: "Product Pricing and Fee Structure."'),

  pageBreak(),
  heading('5. REVENUE MODEL'),
  subheading('5.1 Revenue Streams'),
  para('Monde generates revenue through the following streams:'),
  bullet('Transaction Fees: P2P payment fees on transactions above K500 (0.5% of amount)'),
  bullet('Top-Up Fees: 3% fee on wallet loading from external sources'),
  bullet('Withdrawal Fees: 3% fee on wallet cash-out to external accounts'),
  bullet('Cash-Out Fees: 30% share of tiered cash-out fees (K2.50 to K50.00)'),
  bullet('Float Interest: Interest earned on pooled customer funds held in trust account (future)'),
  bullet('Merchant Services: Transaction fees from merchant integrations (future, Year 2-3)'),

  subheading('5.2 Key Assumptions'),
  para('The following assumptions underlie the financial projections:'),
  bullet('Average top-up amount: K200 (Year 1), K300 (Year 2), K400 (Year 3)'),
  bullet('Average P2P transaction: K150 (Year 1), K200 (Year 2), K250 (Year 3)'),
  bullet('Average transactions per active user per month: 4 (Year 1), 6 (Year 2), 8 (Year 3)'),
  bullet('User acquisition cost: K15 per user (digital marketing, referrals)'),
  bullet('Monthly active user rate: 40% of registered users (Year 1), 50% (Year 2), 55% (Year 3)'),
  bullet('Agent network growth: 50 agents (Year 1), 200 agents (Year 2), 500 agents (Year 3)'),
  bullet('Churn rate: 5% monthly (Year 1), 3% (Year 2), 2% (Year 3)'),

  heading('6. THREE-YEAR FINANCIAL PROJECTIONS'),
  subheading('6.1 User Growth Projections'),
  createTable(
    ['Metric', 'Year 1', 'Year 2', 'Year 3'],
    [
      ['Registered Users', '50,000', '200,000', '500,000'],
      ['Monthly Active Users (MAU)', '20,000', '100,000', '275,000'],
      ['Agents', '50', '200', '500'],
      ['Transactions per Month', '80,000', '600,000', '2,200,000'],
    ]
  ),
  spacer(),

  subheading('6.2 Revenue Projections (ZMW)'),
  createTable(
    ['Revenue Stream', 'Year 1', 'Year 2', 'Year 3'],
    [
      ['P2P Transaction Fees', '360,000', '3,600,000', '16,500,000'],
      ['Top-Up Fees', '1,440,000', '10,800,000', '39,600,000'],
      ['Withdrawal Fees', '720,000', '5,400,000', '19,800,000'],
      ['Cash-Out Fee Share (30%)', '60,000', '720,000', '3,300,000'],
      ['Total Revenue', '2,580,000', '20,520,000', '79,200,000'],
    ]
  ),
  spacer(),

  subheading('6.3 Operating Expenses (ZMW)'),
  createTable(
    ['Expense Category', 'Year 1', 'Year 2', 'Year 3'],
    [
      ['Technology & Infrastructure', '300,000', '600,000', '1,200,000'],
      ['Staff Costs (Salaries & Benefits)', '960,000', '2,400,000', '4,800,000'],
      ['Marketing & User Acquisition', '750,000', '2,000,000', '4,000,000'],
      ['Office Rent & Utilities', '180,000', '360,000', '600,000'],
      ['Compliance & Legal', '200,000', '400,000', '600,000'],
      ['Agent Commissions (Cash-In)', '120,000', '900,000', '3,300,000'],
      ['Payment Gateway Fees (Lipila)', '645,000', '5,130,000', '19,800,000'],
      ['Insurance & Miscellaneous', '100,000', '200,000', '400,000'],
      ['Total Operating Expenses', '3,255,000', '11,990,000', '34,700,000'],
    ]
  ),
  spacer(),

  subheading('6.4 Profit and Loss Summary (ZMW)'),
  createTable(
    ['Item', 'Year 1', 'Year 2', 'Year 3'],
    [
      ['Total Revenue', '2,580,000', '20,520,000', '79,200,000'],
      ['Total Operating Expenses', '(3,255,000)', '(11,990,000)', '(34,700,000)'],
      ['EBITDA', '(675,000)', '8,530,000', '44,500,000'],
      ['Depreciation & Amortisation', '(50,000)', '(100,000)', '(200,000)'],
      ['Net Profit/(Loss) Before Tax', '(725,000)', '8,430,000', '44,300,000'],
      ['Tax (30%)', '0', '(2,529,000)', '(13,290,000)'],
      ['Net Profit/(Loss) After Tax', '(725,000)', '5,901,000', '31,010,000'],
    ]
  ),
  spacer(),
  para('Note: Year 1 shows a net loss which is typical for technology startups in the growth phase. The business achieves profitability in Year 2 and strong margins in Year 3 as the user base scales and unit economics improve.'),

  pageBreak(),
  subheading('6.5 Cash Flow Projections (ZMW)'),
  createTable(
    ['Item', 'Year 1', 'Year 2', 'Year 3'],
    [
      ['Opening Cash Balance', '1,000,000', '325,000', '6,376,000'],
      ['Cash from Operations', '(625,000)', '8,580,000', '44,700,000'],
      ['Capital Expenditure', '(50,000)', '(100,000)', '(300,000)'],
      ['Working Capital Changes', '0', '(2,429,000)', '(13,290,000)'],
      ['Closing Cash Balance', '325,000', '6,376,000', '37,486,000'],
    ]
  ),
  spacer(),

  subheading('6.6 Balance Sheet Summary (ZMW)'),
  createTable(
    ['Item', 'Year 1', 'Year 2', 'Year 3'],
    [
      ['Cash and Cash Equivalents', '325,000', '6,376,000', '37,486,000'],
      ['Fixed Assets (net)', '50,000', '150,000', '250,000'],
      ['Total Assets', '375,000', '6,526,000', '37,736,000'],
      ['Current Liabilities', '100,000', '625,000', '2,726,000'],
      ['Shareholders Equity', '275,000', '5,901,000', '35,010,000'],
      ['Total Liabilities & Equity', '375,000', '6,526,000', '37,736,000'],
    ]
  ),
  spacer(),

  heading('7. INITIAL CAPITAL AND FUNDING'),
  subheading('7.1 Initial Capital Requirements'),
  para('Monde requires initial capital of ZMW 1,000,000 (One Million Zambian Kwacha) to fund:'),
  bullet('Technology development and infrastructure: K300,000'),
  bullet('Staff recruitment and initial salaries (6 months): K480,000'),
  bullet('Marketing and launch campaign: K120,000'),
  bullet('Legal, compliance, and licensing costs: K50,000'),
  bullet('Working capital reserve: K50,000'),

  subheading('7.2 Source of Funds'),
  para('The initial capital will be sourced from the founders/promoters personal savings and investment. Evidence of available funds will be provided in the form of a bank statement from a licensed Zambian bank, confirmed by the bank.'),

  heading('8. OPERATIONAL PLAN'),
  subheading('8.1 Year 1 Milestones'),
  bullet('Q1: Obtain BoZ designation, complete PACRA registration, establish banking relationship'),
  bullet('Q1: Launch Monde app on Google Play Store and Apple App Store'),
  bullet('Q2: Onboard first 10,000 users through targeted digital marketing in Lusaka'),
  bullet('Q2: Recruit and train first 20 agents in Lusaka'),
  bullet('Q3: Expand to Copperbelt Province, onboard 25,000 cumulative users'),
  bullet('Q4: Reach 50,000 registered users, 50 active agents'),

  subheading('8.2 Year 2 Milestones'),
  bullet('Q1-Q2: Expand agent network to 200 agents across Lusaka and Copperbelt'),
  bullet('Q2: Launch merchant payment integration (QR-based)'),
  bullet('Q3: Expand to Southern, Central, and Eastern provinces'),
  bullet('Q4: Reach 200,000 registered users'),

  subheading('8.3 Year 3 Milestones'),
  bullet('Q1: Launch bill payment services (ZESCO, water utilities)'),
  bullet('Q2: Introduce Gold and Platinum tier promotions for business users'),
  bullet('Q3: Nationwide coverage across all 10 provinces'),
  bullet('Q4: Reach 500,000 registered users and K2 billion monthly volume'),

  heading('9. STAFFING PLAN'),
  createTable(
    ['Position', 'Year 1', 'Year 2', 'Year 3'],
    [
      ['Chief Executive Officer', '1', '1', '1'],
      ['Chief Financial Officer', '1', '1', '1'],
      ['Chief Compliance Officer', '1', '1', '1'],
      ['Chief Information Technology Officer', '1', '1', '1'],
      ['Software Developers', '1', '3', '5'],
      ['Customer Support Agents', '2', '5', '10'],
      ['Agent Network Managers', '1', '2', '4'],
      ['Marketing Manager', '0', '1', '2'],
      ['Compliance Analyst', '0', '1', '2'],
      ['Finance & Admin Staff', '1', '2', '3'],
      ['Total Staff', '9', '18', '30'],
    ]
  ),
  spacer(),

  heading('10. NOTES TO FINANCIAL PROJECTIONS'),
  para('The following notes support the three-year financial projections presented in Section 6:'),
  bullet('Note 1 (Revenue Recognition): Revenue is recognised at the point of transaction completion. Top-up and withdrawal fees are recognised when the payment gateway confirms the transaction. P2P fees are recognised instantly upon internal ledger settlement. Cash-out fee revenue (Monde 30% share) is recognised upon agent confirmation.'),
  bullet('Note 2 (Lipila Gateway Costs): Gateway fees are calculated as 2.5% of mobile money collections, 4% of card collections, and 1.5% of mobile money disbursements. These costs are netted against the 3% top-up/withdrawal fee charged to customers. For card collections, the 4% gateway cost exceeds the 3% customer fee, resulting in a 1% subsidy by Monde per card transaction — this is treated as a customer acquisition cost and is included in the Marketing & User Acquisition line in Year 1-2.'),
  bullet('Note 3 (Agent Commissions): Cash-in commissions (0.5% of deposit amount) are paid by Monde from the fee ledger. This is a direct cost of agent network operations and is recorded under Agent Commissions.'),
  bullet('Note 4 (Staff Costs): Year 1 assumes 9 staff including the 4 senior management officers (CEO, CFO, CCO, CITO). Salaries are based on Zambian market rates for fintech professionals. Year 2 and 3 increases reflect headcount growth per the staffing plan in Document 08.'),
  bullet('Note 5 (Technology Costs): Includes Supabase Pro subscription, Twilio SMS costs, EAS build service, domain and hosting, and development tools. Costs scale with user base.'),
  bullet('Note 6 (Tax): Corporate income tax at 30% applied from Year 2 when the company becomes profitable. Year 1 tax loss is carried forward.'),
  bullet('Note 7 (Working Capital): Working capital changes in the cash flow primarily reflect tax payments. Customer funds held in trust are excluded from Monde balance sheet as they are held on behalf of customers.'),
  bullet('Note 8 (Currency): All projections are denominated in Zambian Kwacha (ZMW) as required.'),
  bullet('Note 9 (Transaction Volume Basis): Year 1: 50,000 users × 40% active × 4 txns/month = 80,000 txns/month. Year 2: 200,000 × 50% × 6 = 600,000. Year 3: 500,000 × 55% × 8 = 2,200,000.'),
  spacer(),

  heading('11. RISK FACTORS'),
  para('Key risks and mitigation strategies are detailed in the separate "Risk Management Framework" document. Principal risks include:'),
  bullet('Regulatory Risk: Mitigated through full compliance with BoZ requirements and ongoing engagement'),
  bullet('Technology Risk: Mitigated through robust architecture, redundancy, and disaster recovery planning'),
  bullet('Market Risk: Mitigated through competitive pricing, superior UX, and agent network expansion'),
  bullet('Liquidity Risk: Mitigated through trust account management and reserve requirements'),
  bullet('Cybersecurity Risk: Mitigated through comprehensive security controls and regular audits'),
  bullet('Operational Risk: Mitigated through internal controls, staff training, and BCP/DR planning'),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/02_Business_Plan.docx');
