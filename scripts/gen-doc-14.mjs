import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Risk Management Framework', 'Comprehensive Risk Identification,\nAssessment, and Mitigation', '1.0', TODAY),
  ...disclaimer(),

  heading('1. INTRODUCTION'),
  para('This document presents the comprehensive Risk Management Framework for Monde Limited. It identifies key risks pertaining to the operation of the Monde digital payment system and describes the mitigation measures implemented through policies, controls, product design, and infrastructure safeguards.'),
  para('This framework is prepared in compliance with Section 1.7 of the Bank of Zambia Requirements for Designation of a Payment System, February 2025, which requires that the framework address, at a minimum: cybersecurity risk, operational risk, credit risk, liquidity risk, and money laundering/terrorism financing/proliferation risk.'),

  heading('2. RISK GOVERNANCE'),

  subheading('2.1 Risk Management Structure'),
  para('Risk management responsibility is distributed across the organisation:'),
  createTable(
    ['Level', 'Responsibility', 'Role'],
    [
      ['Board of Directors', 'Ultimate oversight of risk management; approve risk appetite and framework', 'Oversight'],
      ['CEO', 'Ensure risk management is embedded in operations and strategy', 'Executive ownership'],
      ['CITO', 'Manage technology, cybersecurity, and operational technology risks', 'Technology risk owner'],
      ['CCO', 'Manage compliance, AML/CFT, and regulatory risks', 'Compliance risk owner'],
      ['CFO', 'Manage financial, credit, and liquidity risks', 'Financial risk owner'],
      ['All Staff', 'Identify and report risks; comply with risk policies', 'First line of defence'],
    ]
  ),
  spacer(),

  subheading('2.2 Risk Appetite'),
  para('Monde adopts a conservative risk appetite appropriate for a payment system operator:'),
  bullet('Zero tolerance for fraud, money laundering, and regulatory non-compliance'),
  bullet('Low tolerance for system downtime and data loss'),
  bullet('Moderate tolerance for operational inefficiencies during the growth phase'),
  bullet('Risk appetite is reviewed annually by the Board of Directors'),

  heading('3. RISK REGISTER'),
  para('The following sections present the detailed risk assessment for each risk category, including risk description, inherent risk rating, mitigation controls, and residual risk rating.'),
  para('Risk ratings: Critical (5), High (4), Medium (3), Low (2), Very Low (1)'),

  pageBreak(),
  heading('4. CYBERSECURITY RISK'),

  subheading('4.1 Risk Description'),
  para('Cybersecurity risk encompasses threats to the confidentiality, integrity, and availability of Monde systems and data. This includes external attacks (hacking, DDoS, phishing), internal threats (insider misuse), and vulnerabilities in software or infrastructure.'),

  subheading('4.2 Risk Assessment'),
  createTable(
    ['Risk', 'Likelihood', 'Impact', 'Inherent Rating'],
    [
      ['Unauthorised access to customer data', 'Medium', 'Critical', 'High (4)'],
      ['DDoS attack causing service outage', 'Medium', 'High', 'High (4)'],
      ['Exploitation of application vulnerability', 'Medium', 'High', 'High (4)'],
      ['Man-in-the-middle attack on API communications', 'Low', 'Critical', 'Medium (3)'],
      ['Insider threat / malicious employee', 'Low', 'High', 'Medium (3)'],
      ['Malware on customer device', 'Medium', 'Medium', 'Medium (3)'],
    ]
  ),
  spacer(),

  subheading('4.3 Mitigation Controls'),
  bullet('TLS 1.3 encryption for all data in transit — prevents interception and MITM attacks'),
  bullet('AES-256 encryption at rest for database and backups'),
  bullet('Row-Level Security (RLS) policies enforce data access at the database engine level'),
  bullet('JWT-based authentication with short-lived access tokens and encrypted refresh tokens'),
  bullet('PIN-based transaction authorisation with bcrypt hashing'),
  bullet('AWS Shield and CloudFront DDoS protection'),
  bullet('ProGuard/R8 code obfuscation for Android builds'),
  bullet('Expo SecureStore for encrypted credential storage on devices'),
  bullet('Production logging hardened — no sensitive data in production logs (__DEV__ guards)'),
  bullet('Parameterised queries and RPCs prevent SQL injection'),
  bullet('Input validation and sanitisation for all user inputs'),
  bullet('Minimum privilege access for all database roles'),
  bullet('Version control (Git) and code review for all changes'),
  bullet('Regular security testing and vulnerability assessment (planned)'),

  subheading('4.4 Residual Risk'),
  createTable(
    ['Risk', 'Residual Rating'],
    [
      ['Unauthorised access to customer data', 'Low (2)'],
      ['DDoS attack causing service outage', 'Low (2)'],
      ['Exploitation of application vulnerability', 'Low (2)'],
      ['Man-in-the-middle attack', 'Very Low (1)'],
      ['Insider threat', 'Low (2)'],
      ['Malware on customer device', 'Low (2)'],
    ]
  ),
  spacer(),

  pageBreak(),
  heading('5. OPERATIONAL RISK'),

  subheading('5.1 Risk Description'),
  para('Operational risk encompasses losses arising from inadequate or failed internal processes, people, systems, or external events. For Monde, this includes system outages, software bugs, human error, and third-party provider failures.'),

  subheading('5.2 Risk Assessment'),
  createTable(
    ['Risk', 'Likelihood', 'Impact', 'Inherent Rating'],
    [
      ['System outage (database/API)', 'Low', 'Critical', 'High (4)'],
      ['Payment gateway (Lipila) outage', 'Medium', 'High', 'High (4)'],
      ['Software bug causing incorrect transactions', 'Low', 'Critical', 'High (4)'],
      ['Loss of key personnel', 'Medium', 'Medium', 'Medium (3)'],
      ['Third-party provider discontinuation', 'Low', 'High', 'Medium (3)'],
      ['Human error in admin operations', 'Medium', 'Medium', 'Medium (3)'],
    ]
  ),
  spacer(),

  subheading('5.3 Mitigation Controls'),
  bullet('Cloud infrastructure with 99.9% SLA (Supabase/AWS)'),
  bullet('Automated daily backups with point-in-time recovery'),
  bullet('Atomic database transactions preventing partial/incorrect settlements'),
  bullet('Non-negative balance constraints at the database level'),
  bullet('Immutable transaction records (insert-only) for audit trail'),
  bullet('Business Continuity and Disaster Recovery plan (Document 15)'),
  bullet('Graceful degradation: P2P and agent transactions continue if payment gateway is down'),
  bullet('Version-controlled code with testing before deployment'),
  bullet('Admin action logging and audit trail'),
  bullet('Cross-training of staff to reduce single-person dependencies'),
  bullet('Documented procedures for all critical operations'),

  subheading('5.4 Residual Risk'),
  createTable(
    ['Risk', 'Residual Rating'],
    [
      ['System outage', 'Low (2)'],
      ['Payment gateway outage', 'Low-Medium (2-3)'],
      ['Software bug', 'Low (2)'],
      ['Loss of key personnel', 'Low-Medium (2-3)'],
      ['Provider discontinuation', 'Low (2)'],
      ['Human error', 'Low (2)'],
    ]
  ),
  spacer(),

  pageBreak(),
  heading('6. CREDIT RISK'),

  subheading('6.1 Risk Description'),
  para('Credit risk is the risk that a counterparty fails to meet its financial obligations. In the Monde context, credit risk primarily arises from:'),
  bullet('Payment gateway (Lipila) failing to settle collected funds'),
  bullet('Agent float insufficiency'),
  bullet('Failed withdrawals where funds have been debited but not yet reversed'),

  subheading('6.2 Risk Assessment'),
  createTable(
    ['Risk', 'Likelihood', 'Impact', 'Inherent Rating'],
    [
      ['Lipila settlement failure', 'Low', 'High', 'Medium (3)'],
      ['Agent float depletion', 'Medium', 'Low', 'Low (2)'],
      ['Customer overdraft (negative balance)', 'Very Low', 'Medium', 'Low (2)'],
    ]
  ),
  spacer(),

  subheading('6.3 Mitigation Controls'),
  bullet('Pre-funded model: Monde wallet is pre-funded (top-up before spend). No credit is extended to customers.'),
  bullet('Non-negative balance constraint: Database constraint prevents any balance from going below zero'),
  bullet('Real-time balance checks: All transactions verify sufficient balance before processing'),
  bullet('Lipila is a licensed payment gateway regulated by the Bank of Zambia'),
  bullet('Daily reconciliation of Lipila settlements against internal records'),
  bullet('Automatic reversal of failed withdrawals (callback-triggered)'),
  bullet('Agent float is the agent own funds — agent deposits debit the agent balance, not Monde'),

  subheading('6.4 Residual Risk'),
  para('Credit risk is inherently very low in the Monde model because it is a pre-funded (not credit) system. No user can spend more than their available balance. Residual rating: Very Low (1).'),

  heading('7. LIQUIDITY RISK'),

  subheading('7.1 Risk Description'),
  para('Liquidity risk is the risk that Monde cannot meet its financial obligations as they fall due, particularly the obligation to honour customer withdrawal requests.'),

  subheading('7.2 Risk Assessment'),
  createTable(
    ['Risk', 'Likelihood', 'Impact', 'Inherent Rating'],
    [
      ['Inability to honour withdrawal requests', 'Low', 'Critical', 'High (4)'],
      ['Trust account shortfall', 'Very Low', 'Critical', 'Medium (3)'],
      ['Lipila settlement delay', 'Low', 'Medium', 'Low (2)'],
    ]
  ),
  spacer(),

  subheading('7.3 Mitigation Controls'),
  bullet('Trust account segregation: Customer funds are held separately from operational funds and are always available'),
  bullet('1:1 backing: The trust account balance always equals or exceeds the sum of all customer wallet balances'),
  bullet('Daily reconciliation: Trust account balance verified against aggregate customer balances daily'),
  bullet('No use of customer funds for operations: Strict prohibition on using trust account for operational purposes'),
  bullet('Operational reserve: Monde maintains a minimum operational reserve for contingencies'),
  bullet('Pre-funded model: All value in the system has been funded through actual collections — no value is created ex nihilo'),

  subheading('7.4 Residual Risk'),
  para('Liquidity risk is low because the system is fully pre-funded and customer funds are segregated. The trust account provides 1:1 backing for all customer balances. Residual rating: Low (2).'),

  pageBreak(),
  heading('8. MONEY LAUNDERING / TERRORISM FINANCING / PROLIFERATION RISK'),

  subheading('8.1 Risk Description'),
  para('ML/TF/PF risk is the risk that the Monde platform is used to launder money, finance terrorism, or facilitate proliferation financing. As a digital payment system handling cash transactions through agents, Monde is exposed to structuring, layering, and other ML/TF techniques.'),

  subheading('8.2 Risk Assessment'),
  createTable(
    ['Risk', 'Likelihood', 'Impact', 'Inherent Rating'],
    [
      ['Structuring (multiple small cash-in deposits)', 'Medium', 'High', 'High (4)'],
      ['Layering (rapid P2P transfers to obscure source)', 'Medium', 'High', 'High (4)'],
      ['Agent collusion in money laundering', 'Low', 'High', 'Medium (3)'],
      ['Terrorist financing through P2P payments', 'Low', 'Critical', 'High (4)'],
      ['Use of stolen/fake identities for accounts', 'Medium', 'High', 'High (4)'],
    ]
  ),
  spacer(),

  subheading('8.3 Mitigation Controls'),
  bullet('Tiered KYC: Simplified KYC at registration; Standard/Enhanced KYC for higher tiers'),
  bullet('Phone OTP verification: Confirms SIM ownership at registration'),
  bullet('Account tier limits: Copper K100k balance/K20k daily, Gold K250k/K50k, Platinum K500k/K100k'),
  bullet('One account per phone number: Prevents multiple accounts for structuring'),
  bullet('Daily transaction limits: Enforced at database level per tier'),
  bullet('Velocity controls: Max 3 deposits/withdrawals per customer per agent per day'),
  bullet('Circular fraud detection: Cash-out blocked if same agent deposited to same customer in 24 hours'),
  bullet('Agent daily transfer cap: K50,000 for agent-to-agent transfers'),
  bullet('Account freezing: Immediate freeze capability for suspicious accounts'),
  bullet('Transaction monitoring: Automated monitoring with manual review for flagged activity'),
  bullet('STR filing: CCO/MLRO files Suspicious Transaction Reports with FIC as required'),
  bullet('Staff and agent AML/CFT training: Mandatory training programme'),
  bullet('Sanctions screening: For Gold/Platinum tier customers (planned)'),
  bullet('Comprehensive AML/CFT Policy: Document 07'),

  subheading('8.4 Residual Risk'),
  createTable(
    ['Risk', 'Residual Rating'],
    [
      ['Structuring', 'Low-Medium (2-3)'],
      ['Layering', 'Low (2)'],
      ['Agent collusion', 'Low (2)'],
      ['Terrorist financing', 'Low (2)'],
      ['Stolen/fake identities', 'Low-Medium (2-3)'],
    ]
  ),
  spacer(),

  heading('9. ADDITIONAL RISKS'),

  subheading('9.1 Regulatory Risk'),
  para('Risk: Changes in regulations that impact Monde operations or business model.'),
  para('Mitigation: Active engagement with the Bank of Zambia; monitoring of regulatory developments; flexible technology architecture that can accommodate regulatory changes; dedicated CCO role.'),
  para('Residual Rating: Low (2)'),

  subheading('9.2 Reputational Risk'),
  para('Risk: Negative publicity from security incidents, service outages, or customer complaints.'),
  para('Mitigation: Robust security controls; high availability infrastructure; responsive complaints handling; transparent communication with customers and regulators.'),
  para('Residual Rating: Low-Medium (2-3)'),

  subheading('9.3 Strategic Risk'),
  para('Risk: Failure to achieve business objectives due to competitive pressure or market changes.'),
  para('Mitigation: Competitive pricing; modern user experience; continuous feature development; agent network as differentiation; regular market analysis.'),
  para('Residual Rating: Medium (3)'),

  heading('10. RISK MONITORING AND REPORTING'),
  bullet('Daily: Automated monitoring dashboards reviewed by CITO and operations team'),
  bullet('Weekly: Risk summary report to CEO covering operational incidents and resolved items'),
  bullet('Monthly: Comprehensive risk report to senior management'),
  bullet('Quarterly: Board risk report covering all risk categories, incident trends, and control effectiveness'),
  bullet('Annual: Full risk assessment review and framework update'),
  bullet('Ad-hoc: Immediate escalation of Critical (P1) risks to CEO and Board'),

  heading('11. FRAMEWORK REVIEW'),
  para('This Risk Management Framework shall be reviewed:'),
  bullet('Annually by the Board of Directors'),
  bullet('Following any material risk event or near-miss'),
  bullet('When significant changes are made to products, services, or infrastructure'),
  bullet('When new regulatory requirements are introduced'),
  bullet('The CITO is responsible for maintaining the technology risk register; the CCO for compliance risks; and the CFO for financial risks. The CEO ensures cross-functional coordination.'),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/14_Risk_Management_Framework.docx');
