# OKM (OKnowledge-Management) System Overview

This document provides a high-level overview of the OKM-Codebase architecture, focusing on the ingestion pipeline, file structure, and microservices ecosystem.

## 1. How it Ingests Files
The file ingestion process is asynchronous and pipeline-driven:
1. **Upload Request**: A client sends a `multipart/form-data` request containing a document (PDF or image) to the `ingestion` service API (`UploadDocumentAPIView`).
2. **Initial Storage & Queueing**: The `ingestion` service saves the raw file to a shared disk volume, creates a tracking record in the database with a `QUEUED` status, and enqueues a background job via Redis.
3. **Worker Processing**: The Celery `workers` service picks up the background job. It performs the following steps:
   - **Text Extraction**: Extracts text using `PyMuPDF` (fitz) for PDFs. If the PDF text quality is low or the file is an image, it falls back to Optical Character Recognition (OCR) using `pytesseract`.
   - **Chunking**: The extracted text is divided into smaller chunks (e.g., 1200 characters with an overlap of 200).
   - **Embedding Generation**: It invokes the Google Gemini API (`text-embedding-004`) to generate vector embeddings for each text chunk.
   - **Indexing**: The chunks, along with their embeddings and metadata (filename, source type), are indexed into Elasticsearch.
4. **Status Tracking**: The client can poll the `ingestion` service to get real-time progress updates on the extraction, chunking, embedding, and indexing stages.

## 2. Where it Ingests It
- **Raw Files**: Initially saved to a shared local Docker volume named `shared_uploads` which is accessible by both the `ingestion` and `workers` containers.
- **Relational Metadata**: Information like document upload status, Celery task IDs, and file paths are stored in **PostgreSQL**.
- **Processed Text & Embeddings**: The final chunked text and their vector embeddings are stored in **Elasticsearch** (in the `documents_chunks` index) for fast retrieval during RAG operations.

## 3. File Structure
The project is structured as a monorepo containing several distinct microservices:
- `/frontend/`: A Next.js web application for the user interface.
- `/ingestion/`: A Django-based service dedicated to handling document uploads and status tracking.
- `/management/`: A Django-based service handling core system management and administrative API operations.
- `/notification/`: A Django-based service for managing and delivering system notifications.
- `/rag/`: A Django-based service for Retrieval-Augmented Generation, responsible for querying the vector database and answering user questions.
- `/workers/`: A Celery-based Python application that executes the heavy background tasks (OCR, chunking, embedding, indexing).
- `docker-compose.yml`: The orchestration file defining how all application and infrastructure containers run and interact.

## 4. Existing Services
The application is composed of several Dockerized microservices and infrastructural components:

### Application Services
- **`frontend`** (Port 3000): The user-facing web portal.
- **`ingestion`** (Port 8001): API service for uploading documents and managing ingestion jobs.
- **`management`** (Port 8002): API service for primary business logic and system management.
- **`notification`** (Port 8003): API service for handling alerts and user notifications.
- **`rag`** (Port 8004): API service that provides the generative AI and search capabilities.
- **`workers`**: Background processes that handle the intensive file ingestion pipeline.

### Infrastructure & Data Stores
- **`postgres`**: The primary relational database for the Django microservices.
- **`redis`**: The message broker used by Celery for task queues, and potentially used as a cache.
- **`minio`**: An S3-compatible object storage service (utilized by the management service for long-term or structured file storage).
- **`elasticsearch`**: The vector database and search engine used to store and query document chunk embeddings.
