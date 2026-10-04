# Embarko Production Deployment Guide for DukaanLens

DukaanLens is built to run natively within **Embarko's runtime contract**:
- **Single Process:** Node.js + Express backend serving static built React SPA assets.
- **Memory Optimization:** Designed strictly for Embarko's 256 MB memory ceiling.
- **Zero-Dependency Native Database:** Node.js 24 built-in `node:sqlite` (`DatabaseSync`), requiring zero C++ toolchains or native binary downloads.
- **Durable Storage:** All persistent state (database and uploaded files) is confined to `process.env.DATA_DIR`.
- **Dynamic Port Binding:** Binds strictly to `0.0.0.0` on `process.env.PORT`.
- **No Background Workers / Cron / WebSockets / Redis / Postgres:** Pure self-contained web architecture.

---

## 1. Environment Variables Configuration

Set these environment variables inside Embarko's application settings:

| Variable | Type | Recommended Value | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | `production` | Enables production optimizations and cookie security |
| `PORT` | Number | *(Auto-assigned by Embarko)* | Port to bind server (e.g. 8080) |
| `DATA_DIR` | String | `/data` | Path to Embarko's persistent mount volume |
| `SESSION_SECRET` | Secret | `<random-32-character-hex-string>` | Signs secure HTTP-only cookies |
| `GEMINI_API_KEY` | Secret | `<Google AI Studio API Key>` | Secure server-side key for Gemma 4 |
| `GEMMA_MODEL` | String | `gemma-4-26b-a4b-it` | Configurable model (`gemma-4-26b-a4b-it` or `gemma-4-31b-it`) |

> **IMPORTANT:**
> Never commit real secrets to Git or bundle them into build artifacts. Set secrets solely via Embarko's environment variables panel.

---

## 2. Directory Layout & Persistence Contract

DukaanLens creates and maintains the following file layout inside `DATA_DIR`:

```text
${DATA_DIR}/
├── dukaanlens.db          <-- SQLite database with automatic WAL mode & migrations
├── dukaanlens.db-wal      <-- SQLite Write-Ahead Log
├── dukaanlens.db-shm      <-- Shared memory index
└── uploads/               <-- Sanitized invoice & document image storage
    └── [random-sha256].jpg
```

---

## 3. Build & Start Lifecycle

Embarko automatically discovers Node.js applications with a root `package.json`.

1. **Build Step:**
   ```bash
   npm run build
   ```
   * Compiles the React client with Vite to `dist/client/`.
   * Compiles the TypeScript Express backend with `tsc` to `dist/server/`.

2. **Start Step:**
   ```bash
   npm run start
   ```
   * Executes `node dist/server/index.js`.
   * Ensures `DATA_DIR` and `DATA_DIR/uploads` exist.
   * Runs SQLite schema migrations automatically and idempotently.
   * Binds to `0.0.0.0:${PORT}` and serves API routes under `/api/*` and static SPA assets for all other routes.

---

## 4. Post-Deployment Verification & Health Check

After Embarko finishes deploying, verify the live service:

1. **HTTP Health Check:**
   ```bash
   GET https://your-app.embarko.app/health
   ```
   **Expected Response:**
   ```json
   {
     "status": "ok",
     "version": "1.0.0",
     "database": "ok",
     "ai": "configured",
     "model": "gemma-4-26b-a4b-it",
     "dataDir": "ok"
   }
   ```

2. **Login Smoke Test:**
   - Navigate to `https://your-app.embarko.app/login` in your mobile or desktop browser.
   - Enter your configured admin credentials.
   - Verify Dashboard metrics and low-stock cards load cleanly.

3. **Invoice Scan & Assistant Test:**
   - Scan or upload a test invoice.
   - Verify that items are extracted into **DRAFT** status and require human confirmation before stock changes.
   - Ask the Assistant a stock question (*"Kya mangwana hai?"*) to verify grounded responses.

---

## 5. Backup & Data Export Note

> **CRITICAL BACKUP ADVISORY:**
> While `DATA_DIR` persists across application container restarts, it is **not** an automated offsite backup system.
>
> **Recommended Practice:**
> Shop owners should periodically export business data from **Settings > Data Export**:
> - Download full SQLite database snapshot (`dukaanlens.db`).
> - Export CSV tables for Products, Inventory Ledger, Invoices, and Suppliers.

---

## 6. Troubleshooting

### High Memory Alert (> 200MB)
- DukaanLens uses zero in-memory caches, limits file upload sizes to 10MB, and avoids large dependencies. Ensure you are running Node 20+ with built-in `node:sqlite`.

### "AI features disabled / missing_api_key"
- Check that `GEMINI_API_KEY` is present in Embarko environment variables.
- Ensure the application was redeployed or restarted after setting the environment variable.

### Database Lock Errors
- DukaanLens automatically enables SQLite `WAL` mode and `busy_timeout = 5000` with atomic transaction wrappers (`runTransaction`). Single-process concurrency is safely managed.
