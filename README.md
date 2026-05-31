# AI Office Knowledge Hub Platform

## Overview
AI Office Knowledge Hub is a robust, microservices-based enterprise document management and Retrieval-Augmented Generation (RAG) system. Designed to handle large volumes of documents, OKM automatically ingests, processes, embeds, and indexes your files to make them instantly searchable and accessible to generative AI models.

**Technologies Used:**
*   Python and Django (Backend Microservices)
*   Next.js, HTML5, SCSS, and TypeScript (Frontend)
*   Celery & Redis (Asynchronous Workers & Message Broker)
*   Elasticsearch (Vector Database & Search)
*   PostgreSQL (Relational Database)
*   MinIO (Object Storage)
*   Docker & Docker Compose (Containerization & Orchestration)

## Installation Guide

### Prerequisites
*   [Git](https://git-scm.com/downloads)
*   [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
*   Google Gemini API Key (Required for embeddings and RAG inference)

### Method 1: Docker Compose (Full Stack)
This is the recommended approach to set up the entire OKM platform (Frontend, Backend Microservices, and Infrastructure):

1. **Clone the repository:**
   ```bash
   git clone https://github.com/OKnowledge-Management/OKM-Codebase.git
   cd OKM-Codebase
   ```
2. **Set Environment Variables:**
   Export your Gemini API Key in your terminal:
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```
3. **Start Docker Compose:**
   ```bash
   docker compose up --build -d
   ```
4. **Run Database Migrations:**
   ```bash
   docker compose run --rm ingestion python manage.py migrate
   docker compose run --rm management python manage.py migrate
   # Repeat for notification and rag services
   ```
5. **Access the Application:**
   * Frontend: `http://localhost:3000`
   * Ingestion API: `http://localhost:8001`
   * Management API: `http://localhost:8002`

### Method 2: Local Development (Manual Installation)
To run individual services locally for debugging, use standard Django commands. Make sure you have local instances of Redis, PostgreSQL, and Elasticsearch running.

Example for the `notification` service:
```bash
cd notification
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py runserver 0.0.0.0:8000
```

## System Architecture

The OKM platform uses a loosely coupled microservices architecture:

*   **`frontend` (Port 3000):** Next.js web application for user interaction.
*   **`ingestion` (Port 8001):** API for document uploads and WebSocket progress tracking.
*   **`management` (Port 8002):** Core business logic, authentication (JWT), and Drive/File management.
*   **`notification` (Port 8003):** System alerts and user notifications.
*   **`rag` (Port 8004):** Queries the vector database and generates answers using LLMs.
*   **`workers`:** Celery application that executes heavy asynchronous tasks (OCR, chunking, embedding, indexing).

## Development Commands

**Docker Management:**
*   Start all services: `docker compose up --build`
*   Stop all services: `docker compose down`

**Django Operations (Inside Container):**
*   Create migrations: `docker compose run --rm <service_name> python manage.py makemigrations`
*   Apply migrations: `docker compose run --rm <service_name> python manage.py migrate`
*   Create superuser: `docker compose run --rm management python manage.py createsuperuser`
*   Seed database with initial test data (Departments, Clearance levels, and Users): `docker compose run --rm management python scripts/seed_test_data.py`

## Seeding Test Data & Sample Documents

OKM comes pre-packaged with sample organizational test data (for the fictitious company **Apex Solutions Inc.**) spanning 5 departments (Engineering, HR, Finance, Legal, Operations), with multiple clearance levels (Public, Confidential, Secret) and pre-configured test users.

1. **Seed the Relational Database (Departments, Levels, and Users):**
   ```bash
   docker compose run --rm management python scripts/seed_test_data.py
   ```
   *(This creates departments and user profiles like `alice.chen@apexsolutions.com` with secure password `Test@1234!`)*

2. **Ingest Departmental Sample Documents:**
   See the step-by-step ingestion guide in [test_data/seed_guide.md](file:///media/ermias/newvolume/others/SW/Projects/KMS/OKM-Codebase/test_data/seed_guide.md) to ingest the 25 target files categorized by department and clearance level to test mandatory access controls (MAC) and RAG capabilities.

## Configuration Options & Environment Variables

OKM uses a highly organized environment configuration system. Sensitive configurations and secrets are isolated in the **root `.env`** file. Non-sensitive settings specific to microservices are defined in their respective directories under local `.env` files (e.g., `management/.env`, `rag/.env`).

At the root level and inside each service, you will find a `.env.example` file that lists all variables with safe template values.

---

### 1. Global & Sensitive Variables (Root `.env` / `.env.example`)
These variables control global access, database credentials, third-party API keys, and system-wide security. **Never commit the `.env` file containing actual values to version control.**

| Variable | Description | Default / Example | Sourced By |
|----------|-------------|-------------------|------------|
| `POSTGRES_USER` | Relational database superuser. | `okm_user` | `postgres` (Server) |
| `POSTGRES_PASSWORD` | Secure password for relational database. | `okm_password` | `postgres` (Server) |
| `POSTGRES_DB` | Main database name. | `okm_db` | `postgres` (Server) |
| `DB_USER` | Client database username used by apps. | `okm_user` | All Django Services |
| `DB_PASSWORD` | Client database password used by apps. | `okm_password` | All Django Services |
| `MINIO_ROOT_USER` | Object Storage (MinIO) console and API admin username. | `okm_minio_user` | `minio`, `management` |
| `MINIO_ROOT_PASSWORD`| Object Storage (MinIO) console and API admin secret. | `okm_minio_secret`| `minio`, `management` |
| `GEMINI_API_KEY` | Google Gemini API Key for embeddings and RAG generation. | `AIzaSy...` | `rag`, `workers` |
| `GEMINI_EMBEDDING_MODEL`| Model used to generate document embeddings. | `gemini-embedding-001`| `rag`, `workers` |
| `SHARED_JWT_SECRET` | Secret key used to sign and verify user JWT authentication tokens. | `django-insecure-...` | `management`, `notification`, `rag` |
| `PLANNING_SERVICE_SECRET`| Shared authentication key for secure backend service communication. | `a_very_strong_random...`| `notification`, `rag`, `workers` |
| `MILESTONE_SWEEP_INTERVAL_HOURS` | Frequency in hours to check for upcoming or missed milestones. | `1` | `rag` |

---

### 2. Service-Specific & Non-Sensitive Variables (Service `.env` files)
These are service-level parameters (ports, broker routes, internal API topology endpoints) which do not contain security secrets.

#### Core Management Service (`management/.env`)
*   `DB_NAME`: Host/port connection configurations.
*   `MINIO_ENDPOINT`: Internal MinIO API endpoint inside docker network (`minio:9000`).
*   `MINIO_PUBLIC_ENDPOINT`: Public endpoint accessible by the web browser (`localhost:9000`).
*   `MAX_UPLOAD_SIZE_MB`: Limit for document uploads (`500`).

#### Ingestion Service (`ingestion/.env`)
*   `CELERY_BROKER_URL`: Connection string to the Redis broker (`redis://redis:6379/0`).
*   `UPLOAD_ROOT`: Local directory mount for temporary file processing (`/shared/uploads/`).

#### Notification Service (`notification/.env`)
*   `REDIS_URL`: Endpoint for Daphne real-time Channels backend.
*   `DAPHNE_PORT`: Daphne port for WebSockets and HTTP server (`8000`).

#### RAG Service (`rag/.env`)
*   `GEMINI_GENERATIVE_MODEL`: Generation model for reasoning / RAG chat answers (`gemini-2.5-flash`).
*   `ELASTICSEARCH_URL`: Vector database index server URL (`http://elasticsearch:9200`).
*   `ELASTICSEARCH_INDEX`: Vector store index name (`documents_chunks`).
*   `NOTIFICATION_EVENT_URL`: Internal notification API route.

#### Celery Workers Service (`workers/.env`)
*   `CELERY_QUEUES`: Task routing queues (`document_ingestion_jobs,report_generation_jobs,default`).
*   `RAG_INTERNAL_URL`: Internal route to contact the RAG query engine (`http://rag:8000`).

#### Web Frontend Services (`frontend/.env` & `admin-frontend/.env`)
*   `MANAGEMENT_API`: Proxy URL for user management services.
*   `INGESTION_API`: Proxy URL for uploading documents and WebSocket uploads status.
*   `NEXT_PUBLIC_PORTAL_URL`: Cross-origin target for frontend redirection.


## Key Features

### Document Ingestion Pipeline
*   **Automated Processing:** Seamlessly handles PDFs and images via `multipart/form-data` uploads.
*   **Smart Extraction:** Uses `PyMuPDF` for standard text and falls back to `pytesseract` (OCR) for low-quality documents or images.
*   **Chunking & Embedding:** Splits documents into manageable chunks and generates embeddings via Gemini.

### RAG & Search Integration
*   **High-Performance Search:** Uses Elasticsearch to index chunks for rapid similarity search.
*   **LLM Answers:** Generates contextual answers using retrieval-augmented generation.

### Real-Time Tracking
*   **WebSockets:** Track the real-time status of file processing (extraction, chunking, embedding) via `ws://localhost:8001/ws/uploads/{document_id}/`.

### Comprehensive Drive Management
*   Complete API for creating folders, renaming items, moving files, and managing the trash bin.

## Contributing
We welcome contributions! Please read our contribution guidelines before submitting pull requests. Ensure all tests pass and your code adheres to standard styling guidelines.
