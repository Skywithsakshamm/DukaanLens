# DukaanLens 🔍📦
> **AI Inventory Assistant for Small Indian Businesses**

[![Node.js](https://img.shields.io/badge/Node.js-24+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Gemma 4](https://img.shields.io/badge/AI-Cloud%20Gemma%204-orange.svg)](https://aistudio.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

DukaanLens is a production-ready, mobile-first inventory and invoice assistant designed for small Indian retailers and distributors (kirana stores, electronics shops, electrical shops, mobile repair centers, hardware and stationery stores).

It eliminates repetitive manual ledger entries by turning photographed paper invoices into structured inventory records with **mandatory human-in-the-loop review**, multi-stage product matching, duplicate detection, and a conversational Hinglish/Hindi/English voice/text assistant.

---

## 🌟 Core Features

- 📸 **Mobile-First Invoice Scanner:** Upload or capture supplier invoices with instant client-side preview and safe server-side processing.
- 🧠 **Cloud Gemma 4 Powered Extraction:** Leverages official `@google/genai` SDK with strict Zod runtime schema validation. Configurable to `gemma-4-26b-a4b-it` (default) or `gemma-4-31b-it`.
- 🛡️ **Non-Negotiable Confirmation Gate:** AI extracts and proposes; **only human confirmation mutates stock**. Zero autonomous hallucinations to the business ledger.
- 🎯 **Multi-Stage Product Matching:** Automatically reconciles vendor variations (*e.g., "1K RES", "1000R", "RESISTOR 1K"*) against shop inventory with confidence ratings and alias learning.
- 🔍 **Duplicate Invoice Detection:** SHA-256 image hashing + multi-signal invoice metadata matching to prevent accidental double stock intake.
- 📊 **Immutable Inventory Ledger:** Full double-entry transaction trail (`PURCHASE`, `SALE`, `ADJUSTMENT`, `DAMAGE`, etc.) backed by atomic SQLite transactions.
- ⚡ **Deterministic Reorder Engine:** Numerical calculations computed strictly in application code (`currentStock <= minimumStock`), with priority classification (Critical vs Low Stock).
- 🎙️ **Conversational Assistant (Hinglish/Hindi/English):** Context-grounded Q&A (*"1K resistor kitne bache?"*, *"Kya mangwana hai?"*, *"Aaj kya stock mein aaya?"*) with built-in Web Speech API voice fallback.
- 💾 **Data Export & Backup:** Instant CSV exports (Products, Ledger, Invoices, Suppliers) and complete `.db` snapshot downloads.
- 🚀 **Embarko Cloud Ready:** Single-process architecture, Node 24 native SQLite, 0.0.0.0 dynamic port binding, zero background workers, strictly respecting Embarko's 256MB memory ceiling.

---

## 🏛️ Architecture Overview

```text
                                  +-----------------------------+
                                  |    Mobile / Web Browser     |
                                  |   (React 18 + Vanilla CSS)  |
                                  +--------------+--------------+
                                                 |
                                     HTTPS / JSON & Multipart
                                                 |
                                                 v
+-------------------------------------------------------------------------------+
|                       DukaanLens Node.js Backend Process                      |
|                                                                               |
|  +--------------------+   +-----------------------+   +--------------------+  |
|  |  Auth Middleware   |   |   Rate Limiter / CSRF |   |  Request Tracking  |  |
|  +---------+----------+   +-----------+-----------+   +---------+----------+  |
|            |                          |                         |             |
|            v                          v                         v             |
|  +-------------------------------------------------------------------------+  |
|  |                           Service Layer                                 |  |
|  |  InvoiceService  •  ProductService  •  InventoryService  •  AuditService |  |
|  |  ReorderEngine   •  SupplierService •  AssistantService  •  ExportService|  |
|  +------------------------------------+------------------------------------+  |
|                                       |                                       |
|            +--------------------------+--------------------------+            |
|            |                                                     |            |
|            v                                                     v            |
|  +-------------------+                                 +-------------------+  |
|  |  AI Provider      |                                 |  SQLite Storage   |  |
|  |  Abstraction      |                                 |  (node:sqlite)    |  |
|  +---------+---------+                                 +---------+---------+  |
|            |                                                     |            |
+------------|-----------------------------------------------------|------------+
             |                                                     |
             v                                                     v
+-----------------------------+                           +-------------------+
|     Google Cloud API        |                           |  DATA_DIR Mount   |
|   (Cloud Gemma 4 Models)    |                           |  • dukaanlens.db  |
|   gemma-4-26b-a4b-it        |                           |  • uploads/       |
+-----------------------------+                           +-------------------+
```

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js:** v20.0.0 or higher (Node.js 24 recommended)
- **npm:** v10.0.0 or higher

### 2. Installation
```bash
git clone https://github.com/your-org/dukaanlens.git
cd dukaanlens
npm install
```

### 3. Environment Configuration
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Google AI Studio API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Gemma Model Selection (Default: gemma-4-26b-a4b-it, or gemma-4-31b-it)
GEMMA_MODEL=gemma-4-26b-a4b-it

# Server Settings
PORT=3000
NODE_ENV=development
DATA_DIR=./data
SESSION_SECRET=super-secure-random-session-secret-key-32-chars
```

### 4. Seed Demo Data (Optional)
Populate realistic Indian electronics, hardware, and kirana items:
```bash
npm run seed
```
*Default login:* `admin` / `dukaan123`

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

DukaanLens includes a comprehensive automated test suite covering unit calculations, schema validation, multi-stage matching, duplicate detection, and end-to-end invoice workflows:

```bash
# Run full automated test suite (22 unit & integration tests)
npm run test

# Run TypeScript typechecks across client and server
npm run typecheck

# Run real Google Cloud Gemma 4 live smoke test (requires GEMINI_API_KEY)
npm run smoke:ai
```

---

## 📦 Production Build & Embarko Deployment

### Local Production Build
```bash
npm run build
npm run start
```

### Deploying to Embarko
1. Set the production environment variables in your Embarko dashboard:
   - `NODE_ENV=production`
   - `DATA_DIR=/data`
   - `SESSION_SECRET=<secret>`
   - `GEMINI_API_KEY=<Google AI Studio Key>`
   - `GEMMA_MODEL=gemma-4-26b-a4b-it`
2. Deploy the repository. Embarko executes `npm run build` followed by `npm run start`.
3. Check health status at `https://<your-app-domain>/health`.

For full deployment documentation, see [docs/embarko-deployment.md](docs/embarko-deployment.md).
For Google Cloud Gemma setup details, see [docs/gemma-setup.md](docs/gemma-setup.md).

---

## 🔒 Security Best Practices

- **Isolated AI Credentials:** `GEMINI_API_KEY` is exclusively consumed in server-side provider modules; it is never exposed in client bundles or API payloads.
- **HTTP-Only Cookies:** Sessions are stored using signed, HTTP-only, SameSite-protected cookies.
- **SQL Parameterization:** All SQLite queries utilize parameterized statements to prevent SQL injection.
- **Upload Sanitization:** All incoming image files are SHA-256 hashed, renamed with cryptographic UUIDs, and stored strictly within `DATA_DIR/uploads`.
- **Brute Force Defense:** Login and AI endpoints are guarded by in-memory rate limiting.

---

## 📑 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
