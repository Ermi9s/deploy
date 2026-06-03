---
marp: true
theme: gaia
_class: lead
paginate: true
backgroundColor: #0f172a
color: #f1f5f9
style: |
  section {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    padding: 40px;
  }
  h1 {
    color: #ffffff;
  }
  h2 {
    color: #60a5fa;
  }
  footer {
    font-size: 0.5em;
    color: #64748b;
  }
  code {
    background: #1e293b;
    color: #fbbf24;
  }
---

# OKM — AI Office Knowledge Hub
## Final Year Project Pitch

A Secure, Automated Platform to Eliminate Information Silos and Meeting Overhead

---

## The Real-Life Problem
### Think about the last week at your organization...

* **Unnecessary Status Meetings:** Hours spent in recurring update sessions that could easily have been automated emails.
* **Manual Report Review Bottlenecks:** Managers spending hours reviewing documents to verify if milestones were hit.
* **Time Wasted Searching:** Employees spending an average of 2.5 hours per day searching for scattered documents.
* **Onboarding Knowledge Drain:** Senior staff repeating details to new team members because nothing is cataloged.

---

## Problem Statement
### Why existing solutions fail

* **Knowledge Invisibility:** Critical institutional details remain siloed in email chains, local drives, or personal memory.
* **Weak Document Accessibility:** Standard search engines fail when users do not know the exact file name or keywords.
* **No Automatic Compliance:** Access control is either completely open (insecure) or entirely locked down (unproductive).
* **Reactive Management:** No automated sweeps to proactively warn stakeholders about approaching milestones.

---

## Proposed Solution: OKM
### Two core pipelines connecting users to secure knowledge

* **Automated Ingestion Pipeline:** Automatically processes, extracts text (with OCR), chunks, and embeds files.
* **Mandatory Access Control (MAC):** Security filters are embedded into every database query to protect sensitive documents.
* **Intelligent Q&A Engine:** Plain-language retrieval (RAG) that answers questions using the organization's own files.
* **Self-Hosted Security:** Designed to run 100% on-premise so no company data ever leaves your servers.

---

## How It Works: Two Core Pipelines

![width:1100px](/home/ermias/.gemini/antigravity/brain/f2afee89-0399-448d-88de-90cd152082ff/okm_main_pipelines_1780510603186.png)

---

## Feature 1: Document Ingestion Pipeline
### Turning raw files into searchable vectors automatically

* **Text Extraction:** Direct text extraction for digital documents; automatic fallback to OCR for scanned images/PDFs.
* **Semantic Chunking:** Divides documents into overlapping text segments for precise search matches.
* **Vectorization:** Mathematical vectorization of chunks to capture contextual meaning, not just keywords.
* **Indexing:** High-performance indexing in Elasticsearch database with real-time status updates via WebSockets.

---

## Feature 2: Mandatory Access Control (MAC)
### Enforcing department & clearance-level boundaries

* **Role-Based Claims:** Department and clearance level properties are embedded in each user's authenticated token.
* **Enforced at Database Layer:** Filters are dynamically injected into every search query — not hidden on the client side.
* **Complete Isolation:** A Finance employee will never retrieve HR/Secret files, guaranteeing native data security.
* **Frictionless Admin:** Policies are applied centrally, keeping data accessible only to those authorized.

---

## MAC Enforcement Flow

![width:700px](/home/ermias/.gemini/antigravity/brain/f2afee89-0399-448d-88de-90cd152082ff/okm_mac_security_1780510640601.png)

---

## Feature 3: Intelligent Q&A (RAG)
### Conversing directly with your organizational knowledge base

* **Semantic Querying:** Users ask questions in plain language rather than searching for exact keywords.
* **Document Grounding:** The AI model only answers using the retrieved, secure document chunks (no hallucinations).
* **Source Citation:** Answers are delivered with clear references to the original source files for validation.
* **Session Persistence:** Saves chat sessions so employees can recall past conversations and queries easily.

---

## Feature 4: Planning & Automated Oversight
### Replacing status meetings with active notifications

* **Milestone Tracking:** Centralized project boards detailing goals, timelines, and status updates.
* **Automated Sweeper:** Background runner periodically sweeps relational records for upcoming or missed deadlines.
* **Real-Time Alerts:** Instantly alerts supervisors and responsible users of milestone updates via WebSockets.
* **On-Demand Status:** Eliminates the need to call status update meetings — the system provides the exact status instantly.

---

## System Architecture
### Microservices designed for on-premise stability

* **Decoupled Microservices:** Separate services for Ingestion, Core Management, Q&A (RAG), and Notifications.
* **Asynchronous Workers:** Long-running OCR and vectorization tasks are handled in the background by Celery & Redis.
* **Secure APIs:** Next.js frontend interfaces securely with Django services using JWT tokens.
* **Unified Storage:** Structured metadata in PostgreSQL, document vectors in Elasticsearch, files in MinIO storage.

---

## OKM Microservice Architecture

![width:650px](/home/ermias/.gemini/antigravity/brain/f2afee89-0399-448d-88de-90cd152082ff/okm_architecture_diagram_1780510679320.png)

---

## Technology Stack
### Why we selected these technologies

* **Next.js & TypeScript:** Used for its component-based architecture and robust type safety.
* **Django & Python:** Selected for rapid API development, strong ORM, and massive machine learning integration.
* **Elasticsearch:** A vector search engine supporting hybrid keyword and similarity searches.
* **PostgreSQL & MinIO:** ACID-compliant relational DB metadata alongside S3-compatible local file storage.
* **Celery, Redis & Docker:** Scalable background worker queue containerized for painless deployment.

---

## System Demonstration

### [ Live demonstration of document upload, real-time ingestion tracking, secure cross-department searches, and RAG Q&A retrieval ]

---

## Challenges Encountered & Solutions
### Demonstrating system engineering capabilities

* **Challenge:** Filtering vectors by department and clearance level inside the query layer.
  * *Solution:* Decoded JWT claims and injected them directly as mandatory Elasticsearch query-time filters.
* **Challenge:** Extracting text from legacy paper-scanned documents.
  * *Solution:* Built an automatic fallback path that routes empty-text PDFs to Tesseract OCR.
* **Challenge:** Tracking microservices startup failures.
  * *Solution:* Configured custom health check steps in Docker Compose to enforce database readiness before microservices launch.

---

## Results and Operational Impact
### Validating system effectiveness

* **Pipeline Automation:** Successfully processed, vectorized, and indexed various organizational files automatically.
* **Access Isolation:** Verified strict MAC boundaries using organizational test data (Apex Solutions Inc.) containing 5 departments and 3 clearance levels.
* **Grounded Retrieval:** Enabled direct question-answering with zero hallucinations, sourcing responses solely from authenticated search boundaries.
* **Proactive Oversight:** Automated milestone reviews via background sweep scripts, notifying responsible stakeholders of approaching deadlines.

---

## Future Improvements
### Scaling beyond the prototype

* **Mobile Companion App:** Enable remote employees to query corporate knowledge on the go.
* **Automated Summary Digests:** Periodic highlights of changes in operational documents to completely eliminate review sessions.
* **Kubernetes Scale:** Orchestrating containers across distributed nodes for large enterprise environments.
* **Advanced Analytics Dashboard:** Administrative insights into search trends, content gaps, and department activity.

---

## In Summary
### Key takeaways

1. **We identified a universal pain point:** Invisible corporate knowledge resulting in status meeting and manual report review overhead.
2. **We built a microservice-based solution:** OKM automatically processes, vectorizes, secures, and searches documents.
3. **The system is proven and secure:** Enforces access bounds directly at the query layer and provides automated oversight notifications.
