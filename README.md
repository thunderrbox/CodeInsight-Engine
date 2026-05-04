# CodeInsight Engine

A Docker-based sandboxed code execution engine with an asynchronous submission pipeline powered by Redis + BullMQ. Supports multi-language code runs with secure isolation, real-time feedback on code quality, complexity, and performance.

---

## Features

- **Multi-language support**: Python, JavaScript, TypeScript, Java, C++, Go
- **Secure Docker sandboxing**: Network disabled, read-only root filesystem, memory & CPU limits, no new privileges
- **Async job pipeline**: BullMQ + Redis queue with retries, progress tracking, and configurable concurrency
- **Code analysis**: Cyclomatic complexity, comment ratio, quality score, performance score, and actionable suggestions
- **REST API**: Submit jobs and poll for results
- **Horizontal scalability**: Run multiple worker instances independently

---

## Architecture

```
Client ──► POST /api/submissions
              │
              ▼
        Express API Server
              │  enqueue job
              ▼
     BullMQ Queue (Redis)
              │  dequeue
              ▼
       BullMQ Worker(s)
              │  execute
              ▼
    Docker Executor (dockerode)
              │  analyse
              ▼
     Code Analyser (complexity,
      quality, performance)
              │  store result
              ▼
     GET /api/submissions/:id
```

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- [Node.js](https://nodejs.org/) v20+

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env as needed
```

### 2. Start with Docker Compose

```bash
docker compose up --build
```

This starts three services: `redis`, `api` (port 3000), and `worker`.

### 3. Start locally (development)

```bash
npm install
# In one terminal – start the combined API + worker
npm run dev

# Or run them separately:
npm run dev       # API server
npm run worker    # Worker process
```

---

## API Reference

### Submit Code

```
POST /api/submissions
Content-Type: application/json

{
  "language": "python",   // python | javascript | typescript | java | cpp | go
  "code": "print('Hello, World!')",
  "stdin": ""             // optional
}
```

**Response** `202 Accepted`
```json
{
  "jobId": "uuid",
  "status": "waiting",
  "message": "Job enqueued successfully"
}
```

### Get Job Status / Result

```
GET /api/submissions/:jobId
```

**Response** (completed)
```json
{
  "jobId": "uuid",
  "status": "completed",
  "submission": { "language": "python", "code": "...", "submittedAt": "..." },
  "execution": {
    "stdout": "Hello, World!\n",
    "stderr": "",
    "exitCode": 0,
    "executionTimeMs": 312,
    "timedOut": false
  },
  "analysis": {
    "complexity": {
      "linesOfCode": 1,
      "commentLines": 0,
      "blankLines": 0,
      "commentRatio": 0,
      "cyclomaticComplexity": 1
    },
    "qualityScore": 100,
    "performanceScore": 100,
    "suggestions": ["No major issues detected. Code looks good!"]
  },
  "completedAt": "2024-01-01T00:00:00.000Z"
}
```

### Health Check

```
GET /health
```

---

## Configuration

All settings are controlled via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | _(empty)_ | Redis password |
| `EXECUTION_TIMEOUT_MS` | `10000` | Max execution time per job (ms) |
| `MEMORY_LIMIT_MB` | `128` | Container memory limit |
| `CPU_QUOTA` | `50000` | Docker CPU quota (µs per 100ms period) |
| `CONCURRENCY` | `5` | Worker concurrency |
| `JOB_ATTEMPTS` | `3` | Max retry attempts per job |

---

## Security

Each code submission runs in an isolated Docker container with:
- **Networking disabled** – no internet access
- **Read-only root filesystem** – ephemeral `/tmp` tmpfs only
- **Memory & swap cap** – configurable via `MEMORY_LIMIT_MB`
- **CPU quota** – prevents CPU exhaustion
- **`no-new-privileges`** security option
- **Automatic cleanup** – containers are removed after execution

---

## Development

```bash
npm test              # Run all tests
npm run test:coverage # Coverage report
npm run build         # Compile TypeScript
```

