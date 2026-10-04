# Google Cloud Gemma 4 Setup Guide for DukaanLens

DukaanLens uses **Cloud Gemma 4** through the official Google Gemini API (`@google/genai` SDK) to provide intelligent invoice image extraction, multi-stage product matching, Hinglish/Hindi/English conversational inventory assistance, and proposal generation.

---

## 1. Getting Your Gemini API Key

1. Navigate to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click on **"Get API key"** in the top navigation or sidebar.
4. Click **"Create API key"** (select an existing Google Cloud project or create a new one).
5. Copy your generated API key.
   *(Optional but recommended: Restrict the key to specific IPs or APIs where applicable).*

> **SECURITY WARNING:**
> - **NEVER** commit your API key to Git.
> - **NEVER** expose the Gemini API key to frontend client code or browser JavaScript.
> - DukaanLens strictly encapsulates the Gemini API server-side behind the `AiProvider` architecture.

---

## 2. Setting Environment Variables

In your local project root, create a `.env` file (copied from `.env.example`):

```bash
cp .env.example .env
```

Set the following variables in `.env`:

```env
# Required for Gemma AI features
GEMINI_API_KEY=your_actual_google_ai_studio_key_here

# Configured Cloud Gemma Model (Default: gemma-4-26b-a4b-it)
GEMMA_MODEL=gemma-4-26b-a4b-it

# Server & Storage Configuration
PORT=3000
NODE_ENV=development
DATA_DIR=./data
SESSION_SECRET=super-secret-cryptographic-session-key-min-32-chars
```

---

## 3. Switching Between Gemma Models

DukaanLens is designed with provider abstraction. You can switch between Gemma 4 models **without modifying any source code**:

### Default Fast Model
```env
GEMMA_MODEL=gemma-4-26b-a4b-it
```

### High-Capability Model
```env
GEMMA_MODEL=gemma-4-31b-it
```

Simply update the `GEMMA_MODEL` variable in `.env` (or in your hosting platform environment) and restart the application.

---

## 4. Starting the Application & Verifying Health

1. Seed demo products and shop profile (optional for dev):
   ```bash
   npm run seed
   ```

2. Start the server:
   ```bash
   npm run dev
   # OR for production build:
   npm run build && npm run start
   ```

3. Check the health endpoint:
   ```bash
   curl http://localhost:3000/health
   ```
   **Expected output:**
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
   *(If `GEMINI_API_KEY` is not set, `"ai": "missing_api_key"` is returned, and non-AI features remain fully functional without crashing).*

---

## 5. Running the Real Gemma Cloud Smoke Test

DukaanLens includes a dedicated live verification script that tests direct communication with the Gemini Interactions API using your configured key and model:

```bash
npm run smoke:ai
```

This tests:
1. API reachability and authentication.
2. Structured JSON schema enforcement with Zod.
3. Fast natural-language response.

---

## 6. Offline / Mock AI Development

If you are developing locally without an active Gemini API key or quota:
```env
MOCK_AI=true
```
When `MOCK_AI=true`, DukaanLens utilizes the deterministic `MockAiProvider`, returning high-fidelity realistic invoice extractions and inventory proposals for local UI/UX testing.
