import { ContractEvalCase, ExpectedFinding } from "../types";

export const CONTRACT_EVALUATION_CASES: ContractEvalCase[] = [
  // 1. Individually Authored Cases (1 to 35)
  {
    id: "eval-contract-001",
    title: "Mutual NDA with Excessive Duration and Prohibited Indemnity",
    documentType: "nda",
    playbookType: "nda",
    split: "dev",
    description: "Mutual NDA with 5-year confidentiality duration and an improper indemnity clause.",
    canonicalText:
      "MUTUAL NON-DISCLOSURE AGREEMENT\n\n" +
      "This Mutual Non-Disclosure Agreement is entered into by Alpha Technologies Inc. and Beta Systems LLC.\n\n" +
      "SECTION 1. CONFIDENTIAL INFORMATION\n\n" +
      "Each party agrees that all confidential information disclosed shall remain strictly protected. Confidential information excludes information in the public knowledge, independently developed, or compelled by law.\n\n" +
      "SECTION 2. TERM OF CONFIDENTIALITY\n\n" +
      "The obligations of confidentiality shall remain in effect for a period of five (5) years following disclosure.\n\n" +
      "SECTION 3. INDEMNIFICATION\n\n" +
      "The Receiving Party shall indemnify and defend the Disclosing Party from and against any third party claims or liabilities arising out of any breach.\n\n" +
      "SECTION 4. TERMINATION\n\n" +
      "Either party may terminate this Agreement upon thirty (30) days written notice.\n",
    expectedParties: ["Alpha Technologies Inc.", "Beta Systems LLC"],
    expectedFindings: [
      { ruleId: "RULE_NDA_DURATION_LIMIT", category: "term", severity: "medium" },
      { ruleId: "RULE_NDA_PROHIBITED_INDEMNITY", category: "indemnification", severity: "high" },
    ],
  },
  {
    id: "eval-contract-002",
    title: "Unilateral NDA with Party Asymmetry",
    documentType: "nda",
    playbookType: "nda",
    split: "dev",
    description: "Unilateral agreement where only Receiving Party assumes non-disclosure covenants.",
    canonicalText:
      "CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT\n\n" +
      "This Agreement is between Omnicorp Global (Discloser) and Apex Consulting (Recipient).\n\n" +
      "SECTION 1. OBLIGATIONS OF RECIPIENT\n\n" +
      "Recipient shall maintain all Discloser proprietary information in strict confidence and shall not disclose it to any third party for two (2) years. Confidential records exclude public knowledge, independent development, and court ordered disclosures.\n\n" +
      "SECTION 2. RETURN OF MATERIALS\n\n" +
      "Recipient shall promptly return or certify destruction of all confidential materials upon Discloser request.\n\n" +
      "SECTION 3. GOVERNING LAW\n\n" +
      "This Agreement shall be governed by the laws of the State of New York.\n",
    expectedParties: ["Omnicorp Global", "Apex Consulting"],
    expectedGoverningLaw: "New York",
    expectedFindings: [
      { ruleId: "RULE_NDA_RECIPROCAL", category: "confidentiality", severity: "high" },
    ],
  },
  {
    id: "eval-contract-003",
    title: "NDA Lacking Required Carve-Out Exceptions",
    documentType: "nda",
    playbookType: "nda",
    split: "dev",
    description: "Confidentiality clause lacks standard exceptions for independent development and legal compulsion.",
    canonicalText:
      "MUTUAL NON-DISCLOSURE AGREEMENT\n\n" +
      "Between Zenith Labs and Horizon Health.\n\n" +
      "SECTION 1. CONFIDENTIAL INFORMATION DEFINITION\n\n" +
      "Each party agrees to protect confidential records. Confidential information includes all financial and scientific records.\n\n" +
      "SECTION 2. CARVE OUTS\n\n" +
      "Confidential information excludes only information already published in the public domain.\n\n" +
      "SECTION 3. TERM\n\n" +
      "The term of confidentiality shall be two (2) years.\n",
    expectedFindings: [
      { ruleId: "RULE_NDA_REQUIRED_EXCEPTIONS", category: "confidentiality", severity: "critical" },
    ],
  },
  {
    id: "eval-contract-004",
    title: "Fully Compliant Standard Mutual NDA Control",
    documentType: "nda",
    playbookType: "nda",
    split: "dev",
    description: "Standard mutual NDA complying with all policy guidelines with bilateral covenants.",
    canonicalText:
      "MUTUAL NON-DISCLOSURE AGREEMENT\n\n" +
      "This Agreement is entered into by Acme Corp and Cyber Dynamics.\n\n" +
      "SECTION 1. DEFINITIONS AND EXCLUSIONS\n\n" +
      "Confidential information excludes information in the public knowledge, independently developed, or compelled by law.\n\n" +
      "SECTION 2. MUTUAL CONFIDENTIALITY\n\n" +
      "Each party agrees to hold the other party confidential information in confidence for a period of two (2) years.\n\n" +
      "SECTION 3. TERMINATION\n\n" +
      "Either party may terminate upon giving thirty (30) days written notice.\n\n" +
      "SECTION 4. GOVERNING LAW\n\n" +
      "This Agreement shall be governed by Delaware law.\n",
    expectedGoverningLaw: "Delaware",
    expectedFindings: [],
  },
  {
    id: "eval-contract-005",
    title: "Executive Employment Agreement with Overbroad Non-Compete",
    documentType: "employment",
    playbookType: "employment",
    split: "dev",
    description: "Employment agreement containing a restrictive covenant exceeding 12 months.",
    canonicalText:
      "EXECUTIVE EMPLOYMENT AGREEMENT\n\n" +
      "This Executive Employment Agreement is made between Vanguard Financial and Johnathan Reed.\n\n" +
      "SECTION 1. POSITION AND AT-WILL EMPLOYMENT\n\n" +
      "Executive shall serve as Chief Risk Officer. Employment is strictly at-will.\n\n" +
      "SECTION 2. TERMINATION AND NOTICE\n\n" +
      "Either party may terminate employment upon thirty (30) days advance written notice.\n\n" +
      "SECTION 3. RESTRICTIVE COVENANTS\n\n" +
      "During employment and for twenty-four (24) months following termination, Executive shall not engage in any competing financial enterprise worldwide.\n\n" +
      "SECTION 4. PROPRIETARY INFORMATION AND INVENTIONS\n\n" +
      "Executive assigns all inventions, excluding prior inventions disclosed on Exhibit A.\n",
    expectedFindings: [
      { ruleId: "RULE_EMP_NON_COMPETE_DURATION", category: "restrictive_covenants", severity: "critical" },
    ],
  },
  {
    id: "eval-contract-006",
    title: "Compliant At-Will Employment Agreement Control",
    documentType: "employment",
    playbookType: "employment",
    split: "dev",
    description: "Compliant employment agreement with reasonable 6-month non-solicitation and statutory IP assignment exclusions.",
    canonicalText:
      "EMPLOYMENT AGREEMENT\n\n" +
      "Between Cascade Cloud Inc. and Emily Watson.\n\n" +
      "SECTION 1. POSITION AND AT-WILL EMPLOYMENT\n\n" +
      "Employee is hired as Staff Software Engineer. Employment is strictly at-will.\n\n" +
      "SECTION 2. TERMINATION AND NOTICE\n\n" +
      "Either party may terminate employment upon thirty (30) days advance written notice.\n\n" +
      "SECTION 3. RESTRICTIVE COVENANTS\n\n" +
      "For a period of six (6) months post-termination, Employee shall not engage in competing activities.\n\n" +
      "SECTION 4. PROPRIETARY INFORMATION AND INVENTIONS\n\n" +
      "Employee assigns all inventions developed using Company resources, excluding prior inventions developed on personal time without Company equipment.\n",
    expectedFindings: [],
  },
  {
    id: "eval-contract-007",
    title: "Employment Agreement Missing Explicit At-Will Statement",
    documentType: "employment",
    playbookType: "employment",
    split: "dev",
    description: "Employment agreement that omits mandatory at-will employment statement.",
    canonicalText:
      "EMPLOYMENT AGREEMENT\n\n" +
      "Between Pacific Ventures LLC and Marcus Vance.\n\n" +
      "SECTION 1. POSITION AND DUTIES\n\n" +
      "Employee shall serve as Vice President of Operations.\n\n" +
      "SECTION 2. TERMINATION NOTICE\n\n" +
      "Either party may terminate this agreement upon thirty (30) days advance written notice.\n\n" +
      "SECTION 3. RESTRICTIVE COVENANTS\n\n" +
      "Employee shall not engage in competing business for six (6) months post-employment.\n\n" +
      "SECTION 4. INVENTIONS\n\n" +
      "Employee assigns all company inventions, excluding prior inventions disclosed on Exhibit A.\n",
    expectedFindings: [
      { ruleId: "RULE_EMP_AT_WILL", category: "employment_status", severity: "medium" },
    ],
  },
  {
    id: "eval-contract-008",
    title: "Master Services Agreement with Missing Liability Carveouts",
    documentType: "services",
    playbookType: "services",
    split: "dev",
    description: "MSA limitation of liability clause lacking carveouts for gross negligence and willful misconduct.",
    canonicalText:
      "MASTER SERVICES AGREEMENT\n\n" +
      "Between Prime Solutions Inc. and Enterprise Retail.\n\n" +
      "SECTION 1. SCOPE OF SERVICES\n\n" +
      "Provider shall deliver IT integration services as set forth in Statements of Work.\n\n" +
      "SECTION 2. FEES AND PAYMENT\n\n" +
      "Invoices are payable within thirty (30) days of receipt.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "In no event shall either party aggregate liability exceed fifty thousand dollars ($50,000) under any circumstance.\n\n" +
      "SECTION 4. TERM AND RENEWAL\n\n" +
      "This agreement shall renew annually unless thirty (30) days advance notice is given.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_LIABILITY_CARVEOUTS", category: "liability", severity: "critical" },
    ],
  },
  {
    id: "eval-contract-009",
    title: "SaaS Agreement Control with Compliant Trailing Fee Cap",
    documentType: "services",
    playbookType: "services",
    split: "dev",
    description: "Compliant cloud subscription agreement capping liability with standard carveouts.",
    canonicalText:
      "SOFTWARE AS A SERVICE AGREEMENT\n\n" +
      "Between CloudMatrix Corp and Delta Logistics.\n\n" +
      "SECTION 1. SUBSCRIPTION GRANT\n\n" +
      "Customer receives a non-exclusive license to access the CloudMatrix platform.\n\n" +
      "SECTION 2. INVOICING\n\n" +
      "Fees are payable within thirty (30) days of invoice date.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "In no event shall either party aggregate liability exceed the total amounts paid in the twelve (12) months preceding the claim. The limitations in this Section shall not apply to damages arising from a party gross negligence or willful misconduct.\n\n" +
      "SECTION 4. TERM AND TERMINATION\n\n" +
      "This Agreement may be terminated by either party upon thirty (30) days notice.\n",
    expectedFindings: [],
  },
  {
    id: "eval-contract-010",
    title: "Employment Agreement with Missing Prior Inventions Carveout",
    documentType: "employment",
    playbookType: "employment",
    split: "dev",
    description: "IP assignment claiming all inventions without allowing prior invention disclosure.",
    canonicalText:
      "EXECUTIVE EMPLOYMENT AGREEMENT\n\n" +
      "Between Stellar Bio and Dr. Kevin Patel.\n\n" +
      "SECTION 1. POSITION AND AT-WILL EMPLOYMENT\n\n" +
      "Executive is hired as Chief Scientific Officer. Employment is strictly at-will.\n\n" +
      "SECTION 2. TERMINATION\n\n" +
      "Either party may terminate upon thirty (30) days advance written notice.\n\n" +
      "SECTION 3. RESTRICTIVE COVENANTS\n\n" +
      "Executive shall not compete for six (6) months following departure.\n\n" +
      "SECTION 4. INTELLECTUAL PROPERTY ASSIGNMENT\n\n" +
      "Executive hereby assigns to Company all inventions, concepts, and materials conceived prior to or during the term without exception.\n",
    expectedFindings: [
      { ruleId: "RULE_EMP_PRIOR_INVENTIONS", category: "intellectual_property", severity: "high" },
    ],
  },
  {
    id: "eval-contract-011",
    title: "Vendor Agreement with Excessive Auto-Renewal Window",
    documentType: "services",
    playbookType: "services",
    split: "dev",
    description: "Vendor agreement requiring 180 days advance notice to prevent auto-renewal.",
    canonicalText:
      "VENDOR SERVICES MASTER AGREEMENT\n\n" +
      "Between Global Logistics Group and Swift Hauling.\n\n" +
      "SECTION 1. SERVICES PROVIDED\n\n" +
      "Vendor shall provide freight management.\n\n" +
      "SECTION 2. PAYMENT TERMS\n\n" +
      "Invoices are payable within thirty (30) days.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "Liability is capped at $500,000, except for claims arising from gross negligence or willful misconduct.\n\n" +
      "SECTION 4. TERM AND AUTOMATIC RENEWAL\n\n" +
      "The initial term is three (3) years. This agreement shall automatically renew for successive three (3) year periods unless written notice of non-renewal is provided at least one hundred eighty (180) days prior to expiration.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_AUTO_RENEWAL_WINDOW", category: "termination", severity: "high" },
    ],
  },
  {
    id: "eval-contract-012",
    title: "Master Services Agreement with Excessive Liability Cap",
    documentType: "services",
    playbookType: "services",
    split: "dev",
    description: "MSA with an aggregate liability cap of $5,000,000 exceeding the $1,000,000 threshold.",
    canonicalText:
      "MASTER SERVICES AGREEMENT\n\n" +
      "Between Enterprise Code Systems and Apex Retail.\n\n" +
      "SECTION 1. SERVICES\n\n" +
      "Provider will deliver enterprise software installation.\n\n" +
      "SECTION 2. PAYMENT TERMS\n\n" +
      "Invoices are payable within thirty (30) days of receipt.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "Neither party aggregate liability under this Agreement shall exceed Five Million Dollars ($5,000,000). The limitations in this Section shall not apply to damages arising from gross negligence or willful misconduct.\n\n" +
      "SECTION 4. TERM\n\n" +
      "Term is two (2) years with thirty (30) days cancellation notice.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_LIABILITY_CAP_EXCEEDED", category: "liability", severity: "high" },
    ],
  },
  {
    id: "eval-contract-013",
    title: "Compliant Master Services Agreement Control",
    documentType: "services",
    playbookType: "services",
    split: "dev",
    description: "Balanced institutional MSA with reasonable liability cap and Net 30 payment terms.",
    canonicalText:
      "MASTER SERVICES AGREEMENT\n\n" +
      "Between SecureCloud Services and Global Retail Corp.\n\n" +
      "SECTION 1. SERVICES\n\n" +
      "Provider shall deliver managed hosting services.\n\n" +
      "SECTION 2. PAYMENT TERMS\n\n" +
      "All invoices are due and payable thirty (30) days following date of invoice.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "Neither party aggregate liability shall exceed five hundred thousand dollars ($500,000). This limitation does not apply to gross negligence or willful misconduct.\n\n" +
      "SECTION 4. TERM AND RENEWAL\n\n" +
      "Term is one year, renewing upon thirty (30) days advance written notice.\n",
    expectedFindings: [],
  },
  {
    id: "eval-contract-014",
    title: "Services Agreement with Short Payment Window",
    documentType: "services",
    playbookType: "services",
    split: "dev",
    description: "Services agreement requiring invoice payment within 10 days.",
    canonicalText:
      "SERVICES AGREEMENT\n\n" +
      "Between Legacy Host Corp and Apex FinTech.\n\n" +
      "SECTION 1. SERVICES\n\n" +
      "Host shall implement server hosting.\n\n" +
      "SECTION 2. INVOICES AND PAYMENT\n\n" +
      "Invoices are payable within ten (10) days of receipt.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "Total liability is capped at $250,000. Carveouts apply for gross negligence and willful misconduct.\n\n" +
      "SECTION 4. TERM\n\n" +
      "Term is one year with thirty (30) days termination notice.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_PAYMENT_NET_DAYS", category: "payment", severity: "medium" },
    ],
  },
  {
    id: "eval-contract-015",
    title: "Services Agreement with Broken Cross-Reference Integrity",
    documentType: "services",
    playbookType: "services",
    split: "dev",
    description: "Contract referencing non-existent Section 9.4 for critical indemnification procedures.",
    canonicalText:
      "MASTER SERVICES AGREEMENT\n\n" +
      "Between MegaCorp and Startup Innovations.\n\n" +
      "SECTION 1. SERVICES\n\n" +
      "Startup shall provide engineering assistance.\n\n" +
      "SECTION 2. INDEMNITY\n\n" +
      "Pursuant to the indemnification procedures set forth in Section 9.4, Startup shall indemnify MegaCorp.\n\n" +
      "SECTION 3. PAYMENT TERMS\n\n" +
      "Invoices are payable within thirty (30) days.\n\n" +
      "SECTION 4. LIMITATION OF LIABILITY\n\n" +
      "Liability is limited to $250,000 with standard carveouts for gross negligence and willful misconduct.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_CROSS_REFERENCE_INTEGRITY", category: "drafting", severity: "medium" },
    ],
  },
  {
    id: "eval-contract-016",
    title: "Services Agreement with Sub-30 Day Payment Terms",
    documentType: "services",
    playbookType: "services",
    split: "dev",
    description: "Contract mandating invoice settlement within 15 days.",
    canonicalText:
      "PROFESSIONAL SERVICES MASTER CONTRACT\n\n" +
      "Between Quality Tech and Global Buyers.\n\n" +
      "SECTION 1. SERVICES\n\n" +
      "Technical staffing and deliverables.\n\n" +
      "SECTION 2. INVOICING AND PAYMENT\n\n" +
      "Invoices are payable within fifteen (15) days of receipt.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "Liability capped at $100,000, excluding gross negligence or willful misconduct.\n\n" +
      "SECTION 4. TERM\n\n" +
      "Renewable annually upon thirty (30) days notice.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_PAYMENT_NET_DAYS", category: "payment", severity: "medium" },
    ],
  },
  {
    id: "eval-contract-017",
    title: "Employment Agreement with Insufficient Severance Notice",
    documentType: "employment",
    playbookType: "employment",
    split: "dev",
    description: "Employment agreement providing only 5 days termination notice.",
    canonicalText:
      "EMPLOYMENT AGREEMENT\n\n" +
      "Between Pacific Shipping USA and Daniel Wright.\n\n" +
      "SECTION 1. EMPLOYMENT AT WILL\n\n" +
      "Employee is employed at-will.\n\n" +
      "SECTION 2. TERMINATION AND NOTICE\n\n" +
      "Either party may terminate employment upon five (5) days advance written notice.\n\n" +
      "SECTION 3. RESTRICTIVE COVENANTS\n\n" +
      "Employee shall not compete for six (6) months following termination.\n\n" +
      "SECTION 4. INVENTIONS\n\n" +
      "Employee assigns inventions, excluding prior inventions disclosed on Exhibit A.\n",
    expectedFindings: [
      { ruleId: "RULE_EMP_SEVERANCE_NOTICE", category: "termination", severity: "high" },
    ],
  },
  {
    id: "eval-contract-018",
    title: "Vendor Agreement with 90-Day Auto-Renewal Notice Window",
    documentType: "services",
    playbookType: "services",
    split: "dev",
    description: "Agreement locking vendor into renewal unless cancelled 90 days prior.",
    canonicalText:
      "MASTER SUBCONTRACT AGREEMENT\n\n" +
      "Between Prime Builders Inc. and Sub Specialists LLC.\n\n" +
      "SECTION 1. SCOPE OF SUBCONTRACT WORK\n\n" +
      "Electrical installation services.\n\n" +
      "SECTION 2. PAYMENT TERMS\n\n" +
      "Invoices are payable within thirty (30) days.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "Liability capped at $200,000, excluding gross negligence and willful misconduct.\n\n" +
      "SECTION 4. TERM AND RENEWAL\n\n" +
      "This agreement automatically renews unless notice of non-renewal is delivered ninety (90) days prior to the expiration date.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_AUTO_RENEWAL_WINDOW", category: "termination", severity: "high" },
    ],
  },
  {
    id: "eval-contract-019",
    title: "Employment Agreement Missing Prior Inventions Exclusions",
    documentType: "employment",
    playbookType: "employment",
    split: "dev",
    description: "IP assignment clause without pre-existing inventions disclosure.",
    canonicalText:
      "EMPLOYMENT AND PROPRIETARY INFORMATION AGREEMENT\n\n" +
      "Between BioNano Research and Green Therapeutics.\n\n" +
      "SECTION 1. AT WILL EMPLOYMENT\n\n" +
      "Employment relationship is strictly at-will.\n\n" +
      "SECTION 2. TERMINATION NOTICE\n\n" +
      "Thirty (30) days written notice required for termination.\n\n" +
      "SECTION 3. RESTRICTIVE COVENANTS\n\n" +
      "Six (6) months non-competition post-employment.\n\n" +
      "SECTION 4. INVENTIONS ASSIGNMENT\n\n" +
      "Employee assigns all inventions, patents, and designs created during employment to Employer.\n",
    expectedFindings: [
      { ruleId: "RULE_EMP_PRIOR_INVENTIONS", category: "intellectual_property", severity: "high" },
    ],
  },
  {
    id: "eval-contract-020",
    title: "Clean Mutual NDA Control with 3-Year Term",
    documentType: "nda",
    playbookType: "nda",
    split: "dev",
    description: "Standard mutual NDA complying with 3-year term and statutory carveouts.",
    canonicalText:
      "MUTUAL CONFIDENTIALITY AGREEMENT\n\n" +
      "Between Nexus Software and Quantum Devices.\n\n" +
      "SECTION 1. CONFIDENTIAL INFORMATION\n\n" +
      "Each party agrees to hold confidential records in strict confidence. Excludes public knowledge, independent development, and compelled by law disclosures.\n\n" +
      "SECTION 2. TERM OF OBLIGATIONS\n\n" +
      "Confidentiality shall last three (3) years from disclosure.\n\n" +
      "SECTION 3. TERMINATION\n\n" +
      "Either party may terminate upon thirty (30) days notice.\n",
    expectedFindings: [],
  },
  {
    id: "eval-contract-021",
    title: "Services Agreement with Broken Cross-Reference",
    documentType: "services",
    playbookType: "services",
    split: "held_out",
    description: "Agreement referencing non-existent Section 12.1.",
    canonicalText:
      "COMMERCIAL RESELLER AGREEMENT\n\n" +
      "Between Hardware Manufacturer and Regional Distributor.\n\n" +
      "SECTION 1. SERVICES SCOPE\n\n" +
      "Distributor shall market hardware products.\n\n" +
      "SECTION 2. COMPLIANCE\n\n" +
      "Distributor shall comply with warranty procedures set forth in Section 12.1 of this Agreement.\n\n" +
      "SECTION 3. PAYMENT TERMS\n\n" +
      "Payment due within thirty (30) days of invoice.\n\n" +
      "SECTION 4. LIMITATION OF LIABILITY\n\n" +
      "Liability capped at $300,000. Carveouts apply for gross negligence and willful misconduct.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_CROSS_REFERENCE_INTEGRITY", category: "drafting", severity: "medium" },
    ],
  },
  {
    id: "eval-contract-022",
    title: "Services Agreement Lacking Liability Cap Carveouts",
    documentType: "services",
    playbookType: "services",
    split: "held_out",
    description: "Agreement eliminating liability without gross negligence carveout.",
    canonicalText:
      "SERVICE LEVEL AGREEMENT ADDENDUM\n\n" +
      "Between CloudHost Data and SaaS Operator.\n\n" +
      "SECTION 1. SERVICE AVAILABILITY\n\n" +
      "Provider will target 99.9% uptime.\n\n" +
      "SECTION 2. PAYMENT TERMS\n\n" +
      "Invoices payable in thirty (30) days.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "In no event shall either party aggregate liability exceed $10,000 for any and all claims.\n\n" +
      "SECTION 4. TERMINATION\n\n" +
      "Terminable on thirty (30) days notice.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_LIABILITY_CARVEOUTS", category: "liability", severity: "critical" },
    ],
  },
  {
    id: "eval-contract-023",
    title: "Clean Services Agreement Control with 1x Cap and Reciprocal Indemnity",
    documentType: "services",
    playbookType: "services",
    split: "held_out",
    description: "Balanced institutional MSA with 12-month trailing fee liability cap.",
    canonicalText:
      "MASTER SERVICES AGREEMENT\n\n" +
      "Between Apex Engineering and Bluebird Retail.\n\n" +
      "SECTION 1. PERFORMANCE OF SERVICES\n\n" +
      "Engineering services described in Statements of Work.\n\n" +
      "SECTION 2. PAYMENT TERMS\n\n" +
      "Payment due thirty (30) days from invoice.\n\n" +
      "SECTION 3. AGGREGATE LIABILITY CAP\n\n" +
      "Neither party total aggregate liability shall exceed five hundred thousand dollars ($500,000). The limitations do not apply to gross negligence or willful misconduct.\n\n" +
      "SECTION 4. TERM\n\n" +
      "Term is one year with thirty (30) days non-renewal notice.\n",
    expectedFindings: [],
  },
  {
    id: "eval-contract-024",
    title: "Clean Employment Offer Letter Control with 1-Year Non-Solicit",
    documentType: "employment",
    playbookType: "employment",
    split: "held_out",
    description: "Standard compliant offer letter with at-will status and reasonable non-competition.",
    canonicalText:
      "EMPLOYMENT OFFER LETTER AND AGREEMENT\n\n" +
      "Between Brightline Inc. and Sarah Jenkins.\n\n" +
      "SECTION 1. OFFER OF EMPLOYMENT\n\n" +
      "Position of Senior Product Designer with at-will employment relationship.\n\n" +
      "SECTION 2. NOTICE OF TERMINATION\n\n" +
      "Either party may terminate upon thirty (30) days written notice.\n\n" +
      "SECTION 3. RESTRICTIVE COVENANTS\n\n" +
      "Employee agrees not to engage in competing enterprise for six (6) months following separation.\n\n" +
      "SECTION 4. PROPRIETARY INFORMATION\n\n" +
      "Employee assigns inventions created during employment, excluding prior inventions listed on Exhibit A.\n",
    expectedFindings: [],
  },
  {
    id: "eval-contract-025",
    title: "Mutual NDA with Unilateral Confidentiality Obligations",
    documentType: "nda",
    playbookType: "nda",
    split: "held_out",
    description: "Agreement where recipient alone assumes confidentiality obligations.",
    canonicalText:
      "NON-DISCLOSURE AGREEMENT\n\n" +
      "Between Pioneer Dynamics and Summit Systems.\n\n" +
      "SECTION 1. OBLIGATIONS OF RECIPIENT\n\n" +
      "Recipient shall maintain all Discloser proprietary information in strict confidence and shall not disclose it for two (2) years. Confidential records exclude public knowledge, independent development, and court ordered disclosures.\n\n" +
      "SECTION 2. DESTRUCTION OF DOCUMENTS\n\n" +
      "Recipient shall return or destroy all documents within five days of request.\n\n" +
      "SECTION 3. TERMINATION\n\n" +
      "Either party may terminate upon thirty (30) days notice.\n",
    expectedFindings: [
      { ruleId: "RULE_NDA_RECIPROCAL", category: "confidentiality", severity: "high" },
    ],
  },
  {
    id: "eval-contract-026",
    title: "Services Agreement with Excessive Liability Cap",
    documentType: "services",
    playbookType: "services",
    split: "held_out",
    description: "Services agreement with $3,000,000 liability cap exceeding threshold.",
    canonicalText:
      "COMMERCIAL AGENCY AGREEMENT\n\n" +
      "Between Principal Manufacturer and Marketing Agent.\n\n" +
      "SECTION 1. AGENCY SCOPE\n\n" +
      "Agent shall solicit orders in designated territory.\n\n" +
      "SECTION 2. PAYMENT TERMS\n\n" +
      "Invoices payable in thirty (30) days.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "Neither party liability shall exceed Three Million Dollars ($3,000,000). Does not apply to gross negligence or willful misconduct.\n\n" +
      "SECTION 4. TERMINATION\n\n" +
      "Terminable on thirty (30) days notice.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_LIABILITY_CAP_EXCEEDED", category: "liability", severity: "high" },
    ],
  },
  {
    id: "eval-contract-027",
    title: "Employment Agreement Missing At-Will Statement",
    documentType: "employment",
    playbookType: "employment",
    split: "held_out",
    description: "Agreement lacking statutory at-will employment statement.",
    canonicalText:
      "EMPLOYMENT AGREEMENT\n\n" +
      "Between Building Management Co. and CleanCorp Services.\n\n" +
      "SECTION 1. POSITION\n\n" +
      "Employee shall serve as Facilities Director.\n\n" +
      "SECTION 2. TERMINATION NOTICE\n\n" +
      "Thirty (30) days advance notice required for termination.\n\n" +
      "SECTION 3. RESTRICTIVE COVENANTS\n\n" +
      "Six (6) months non-competition post-employment.\n\n" +
      "SECTION 4. INVENTIONS\n\n" +
      "Employee assigns inventions, excluding prior inventions disclosed on Exhibit A.\n",
    expectedFindings: [
      { ruleId: "RULE_EMP_AT_WILL", category: "employment_status", severity: "medium" },
    ],
  },
  {
    id: "eval-contract-028",
    title: "Employment Agreement with 24-Month Non-Compete",
    documentType: "employment",
    playbookType: "employment",
    split: "held_out",
    description: "Employment non-compete binding employee for 24 months.",
    canonicalText:
      "EXECUTIVE EMPLOYMENT AGREEMENT\n\n" +
      "Between Buyer Global Corp and Arthur King.\n\n" +
      "SECTION 1. POSITION AND AT-WILL EMPLOYMENT\n\n" +
      "Executive is hired as Vice President. Employment is at-will.\n\n" +
      "SECTION 2. TERMINATION NOTICE\n\n" +
      "Thirty (30) days advance written notice required.\n\n" +
      "SECTION 3. RESTRICTIVE COVENANTS\n\n" +
      "Executive shall not engage in any competing software activity for twenty-four (24) months following termination.\n\n" +
      "SECTION 4. INVENTIONS\n\n" +
      "Assignments exclude prior inventions on Exhibit A.\n",
    expectedFindings: [
      { ruleId: "RULE_EMP_NON_COMPETE_DURATION", category: "restrictive_covenants", severity: "critical" },
    ],
  },
  {
    id: "eval-contract-029",
    title: "Services Agreement with Net 10 Payment Terms",
    documentType: "services",
    playbookType: "services",
    split: "held_out",
    description: "Payment terms requiring payment within 10 days.",
    canonicalText:
      "CLIENT REFERRAL AGREEMENT\n\n" +
      "Between SaaS Provider and Business Broker.\n\n" +
      "SECTION 1. REFERRAL FEES\n\n" +
      "Broker receives 15% commission.\n\n" +
      "SECTION 2. INVOICES AND PAYMENT\n\n" +
      "Invoices are payable within ten (10) days of receipt.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "Liability capped at $100,000 with standard carveouts for gross negligence and willful misconduct.\n\n" +
      "SECTION 4. TERM\n\n" +
      "Term is one year with thirty (30) days notice.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_PAYMENT_NET_DAYS", category: "payment", severity: "medium" },
    ],
  },
  {
    id: "eval-contract-030",
    title: "Services Agreement with Broken Cross-Reference",
    documentType: "services",
    playbookType: "services",
    split: "held_out",
    description: "Contract referencing non-existent Section 14.3.",
    canonicalText:
      "TECHNOLOGY TRANSFER AND LICENSING AGREEMENT\n\n" +
      "Between Research Institute and Commercialization Partner.\n\n" +
      "SECTION 1. TRANSFER OF MATERIALS\n\n" +
      "Institute shall provide technical blueprints.\n\n" +
      "SECTION 2. WARRANTY DISCLAIMER\n\n" +
      "Except as explicitly set forth in Section 14.3 of this Agreement, all technical assets are provided as is.\n\n" +
      "SECTION 3. PAYMENT TERMS\n\n" +
      "Invoices payable in thirty (30) days.\n\n" +
      "SECTION 4. LIMITATION OF LIABILITY\n\n" +
      "Liability capped at $500,000 with gross negligence carveouts.\n",
    expectedFindings: [
      { ruleId: "RULE_MSA_CROSS_REFERENCE_INTEGRITY", category: "drafting", severity: "medium" },
    ],
  },
  {
    id: "eval-contract-031",
    title: "Mutual NDA with Prohibited Indemnity",
    documentType: "nda",
    playbookType: "nda",
    split: "held_out",
    description: "Mutual NDA introducing broad indemnification clause.",
    canonicalText:
      "MUTUAL NON-DISCLOSURE AGREEMENT\n\n" +
      "Between Indie Studio and Streaming Giant.\n\n" +
      "SECTION 1. CONFIDENTIAL INFORMATION\n\n" +
      "Each party agrees to maintain confidentiality of confidential records. Excludes public knowledge, independent development, and court ordered disclosures.\n\n" +
      "SECTION 2. TERM\n\n" +
      "The confidentiality term shall be two (2) years.\n\n" +
      "SECTION 3. INDEMNITY\n\n" +
      "Receiving party shall defend and indemnify disclosing party from any liabilities.\n\n" +
      "SECTION 4. TERMINATION\n\n" +
      "Terminable upon thirty (30) days notice.\n",
    expectedFindings: [
      { ruleId: "RULE_NDA_PROHIBITED_INDEMNITY", category: "indemnification", severity: "high" },
    ],
  },
  {
    id: "eval-contract-032",
    title: "Clean Services Agreement Control with Net 30 Terms",
    documentType: "services",
    playbookType: "services",
    split: "held_out",
    description: "Standard balanced professional services contract with Net 30 payment terms.",
    canonicalText:
      "PROFESSIONAL SERVICES MASTER AGREEMENT\n\n" +
      "Between Consulting Group and Retail Partner.\n\n" +
      "SECTION 1. STATEMENT OF WORK\n\n" +
      "Services shall be performed in accordance with agreed milestones.\n\n" +
      "SECTION 2. PAYMENT TERMS\n\n" +
      "All invoices are due and payable thirty (30) days following date of invoice.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "Liability capped at $250,000 with carveouts for gross negligence and willful misconduct.\n\n" +
      "SECTION 4. TERMINATION FOR CAUSE\n\n" +
      "Either party may terminate upon thirty (30) days written notice of material breach.\n",
    expectedFindings: [],
  },
  {
    id: "eval-contract-033",
    title: "Clean Security Guard Services Agreement Control",
    documentType: "services",
    playbookType: "services",
    split: "held_out",
    description: "Security services contract with standard terms and liability cap.",
    canonicalText:
      "ONSITE SECURITY SERVICES CONTRACT\n\n" +
      "Between Shield Security Inc. and Corporate Plaza LLC.\n\n" +
      "SECTION 1. PATROL SERVICES\n\n" +
      "Shield shall provide licensed security personnel around the clock.\n\n" +
      "SECTION 2. PAYMENT TERMS\n\n" +
      "Fees are payable within thirty (30) days.\n\n" +
      "SECTION 3. LIMITATION OF LIABILITY\n\n" +
      "Aggregate liability capped at $500,000, excluding claims arising from gross negligence or willful misconduct.\n\n" +
      "SECTION 4. TERMINATION\n\n" +
      "Either party may terminate on thirty (30) days notice.\n",
    expectedFindings: [],
  },
  {
    id: "eval-contract-034",
    title: "Mutual NDA with 5-Year Confidentiality Duration",
    documentType: "nda",
    playbookType: "nda",
    split: "held_out",
    description: "NDA setting confidentiality duration to five years.",
    canonicalText:
      "MUTUAL CONFIDENTIALITY AGREEMENT\n\n" +
      "Between Metro University and Pharma Sponsor Corp.\n\n" +
      "SECTION 1. CONFIDENTIAL INFORMATION\n\n" +
      "Each party agrees to hold records in confidence. Excludes public knowledge, independent development, and court ordered disclosures.\n\n" +
      "SECTION 2. TERM OF CONFIDENTIALITY\n\n" +
      "Confidentiality duration shall be five (5) years following disclosure.\n\n" +
      "SECTION 3. TERMINATION\n\n" +
      "Terminable on thirty (30) days notice.\n",
    expectedFindings: [
      { ruleId: "RULE_NDA_DURATION_LIMIT", category: "term", severity: "medium" },
    ],
  },
  {
    id: "eval-contract-035",
    title: "Employment Agreement with 7-Day Severance Notice",
    documentType: "employment",
    playbookType: "employment",
    split: "held_out",
    description: "Employment agreement with 7 days termination notice.",
    canonicalText:
      "EMPLOYMENT AGREEMENT\n\n" +
      "Between Media Publisher and Jane Smith.\n\n" +
      "SECTION 1. POSITION AND AT-WILL EMPLOYMENT\n\n" +
      "Employee is hired as Staff Writer. Employment is strictly at-will.\n\n" +
      "SECTION 2. TERMINATION NOTICE\n\n" +
      "Either party may terminate this agreement upon seven (7) days advance written notice.\n\n" +
      "SECTION 3. RESTRICTIVE COVENANTS\n\n" +
      "Employee covenants not to compete for six (6) months following termination.\n\n" +
      "SECTION 4. INVENTIONS\n\n" +
      "Assignments exclude prior inventions on Exhibit A.\n",
    expectedFindings: [
      { ruleId: "RULE_EMP_SEVERANCE_NOTICE", category: "termination", severity: "high" },
    ],
  },

  // 2. Synthetic and Parameterized Boundary Cases (36 to 65)
  ...Array.from({ length: 30 }, (_, idx) => {
    const caseNum = 36 + idx;
    const isDurationIssue = idx % 3 === 0;
    const isIndemnityIssue = idx % 3 === 1;
    const isClean = idx % 3 === 2;
    const split = idx < 20 ? ("dev" as const) : ("held_out" as const);

    const durationYears = isDurationIssue ? 4 + (idx % 4) : 2;
    const indemnityClause = isIndemnityIssue
      ? "SECTION 3. INDEMNITY\n\nReceiving party shall defend and indemnify disclosing party against all liabilities.\n\n"
      : "";

    const text =
      `MUTUAL NON-DISCLOSURE AGREEMENT CASE ${caseNum}\n\n` +
      `Between Entity Alpha ${caseNum} and Entity Beta ${caseNum}.\n\n` +
      `SECTION 1. CONFIDENTIAL INFORMATION\n\n` +
      `Each party agrees to hold confidential information in confidence. Confidential records exclude public knowledge, independent development, and court ordered disclosures.\n\n` +
      `SECTION 2. TERM\n\n` +
      `The confidentiality term shall be ${durationYears} years.\n\n` +
      indemnityClause +
      `SECTION 4. TERMINATION\n\n` +
      `Terminable on thirty (30) days notice.\n`;

    const expectedFindings: ExpectedFinding[] = [];
    if (isDurationIssue) {
      expectedFindings.push({ ruleId: "RULE_NDA_DURATION_LIMIT", category: "term", severity: "medium" });
    }
    if (isIndemnityIssue) {
      expectedFindings.push({ ruleId: "RULE_NDA_PROHIBITED_INDEMNITY", category: "indemnification", severity: "high" });
    }

    return {
      id: `eval-contract-${String(caseNum).padStart(3, "0")}`,
      title: `Contract Variant ${caseNum}: ${isClean ? "Compliant" : isDurationIssue ? "Duration Deviation" : "Indemnity Deviation"}`,
      documentType: "nda" as const,
      playbookType: "nda",
      split,
      description: `Parameterized evaluation case testing variant ${caseNum} with duration ${durationYears} years.`,
      canonicalText: text,
      expectedFindings,
    };
  }),
];
