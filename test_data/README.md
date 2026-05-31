# OKM Test Data — Apex Solutions Inc.

This directory contains sample documents for every department.  
Each file is crafted to exercise a specific OKM feature.

## Organisation Structure

| Department        | Clearance Levels             | Users |
|-------------------|------------------------------|-------|
| Engineering       | Public / Confidential / Secret | Alice (Secret), Bob (Confidential), Carol (Public) |
| Human Resources   | Public / Confidential / Secret | Diana (Secret), Ethan (Confidential), Fiona (Public) |
| Finance           | Public / Confidential / Secret | George (Secret), Hannah (Confidential), Ivan (Public) |
| Legal & Compliance| Public / Confidential / Secret | Julia (Secret), Kevin (Confidential) |
| Operations        | Public / Confidential / Secret | Laura (Secret), Mike (Confidential), Nina (Public) |

## Directory Layout

```
test_data/
  README.md                        ← this file
  seed_guide.md                    ← step-by-step ingestion guide
  engineering/
    public/
      engineering_onboarding_guide.txt
      tech_stack_overview.txt
    confidential/
      q2_architecture_design.txt
      api_integration_spec.txt
    secret/
      platform_security_audit_2025.txt
  human_resources/
    public/
      employee_handbook.txt
      remote_work_policy.txt
    confidential/
      performance_review_template.txt
      recruitment_pipeline_q3.txt
    secret/
      compensation_bands_2025.txt
  finance/
    public/
      expense_claim_policy.txt
      budget_overview_fy2025.txt
    confidential/
      q1_financial_report.txt
      vendor_payment_schedule.txt
    secret/
      annual_audit_findings.txt
  legal/
    public/
      code_of_conduct.txt
      data_privacy_policy.txt
    confidential/
      nda_template.txt
      regulatory_compliance_checklist.txt
    secret/
      litigation_risk_assessment.txt
  operations/
    public/
      facility_safety_guidelines.txt
      supply_chain_overview.txt
    confidential/
      logistics_partner_contracts_summary.txt
      warehouse_capacity_report_q2.txt
    secret/
      business_continuity_plan.txt
```

## Features Exercised

| Feature | Test Files |
|---------|-----------|
| **RAG Chat / Q&A** | All `.txt` files (content is query-answerable) |
| **MAC / Dept Access Control** | Files in `confidential/` and `secret/` folders |
| **Document Ingestion Pipeline** | All 25 `.txt` files uploadable via the ingestion API |
| **AI Planning & Milestones** | Each department has a matching Plan in `seed_guide.md` |
| **File Versioning** | Re-upload any file with `_v2` suffix |
| **Trash & Restore** | Delete any file and restore from trash |
| **Admin Audit Log** | Any admin action on users / departments |
| **Notifications** | Milestone auto-completion events |
