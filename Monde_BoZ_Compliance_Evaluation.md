# Monde — Bank of Zambia Compliance Evaluation
## National Payment Systems Act No. 1 of 2007

---

## 1. Executive Summary

Monde is a mobile payment application for Zambia offering P2P payments, QR code transactions, NFC tap-to-pay, digital wallet services, and agent-assisted cash-in/cash-out. Under the **National Payment Systems Act No. 1 of 2007 (NPSA)**, Monde qualifies as a **"payment system business"** as defined in Section 2(1) — specifically, "the business of providing money transfer or transmission services."

**Designation under Section 12 is required before Monde can legally operate.**

This document evaluates Monde's current state against all applicable NPSA requirements and identifies compliance gaps with remediation plans.

---

## 2. Applicability Assessment

### Section 3 — Application
> "This Act shall apply to any person engaged in operating or participating in a payment system or payment system business."

**Status: ✅ APPLICABLE**
Monde provides money transfer/transmission services (P2P payments, wallet top-up, withdrawal, agent cash-in/cash-out). The NPSA applies in full.

### Section 2(1) — Classification
- **"payment system business"** = "the business of providing money transfer or transmission services or any other business that the Bank of Zambia may prescribe"
- Monde is a **payment system business**, NOT a payment system operator (we don't operate clearing/settlement infrastructure)
- Monde uses existing regulated infrastructure (Lipila API → MNO mobile money systems) for actual fund movement

---

## 3. Section-by-Section Compliance Assessment

### PART II — PAYMENT SYSTEM REGULATION (Sections 4–10)

| Section | Requirement | Monde Status | Notes |
|---------|-------------|-------------|-------|
| 4 | BoZ responsible for Act implementation | N/A | Regulatory authority matter |
| 5 | BoZ regulates/oversees payment systems | N/A | Applies to payment systems, not payment system businesses directly |
| 6 | BoZ prescribes designation requirements | N/A | Monde to comply with whatever BoZ prescribes |
| 7 | Application for designation of payment system | N/A | Applies to payment system operators |
| 8 | Existing systems deemed designated | N/A | Monde is new, not pre-existing |
| 9 | BoZ directives to clearing houses/participants | N/A | Monde is not a clearing house |
| 10 | (Continuation of Section 9) | N/A | — |

### PART III — PAYMENT SYSTEM BUSINESS (Sections 11–13)

| Section | Requirement | Monde Status | Action Required |
|---------|-------------|-------------|-----------------|
| **11** | BoZ regulates and oversees payment system businesses | ⚠️ PARTIAL | Monde must submit to BoZ oversight. Seeking designation demonstrates willingness. |
| **12(1)** | Must apply for designation before conducting business | ⚠️ IN PROGRESS | **Application being prepared.** This presentation is part of the process. |
| **12(2)** | Existing businesses must apply within 180 days | N/A | Monde is new, not pre-existing. |
| **12(3)** | BoZ prescribes designation requirements | ⚠️ PARTIAL | Must comply with all BoZ-prescribed forms and requirements. Gathering documentation. |
| **12(4)** | BoZ grants certificate upon compliance + fee payment | ⏳ PENDING | Awaiting BoZ review and fee determination. |
| **12(5)** | Certificate valid until revoked | N/A | Post-designation. |
| **12(6)** | BoZ may refuse non-compliant applicants | N/A | Working to ensure full compliance. |
| **12(7)** | Operating without designation is an offence (fine up to 500,000 penalty units or 5 years imprisonment) | ⚠️ CRITICAL | **Monde must NOT launch commercially until designated.** Currently in pre-launch/development mode. |
| **13(1)** | Cannot conduct payment system business unless designated, a participant, or exempted | ⚠️ CRITICAL | Same as above — commercial launch blocked until designation obtained. |
| **13(2)** | Exceptions for agents of payees, holding company transactions, money lending agents | N/A | Monde does not fall under these exceptions. |

### PART IV — CHEQUES (Sections 14–16)
**Status: ✅ NOT APPLICABLE** — Monde is a digital-only platform with no cheque processing capabilities.

### PART V — SETTLEMENTS (Sections 17–24)
**Status: ✅ NOT DIRECTLY APPLICABLE** — These sections apply to designated payment systems (clearing houses, settlement agents). Monde is a payment system business, not a payment system operator. Settlement is handled by the underlying MNO infrastructure.

### PART VI — GENERAL AND ENFORCEMENT (Sections 25–43)

| Section | Requirement | Monde Status | Action Required |
|---------|-------------|-------------|-----------------|
| **27** | Submit returns as prescribed by BoZ | ⚠️ PARTIAL | System capable of generating reports. Formal reporting structure to be agreed with BoZ after designation. |
| **28** | Maintain records for 6 years; electronic storage permitted | ✅ COMPLIANT | All records stored in Supabase PostgreSQL. Electronic storage with full audit trail. Retention policy configured. |
| **29(1)** | Provide information to BoZ within 14 days of written request | ✅ READY | Full database access capability. Can export any requested data. |
| **29(3)** | Information obtained by BoZ is confidential | N/A | BoZ obligation, not Monde's. |
| **30** | Documents must be signed by CEO and CFO | ⚠️ PARTIAL | Governance structure being formalized. CEO/CFO roles to be formally designated. |
| **31** | False documents are an offence | ✅ ACKNOWLEDGED | Monde commits to truthful, accurate documentation. |
| **32** | Cannot use names implying BoZ designation if not designated | ✅ COMPLIANT | Monde does not claim to be BoZ-designated. Will only use designation references after certificate is obtained. |
| **33** | Dishonoured cheques reporting | ✅ N/A | Digital-only platform, no cheques. |
| **34** | BoZ may investigate premises | ✅ READY | Monde will cooperate fully with any BoZ investigation. |
| **35** | General offence for breaching Act provisions | ✅ ACKNOWLEDGED | Compliance program designed to prevent breaches. |
| **36** | Transactions not void solely due to contravention | N/A | Legal protection for transaction integrity. |
| **37** | BoZ officials have immunity | N/A | BoZ matter. |
| **38** | BoZ may prescribe exemptions | N/A | Monde may request exemption if applicable, but seeking full designation. |
| **39** | Disputes between participants: mutual agreement then arbitration | ✅ READY | Will implement dispute resolution procedures. |
| **40** | BoZ decisions must be in writing with reasons | N/A | BoZ obligation. |
| **41** | Appeal to Minister/Tribunal within 14 days | N/A | Available if needed; hope not to need it. |
| **42** | Minister may make regulations | N/A | Monde will comply with any regulations made. |
| **43** | BoZ may prescribe rules/guidelines covering fees, operations, etc. | ⚠️ PARTIAL | Ready to comply with all BoZ-prescribed rules. Fee schedule prepared for filing. |

---

## 4. Compliance Gap Analysis

### 🔴 Critical Gaps (Must Address Before Launch)

1. **Designation Certificate (Section 12)**
   - **Gap:** Monde is not yet designated as a payment system business
   - **Risk:** Operating without designation is a criminal offence (Section 12(7))
   - **Action:** Complete and submit formal designation application to BoZ
   - **Timeline:** Immediate (0–3 months)

2. **Company Registration & Legal Entity**
   - **Gap:** Must ensure proper company registration with PACRA
   - **Risk:** BoZ requires a legally registered entity for designation
   - **Action:** Verify/complete PACRA registration, obtain tax clearance from ZRA
   - **Timeline:** Immediate

3. **Corporate Governance (Section 30)**
   - **Gap:** Formal CEO/CFO roles and signing authority not yet established
   - **Risk:** Cannot submit properly signed documents to BoZ
   - **Action:** Formalize governance structure, appoint directors, complete Directors' Questionnaires
   - **Timeline:** 0–3 months

### 🟡 Important Gaps (Address in Short-Term)

4. **KYC/CDD Procedures**
   - **Gap:** No formal KYC/Customer Due Diligence procedures beyond phone-based registration
   - **Risk:** FIC Act and BoZ directives require proper KYC for payment service providers
   - **Action:** Implement tiered KYC (basic phone verification → enhanced ID verification for higher limits)
   - **Timeline:** 3–6 months

5. **AML/CFT Compliance Program**
   - **Gap:** No formal AML/CFT program, no Money Laundering Reporting Officer (MLRO)
   - **Risk:** Required under Financial Intelligence Centre Act
   - **Action:** Appoint MLRO, develop AML/CFT policies, establish STR filing procedures
   - **Timeline:** 3–6 months

6. **Formal Returns & Reporting (Section 27)**
   - **Gap:** No established reporting framework to BoZ
   - **Risk:** Section 27 requires prescribed returns; failure is an offence
   - **Action:** Engage BoZ to understand reporting requirements, build reporting templates
   - **Timeline:** 3–6 months

7. **Fee Schedule Filing (Section 43)**
   - **Gap:** Fee schedule not formally filed with BoZ
   - **Risk:** BoZ directives require pre-approval of fees and charges
   - **Action:** Prepare and submit fee schedule for BoZ review
   - **Timeline:** 3–6 months

### 🟢 Areas of Compliance / Low Risk

8. **Record Retention (Section 28)** — ✅ Compliant. Electronic records stored with full audit trail. 6+ year retention.

9. **Information Access (Section 29)** — ✅ Ready. Can provide any data to BoZ within 14-day requirement.

10. **Misleading Names (Section 32)** — ✅ Compliant. No false designation claims.

11. **Security Architecture** — ✅ Strong. PIN auth, auto-lock, rate limiting, RLS, input sanitization, encrypted transmission.

12. **Transaction Controls** — ✅ Implemented. Amount limits (K1–K50,000), balance validation, anti-fraud controls on agent operations.

13. **Audit Trail** — ✅ Complete. Full transaction history with timestamps, references, status, fees.

---

## 5. Additional Regulatory Considerations

### Data Protection Act No. 3 of 2021
- **Status:** Partially compliant
- **Gaps:** Need formal data protection policy, data breach notification procedures, Data Protection Impact Assessment
- **Action:** Develop comprehensive data protection framework

### Financial Intelligence Centre Act
- **Status:** Not yet compliant
- **Gaps:** No MLRO, no STR procedures, no customer risk assessment
- **Action:** Establish AML/CFT compliance program (see Gap #5)

### Electronic Communications and Transactions Act
- **Status:** Partially compliant
- **Gaps:** Formal electronic transaction terms and conditions needed
- **Action:** Develop user-facing terms that comply with e-commerce requirements

### BoZ National Payment Systems Directives
- **Money Transfer Services Directives 2021** — Must comply; details to be confirmed with BoZ
- **Electronic Money Issuance Directives 2018** — May apply if Monde is classified as e-money issuer (arguable since Monde facilitates transfers rather than issuing e-money)
- **ATM, POS, Internet Transactions and Mobile Payments Directives 2019** — Applicable to mobile payment operations

### BoZ Sandbox Guidelines
- Monde may benefit from entering the BoZ Regulatory Sandbox for innovative fintech products
- This allows testing under controlled conditions before full designation
- Sandbox participation could accelerate the designation process

---

## 6. Recommended Compliance Roadmap

### Phase 1: Immediate (0–3 months)
- [ ] Submit formal designation application to BoZ (Section 12)
- [ ] Complete and file all required BoZ documentation
- [ ] Complete Directors' Questionnaire and Vital Statistics forms
- [ ] Engage legal counsel specializing in Zambian financial regulation
- [ ] Verify PACRA registration and ZRA tax compliance
- [ ] Formalize corporate governance (CEO, CFO, Board)

### Phase 2: Short-Term (3–6 months)
- [ ] Implement formal KYC/CDD procedures (tiered approach)
- [ ] Appoint MLRO and develop AML/CFT compliance program
- [ ] File fee schedule with BoZ for review/approval
- [ ] Establish returns/reporting structure per Section 27
- [ ] Develop formal data protection policy (DPA 2021)
- [ ] Prepare internal compliance manual

### Phase 3: Medium-Term (6–12 months)
- [ ] Apply for BoZ Regulatory Sandbox (if recommended)
- [ ] Implement customer complaint/grievance mechanism (Section 43(3)(g))
- [ ] Develop business continuity and disaster recovery plan
- [ ] Build quarterly BoZ reporting framework
- [ ] Conduct first internal compliance audit
- [ ] Train all staff on AML/CFT and data protection

### Phase 4: Ongoing
- [ ] Regular compliance audits and self-assessments
- [ ] Respond to BoZ information requests within 14 days (Section 29)
- [ ] Maintain 6-year record retention (Section 28)
- [ ] Adapt to new BoZ directives and guidelines
- [ ] Annual review of fee schedules and operational procedures
- [ ] Annual external audit by BoZ-approved auditor

---

## 7. Conclusion

Monde has a **strong technical foundation** with robust security, full audit trails, and transparent fee management. The primary gaps are **regulatory and governance-related** — specifically:

1. **Obtaining BoZ designation** (the application itself)
2. **Formalizing corporate governance** (CEO/CFO roles, board)
3. **Establishing KYC/AML compliance programs**
4. **Filing formal reports and fee schedules with BoZ**

These gaps are **addressable** and represent standard requirements for any new payment system business. Monde's proactive engagement with BoZ — evidenced by this presentation — demonstrates commitment to full regulatory compliance.

**The technology platform is ready. The compliance framework is being built around it.**

---

*Document prepared for Bank of Zambia designation application*
*National Payment Systems Act No. 1 of 2007 — Section 12*
