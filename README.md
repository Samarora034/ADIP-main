# Azure Drift Intelligence Platform (ADIP)

Real-time Azure infrastructure drift detection, comparison, and auto-remediation platform.

## Prerequisites

- Node.js 18+
- Azure CLI (`az login` with Contributor access)
- Azure Functions Core Tools v4 (`npm install -g azure-functions-core-tools@4`)

---
For someone setting up from scratch, the complete flow is:
bash
git clone <repo>

# Install everything
npm install
cd adip-backend/express-api && npm install
cd ../function-app && npm install

# Configure
cp .env.example .env                                          # frontend
cp adip-backend/express-api/.env.example adip-backend/express-api/.env
cp adip-backend/function-app/.env.example adip-backend/function-app/.env
# → fill in Azure values in each .env

# Run
cd adip-backend/express-api && npm start   # Terminal 1
cd ADIP-main && npm run dev                # Terminal 2
## Quick Start

### 1. Clone and install all dependencies

```bash
# Frontend
npm install

# Express API backend
cd adip-backend/express-api
npm install

# Function App
cd ../function-app
npm install
```

### 2. Configure environment variables

```bash
# Frontend
cp .env.example .env

# Express API
cp adip-backend/express-api/.env.example adip-backend/express-api/.env

# Function App
cp adip-backend/function-app/.env.example adip-backend/function-app/.env
```

Fill in your Azure resource values in each `.env` file.  
See the comments in each `.env.example` for where to find each value.

### 3. Run locally

```bash
# Terminal 1 — Express API (port 3001)
cd adip-backend/express-api
npm start

# Terminal 2 — Frontend (port 5173)
npm run dev
```

Open http://localhost:5173

---

## Project Structure

```
ADIP-main/
├── src/                          # React frontend (Vite)
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx     # Resource selection + live feed
│   │   └── ComparisonPage.jsx    # Baseline vs live diff
│   ├── hooks/
│   │   ├── useDriftSocket.js     # Socket.IO real-time hook
│   │   └── useAzureScope.js      # Subscription/RG/resource loader
│   ├── context/
│   │   └── DashboardContext.jsx  # Persistent dashboard state
│   └── services/
│       └── api.js                # All frontend API calls
│
├── adip-backend/
│   ├── express-api/              # Node.js Express API (port 3001)
│   │   └── src/
│   │       ├── app.js            # Server entry + Socket.IO
│   │       ├── routes/           # REST endpoints
│   │       └── services/         # Azure SDK integrations
│   │
│   ├── function-app/             # Azure Function (detectDrift)
│   │   └── detectDrift/
│   │       └── index.js
│   │
│   └── logic-app/
│       ├── workflow.json         # Event Grid → Function App
│       └── alert-workflow.json   # Drift alert → Email
│
├── .env.example                  # Frontend env template
└── README.md
```

---

## Azure Resources Required

| Resource | Purpose |
|---|---|
| Cosmos DB | Stores baselines and drift records |
| Storage Account + Queue | Buffers Event Grid change events |
| Function App (Node 20) | Automated drift detection |
| Event Grid Topic | Receives ARM resource change events |
| Logic App (adip-logic-app) | Routes events to Function App |
| Logic App (adip-drift-alert) | Sends email alerts on critical/high drift |
| Azure Communication Services | Sends alert emails |

---

## Key Features

- **Real-time change feed** — any Azure resource change appears in the Live Activity feed instantly via Event Grid → Storage Queue → Socket.IO
- **Drift detection** — compares live ARM config against a stored golden baseline using deep JSON diff
- **Severity classification** — Critical / High / Medium / Low based on which fields changed
- **Auto-remediation** — reverts live resource to golden baseline via ARM PUT
- **Email alerts** — sends HTML email via Azure Communication Services for critical/high drift
- **Policy compliance** — shows Azure Policy compliance state alongside drift data

---

## Deploying the Function App

```bash
cd adip-backend/function-app
npm run deploy
```

## Environment Variables Reference

See `.env.example` files in each directory for full documentation of all required variables.
