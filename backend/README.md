# Sportivo Backend API (FastAPI + PostgreSQL + Redis + Docker)

High-performance asynchronous backend powering the **Sportivo** mobile app (React Native / Expo) and web platform.

## Architecture & Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Mobile App** | React Native, Expo, TypeScript | Native iOS & Android application |
| **API Framework** | Python 3.12, FastAPI, Pydantic v2 | High-throughput async REST endpoints & OpenAPI / Swagger |
| **Relational Database** | PostgreSQL 16, SQLAlchemy 2.0 (Asyncpg) | Fixtures, tournament matches, standings, and push subscriptions |
| **In-Memory Cache** | Redis 7 | 3s live match telemetry caching, stream probe cache, rate-limiting |
| **Containerization** | Docker, Docker Compose | Multi-container microservices with health checks & volume persistence |
| **CI / CD** | GitHub Actions | Automated tests, linting, Docker image verification, native APK builds |

---

## Quickstart with Docker Compose

Run the entire backend stack (FastAPI + PostgreSQL + Redis) in one command:

```bash
docker compose up --build
```

Services will start:
* **FastAPI API**: `http://localhost:8000`
* **Interactive Swagger Docs**: `http://localhost:8000/docs`
* **Health Check**: `http://localhost:8000/health`
* **PostgreSQL 16**: `localhost:5432` (`sportivo_db`)
* **Redis 7**: `localhost:6379`

To stop:
```bash
docker compose down
```

---

## API Endpoints

### 1. Health & Diagnostics
* `GET /health`: Probes FastAPI, PostgreSQL, and Redis connectivity.

### 2. Nepal Premier League (NPL 2026)
* `GET /api/npl/live-moments/`: Real-time Crex/ground scorer ball-by-ball moments, batsman/bowler figures, CRR/RRR. Cached in Redis (3s TTL).
* `GET /api/npl/fixtures/`: Official tournament schedule in Nepal Standard Time (NST).
* `GET /api/npl/standings/`: Live points table with ranks, NRR, points, and team crests.

### 3. Multi-Server Broadcast Streaming
* `GET /api/stream/all/`: Probes active upstream broadcast streams and ranks them by latency.
* `GET /api/stream/{source}/{match_id}/`: Resolves stream feeds with multi-device **Server 1 HD** priority.

### 4. General Matches
* `GET /api/matches/{category}/`: Matches for `football`, `cricket`, and `basketball`.

### 5. Notifications
* `POST /api/push/subscribe`: Subscribes Android / iOS / Web push tokens in PostgreSQL.

---

## Connecting the React Native / Expo Mobile App

In `mobile/`, the app connects to the API via `EXPO_PUBLIC_API_URL`:

```bash
# Android Emulator (points to host machine Docker backend)
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api

# Physical Device on same Wi-Fi
EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:8000/api

# Production
EXPO_PUBLIC_API_URL=https://sportivo.dipeshsapkota7.com.np/api
```
