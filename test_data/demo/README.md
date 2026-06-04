# OKM Plan Feature Test Guide — Apex Solutions Inc.

## Purpose

Use this file as a copy-paste reference to create a fictional plan and the fictional documents that should trigger its milestones after ingestion.

## Plan API Parameters

Create the plan with:

`POST http://localhost:8004/api/planning/plans/`

Example body:

```json
{
  "title": "Apex Solutions 2025 Demo Plan",
  "description": "Fictional plan used to test milestone auto-completion and notifications.",
  "milestones": [
    {
      "title": "Approve the Engineering Architecture Pack",
      "description": "Approve the Engineering Architecture Pack",
      "due_date": "2025-06-30"
    },
    {
      "title": "Confirm HR Policy and Hiring Pack",
      "description": "The HR pack must mention the employee handbook, remote work policy, and the Q3 recruitment pipeline.",
      "due_date": "2025-06-30"
    },
    {
      "title": "Close Finance Reporting Pack",
      "description": "The finance pack must mention the Q1 financial report, vendor payment schedule, and annual audit findings.",
      "due_date": "2025-06-30"
    },
    {
      "title": "Validate Legal Compliance Pack",
      "description": "The legal pack must mention the NDA template, compliance checklist, and litigation risk assessment.",
      "due_date": "2025-06-30"
    },
    {
      "title": "Approve Operations Continuity Pack",
      "description": "The operations pack must mention facility safety guidelines, warehouse capacity, logistics contracts, and business continuity planning.",
      "due_date": "2025-06-30"
    }
  ]
}
```

## Fictional Trigger Documents

Upload the following fictional documents after creating the plan. They are written to match the milestone descriptions closely enough to trigger completion during ingestion.

### 1. engineering_demo_pack.txt

```text
Apex Solutions 2025 Engineering Demo Pack

This engineering pack confirms the Q2 architecture design, the API integration specification, and the platform security review.
The architecture design includes service boundaries, query flow, and indexing changes.
The API integration section covers REST endpoints, WebSocket notifications, and document ingestion status.
The security review section confirms that the platform security audit was completed and no critical issues remain.
```

### 2. hr_demo_pack.txt

```text
Apex Solutions 2025 HR Demo Pack

This HR pack confirms the employee handbook, the remote work policy, and the Q3 recruitment pipeline.
The employee handbook covers onboarding, conduct expectations, and leave rules.
The remote work policy covers hybrid expectations, home office setup, and security requirements.
The recruitment pipeline lists open requisitions, candidate stages, and hiring targets for Q3.
```

### 3. finance_demo_pack.txt

```text
Apex Solutions 2025 Finance Demo Pack

This finance pack confirms the Q1 financial report, the vendor payment schedule, and the annual audit findings.
The Q1 financial report includes revenue, expenses, cash position, and variance analysis.
The vendor payment schedule lists payment dates, approval routing, and outstanding obligations.
The audit findings summary states that the annual audit issues have been reviewed and remediated.
```

### 4. legal_demo_pack.txt

```text
Apex Solutions 2025 Legal Demo Pack

This legal pack confirms the NDA template, the compliance checklist, and the litigation risk assessment.
The NDA template includes confidentiality, governing law, and arbitration clauses.
The compliance checklist covers GDPR, CCPA, and Kenya DPA obligations.
The litigation risk assessment summarizes active matters, risk levels, and financial provisions.
```

### 5. operations_demo_pack.txt

```text
Apex Solutions 2025 Operations Demo Pack

This operations pack confirms the facility safety guidelines, the warehouse capacity report, the logistics contract summary, and the business continuity plan.
The safety guidelines cover emergency exits, equipment handling, and incident reporting.
The warehouse capacity section details available storage, utilization, and planned expansion.
The logistics contract summary covers service levels, renewal dates, and vendor performance.
The business continuity plan includes emergency contacts, IT recovery, and testing procedures.
```

## Expected Milestone Matches

Use these pairings when testing the planning feature:

* Engineering milestone should match the engineering demo pack
* HR milestone should match the HR demo pack
* Finance milestone should match the finance demo pack
* Legal milestone should match the legal demo pack
* Operations milestone should match the operations demo pack

## Suggested Verification Steps

1. Create the plan with the JSON body above.
2. Add the five milestones if you prefer to create them separately.
3. Upload the five fictional documents.
4. Confirm the matching milestone changes to auto-completed.
5. Check notifications at `GET http://localhost:8004/api/planning/notifications/`.

## Test Report Title

**Apex Solutions 2025 Plan Feature Validation Report**

## Test Report Agenda

1. Plan creation parameters used
2. Milestones created for the fictional plan
3. Fictional documents uploaded
4. Auto-completion results
5. Notification results
6. Final issues and follow-up actions
