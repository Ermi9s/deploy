# OKM Test Data — Step-by-Step Seed Guide

This guide walks you through populating every feature of the OKM platform
with the Apex Solutions Inc. test data.

---

## Step 1 — Seed Users, Departments & Clearance Levels

Run the seed script inside the **management** service container:

```bash
# From the repo root
docker compose exec management python manage.py shell < scripts/seed_test_data.py
```

Expected output:
```
============================================================
  OKM Test Data Seed — Organisation: Apex Solutions Inc.
============================================================

▶  Seeding Departments & Clearance Levels …
  [CREATED] Department: Engineering
           [CREATED] Level: Public (rank 1)
           [CREATED] Level: Confidential (rank 2)
           [CREATED] Level: Secret (rank 3)
  [CREATED] Department: Finance
  ... (and so on for all 5 departments)

▶  Seeding Users …
  [CREATED] User: admin@apexsolutions.com
  [CREATED] User: alice.chen@apexsolutions.com
           Assigned → Engineering / Secret
  ...

✅  Done.  Summary:
    Departments : 5
    Levels      : 15
    Users       : 15
```

### All Test Users

| Email | Password | Department | Clearance |
|-------|----------|-----------|-----------|
| `admin@apexsolutions.com` | `Admin@1234!` | — | Superuser |
| `alice.chen@apexsolutions.com` | `Test@1234!` | Engineering | Secret |
| `bob.kumar@apexsolutions.com` | `Test@1234!` | Engineering | Confidential |
| `carol.smith@apexsolutions.com` | `Test@1234!` | Engineering | Public |
| `diana.osei@apexsolutions.com` | `Test@1234!` | Human Resources | Secret |
| `ethan.lewis@apexsolutions.com` | `Test@1234!` | Human Resources | Confidential |
| `fiona.tanaka@apexsolutions.com` | `Test@1234!` | Human Resources | Public |
| `george.mbeki@apexsolutions.com` | `Test@1234!` | Finance | Secret |
| `hannah.vogel@apexsolutions.com` | `Test@1234!` | Finance | Confidential |
| `ivan.petrov@apexsolutions.com` | `Test@1234!` | Finance | Public |
| `julia.santos@apexsolutions.com` | `Test@1234!` | Legal & Compliance | Secret |
| `kevin.park@apexsolutions.com` | `Test@1234!` | Legal & Compliance | Confidential |
| `laura.mensah@apexsolutions.com` | `Test@1234!` | Operations | Secret |
| `mike.ali@apexsolutions.com` | `Test@1234!` | Operations | Confidential |
| `nina.gruber@apexsolutions.com` | `Test@1234!` | Operations | Public |

---

## Step 2 — Obtain Department UUIDs

After seeding, retrieve the UUIDs (needed when uploading files):

```bash
# Log in as admin and call the departments endpoint
curl -s -X POST http://localhost:8002/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@apexsolutions.com","password":"Admin@1234!"}' \
  | python3 -m json.tool
# Copy the `access` token

curl -s http://localhost:8002/auth/admin/departments/ \
  -H "Authorization: Bearer <access_token>" \
  | python3 -m json.tool
```

Note down the UUID for each department — you will need it when uploading files.

---

## Step 3 — Upload Documents via the Frontend

Log in as the appropriate user and upload each file.  Set the `departmentAccess`
map so that:
- **Public** files: `{ "<dept_uuid>": 1 }` — anyone in the department can see them
- **Confidential** files: `{ "<dept_uuid>": 2 }` — only ranking ≥ 2
- **Secret** files: `{ "<dept_uuid>": 3 }` — only ranking 3 (Secret)

### Upload Map

| File | Upload As | departmentAccess ranking |
|------|-----------|--------------------------|
| `engineering/public/*.txt` | alice.chen | Engineering → 1 |
| `engineering/confidential/*.txt` | alice.chen | Engineering → 2 |
| `engineering/secret/*.txt` | alice.chen | Engineering → 3 |
| `human_resources/public/*.txt` | diana.osei | HR → 1 |
| `human_resources/confidential/*.txt` | diana.osei | HR → 2 |
| `human_resources/secret/*.txt` | diana.osei | HR → 3 |
| `finance/public/*.txt` | george.mbeki | Finance → 1 |
| `finance/confidential/*.txt` | george.mbeki | Finance → 2 |
| `finance/secret/*.txt` | george.mbeki | Finance → 3 |
| `legal/public/*.txt` | julia.santos | Legal → 1 |
| `legal/confidential/*.txt` | julia.santos | Legal → 2 |
| `legal/secret/*.txt` | julia.santos | Legal → 3 |
| `operations/public/*.txt` | laura.mensah | Operations → 1 |
| `operations/confidential/*.txt` | laura.mensah | Operations → 2 |
| `operations/secret/*.txt` | laura.mensah | Operations → 3 |

---

## Step 4 — Create Plans & Milestones (AI Planning Feature)

After uploading, create a Plan per department with milestones that the AI can
auto-complete when the matching document is ingested.

Log in as the department head, then POST to the RAG service:

```
POST http://localhost:8004/api/planning/plans/
Authorization: Bearer <alice_token>
```

### Engineering Plan

```json
{
  "title": "Q2 2025 Engineering Readiness",
  "description": "Track the key Q2 engineering goals for Apex Solutions.",
  "milestones": [
    {
      "title": "Finalise Q2 Architecture Design",
      "description": "The approved Q2 2025 architecture design document must be completed, covering pipeline parallelisation, Elasticsearch optimisation, and the management service split.",
      "due_date": "2025-06-30"
    },
    {
      "title": "Complete Platform Security Audit",
      "description": "An external security audit must be conducted and all HIGH severity findings must be remediated.",
      "due_date": "2025-05-31"
    },
    {
      "title": "Publish API Integration Specification",
      "description": "The internal REST and WebSocket API contracts between all microservices must be documented and approved.",
      "due_date": "2025-04-30"
    }
  ]
}
```

### Human Resources Plan

```json
{
  "title": "HR Compliance & Talent Q3 2025",
  "description": "Track HR department objectives for talent acquisition and policy compliance.",
  "milestones": [
    {
      "title": "Update Remote Work Policy",
      "description": "The remote work policy must be revised for 2025, covering hybrid model requirements, home office setup, and security rules.",
      "due_date": "2025-02-28"
    },
    {
      "title": "Publish Q3 Recruitment Pipeline",
      "description": "A recruitment pipeline document must be created covering all open requisitions, active candidates, and hiring targets for Q3 2025.",
      "due_date": "2025-04-30"
    },
    {
      "title": "Complete Compensation Band Review",
      "description": "FY 2025 salary bands for all departments must be approved by the Head of HR, CFO, and CEO.",
      "due_date": "2025-01-31"
    }
  ]
}
```

### Finance Plan

```json
{
  "title": "Finance Controls & Reporting FY 2025",
  "description": "Ensure financial controls, audit remediation, and reporting targets are met.",
  "milestones": [
    {
      "title": "Publish Q1 Financial Report",
      "description": "The Q1 2025 financial report must be produced including P&L, cash position, and variance analysis.",
      "due_date": "2025-04-15"
    },
    {
      "title": "Remediate Annual Audit Finding A-001",
      "description": "The external auditor finding A-001 (revenue recognition timing discrepancy of USD 240,000) must be remediated and the financial statements restated.",
      "due_date": "2025-03-31"
    },
    {
      "title": "Create Q2 Vendor Payment Schedule",
      "description": "A detailed schedule of all vendor payments for Q2 2025 must be produced and approved by Finance.",
      "due_date": "2025-04-01"
    }
  ]
}
```

### Legal & Compliance Plan

```json
{
  "title": "Legal & Compliance Programme 2025",
  "description": "Track Legal department compliance, NDA management, and litigation matters.",
  "milestones": [
    {
      "title": "Update Standard NDA Template",
      "description": "The mutual NDA template must be revised to version 3.2 with updated governing law and arbitration clauses.",
      "due_date": "2025-01-31"
    },
    {
      "title": "Complete Q2 Regulatory Compliance Checklist",
      "description": "All GDPR, CCPA, and Kenya DPA compliance items must be reviewed and status updated for Q2 2025.",
      "due_date": "2025-06-30"
    },
    {
      "title": "Complete Litigation Risk Assessment",
      "description": "A quarterly litigation risk assessment must be produced covering all active legal matters, risk levels, and financial provisions.",
      "due_date": "2025-04-30"
    }
  ]
}
```

### Operations Plan

```json
{
  "title": "Operations & Facilities Q2 2025",
  "description": "Ensure operational continuity, supplier management, and BCP readiness.",
  "milestones": [
    {
      "title": "Approve Business Continuity Plan",
      "description": "The 2025 Business Continuity Plan must be completed, approved by the CEO, and contain emergency contacts, IT recovery procedures, and a testing schedule.",
      "due_date": "2025-03-15"
    },
    {
      "title": "Complete Q2 Warehouse Capacity Assessment",
      "description": "A warehouse capacity report must be produced for Q2 2025, identifying available storage space and Q3 procurement requirements.",
      "due_date": "2025-04-15"
    },
    {
      "title": "Review All Logistics Partner Contracts",
      "description": "All active facilities and logistics contracts must be reviewed, performance assessed, and upcoming renewals flagged.",
      "due_date": "2025-04-01"
    }
  ]
}
```

---

## Step 5 — Test MAC Access Control

Verify that department isolation works correctly:

| Action | User | Expected Result |
|--------|------|-----------------|
| Query RAG about compensation bands | `carol.smith` (Eng/Public) | No results (Secret HR doc) |
| Query RAG about compensation bands | `diana.osei` (HR/Secret) | Returns salary band info |
| Query RAG about security audit | `bob.kumar` (Eng/Conf) | No results (Secret Eng doc) |
| Query RAG about security audit | `alice.chen` (Eng/Secret) | Returns audit findings |
| Query RAG about tech stack | `carol.smith` (Eng/Public) | Returns tech stack overview ✓ |
| Query RAG about litigation | `kevin.park` (Legal/Conf) | No results (Secret Legal doc) |
| Query RAG about litigation | `julia.santos` (Legal/Secret) | Returns litigation assessment |

---

## Step 6 — Test Additional Features

### File Versioning
Re-upload any document (e.g. `engineering_onboarding_guide.txt`) with
updated content. The Drive will create version 2 visible under
`GET /drive/items/<id>/versions/`.

### Trash & Restore
In the Drive UI, delete any file → verify it moves to Trash.
Use "Restore" to bring it back.

### Admin Audit Log
After making any admin change (e.g. assigning a user to a department),
check the audit log:
```
GET http://localhost:8002/auth/admin/audit-logs/
Authorization: Bearer <admin_token>
```

### Notifications
Once a milestone is auto-completed by the AI (after ingesting the matching
document), check planning notifications:
```
GET http://localhost:8004/api/planning/notifications/
Authorization: Bearer <dept_head_token>
```

### RAG Chat Sessions
Start a new chat session with any user:
```
POST http://localhost:8004/api/chat/sessions/
{ "title": "Q1 Finance Questions" }
```
Then ask: *"What was the EBITDA margin in Q1 2025?"*  
Expected: The RAG retrieves the Q1 Financial Report and cites it.

---

## Quick Reference — Test Scenarios

| Scenario | Users Involved | Documents |
|---------|----------------|-----------|
| New employee onboarding | carol.smith | engineering_onboarding_guide.txt |
| Budget inquiry | ivan.petrov | budget_overview_fy2025.txt |
| Contract review | kevin.park | nda_template.txt |
| Security incident response | alice.chen | platform_security_audit_2025.txt |
| Salary band query | diana.osei | compensation_bands_2025.txt |
| BCP activation | laura.mensah | business_continuity_plan.txt |
| Cross-dept search (expect 403) | carol.smith querying HR docs | compensation_bands_2025.txt |
