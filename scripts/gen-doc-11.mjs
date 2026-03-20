import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Governance Structure', 'Corporate Governance Arrangements\nand Internal Control Mechanisms', '1.0', TODAY),
  ...disclaimer(),

  heading('1. INTRODUCTION'),
  para('This document describes the governance arrangements and internal control mechanisms of Monde Limited, demonstrating that such arrangements, mechanisms, and procedures are proportionate, appropriate, sound, and adequate to ensure the safety and efficiency of the payment services offered. This document is prepared in compliance with Section 1.5 of the Bank of Zambia Requirements for Designation of a Payment System, February 2025.'),

  heading('2. GOVERNANCE FRAMEWORK'),
  subheading('2.1 Governance Principles'),
  para('Monde Limited is committed to the highest standards of corporate governance, guided by the following principles:'),
  bullet('Accountability: Clear lines of responsibility and accountability at all levels of the organisation'),
  bullet('Transparency: Open and honest communication with regulators, shareholders, and customers'),
  bullet('Integrity: Ethical conduct in all business dealings and regulatory interactions'),
  bullet('Fairness: Equitable treatment of all stakeholders including customers, employees, agents, and partners'),
  bullet('Compliance: Full adherence to all applicable laws, regulations, and standards'),
  bullet('Risk Management: Proactive identification, assessment, and mitigation of risks'),

  heading('3. BOARD OF DIRECTORS'),

  subheading('3.1 Board Composition'),
  para('The Board of Directors of Monde Limited shall comprise a minimum of three (3) members, with the following requirements:'),
  bullet('The majority of directors shall be appointed in a non-executive capacity'),
  bullet('The majority of directors shall be resident in Zambia'),
  bullet('No director shall hold a position on the board of more than one payment system without prior written approval of the Bank of Zambia'),
  bullet('Directors shall be appropriately skilled and experienced to execute their responsibilities'),

  subheading('3.2 Board Responsibilities'),
  para('The Board of Directors is responsible for:'),
  bullet('Setting the strategic direction of Monde and approving the business plan'),
  bullet('Monitoring and overseeing the implementation of strategic objectives'),
  bullet('Overseeing the management of risk, including approval of the Risk Management Framework'),
  bullet('Monitoring financial performance and ensuring the viability of the entity'),
  bullet('Ensuring good governance practices and corporate values are upheld'),
  bullet('Ensuring compliance with all relevant regulatory requirements, including the National Payment Systems Act'),
  bullet('Approving key policies including AML/CFT, Information Security, BCP/DR, and Complaints Handling'),
  bullet('Appointing and overseeing senior management'),
  bullet('Ensuring adequate resources are allocated for compliance and risk management'),
  bullet('Reviewing and approving the annual audited financial statements'),

  subheading('3.3 Board Meetings'),
  bullet('The Board shall meet at least quarterly (four times per year)'),
  bullet('Special meetings may be called by the Chairman or any two directors'),
  bullet('A quorum of at least two-thirds of directors is required for valid resolutions'),
  bullet('Minutes of all Board meetings shall be recorded and maintained'),
  bullet('The Board shall receive and review reports from senior management at each meeting'),

  subheading('3.4 Board Committees'),
  para('As the company grows, the Board may establish the following committees:'),
  boldPara('Audit and Risk Committee (from Year 2):'),
  bullet('Oversee financial reporting and internal controls'),
  bullet('Review risk management effectiveness'),
  bullet('Liaise with external auditors'),
  bullet('Review compliance reports'),
  boldPara('Technology and Innovation Committee (from Year 2):'),
  bullet('Oversee technology strategy and investments'),
  bullet('Review cybersecurity posture'),
  bullet('Monitor system performance and reliability'),

  pageBreak(),
  heading('4. SENIOR MANAGEMENT'),

  subheading('4.1 Senior Management Structure'),
  para('Monde Limited shall have the following minimum senior management positions, as required by the Bank of Zambia:'),
  createTable(
    ['Position', 'Key Responsibilities', 'Reports To'],
    [
      ['Chief Executive Officer (CEO)', 'Overall management, strategy execution, regulatory liaison', 'Board of Directors'],
      ['Chief Financial Officer (CFO)', 'Financial management, reporting, treasury, trust account oversight', 'CEO / Board'],
      ['Chief Compliance Officer (CCO)', 'AML/CFT compliance, regulatory reporting, MLRO duties, complaints', 'CEO / Board'],
      ['Chief Information Technology Officer (CITO)', 'Technology strategy, security, development, infrastructure', 'CEO / Board'],
    ]
  ),
  spacer(),
  para('No officer shall hold more than one senior management position at any particular time. All officers shall be engaged in compliance with the Employment Act and other relevant Zambian labour laws.'),

  subheading('4.2 Fit and Proper Requirements'),
  para('All senior management officers must satisfy the Bank of Zambia that they:'),
  bullet('Possess appropriate knowledge and experience for their respective roles'),
  bullet('Are of good repute and have no disqualifying criminal convictions'),
  bullet('Have no history of regulatory sanctions or disqualification from acting as a director or officer'),
  bullet('Have no unresolved conflicts of interest'),
  para('Evidence of fitness and propriety shall be provided through:'),
  bullet('Detailed curriculum vitae with three (3) traceable references'),
  bullet('Certified identity documents (NRC or passport)'),
  bullet('Director Questionnaire in the format prescribed by the Bank of Zambia'),
  bullet('Vital statistics form in the format prescribed by the Bank of Zambia'),
  bullet('Security screening results for non-Zambian officers'),
  bullet('Immigration and non-resident work permits for expatriate officers (if applicable)'),

  heading('5. INTERNAL CONTROL MECHANISMS'),

  subheading('5.1 Financial Controls'),
  bullet('Segregation of Duties: No single individual can initiate, approve, and record a financial transaction'),
  bullet('Trust Account Controls: Customer funds are held separately from operational funds with dual-signatory requirements for withdrawals'),
  bullet('Daily Reconciliation: Automated and manual reconciliation of all financial records'),
  bullet('Fee Verification: All fee calculations are performed at the database level through audited SQL functions, not in the application layer'),
  bullet('Budget Controls: Operating expenses are managed against approved budgets with variance reporting'),
  bullet('External Audit: Annual audit by a ZICA-registered auditor'),

  subheading('5.2 Technology Controls'),
  bullet('Change Management: All code changes are version-controlled (Git) and reviewed before deployment'),
  bullet('Access Management: Database and system access follows the principle of least privilege'),
  bullet('Row-Level Security: Database policies enforce data access at the engine level, independent of the application'),
  bullet('Encryption: All data encrypted in transit (TLS 1.3) and at rest (AES-256)'),
  bullet('Monitoring: Real-time monitoring of system performance, errors, and security events'),
  bullet('Incident Response: Defined procedures for security incident detection, containment, and resolution'),
  bullet('Backup and Recovery: Automated daily backups with tested recovery procedures'),

  subheading('5.3 Compliance Controls'),
  bullet('Transaction Monitoring: Automated monitoring of all transactions for suspicious activity'),
  bullet('KYC Enforcement: Tiered KYC requirements enforced through account tiers with database-level limits'),
  bullet('Regulatory Reporting: Defined procedures for filing STRs, large transaction reports, and other regulatory reports'),
  bullet('Policy Review: Annual review and update of all compliance policies'),
  bullet('Training: Mandatory AML/CFT training for all staff and agents'),

  subheading('5.4 Operational Controls'),
  bullet('Agent Management: Centralised agent status management through admin-only controls'),
  bullet('Customer Complaints: Defined complaints handling and resolution procedure'),
  bullet('Service Continuity: Business Continuity and Disaster Recovery plans tested annually'),
  bullet('Vendor Management: SLAs and performance monitoring for all third-party providers'),

  pageBreak(),
  heading('6. CONFLICT OF INTEREST'),

  subheading('6.1 Policy'),
  para('Monde has established procedures to prevent and manage conflicts of interest:'),
  bullet('All directors and senior management must disclose any actual or potential conflicts of interest'),
  bullet('Disclosure must be made at the time of appointment and whenever a new conflict arises'),
  bullet('Directors with a conflict of interest must recuse themselves from relevant discussions and decisions'),
  bullet('A register of interests is maintained and reviewed by the Board annually'),

  subheading('6.2 Related Party Transactions'),
  para('Any transactions between Monde and related parties (directors, shareholders, or their connected entities) must:'),
  bullet('Be conducted at arm\'s length on commercial terms'),
  bullet('Be disclosed to the Board and approved by non-conflicted directors'),
  bullet('Be reported to the Bank of Zambia as required'),

  heading('7. SHAREHOLDER INFORMATION'),
  para('Details of the direct and indirect shareholding of Monde Limited, including the names of ultimate beneficial owners and the number of shares held by each shareholder, will be provided in the formal application documentation. All shareholders will undergo fit-and-proper assessments, including:'),
  bullet('Identity verification (NRC or passport)'),
  bullet('Source of funds verification'),
  bullet('Background and security screening'),
  bullet('Disclosure of interests in other financial service providers'),

  heading('8. REGULATORY DECLARATIONS'),

  subheading('8.1 Regulatory Sanctions'),
  para('Monde Limited and its directors/shareholders have no history of regulatory sanctions, license/designation revocations, suspensions, or other disciplinary actions in Zambia or any other jurisdiction.'),

  subheading('8.2 Bankruptcy/Receivership'),
  para('Neither Monde Limited nor any of its directors/shareholders are currently subject to or have been subject to bankruptcy or receivership proceedings.'),

  subheading('8.3 Licensing in Other Jurisdictions'),
  para('Monde Limited is not currently licensed to provide payment services in any jurisdiction. This application to the Bank of Zambia represents the company\'s first application for a payment system designation.'),

  heading('9. GOVERNANCE REVIEW'),
  para('The governance framework shall be reviewed:'),
  bullet('Annually by the Board of Directors'),
  bullet('Following any significant changes to the business or regulatory environment'),
  bullet('Following any governance-related incident or regulatory finding'),
  bullet('When directed by the Bank of Zambia'),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/11_Governance_Structure.docx');
