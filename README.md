# DocuMind AI Backend 

A production-ready backend service implementing a Retrieval-Augmented Generation (RAG) pipeline that reads PDF documents (URL or upload), indexes/extracts the content, and answers user questions using Google Gemini.

## Overview

DocuMind AI Backend accepts one or more PDF documents (URL or uploaded file), extracts and preprocesses text, optionally creates lightweight retrieval vectors, and uses Google Gemini to generate concise, accurate answers to user-supplied questions. It is intended as a focused microservice that can be integrated into larger apps (chatbots, knowledge assistants, legal/insurance document processors).

## Features

* Accepts PDF **URLs** or **file uploads** (multipart/form-data)
* Strict request validation (input shape, question limits)
* Simple Bearer-token authentication for service access
* Gemini (Generative AI) integration for answer generation
* Health check and basic observability
* Graceful error handling and structured responses

## Architecture & Flow

1. **Request** (URL or upload) arrives at endpoint.
2. **Auth middleware** validates Bearer token.
3. **Validation** middleware checks payload schema (max 10 questions, valid URL or file).
4. **PDF service** downloads/parses PDF pages and extracts text in a deterministic order.
5. **RAG service** (optional): chunking, lightweight vectorization (in-memory or to a vector DB like Pinecone), retrieval of most relevant chunks for each question.
6. **Gemini service** submits a prompt combining the retrieved context + question and returns a short, source-cited answer.
7. **Response** is normalized to `{ answers: string[] }`.

## Configuration (.env)

Create a `.env` (or use your environment management):

```
PORT=8000
NODE_ENV=development
AUTH_BEARER_TOKEN=replace_with_token
GEMINI_API_KEY=replace_with_key
# Optional
VECTOR_DB_URL= (if using Pinecone/Weaviate)
MAX_QUESTIONS=10
UPLOAD_TMP_DIR=./uploads
```

## API Endpoints (examples)

### POST /api/v1/hackrx/run

Process a PDF from a public URL.
**Headers:** `Authorization: Bearer <TOKEN>` `Content-Type: application/json`
**Body:**

```json
{
  "documents": "https://example.com/file.pdf",
  "questions": ["What is the main purpose of the document?", "What is the policy limit?"]
}
```

**Response:**

```json
{ "answers": ["Answer to Q1", "Answer to Q2"] }
```

## Testing & Validation

* Unit tests for: PDF extraction, chunker, retriever, request validation.
* Integration test: mock Gemini responses and verify final JSON contract.
* End-to-end test: run server against a known PDF and assert answers contain expected keywords.

## Logging & Monitoring

* Use structured logs (JSON) via `winston` or similar.
* Track request ID, latency, input size, and Gemini token usage per request.
* Expose metrics for Prometheus (request count, errors, avg latency).

## Minimal Project Structure

```
backend/
├─ server.js                    # app bootstrap
├─ package.json
├─ routes/
│  └─ hackrx.js                 # route handlers
├─ controllers/
│  └─ hackrxController.js       # validation -> service calls
├─ services/
│  ├─ pdfService.js             # download + extract text
│  ├─ ragService.js             # chunk + retrieve
│  └─ geminiService.js          # calls to Gemini API
├─ middleware/
│  ├─ auth.js
│  ├─ validator.js
│  └─ errorHandler.js
├─ utils/
│  ├─ logger.js
│  └─ promptBuilder.js
└─ uploads/                      # temp storage
```

---
