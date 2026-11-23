# 🚀 ReachInbox Full-Stack Email Job Scheduler

Production-grade, distributed cold email job scheduler service and dashboard built for the **ReachInbox (Outbox Labs)** engineering hiring assignment.

---

## 📌 Architecture Overview

```
               ┌────────────────────────────────────────────────────────┐
               │         Frontend Dashboard (Next.js 14 + Tailwind)     │
               └───────────────▲────────────────────────▲───────────────┘
                               │ HTTP / REST            │
               ┌───────────────▼────────────────────────▼───────────────┐
               │            Express.js + TypeScript Backend             │
               │  - Schedule API, Lead Parser, Auth & Bull-Board UI     │
               └───────────────┬────────────────────────┬───────────────┘
                               │                        │
             ┌─────────────────▼────────┐      ┌────────▼───────────────┐
             │   PostgreSQL (Prisma)    │      │  Redis 7 (Sliding-Win) │
             │  - Batches, Jobs, Senders│      │  - Hourly Limit Keys   │
             │  - Persistence on reboot │      │  - BullMQ Queue & State│
             └──────────────────────────┘      └────────┬───────────────┘
                                                        │
                                               ┌────────▼───────────────┐
                                               │   BullMQ Worker Pool   │
                                               │ - Concurrency Limiter  │
                                               │ - Delayed Email Sends  │
                                               └────────┬───────────────┘
                                                        │
                      ┌─────────────────────────────────┼──────────────────────────────┐
                      │                                 │                              │
             ┌────────▼──────────┐            ┌─────────▼─────────┐          ┌─────────▼─────────┐
             │   Ethereal SMTP   │            │   Elasticsearch   │          │  Slack Alert API  │
             │ - Multi-sender test│            │ - Full-text search│          │ - Real-time alerts│
             │ - Preview web links│            │ - Immediate sync  │          │   on rate limits  │
             └───────────────────┘            └───────────────────┘          └───────────────────┘
```

---

## ✨ Features Implemented

### 🖥 Backend
- **BullMQ + Redis Job Queue**: No cron jobs. Jobs are scheduled as persistent BullMQ delayed jobs with guaranteed idempotency via unique IDs (`email-<uuid>`).
- **Persistence Across Restarts**: Future jobs remain in Redis. Additionally, on server startup `recoverScheduledJobsOnStartup()` checks the database to re-enqueue any pending or rate-limited jobs.
- **Worker Concurrency**: Worker concurrency level is fully configurable (`WORKER_CONCURRENCY=5`).
- **Minimum Delay Throttling**: Configurable delay between individual sends (`DELAY_BETWEEN_EMAILS_MS=2000`) to prevent ESP throttling.
- **Hourly Rate Limiting per Sender**: Atomic Redis sliding window counter per sender window (`ratelimit:sender:<id>:<YYYYMMDDHH>`). When the hourly limit is hit, jobs are rescheduled into the next available hour window without data loss.
- **Live Slack Alerting**: Sends an instant alert to the configured Slack webhook/channel when a sender's rate limit is hit (includes sender email, limit count, and next window time).
- **Elasticsearch Search Indexing**: Emails are indexed in Elasticsearch upon scheduling and status change, supporting full-text fuzzy search across recipients, subjects, and bodies with database fallback.
- **Real-Time Bull-Board Dashboard**: Live queue monitoring UI available at `http://localhost:5000/admin/queues`.
- **Multiple Senders**: Support for multiple sender accounts via Ethereal SMTP with auto-generated test credentials.

### 🎨 Frontend Dashboard
- **Google OAuth Login**: User info, avatar, and logout option.
- **Scheduled Emails Table**: Real-time list with recipient, subject, sender, scheduled time, and status badges.
- **Sent Emails Table**: Sent time, status, and direct preview links to Ethereal Email web inspection.
- **Compose & Schedule Modal**:
  - Drag-and-drop or file upload for CSV/TXT leads with instant email parsing and count badge.
  - Controls for Start Time, Delay between emails, and Hourly limit per sender.
- **Connect Slack Modal**: Real-time connection and disconnection for Slack notifications.
- **Elasticsearch Search Bar**: Instant search across all email fields.

---

## 🛠 Tech Stack

- **Backend**: Node.js, TypeScript, Express.js, Prisma ORM, PostgreSQL, BullMQ, Redis (ioredis), `@elastic/elasticsearch`, Nodemailer (Ethereal), `@bull-board/express`
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, date-fns
- **Infra**: Docker Compose (Redis & Elasticsearch)

---

## 🚀 Setup & Running Instructions

### 1. Prerequisites
- Node.js (v18+) & npm
- PostgreSQL running locally or in Docker
- Docker & Docker Compose (for Redis and Elasticsearch)

### 2. Start Redis & Elasticsearch
```bash
docker compose up -d
```
This runs:
- Redis on `localhost:6379`
- Elasticsearch on `localhost:9200`

### 3. Setup and Start Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env to set your DATABASE_URL if needed

# Run Prisma migrations & seed demo sender accounts
npx prisma db push
npm run seed

# Start backend dev server
npm run dev
```
Backend runs at `http://localhost:5000`.
Bull-Board queue dashboard: `http://localhost:5000/admin/queues`.

### 4. Setup and Start Frontend
```bash
cd ../frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🧪 Rate Limiting & Concurrency Trade-Offs

- **Atomic Redis Counters**: Using Redis `INCR` with a TTL ensures multi-worker thread safety without database locks.
- **Order Preservation Under Load**: When 1000+ emails are scheduled simultaneously, jobs exceeding the hourly limit receive a calculated delay pointing to the top of the next hour window (`resetAt`), ensuring no jobs are dropped or permanently failed.

---

## 👥 Reviewers Access
Repository access granted to:
- `Mitrajit`
- `Yadav036`
