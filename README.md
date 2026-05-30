# OKnowledge-Management (OKM) Platform

## Overview
OKnowledge-Management (OKM) is a robust, microservices-based enterprise document management and Retrieval-Augmented Generation (RAG) system. Designed to handle large volumes of documents, OKM automatically ingests, processes, embeds, and indexes your files to make them instantly searchable and accessible to generative AI models.

**Technologies Used:**
*   Python and Django (Backend Microservices)
*   Next.js, HTML5, SCSS, and TypeScript (Frontend)
*   Celery & Redis (Asynchronous Workers & Message Broker)
*   Elasticsearch (Vector Database & Search)
*   PostgreSQL (Relational Database)
*   MinIO (Object Storage)
*   Docker & Docker Compose (Containerization & Orchestration)

## 📋 Table of Contents
- [Overview](#overview)
- [Installation Guide](#installation-guide)
  - [Prerequisites](#prerequisites)
  - [Method 1: Docker Compose (Full Stack)](#method-1-docker-compose-full-stack)
  - [Method 2: Local Development (Manual Installation)](#method-2-local-development-manual-installation)
- [System Architecture](#system-architecture)
- [Development Commands](#development-commands)
- [Configuration Options](#configuration-options)
- [Key Features](#key-features)
- [Contributing](#contributing)

## Quick Links
*   [GitHub Repository](#)
*   [API Documentation](#)
*   [Issue Tracker](#)

## Installation Guide

### Prerequisites
*   [Git](https://git-scm.com/downloads)
*   [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
*   Google Gemini API Key (Required for embeddings and RAG inference)

### Method 1: Docker Compose (Full Stack)
This is the recommended approach to set up the entire OKM platform (Frontend, Backend Microservices, and Infrastructure):

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
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

## Configuration Options

### Environment Variables
These variables can be set in your `.env` file or exported to your shell before running Docker Compose:

| Variable | Description | Example |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Required API key for Google Gemini (`text-embedding-004`). | `AIzaSy...` |
| `CELERY_BROKER_URL` | Redis broker URL for Celery workers. | `redis://redis:6379/0` |
| `CELERY_RESULT_BACKEND` | Redis backend URL for Celery workers. | `redis://redis:6379/0` |

*(Additional database and MinIO credentials should be configured in their respective `.env` files per service).*

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
