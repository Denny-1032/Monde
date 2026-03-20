import { coverPage, disclaimer, heading, subheading, subsubheading, para, boldPara, bullet, richPara, createTable, pageBreak, spacer, createDoc, saveDoc, TODAY } from './doc-utils.mjs';

const sections = [
  ...coverPage('Business Continuity &\nDisaster Recovery Plan', 'BCP/DR Framework with Recovery\nTime and Point Objectives', '1.0', TODAY),
  ...disclaimer(),

  heading('1. INTRODUCTION'),
  para('This document presents the Business Continuity Plan (BCP) and Disaster Recovery Plan (DRP) for Monde Limited. It establishes the framework, procedures, and responsibilities for maintaining the availability of the Monde digital payment system during disruptive events and recovering from disasters that may affect the system.'),
  para('This plan is prepared in compliance with Section 1.8 of the Bank of Zambia Requirements for Designation of a Payment System, February 2025, which requires a business continuity framework that describes recovery time objectives and recovery point objectives.'),

  heading('2. SCOPE'),
  para('This plan covers all components of the Monde payment system:'),
  bullet('Mobile application (Android and iOS)'),
  bullet('Backend infrastructure (Supabase Cloud: database, authentication, Edge Functions, realtime)'),
  bullet('Payment gateway integration (Lipila)'),
  bullet('SMS verification service (Twilio)'),
  bullet('Agent network operations'),
  bullet('Customer support operations'),
  bullet('Administrative and back-office operations'),

  heading('3. BUSINESS IMPACT ANALYSIS'),

  subheading('3.1 Critical Business Functions'),
  createTable(
    ['Function', 'Criticality', 'Max Tolerable Downtime', 'Impact of Failure'],
    [
      ['P2P Payment Processing', 'Critical', '4 hours', 'Users unable to send/receive money'],
      ['Wallet Top-Up', 'High', '8 hours', 'Users unable to load funds'],
      ['Wallet Withdrawal', 'High', '8 hours', 'Users unable to cash out'],
      ['Agent Cash-In/Cash-Out', 'Critical', '4 hours', 'Cash users unable to transact'],
      ['User Authentication', 'Critical', '2 hours', 'All users locked out'],
      ['Database Services', 'Critical', '1 hour', 'Complete system failure'],
      ['Customer Support', 'Medium', '24 hours', 'Complaints unresolved'],
      ['Admin Dashboard', 'Medium', '24 hours', 'No admin operations'],
    ]
  ),
  spacer(),

  subheading('3.2 Recovery Objectives'),
  createTable(
    ['Component', 'Recovery Time Objective (RTO)', 'Recovery Point Objective (RPO)'],
    [
      ['PostgreSQL Database', '1 hour', '0 minutes (WAL replication)'],
      ['Supabase API Gateway', '30 minutes', 'N/A (stateless)'],
      ['Edge Functions', '30 minutes', 'N/A (stateless, code in Git)'],
      ['Authentication Service', '1 hour', '0 minutes'],
      ['Realtime Subscriptions', '1 hour', 'N/A (derived from database)'],
      ['Lipila Integration', '4 hours', 'Last successful callback'],
      ['Twilio Integration', '8 hours', 'N/A'],
      ['Mobile Application', '24 hours', 'N/A (client-side)'],
      ['Overall Platform', '4 hours', '0-5 minutes'],
    ]
  ),
  spacer(),
  para('RPO of 0 minutes for the database is achieved through PostgreSQL Write-Ahead Logging (WAL) which ensures all committed transactions are durable. The 5-minute RPO represents the maximum data loss in a catastrophic scenario requiring point-in-time recovery from the backup system.'),

  pageBreak(),
  heading('4. RISK SCENARIOS AND RESPONSE PROCEDURES'),

  subheading('4.1 Scenario 1: Database Outage'),
  boldPara('Description: Supabase-hosted PostgreSQL database becomes unavailable.'),
  boldPara('Impact: Complete system failure — all transactions and authentication stop.'),
  para('Response Procedure:'),
  bullet('1. Detection: Automated monitoring detects database connectivity failure; alert sent to CITO'),
  bullet('2. Assessment: CITO checks Supabase status page and dashboard for known incidents'),
  bullet('3. Escalation: If Supabase-side issue, contact Supabase support (Pro plan priority support)'),
  bullet('4. Communication: Notify CEO and CCO; prepare customer communication if outage exceeds 30 minutes'),
  bullet('5. Recovery: Supabase restores database from automated backups or WAL replay'),
  bullet('6. Verification: Run reconciliation checks to verify data integrity post-recovery'),
  bullet('7. Post-Incident: Document incident, root cause, and preventive measures'),
  para('Contingency: If Supabase cannot restore within RTO, CITO initiates migration to a self-hosted PostgreSQL instance using the most recent automated backup.'),

  subheading('4.2 Scenario 2: Payment Gateway (Lipila) Outage'),
  boldPara('Description: Lipila API becomes unavailable or stops processing transactions.'),
  boldPara('Impact: Top-up and withdrawal services unavailable. P2P and agent transactions continue normally.'),
  para('Response Procedure:'),
  bullet('1. Detection: Edge Function errors or callback delays detected; alert sent to CITO'),
  bullet('2. Assessment: CITO contacts Lipila technical support to determine scope and ETA'),
  bullet('3. Mitigation: Display user-friendly message in app indicating top-up/withdrawal temporarily unavailable'),
  bullet('4. Communication: Notify CEO; inform customer support team to handle inquiries'),
  bullet('5. Pending Transactions: All pending top-ups are held in pending state; no customer funds are at risk'),
  bullet('6. Recovery: Resume service when Lipila confirms restoration; process any stuck pending transactions'),
  bullet('7. Reconciliation: Run full reconciliation against Lipila records post-recovery'),

  subheading('4.3 Scenario 3: SMS Service (Twilio) Outage'),
  boldPara('Description: Twilio Verify service becomes unavailable.'),
  boldPara('Impact: New user registration and PIN recovery unavailable. All existing users unaffected.'),
  para('Response Procedure:'),
  bullet('1. Detection: Registration errors reported by users or detected in logs'),
  bullet('2. Assessment: Check Twilio status page; contact Twilio support'),
  bullet('3. Mitigation: Display message indicating registration temporarily unavailable'),
  bullet('4. Contingency: If outage exceeds 24 hours, evaluate alternative SMS providers (e.g., Africa\'s Talking)'),
  bullet('5. Recovery: Resume normal registration when Twilio service is restored'),

  subheading('4.4 Scenario 4: Mobile Application Store Removal'),
  boldPara('Description: App removed from Google Play Store or Apple App Store.'),
  boldPara('Impact: New downloads impossible; existing installed apps continue to function.'),
  para('Response Procedure:'),
  bullet('1. Detection: Notification from app store or user reports'),
  bullet('2. Assessment: Identify reason for removal and corrective actions needed'),
  bullet('3. Appeal: File appeal with the respective app store'),
  bullet('4. Mitigation: Existing users can continue using installed app; direct download APK available for Android'),
  bullet('5. Recovery: Address removal reason and resubmit app for review'),

  subheading('4.5 Scenario 5: Cybersecurity Incident'),
  boldPara('Description: Detected or suspected security breach.'),
  boldPara('Impact: Potential data exposure, financial loss, or reputational damage.'),
  para('Response Procedure:'),
  bullet('1. Detection: Monitoring alert, user report, or external notification'),
  bullet('2. Containment: CITO immediately isolates affected systems (e.g., rotate API keys, freeze affected accounts)'),
  bullet('3. Assessment: Determine scope and impact of the breach'),
  bullet('4. Escalation: Notify CEO, CCO, and Board. Notify Bank of Zambia within 24 hours if customer data or funds are affected.'),
  bullet('5. Recovery: Remediate vulnerability; restore affected systems from clean backups'),
  bullet('6. Communication: Notify affected customers with clear, honest information about the incident and steps taken'),
  bullet('7. Post-Incident: Engage external security auditor if warranted; implement preventive measures'),

  subheading('4.6 Scenario 6: Loss of Key Personnel'),
  boldPara('Description: Sudden departure or incapacitation of a key team member.'),
  para('Response Procedure:'),
  bullet('Cross-training ensures at least two people can perform each critical function'),
  bullet('All system credentials and access procedures are documented and securely stored'),
  bullet('Code is maintained in version control (Git) with documentation'),
  bullet('Succession planning for senior management positions'),

  pageBreak(),
  heading('5. BACKUP AND RECOVERY'),

  subheading('5.1 Database Backups'),
  bullet('Type: Automated daily full backups provided by Supabase'),
  bullet('Retention: 7 days (Supabase Pro plan)'),
  bullet('Point-in-Time Recovery: Available within the backup retention window using WAL archiving'),
  bullet('Encryption: All backups are encrypted at rest with AES-256'),
  bullet('Verification: Backup integrity is verified through periodic restoration testing (quarterly)'),

  subheading('5.2 Application Code'),
  bullet('Version Control: All application code is stored in Git repository'),
  bullet('Branch Strategy: Main branch contains production-ready code'),
  bullet('Build Reproducibility: EAS build configurations allow reproduction of any build'),
  bullet('Edge Functions: All Edge Function code is version-controlled and can be redeployed in minutes'),

  subheading('5.3 Configuration and Secrets'),
  bullet('Environment Variables: Stored in Supabase dashboard (Edge Functions) and EAS secrets'),
  bullet('API Keys: Documented in secure password manager accessible to CITO and CEO'),
  bullet('Database Migrations: All schema changes are recorded as numbered SQL migration files'),

  heading('6. COMMUNICATION PLAN'),

  subheading('6.1 Internal Communication'),
  createTable(
    ['Event', 'Notify', 'Method', 'Timeframe'],
    [
      ['System outage detected', 'CITO, CEO', 'Phone/WhatsApp', 'Immediately'],
      ['Outage exceeds 30 minutes', 'CCO, CFO, Board Chair', 'Phone/Email', 'Within 30 minutes'],
      ['Security breach detected', 'CITO, CEO, CCO', 'Phone', 'Immediately'],
      ['Customer data affected', 'Full Board', 'Emergency meeting', 'Within 2 hours'],
    ]
  ),
  spacer(),

  subheading('6.2 External Communication'),
  createTable(
    ['Event', 'Notify', 'Method', 'Timeframe'],
    [
      ['Service outage > 1 hour', 'Customers', 'In-app banner / SMS', 'Within 1 hour'],
      ['Security breach (customer impact)', 'Bank of Zambia', 'Email/letter', 'Within 24 hours'],
      ['Security breach (customer impact)', 'Affected customers', 'SMS + in-app', 'Within 48 hours'],
      ['Material business disruption', 'Bank of Zambia', 'Formal notification', 'Within 24 hours'],
    ]
  ),
  spacer(),

  heading('7. TESTING AND MAINTENANCE'),

  subheading('7.1 Testing Schedule'),
  createTable(
    ['Test Type', 'Frequency', 'Responsibility'],
    [
      ['Backup restoration test', 'Quarterly', 'CITO'],
      ['Disaster recovery simulation', 'Annually', 'CITO + CEO'],
      ['Communication plan test', 'Annually', 'CCO'],
      ['Security incident response drill', 'Annually', 'CITO'],
      ['Payment gateway failover test', 'Semi-annually', 'CITO'],
    ]
  ),
  spacer(),

  subheading('7.2 Plan Maintenance'),
  para('This BCP/DR plan shall be reviewed and updated:'),
  bullet('Annually by the CITO with Board approval'),
  bullet('Following any activation of the plan'),
  bullet('Following significant changes to the technology infrastructure'),
  bullet('Following the addition of new third-party providers or services'),
  bullet('Following any regulatory changes affecting continuity requirements'),

  heading('8. ROLES AND RESPONSIBILITIES'),
  createTable(
    ['Role', 'BCP/DR Responsibility'],
    [
      ['CEO', 'Overall crisis management; external communication; Board liaison'],
      ['CITO', 'BCP/DR plan owner; technical recovery lead; infrastructure decisions'],
      ['CCO', 'Regulatory notifications; customer communication; compliance aspects'],
      ['CFO', 'Financial impact assessment; trust account continuity; insurance claims'],
      ['Customer Support Lead', 'Customer inquiry management during incidents'],
    ]
  ),
];

const doc = createDoc(sections);
await saveDoc(doc, 'docs/boz-designation/15_Business_Continuity_and_Disaster_Recovery.docx');
