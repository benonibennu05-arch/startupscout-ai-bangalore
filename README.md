# StartupScout AI

AI-powered startup employment intelligence platform discovering real companies, job openings, internships, open talent pools, verified recruitment contacts, and managing a human-in-the-loop email application outreach pipeline across Bangalore and Hyderabad tech ecosystems.

---

## Features

- **Multi-Source Company Intelligence**: Continuous synchronization across Bangalore Startup Map, Hyderabad Startup Map (`https://hyderabadstartupsmap.lol/api/startups`), and WhereWeWork (`https://wherewework.co.in`) covering Bengaluru, Hyderabad, Pune, Gurugram, and Delhi NCR.
- **Dual-Mode Research Engine**: Supports `INITIAL_FULL` mode for deep exhaustive parsing of websites, career portals, and recruitment personnel, as well as `INCREMENTAL` mode for change detection, delta updates, and rapid periodic syncs.
- **Background Worker & Queue Engine**: Dedicated asynchronous queue (`ResearchQueue`) processing company discovery, deep web crawling, role scraping, and email verification without blocking the Express event loop.
- **Strict Public Contact Policy**: Crawls verified public HR and founder contacts from official domains with 0% fabricated/guessed emails and full cryptographic verification status.
- **Gmail OAuth 2.0 Sending Engine**: Real email delivery via official Google APIs (`gmail.send`) authenticated strictly with authorized sender `tejamatta05@gmail.com`, dynamic origin resolution, and automated PDF resume attachments.
- **OAuth Diagnostic Panel**: In-app diagnostic UI in Settings showing browser origin, configured vs expected redirect URIs, OAuth environment status, copyable parameters, and account validation.
- **Human-in-the-Loop Safeguards**: Strict review workflow allowing pitch preview, draft customization, and manual send confirmation before dispatching.
- **Persistent Storage**: Hybrid storage with durable SQLite database and JSON serialization in `./data/startupscout.db` and `./data/database.json`.
- **Automated Test Suite**: 23 automated tests verifying crawlers, location matching, contact policies, WhereWeWork sync, and OAuth state integrity.

---

## Quick Start Guide

### 1. Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher (or **Bun** `v1.1+`)
- **Docker**: (Optional, for containerized deployments)

---

### 2. Configure Environment Variables

Create a `.env` file in the root directory by copying the example:

```bash
cp .env.example .env
```

Open `.env` and configure your API keys and credentials:

```env
# ==============================================================================
# Google OAuth 2.0 Credentials (for Gmail Sending)
# ==============================================================================
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-production-domain.com/api/auth/google/callback

# ==============================================================================
# Gemini AI Configuration
# ==============================================================================
GEMINI_API_KEY=your-gemini-api-key
```

#### Environment Variable Descriptions:

| Variable | Required | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Optional | Used for AI-assisted company categorization, contact extraction, and tailored email drafting. |
| `GOOGLE_CLIENT_ID` | Required for Gmail | OAuth 2.0 Client ID from Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Required for Gmail | OAuth 2.0 Client Secret from Google Cloud Console. |
| `GOOGLE_REDIRECT_URI` | Required for Gmail | Callback endpoint for Google OAuth (defaults to `/api/auth/google/callback` on your active host). |

---

### 3. Google Cloud OAuth 2.0 Setup

To enable real Gmail delivery through your Gmail address (`tejamatta05@gmail.com`):

1. **Open Google Cloud Console**:
   - Navigate to [Google Cloud Console](https://console.cloud.google.com/).
   - Select or create a project.

2. **Enable the Gmail API**:
   - Go to **APIs & Services** → **Library**.
   - Search for **Gmail API** and click **Enable**.

3. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services** → **OAuth consent screen**.
   - Choose **External** user type.
   - Fill in the required app information (App name: *StartupScout AI*, support email).
   - Under **Scopes**, add:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Under **Test users**, add your sender email: `tejamatta05@gmail.com`.

4. **Create OAuth 2.0 Client ID**:
   - Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for local development)
     - `https://your-domain.com` (for production/Cloud Run)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/google/callback` (for local development)
     - `https://your-domain.com/api/auth/google/callback` (for production)

5. Copy the generated **Client ID** and **Client Secret** into your `.env` file.

---

### 4. Running Locally

#### Development Mode:
Runs the Express backend with `tsx` and hot frontend compilation:

```bash
# Install dependencies
npm install

# Start development server (serves on http://localhost:3000)
npm run dev
```

#### Production Build:
Compiles static React assets with Vite and bundles the Node backend with esbuild into `dist/`:

```bash
# Build production bundle
npm run build

# Start production server
npm start
```

---

### 5. Running with Docker

#### Option A: Using Docker Compose (Recommended)

```bash
# Start container in detached mode
docker-compose up -d

# View application logs
docker-compose logs -f

# Stop container
docker-compose down
```

The database and uploaded resumes are stored in the persistent Docker volume `startupscout-data`.

#### Option B: Using Standalone Docker Build

```bash
# Build the Docker image
docker build -t startupscout-ai .

# Run container with your .env file and mounted data volume
docker run -d \
  --name startupscout-ai \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  startupscout-ai
```

---

## Application Structure

```text
├── Dockerfile                  # Multi-stage production container build
├── docker-compose.yml          # Container composition & volume persistence
├── requirements.txt            # System dependencies & package requirements
├── package.json                # Node.js dependencies and scripts
├── server.ts                   # Express server entry point & Vite middleware
├── server/                     # Backend API modules
│   ├── ai/                     # Gemini AI analysis & classification
│   ├── crawler/                # Startup ecosystem web scrapers
│   ├── database/               # JSON file-based database store
│   ├── routes/                 # Express API routes (auth, email, companies)
│   └── services/               # Gmail API service, outreach service, resume parser
├── src/                        # Frontend React application
│   ├── components/             # Reusable UI widgets, modals, headers
│   ├── pages/                  # Main views (Outreach, Opportunities, Companies)
│   └── services/api.ts         # Frontend API client
└── data/                       # Local data persistence
    ├── database.json           # Cached company data & outreach logs
    └── resumes/                # Uploaded PDF resumes
```

---

## Automated Test Suite

StartupScout AI includes a complete automated test suite run via Node's native test runner (`node --test` with TypeScript loader):

```bash
# Run all automated tests
npm test
```

### Test Coverage:
1. **Hyderabad Startup Discovery (`tests/hyderabad-discovery.test.ts`)**:
   - Validates live endpoint consumption at `https://hyderabadstartupsmap.lol/api/startups`.
   - Tests official domain extraction and protocol sanitization.
   - Verifies curated tech startups directory (Darwinbox, Zenoti, HighRadius, Skyroot Aerospace, etc.).
2. **Location Scope & Multi-Hub Matching (`tests/location-scope.test.ts`)**:
   - Tests `matchesLocationScope` across Hyderabad, Bangalore, WhereWeWork, and Both/All scopes.
   - Verifies neighborhood matching (Hitec City, Gachibowli, Madhapur, Financial District, Kondapur, Koramangala, Indiranagar, Whitefield, HSR).
3. **Strict Public Contact Policy (`tests/contacts-email-policy.test.ts`)**:
   - Verifies strict rejection of dummy, fake, or synthetic addresses (`user@example.com`, `test@test.com`).
   - Ensures exact match verification in crawled HTML and career pages.
   - Validates role classifications (`CAREERS`, `TALENT`, `RECRUITING`, `CAMPUS_HIRING`, `HR`, `FOUNDER`).
4. **OAuth State & Authorized Sender (`tests/oauth-flow.test.ts`)**:
   - Tests single-use CSRF OAuth state generation, storage, and consumption.
   - Enforces `tejamatta05@gmail.com` as the exclusive authorized sender.
   - Validates dynamic origin diagnostic payload format.
5. **WhereWeWork Adapter & Jobs Sync (`tests/wherewework-sync.test.ts`)**:
   - Validates Indian tech cities coverage (Bengaluru, Hyderabad, Pune, Gurugram, Delhi).
   - Tests title parsing for internships vs full-time positions.
   - Verifies adapter health reporting and monitoring status.

---

## Health Check & Verification

Once running, verify the backend endpoints:

- **Health Check**: `GET http://localhost:3000/api/health`
- **Gmail Status**: `GET http://localhost:3000/api/email/status`
- **OAuth Diagnostics**: `GET http://localhost:3000/api/auth/google/diagnostic`
- **Source Monitoring**: `GET http://localhost:3000/api/sources/status`
- **Multi-Source Discovery**: `POST http://localhost:3000/api/sources/sync-all`
- **Connection Test**: `POST http://localhost:3000/api/email/test-connection`
