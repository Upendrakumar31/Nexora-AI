# Nexora AI

> Modern AI-Powered Content Creation, Image Manipulation, and Career Intelligence Suite.

Nexora AI is a production-grade full-stack platform built with **React 19**, **Express 5**, **Clerk Authentication**, **Neon Serverless PostgreSQL (pgvector)**, **Redis Cloud**, and multi-provider AI integrations (**Groq** and **Google Gemini**).

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────┐
│               Client (React 19 + Vite 7)               │
│    • Tailwind CSS v4       • Clerk React Auth Provider │
│    • Centralized Axios API • React Router v7           │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / JSON / Bearer JWT
┌──────────────────────────▼─────────────────────────────┐
│                 Server (Express 5 ESM)                 │
│  • Clerk Auth Middleware  • Origin-Restricted CORS     │
│  • Multer Secure Uploads  • Global Error Boundary      │
└────────────┬─────────────┬─────────────┬───────────────┘
             │             │             │
    ┌────────▼────────┐    │    ┌────────▼────────┐
    │  Neon Postgres  │    │    │   Redis Cloud   │
    │  • pgvector HNSW│    │    │  • Plan TTL 10m │
    │  • Resumes & RAG│    │    │  • Feed TTL 5m  │
    │  • Creations DB │    │    │  • Atomic Quota │
    └─────────────────┘    │    └─────────────────┘
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
┌─────▼──────┐       ┌─────▼──────┐       ┌─────▼──────┐
│  Groq LLM  │       │GoogleGemini│       │ Cloudinary │
│Articles &  │       │ 768d Vector│       │  & Clipdrop│
│Blog Titles │       │ Embeddings │       │ Inpainting │
└────────────┘       └────────────┘       └────────────┘
```

---

## ✨ Features

- **AI Article Writer**: Long-form article generator with selectable lengths and Markdown preview powered by Groq high-speed inference.
- **Blog Title Generator**: SEO-optimized title generator tailored across 8 industry categories.
- **AI Image Generation & Community Feed**: Text-to-image synthesis with style presets, Cloudinary storage, public showcase feed, and cached like interactions.
- **Background Removal**: Neural background removal with transparency checkerboard preview.
- **Object Removal**: Generative inpainting to remove unwanted items from photographs seamlessly.
- **Resume Reviewer & RAG Grounded Chat**:
  - Semantic resume parsing and structured Zod schema review.
  - Multi-chunk text embedding via Google Gemini (`gemini-embedding-001`, 768 dimensions).
  - Neon PostgreSQL vector storage with cosine similarity search (HNSW index).
  - Grounded contextual chat restricted strictly to resume career facts and suggestions.
- **Usage & Quota Management**: Clerk metadata synchronization with Redis Cloud caching to enforce usage boundaries (10 free generations) without stale-cache bypasses.

---

## 📋 Prerequisites

- **Node.js**: `v20.x` or higher (verified on `v24.12.0`)
- **Package Manager**: `npm` `v10.x` or higher
- **Accounts & Services**:
  - [Clerk](https://clerk.com) for authentication and user metadata
  - [Neon](https://neon.tech) serverless PostgreSQL with `pgvector` extension
  - [Redis Cloud](https://redis.io/try-free/) (optional; falls back gracefully if unconfigured)
  - [GroqCloud](https://console.groq.com) for LLM inference (`llama-3.3-70b-versatile` or `openai/gpt-oss-120b`)
  - [Google AI Studio](https://aistudio.google.com) for Gemini vector embeddings
  - [Cloudinary](https://cloudinary.com) for image hosting
  - [Clipdrop](https://clipdrop.co/apis) for background and object removal

---

## ⚙️ Environment Variables

### 1. Server Environment (`server/.env`)

Copy `server/.env.example` to `server/.env`:

```bash
cp server/.env.example server/.env
```

| Variable | Description | Example / Default |
|:---|:---|:---|
| `PORT` | Express server port | `3000` |
| `CLIENT_URL` | Allowed frontend origin for CORS | `http://localhost:5173` |
| `DATABASE_URL` | Neon PostgreSQL pooled connection string | `postgresql://user:pass@ep-xyz.neon.tech/dbname?sslmode=require` |
| `REDIS_URL` | Redis Cloud connection URL | `rediss://default:pass@host:port` |
| `CLERK_PUBLISHABLE_KEY` | Clerk Frontend API key | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk Backend Secret key | `sk_test_...` |
| `GROQ_API_KEY` | GroqCloud API key | `gsk_...` |
| `GROQ_MODEL` | Groq production model ID | `llama-3.3-70b-versatile` or `openai/gpt-oss-120b` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIzaSy...` |
| `RAG_MIN_SIMILARITY` | Cosine similarity threshold for RAG retrieval | `0.40` |
| `CLIPDROP_API_KEY` | Clipdrop API key | `...` |
| `CLOUDINARY_CLOUD_NAME`| Cloudinary cloud name | `...` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `...` |
| `CLOUDINARY_API_SECRET`| Cloudinary API secret | `...` |

### 2. Client Environment (`client/.env`)

Copy `client/.env.example` to `client/.env`:

```bash
cp client/.env.example client/.env
```

| Variable | Description | Default |
|:---|:---|:---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Publishable key matching server | `pk_test_...` |
| `VITE_BASE_URL` | Backend server URL | `http://localhost:3000` |

---

## 🗄️ Database Migrations

Nexora AI includes an automated, idempotent migration runner that tracks applied scripts in `schema_migrations`.

```bash
# Run migrations against your Neon PostgreSQL database
npm run migrate
```

Migrations included:
- `001_resume_rag_schema.sql`: Enables `vector` and `pgcrypto` extensions, sets up `resumes`, `resume_chunks` (768d vector with HNSW index), and `resume_chat_messages`.
- `002_creations_schema.sql`: Sets up `creations` with indexing on public status, timestamps, and user ID.

---

## 🚀 Local Development Setup

### 1. Install Dependencies

From the project root:

```bash
npm install
```

### 2. Run Database Migrations

Ensure `server/.env` contains your `DATABASE_URL`, then execute:

```bash
npm run migrate
```

### 3. Start Development Servers

Run backend and frontend concurrently:

```bash
# Terminal 1: Backend Server (runs on http://localhost:3000)
npm run dev:server

# Terminal 2: Frontend Client (runs on http://localhost:5173)
npm run dev:client
```

---

## 🧪 Testing & Verification

Nexora AI includes a comprehensive Node.js native test suite (`node --test`):

```bash
# Run all server test suites
npm test

# Run client production build
npm run build
```

### Test Coverage Highlights:
- **RAG & Vector Search**: Text chunking, 768-dimensional schema validation, dynamic similarity thresholds, scope-safety prompt grounding, and query sanitization.
- **Redis Cloud & Quota Safety**: Cache key isolation, 600s plan TTL, 300s feed TTL, feed cache invalidation on publication/likes, quota boundary enforcement (>=10 generations blocked), and offline client resilience.
- **Security & Upload Validation**: Multer image filter (10MB, JPEG/PNG/WebP), PDF resume filter (5MB), origin-restricted CORS with untrusted origin rejection, and global error handling.
- **API Routes & Authentication**: Unauthenticated route rejection (Clerk 401/302 guard), health check verification, and migration engine idempotency.

---

## 📦 Production Deployment

### Client (Vercel / Netlify / Cloudflare Pages)
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_CLERK_PUBLISHABLE_KEY`
  - `VITE_BASE_URL` (points to production backend URL)

### Server (Render / Railway / Fly.io / AWS)
- **Root Directory**: `server`
- **Start Command**: `npm start`
- **Build Command**: `npm run migrate` (runs before startup)
- **Environment Variables**:
  - All keys defined in `server/.env.example`
  - Ensure `CLIENT_URL` is set to the production frontend domain to enforce CORS security.

---

## 📄 License

ISC License. Copyright 2026 © Nexora AI.
