import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Complaints Handling &\nResolution Policy', 'Customer Complaints Management\nFramework and Procedures', '1.0', TODAY),
  ...disclaimer(),

  heading('1. INTRODUCTION'),
  para('This document sets out the Complaints Handling and Resolution Policy for Monde Limited. It establishes the framework, procedures, and responsibilities for receiving, investigating, and resolving customer complaints in a fair, timely, and transparent manner.'),
  para('This policy is prepared in compliance with Section 1.7.3(d) of the Bank of Zambia Requirements for Designation of a Payment System, February 2025, which requires a Complaints Handling and Resolution Policy.'),
  para('Monde is committed to treating every complaint as an opportunity to improve its services and maintain the trust of its customers.'),

  heading('2. SCOPE'),
  para('This policy applies to:'),
  bullet('All complaints received from Monde customers (individuals and agents)'),
  bullet('All Monde employees and agents involved in customer interactions'),
  bullet('All channels through which complaints may be received'),
  bullet('All products and services offered by Monde'),

  heading('3. DEFINITIONS'),
  bullet('Complaint: An expression of dissatisfaction by a customer regarding a Monde product, service, or employee that requires a response or resolution.'),
  bullet('Complainant: A customer or agent who lodges a complaint.'),
  bullet('First Contact Resolution: A complaint that is resolved at the time of first contact with the customer.'),
  bullet('Escalated Complaint: A complaint that cannot be resolved at the first level and is referred to a senior team member or the CCO.'),

  heading('4. COMPLAINTS CHANNELS'),
  para('Monde accepts complaints through the following channels:'),
  createTable(
    ['Channel', 'Details', 'Availability'],
    [
      ['Phone', 'Customer support hotline (to be established)', 'Business hours (Mon-Fri 08:00-17:00, Sat 09:00-13:00)'],
      ['WhatsApp', 'Dedicated WhatsApp support number (to be established)', 'Business hours + automated responses after hours'],
      ['Email', 'support@monde.co.zm (to be activated)', '24/7 receipt; response during business hours'],
      ['In-App', 'In-app support feature (planned)', '24/7 receipt; response during business hours'],
      ['Walk-In', 'Head office, Lusaka (when established)', 'Business hours'],
      ['Agent', 'Complaints received by Monde agents and escalated to support', 'Agent operating hours'],
    ]
  ),
  spacer(),
  para('All complaint channels are accessible free of charge to the customer.'),

  heading('5. COMPLAINTS HANDLING PROCEDURE'),

  subheading('5.1 Step 1: Receipt and Acknowledgement'),
  bullet('All complaints are logged in the Complaints Register with a unique reference number'),
  bullet('The complainant receives acknowledgement within 24 hours of receipt'),
  bullet('Acknowledgement includes: reference number, name of assigned handler, expected resolution timeframe'),
  bullet('Verbal complaints are documented in writing by the receiving staff member'),

  subheading('5.2 Step 2: Classification'),
  para('Complaints are classified by type and priority:'),
  createTable(
    ['Category', 'Examples', 'Priority', 'Target Resolution'],
    [
      ['Transaction Error', 'Incorrect debit/credit, missing funds, failed transaction not reversed', 'High', '48 hours'],
      ['Service Availability', 'App not working, unable to transact, login issues', 'High', '24 hours'],
      ['Fee Dispute', 'Incorrect fee charged, fee not disclosed', 'Medium', '5 business days'],
      ['Agent Complaint', 'Agent misconduct, overcharging, refusal to serve', 'Medium', '5 business days'],
      ['Account Issue', 'Account frozen, tier upgrade request, profile error', 'Medium', '5 business days'],
      ['General Inquiry', 'Feature questions, fee inquiries, service information', 'Low', '3 business days'],
      ['Fraud/Security', 'Unauthorised transaction, account compromise', 'Critical', 'Immediate + 24 hours'],
    ]
  ),
  spacer(),

  subheading('5.3 Step 3: Investigation'),
  para('The assigned handler investigates the complaint using:'),
  bullet('Transaction records from the Monde database (immutable audit trail)'),
  bullet('System logs and Edge Function execution records'),
  bullet('Payment gateway (Lipila) transaction records and callbacks'),
  bullet('Customer account history and profile information'),
  bullet('Agent activity records (for agent-related complaints)'),
  bullet('Interviews with relevant staff or agents'),

  subheading('5.4 Step 4: Resolution'),
  para('Based on the investigation findings, the handler determines the appropriate resolution:'),
  bullet('Transaction Reversal: Where a system error caused an incorrect transaction, the customer is made whole through a corrective transaction'),
  bullet('Refund: Where a fee was incorrectly charged, the fee is refunded to the customer wallet'),
  bullet('Account Correction: Where account data is incorrect, it is corrected in the system'),
  bullet('Explanation: Where the complaint arises from a misunderstanding, a clear explanation is provided'),
  bullet('Agent Action: Where an agent is at fault, disciplinary action is taken (warning, suspension, or termination of agent status)'),
  bullet('Escalation: Where the complaint involves potential fraud or regulatory issues, it is escalated to the CCO'),

  subheading('5.5 Step 5: Communication'),
  para('The complainant is informed of the resolution:'),
  bullet('Written response provided through the same channel as the complaint (or by SMS/email)'),
  bullet('Response includes: summary of findings, resolution action taken, and right to escalate if dissatisfied'),
  bullet('If investigation is ongoing beyond the target timeframe, interim update is provided'),

  subheading('5.6 Step 6: Closure and Follow-Up'),
  bullet('Complaint is marked as resolved in the Complaints Register'),
  bullet('Customer satisfaction is confirmed (where practical)'),
  bullet('Root cause analysis is performed for systemic issues'),
  bullet('Trends are reported to management for process improvement'),

  pageBreak(),
  heading('6. ESCALATION PROCEDURE'),

  subheading('6.1 Internal Escalation'),
  createTable(
    ['Level', 'Handler', 'Trigger', 'Timeframe'],
    [
      ['Level 1', 'Customer Support Agent', 'Initial complaint receipt', 'Resolve within target time'],
      ['Level 2', 'Customer Support Lead / Agent Network Manager', 'Unable to resolve at Level 1, or customer requests escalation', 'Additional 2 business days'],
      ['Level 3', 'Chief Compliance Officer (CCO)', 'Unable to resolve at Level 2, involves fraud/regulatory/policy issues, or customer requests escalation', 'Additional 5 business days'],
      ['Level 4', 'Chief Executive Officer (CEO)', 'Unable to resolve at Level 3, or involves significant financial or reputational impact', 'Additional 5 business days'],
    ]
  ),
  spacer(),

  subheading('6.2 External Escalation'),
  para('If the complainant is not satisfied with the resolution after exhausting the internal escalation process, they may escalate the matter to:'),
  boldPara('Bank of Zambia — Payment Systems Department'),
  para('Address: Bank Square, Cairo Road, P.O. Box 30080, Lusaka, Zambia'),
  para('Email: psd@boz.zm'),
  para('Phone: +260 211 399 300'),
  spacer(),
  para('Monde will cooperate fully with any investigation initiated by the Bank of Zambia and provide all requested information and records.'),

  heading('7. COMPLAINTS REGISTER'),
  para('Monde maintains a Complaints Register that records:'),
  bullet('Unique complaint reference number'),
  bullet('Date and time of receipt'),
  bullet('Channel through which complaint was received'),
  bullet('Complainant name, phone number, and account details'),
  bullet('Nature and category of the complaint'),
  bullet('Priority classification'),
  bullet('Assigned handler'),
  bullet('Investigation findings'),
  bullet('Resolution action taken'),
  bullet('Date of resolution'),
  bullet('Customer satisfaction status'),
  bullet('Escalation history (if any)'),
  para('The Complaints Register is maintained electronically and is accessible to the CCO and senior management for monitoring and reporting purposes.'),

  heading('8. REPORTING AND MONITORING'),

  subheading('8.1 Internal Reporting'),
  bullet('Weekly: Complaints summary report to Customer Support Lead (volume, categories, resolution rate)'),
  bullet('Monthly: Complaints analytics report to CEO and CCO (trends, root causes, systemic issues)'),
  bullet('Quarterly: Comprehensive complaints report to the Board of Directors (statistics, trends, actions taken, customer satisfaction)'),

  subheading('8.2 Regulatory Reporting'),
  para('Monde will provide the Bank of Zambia with:'),
  bullet('Quarterly summary of complaints received, categories, and resolution outcomes'),
  bullet('Immediate notification of any complaint that reveals a systemic risk or significant customer impact'),
  bullet('Annual report on complaints handling performance and improvement initiatives'),

  subheading('8.3 Key Performance Indicators'),
  createTable(
    ['KPI', 'Target'],
    [
      ['Acknowledgement within 24 hours', '100%'],
      ['Resolution within target timeframe', '90%'],
      ['First Contact Resolution rate', '60%'],
      ['Customer satisfaction with resolution', '80%'],
      ['Complaints escalated to Level 3+', 'Less than 10%'],
      ['Complaints escalated to Bank of Zambia', 'Less than 1%'],
    ]
  ),
  spacer(),

  heading('9. STAFF TRAINING'),
  para('All customer-facing staff and agents receive training on:'),
  bullet('This Complaints Handling Policy and associated procedures'),
  bullet('Effective communication and de-escalation techniques'),
  bullet('Using the Complaints Register and documentation requirements'),
  bullet('Escalation procedures and when to escalate'),
  bullet('Privacy and confidentiality requirements when handling complaints'),
  para('Training is provided during onboarding and refreshed annually.'),

  heading('10. CONTINUOUS IMPROVEMENT'),
  para('Monde uses complaints data to drive continuous improvement:'),
  bullet('Root cause analysis is performed for all recurring complaint types'),
  bullet('System improvements are prioritised based on complaint volume and impact'),
  bullet('Customer feedback is incorporated into product development decisions'),
  bullet('Complaint trends are reviewed at monthly management meetings'),
  bullet('Process changes are documented and communicated to all staff'),

  heading('11. POLICY REVIEW'),
  para('This Complaints Handling and Resolution Policy shall be reviewed:'),
  bullet('Annually by the CCO with approval from the Board of Directors'),
  bullet('Following any significant increase in complaint volumes or types'),
  bullet('Following any regulatory finding or direction from the Bank of Zambia'),
  bullet('When new products or services are introduced'),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/16_Complaints_Handling_Policy.docx');
