import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Organisational Structure', 'Corporate Structure, Staffing\nand Outsourcing Arrangements', '1.0', TODAY),
  ...disclaimer(),

  heading('1. INTRODUCTION'),
  para('This document describes the organisational structure of Monde Limited, including the corporate hierarchy, staffing plan, outsourcing arrangements, and the relationship between internal departments. This structure is designed to ensure effective governance, regulatory compliance, and operational efficiency.'),

  heading('2. CORPORATE STRUCTURE'),
  subheading('2.1 Legal Entity'),
  para('Monde Limited is a private limited company to be incorporated under the laws of the Republic of Zambia and registered with the Patents and Companies Registration Agency (PACRA). The company is headquartered in Lusaka, Zambia.'),

  subheading('2.2 Shareholding Structure'),
  para('The shareholding structure of Monde Limited will be disclosed in full in the application form and accompanying documentation. All shareholders will be subject to fit-and-proper assessments as required by the Bank of Zambia. Details of ultimate beneficial owners will be provided with the formal application.'),

  subheading('2.3 Branches and Points of Service'),
  para('Monde will initially operate from a single head office in Lusaka. The digital nature of the platform means that services are accessible nationwide through the mobile application. Physical service delivery is extended through the agent network.'),
  para('Planned expansion:'),
  bullet('Year 1: Head office in Lusaka; agent network in Lusaka and Copperbelt'),
  bullet('Year 2: Regional coordination office in Ndola (Copperbelt); agent expansion to Southern and Central provinces'),
  bullet('Year 3: Nationwide agent coverage across all 10 provinces'),

  heading('3. ORGANISATIONAL CHART'),
  para('[ORGANISATIONAL CHART]', { bold: true, italics: true }),
  spacer(),
  para('Board of Directors'),
  para('        |'),
  para('Chief Executive Officer (CEO)'),
  para('        |'),
  para('--------|--------|--------|--------'),
  para('|                |                |                |'),
  para('CFO          CCO          CITO          COO'),
  para('|                |                |                |'),
  para('Finance &    Compliance   Technology   Operations'),
  para('Accounts     & AML        & Dev        & Agents'),
  spacer(),
  para('Note: A formal visual organisational chart will be prepared for the Bank of Zambia submission.', { italics: true }),

  pageBreak(),
  heading('4. SENIOR MANAGEMENT POSITIONS'),

  subheading('4.1 Chief Executive Officer (CEO)'),
  para('The CEO is responsible for:'),
  bullet('Overall strategic direction and management of Monde'),
  bullet('Reporting to and liaising with the Board of Directors'),
  bullet('Representing Monde to regulators, partners, and stakeholders'),
  bullet('Ensuring compliance with all regulatory requirements'),
  bullet('Overseeing all senior management functions'),
  bullet('Setting and monitoring key performance indicators'),

  subheading('4.2 Chief Financial Officer (CFO)'),
  para('The CFO is responsible for:'),
  bullet('Financial planning, budgeting, and forecasting'),
  bullet('Financial reporting and preparation of statutory accounts'),
  bullet('Cash flow management and treasury operations'),
  bullet('Liaison with external auditors (ZICA-registered)'),
  bullet('Management of the customer funds trust account'),
  bullet('Revenue reconciliation and fee management'),
  bullet('Tax compliance and reporting'),

  subheading('4.3 Chief Compliance Officer (CCO)'),
  para('The CCO serves as the designated Money Laundering Reporting Officer (MLRO) and is responsible for:'),
  bullet('AML/CFT programme implementation and management'),
  bullet('Filing Suspicious Transaction Reports with the Financial Intelligence Centre'),
  bullet('Conducting risk assessments and compliance monitoring'),
  bullet('Staff and agent AML/CFT training'),
  bullet('Regulatory reporting to the Bank of Zambia'),
  bullet('Handling customer complaints and dispute resolution'),
  bullet('Ensuring compliance with the National Payment Systems Act and all related regulations'),
  bullet('Data protection and privacy compliance'),

  subheading('4.4 Chief Information Technology Officer (CITO)'),
  para('The CITO is responsible for:'),
  bullet('Technology strategy and system architecture'),
  bullet('Application development and maintenance'),
  bullet('Information security and cybersecurity management'),
  bullet('Infrastructure management and cloud operations'),
  bullet('Disaster recovery and business continuity (technology)'),
  bullet('Third-party technology provider management'),
  bullet('System monitoring, incident response, and resolution'),
  bullet('Technology risk management'),

  heading('5. DEPARTMENTAL STRUCTURE'),

  subheading('5.1 Finance and Administration'),
  para('Reporting to the CFO:'),
  bullet('Financial accountant(s)'),
  bullet('Administrative support staff'),
  para('Functions: Bookkeeping, payroll, accounts payable/receivable, bank reconciliation, statutory reporting.'),

  subheading('5.2 Compliance and Legal'),
  para('Reporting to the CCO:'),
  bullet('Compliance analyst(s)'),
  para('Functions: Transaction monitoring, KYC verification, STR preparation, regulatory correspondence, legal coordination.'),

  subheading('5.3 Technology and Development'),
  para('Reporting to the CITO:'),
  bullet('Software developer(s)'),
  bullet('Quality assurance / testing'),
  para('Functions: Application development, bug fixes, feature implementation, system monitoring, database administration, security patching.'),

  subheading('5.4 Operations and Agent Management'),
  para('Reporting to the CEO (or Chief Operating Officer when appointed):'),
  bullet('Customer support agents'),
  bullet('Agent network managers'),
  para('Functions: Customer service, agent onboarding and training, agent performance monitoring, complaint handling, field operations.'),

  pageBreak(),
  heading('6. STAFFING PLAN'),
  createTable(
    ['Position', 'Year 1', 'Year 2', 'Year 3', 'Employment Type'],
    [
      ['Chief Executive Officer', '1', '1', '1', 'Full-time'],
      ['Chief Financial Officer', '1', '1', '1', 'Full-time'],
      ['Chief Compliance Officer', '1', '1', '1', 'Full-time'],
      ['Chief Information Technology Officer', '1', '1', '1', 'Full-time'],
      ['Software Developers', '1', '3', '5', 'Full-time'],
      ['Customer Support Agents', '2', '5', '10', 'Full-time'],
      ['Agent Network Managers', '1', '2', '4', 'Full-time'],
      ['Financial Accountant', '1', '1', '2', 'Full-time'],
      ['Compliance Analyst', '0', '1', '2', 'Full-time'],
      ['Marketing Manager', '0', '1', '2', 'Full-time'],
      ['Administrative Support', '0', '1', '1', 'Full-time'],
      ['Total Headcount', '9', '18', '30', ''],
    ]
  ),
  spacer(),
  para('All senior management officers will be engaged in compliance with the Employment Act and other relevant Zambian labour laws. No officer will hold more than one senior management position at any time.'),

  heading('7. OUTSOURCING ARRANGEMENTS'),

  subheading('7.1 Current Outsourcing'),
  para('Monde outsources the following services to specialised third-party providers:'),
  createTable(
    ['Service', 'Provider', 'Description', 'Jurisdiction'],
    [
      ['Cloud Infrastructure & Database', 'Supabase (on AWS)', 'Managed PostgreSQL database, authentication, Edge Functions, realtime engine', 'USA (AWS region: af-south-1)'],
      ['Payment Gateway', 'Lipila', 'Mobile money and bank card collection/disbursement processing', 'Zambia'],
      ['SMS Verification', 'Twilio', 'OTP delivery for phone number verification', 'USA (global SMS network)'],
      ['App Distribution', 'Google/Apple', 'Google Play Store and Apple App Store for app distribution', 'USA'],
      ['Build Infrastructure', 'Expo (EAS)', 'Application build and signing services', 'USA'],
    ]
  ),
  spacer(),

  subheading('7.2 Outsourcing Risk Management'),
  para('Monde manages outsourcing risks through:'),
  bullet('Service Level Agreements (SLAs) with all critical providers'),
  bullet('Regular performance monitoring and review'),
  bullet('Contingency planning for provider failure or discontinuation'),
  bullet('Data protection and confidentiality clauses in all provider agreements'),
  bullet('Compliance verification for providers handling customer data'),
  bullet('Board oversight of significant outsourcing arrangements'),

  subheading('7.3 Data Residency'),
  para('While the primary database is hosted on AWS in the af-south-1 (Cape Town) region, customer data may transit through other jurisdictions for processing. Monde ensures:'),
  bullet('All data in transit is encrypted with TLS 1.3'),
  bullet('All data at rest is encrypted with AES-256'),
  bullet('Data processing agreements are in place with all providers'),
  bullet('No provider has standing access to decrypted customer financial data'),

  heading('8. PARTICIPATION IN PAYMENT SYSTEMS'),
  para('Monde is applying for designation as a payment system under the National Payment Systems Act, 2007. Monde does not currently participate in any other national or international payment system. Integration with external payment systems is facilitated through the Lipila payment gateway, which handles all interoperability with mobile money operators and banking institutions.'),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/08_Organisational_Structure.docx');
