import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Third-Party Agreements', 'Draft Service Level Agreements\nwith Technology Providers', '1.0', TODAY),
  ...disclaimer(),

  heading('1. INTRODUCTION'),
  para('This document presents the draft agreements and service level arrangements between Monde Limited and its third-party technology providers. These agreements are prepared in compliance with Section 1.6.1(a) of the Bank of Zambia Requirements for Designation of a Payment System, February 2025, which requires the submission of draft agreements with all third-party technology providers including relevant Service Level Agreements (SLAs).'),

  heading('2. THIRD-PARTY PROVIDER OVERVIEW'),
  createTable(
    ['Provider', 'Service Provided', 'Criticality', 'Jurisdiction'],
    [
      ['Lipila (Beem Africa Ltd)', 'Payment gateway (MoMo collections, disbursements, card payments)', 'Critical', 'Zambia'],
      ['Supabase Inc.', 'Cloud database, authentication, Edge Functions, realtime engine', 'Critical', 'USA (AWS af-south-1)'],
      ['Twilio Inc.', 'SMS OTP delivery for phone verification', 'High', 'USA (global network)'],
      ['Google LLC', 'Android app distribution (Google Play Store)', 'Medium', 'USA'],
      ['Apple Inc.', 'iOS app distribution (Apple App Store)', 'Medium', 'USA'],
      ['Expo (820 Labs Inc.)', 'Application build and signing services (EAS)', 'Medium', 'USA'],
    ]
  ),
  spacer(),

  heading('3. DRAFT AGREEMENT: LIPILA PAYMENT GATEWAY'),

  subheading('3.1 Parties'),
  para('This agreement is between Monde Limited ("Monde") and Beem Africa Limited trading as Lipila ("Lipila"), a licensed payment gateway operating in Zambia.'),

  subheading('3.2 Scope of Services'),
  para('Lipila shall provide the following services to Monde:'),
  bullet('Mobile Money Collections: Processing of collection requests from Airtel Money, MTN Money, and Zamtel Kwacha accounts on behalf of Monde customers (wallet top-up)'),
  bullet('Mobile Money Disbursements: Processing of disbursement requests to Airtel Money, MTN Money, and Zamtel Kwacha accounts on behalf of Monde customers (wallet withdrawal)'),
  bullet('Card Collections: Processing of Visa/Mastercard card payments from FNB, Zanaco, and Absa accounts'),
  bullet('Callback Notifications: Real-time webhook callbacks to Monde for transaction status updates'),
  bullet('Status API: API endpoint for querying transaction status'),
  bullet('Dashboard Access: Access to the Lipila merchant dashboard for transaction monitoring and reconciliation'),

  subheading('3.3 Service Levels'),
  createTable(
    ['Metric', 'Target SLA', 'Measurement'],
    [
      ['API Availability', '99.5% uptime', 'Monthly, excluding scheduled maintenance'],
      ['Collection Processing', 'Within 60 seconds of approval', 'Time from user approval to callback'],
      ['Disbursement Processing', 'Within 5 minutes of request', 'Time from API call to funds delivery'],
      ['Callback Delivery', 'Within 30 seconds of status change', 'Time from status change to callback receipt'],
      ['API Response Time', 'Less than 3 seconds (p95)', 'Measured at API endpoint'],
      ['Daily Settlement', 'T+1 business day', 'Settlement of net collections to Monde bank account'],
    ]
  ),
  spacer(),

  subheading('3.4 Pricing'),
  createTable(
    ['Service', 'Lipila Fee'],
    [
      ['Mobile Money Collection', '2.5% of collection amount'],
      ['Card Collection', '4% of collection amount'],
      ['Mobile Money Disbursement', '1.5% of disbursement amount'],
    ]
  ),
  spacer(),

  subheading('3.5 Security Requirements'),
  bullet('All API communication shall use HTTPS with TLS 1.2 or higher'),
  bullet('API keys shall be kept confidential and rotated periodically'),
  bullet('Lipila shall maintain PCI DSS compliance for card processing'),
  bullet('Lipila shall notify Monde within 24 hours of any security breach affecting Monde data'),
  bullet('Lipila shall maintain compliance with all Bank of Zambia regulations applicable to payment gateways'),

  subheading('3.6 Data Protection'),
  bullet('Lipila shall process customer data only for the purpose of providing the agreed services'),
  bullet('Lipila shall not share customer data with third parties without Monde written consent'),
  bullet('Lipila shall maintain appropriate technical and organisational security measures'),
  bullet('Upon termination, Lipila shall delete or return all Monde customer data'),

  subheading('3.7 Term and Termination'),
  bullet('Initial term: 12 months, with automatic annual renewal'),
  bullet('Either party may terminate with 90 days written notice'),
  bullet('Immediate termination for material breach that is not remedied within 30 days'),
  bullet('Immediate termination if either party loses its regulatory license'),

  pageBreak(),
  heading('4. DRAFT AGREEMENT: SUPABASE (CLOUD INFRASTRUCTURE)'),

  subheading('4.1 Parties'),
  para('This agreement is between Monde Limited ("Monde") and Supabase Inc. ("Supabase"), a cloud infrastructure provider.'),

  subheading('4.2 Scope of Services'),
  bullet('Managed PostgreSQL Database: Hosted, managed, and backed-up database service'),
  bullet('Authentication Service (GoTrue): User authentication with phone-based auth, JWT tokens'),
  bullet('Edge Functions: Serverless function execution environment (Deno runtime)'),
  bullet('Realtime Engine: WebSocket-based real-time data subscriptions'),
  bullet('API Gateway: RESTful and GraphQL API endpoints with automatic security'),
  bullet('Row-Level Security: Database-level access control enforcement'),
  bullet('Dashboard: Web-based management interface for monitoring and administration'),

  subheading('4.3 Service Levels'),
  createTable(
    ['Metric', 'Target SLA', 'Notes'],
    [
      ['Platform Availability', '99.9% uptime', 'Monthly, per Supabase SLA'],
      ['Database Backup', 'Daily automated backups', '7-day retention'],
      ['Point-in-Time Recovery', 'Available', 'Within backup retention window'],
      ['API Response Time', 'Less than 200ms (p95)', 'For standard API calls'],
      ['Edge Function Cold Start', 'Less than 500ms', 'Initial function invocation'],
    ]
  ),
  spacer(),

  subheading('4.4 Security and Compliance'),
  bullet('Supabase maintains SOC2 Type II certification'),
  bullet('Infrastructure hosted on AWS with ISO 27001 and PCI DSS certifications'),
  bullet('Data encrypted at rest (AES-256) and in transit (TLS 1.3)'),
  bullet('Network isolation between projects'),
  bullet('DDoS protection via AWS Shield'),

  subheading('4.5 Data Residency'),
  para('The Monde database is hosted in AWS region af-south-1 (Cape Town, South Africa), providing low-latency access for Zambian users while keeping data within the African continent.'),

  subheading('4.6 Term'),
  bullet('Monthly subscription with no minimum commitment'),
  bullet('Either party may terminate with 30 days notice'),
  bullet('Data export available at any time through standard PostgreSQL tools'),

  heading('5. DRAFT AGREEMENT: TWILIO (SMS VERIFICATION)'),

  subheading('5.1 Scope of Services'),
  para('Twilio provides SMS-based OTP (One-Time Password) delivery for phone number verification during:'),
  bullet('New user registration'),
  bullet('PIN recovery / account recovery'),
  bullet('Additional verification when required'),

  subheading('5.2 Service Levels'),
  createTable(
    ['Metric', 'Target SLA', 'Notes'],
    [
      ['API Availability', '99.95% uptime', 'Per Twilio SLA'],
      ['SMS Delivery Rate', 'Greater than 95% to Zambian numbers', 'Within 30 seconds'],
      ['API Response Time', 'Less than 1 second', 'For verification API calls'],
    ]
  ),
  spacer(),

  subheading('5.3 Security'),
  bullet('All API communication uses HTTPS/TLS'),
  bullet('API keys stored as environment variables, never in client code'),
  bullet('Twilio maintains SOC2 Type II and ISO 27001 certifications'),
  bullet('OTP codes are time-limited (10-minute expiry) and single-use'),

  heading('6. CONTINGENCY PLANNING'),
  para('Monde maintains contingency plans for third-party provider failure:'),
  createTable(
    ['Provider', 'Impact of Failure', 'Contingency Measure'],
    [
      ['Lipila', 'Top-up and withdrawal services unavailable', 'P2P and agent transactions continue (internal ledger). Alternative gateway evaluation in BCP.'],
      ['Supabase', 'Full platform outage', 'Daily backups enable migration to self-hosted or alternative provider within RTO. BCP details in Document 15.'],
      ['Twilio', 'New registrations and PIN recovery unavailable', 'Existing users unaffected. Alternative SMS provider can be integrated within 48 hours.'],
    ]
  ),
  spacer(),

  heading('7. AGREEMENT STATUS'),
  para('The agreements presented in this document are draft versions prepared for the Bank of Zambia designation application. Final executed agreements will be submitted upon completion of commercial negotiations with each provider. Current status:'),
  createTable(
    ['Provider', 'Status'],
    [
      ['Lipila', 'Active integration (sandbox and production). Formal SLA to be executed.'],
      ['Supabase', 'Active subscription (Pro plan). Standard Terms of Service in effect.'],
      ['Twilio', 'Active account. Standard Terms of Service in effect.'],
      ['Google Play', 'Developer account active. Standard Developer Distribution Agreement.'],
      ['Apple App Store', 'Developer account pending. Standard Apple Developer Program License.'],
      ['Expo (EAS)', 'Active account. Standard Terms of Service in effect.'],
    ]
  ),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/12_Third_Party_Agreements.docx');
