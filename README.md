# 🖥️ ITAM Portal — IT Asset Management System

[![Live Demo](https://img.shields.io/badge/🔗_Live_App-ITAM_Portal-000000?style=for-the-badge&logo=vercel)](https://asset-management-phi-eight.vercel.app/)

Full-stack IT asset management with automatic endpoint discovery, hardware/software inventory, live telemetry, remote screen sharing, and request/approval workflow.

## Features

- **Asset Discovery & Inventory** — Windows agent auto-discovers CPU, RAM, disks, serial, MAC, OS details, installed software, and security posture. Runs as a Windows service with periodic check-ins and heartbeats. Offline queuing caches payloads locally when API is unreachable.
- **Live Telemetry** — Admin-only live CPU/RAM/disk usage from active agents with real-time monitoring dashboards.
- **Remote Screen Sharing** — Admin-initiated remote desktop viewing via JPEG base64 frames at ~3–5 FPS. Agent shows a Windows tray notification on share start/stop.
- **Asset Requests & Approvals** — Users submit hardware/software requests. Admins review, approve, or reject. Approved requests auto-create asset records.
- **Allocation Tracking** — Assign assets to employees with full audit trail. Return assets with history logs. Organize assets into groups. Track status: Available / Allocated / In Repair / Retired / Disposed.
- **Purchase & Warranty Management** — Record purchases with invoice numbers, vendors, costs, and warranty periods.
- **Role-Based Access Control** — Admin (full access) and User (read-only + requests). Admin-only tabs: Purchases, Allocations, Live Telemetry, User Management. Non-admins see only assets allocated to them and can submit asset requests.
- **AI Assistant** — Built-in natural-language chat assistant that queries asset inventory, warranties, telemetry, purchases, and history — no external API required.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.12 — pure `http.server` (no framework) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| Frontend | React 18 + TypeScript + Vite |
| Agent | Python 3.12 — WMI, psutil, mss, pywin32 |
| Icons | lucide-react |
| Packaging | PyInstaller — standalone agent EXE + setup EXE |

## Project Structure

```
D:\ASSETMANAGEMENT\
├── api_server.py              # REST API server (port 8000)
├── auth_service.py            # Supabase auth wrapper
├── load_env.py                # Loads .env into environment on import
├── requirements.txt           # Python dependencies
├── README.md
├── .env.example
├── LICENSE (MIT)
│
├── asset-dashboard/           # React frontend
│   ├── .env                   # Frontend environment config
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx            # Main app with sidebar + tab routing
│       ├── index.css          # Design system (light/dark theme)
│       ├── main.tsx           # Entry point
│       ├── contexts/
│       │   └── AuthContext.tsx # Auth state management
│       ├── services/
│       │   ├── apiConfig.ts   # API base URL helper
│       │   ├── authService.ts # Auth API client
│       │   └── supabaseClient.ts
│       └── components/
│           ├── Dashboard.tsx
│           ├── AssetList.tsx
│           ├── ActiveAgents.tsx
│           ├── AssetRequests.tsx
│           ├── RequestAssetModal.tsx
│           ├── Purchases.tsx
│           ├── Allocation.tsx
│           ├── LiveTelemetry.tsx
│           ├── ScreenViewer.tsx
│           ├── UserManagement.tsx
│           ├── SecuritySettings.tsx
│           ├── AIAssistant.tsx
│           ├── NotificationBell.tsx
│           └── LoginScreen.tsx
│
└── asset-agent/               # Windows discovery agent
    ├── main.py                # Agent CLI entry point + daemon loop
    ├── screen_capture.py      # Screen capture module (mss + PIL)
    ├── installer.py           # Source-based service installer
    ├── gui_installer.py       # Standalone EXE setup wizard
    ├── build_agent.py         # PyInstaller build script
    ├── AssetAgentService.spec # PyInstaller spec for service EXE
    ├── AssetAgentSetup.spec   # PyInstaller spec for setup EXE
    ├── config/
    │   ├── config.json        # Agent configuration
    │   └── config_manager.py  # Config loader with DPAPI encryption
    ├── api/
    │   └── client.py          # HTTP client for API communication
    ├── collector/
    │   ├── hardware.py        # CPU, RAM, disks, MAC, serial
    │   ├── os_info.py         # OS version, uptime, logged-in user
    │   ├── software.py        # Installed software from registry
    │   └── security.py        # Defender, Firewall, BitLocker, Updates
    ├── storage/
    │   └── sqlite_queue.py    # Offline payload queue
    ├── service/
    │   └── windows_service.py # Windows Service wrapper + management menu
    ├── tests/
    └── dist/
        ├── AssetAgentService.exe     # Standalone agent executable
        └── AssetAgentSetup.exe       # Setup wizard executable
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- A Supabase project (free tier works)

### 1. Clone & Setup Backend

```powershell
cd D:\ASSETMANAGEMENT
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your Supabase credentials.

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

### 2. Start the API Server

```powershell
python api_server.py
```

The server starts on **http://localhost:8000** by default (configurable via `PORT` env).

### 3. Setup & Start Frontend

```powershell
cd asset-dashboard
npm install
```

Create `asset-dashboard/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_TITLE=ITAM Portal
VITE_POLL_INTERVAL_MS=3000
```

```powershell
npm run dev
```

Open http://localhost:5173. Register the first account, then use the Supabase dashboard to set `role` to `admin` in the `user_profiles` table (or edit directly in the DB).

### 4. Deploy the Agent

#### Option A: Standalone EXE (recommended)

1. Copy `asset-agent/dist/AssetAgentSetup.exe` or `AssetAgentService.exe` to the target Windows machine
2. Right-click → **Run as Administrator**
3. The menu appears:
   ```
   1) Install & Start Service  (requires Admin)
   2) Start Service
   3) Stop Service
   4) Remove Service
   5) Run Agent in Console  (for testing)
   6) Exit
   ```
4. Select **1** to install with auto-start
5. Enter the server's IP address when prompted

#### Option B: Python source

```powershell
cd asset-agent
python main.py
```

#### Option C: Build from source

```powershell
cd asset-agent
python build_agent.py
```

Output: `dist/AssetAgentService.exe` and `dist/AssetAgentSetup.exe`.

### Network Requirements

- API server port must be reachable from agent machines
- Open Windows Firewall inbound rule:
  ```powershell
  New-NetFirewallRule -DisplayName "ITAM API" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
  ```

## API Endpoints

### Agent Endpoints (token-authenticated)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/agent/checkin` | Full inventory check-in |
| POST | `/api/v1/agent/heartbeat` | CPU/RAM/disk heartbeat |
| POST | `/api/v1/agent/screen-frame` | Upload screen capture frame |
| POST | `/api/v1/agent/screen-sharer-checkin` | Screen sharer status poll |
| POST | `/api/v1/agent/screen-share-stop-ack` | Screen share stop acknowledgment |
| GET | `/api/v1/agent/screen-share-status/{agent_id}` | Check if screen sharing is active |

### Dashboard Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/assets` | None | List all assets |
| GET | `/api/v1/agents` | Bearer | List all agents (with employee links) |
| GET | `/api/agents/{id}` | Bearer | Get a single agent |
| GET | `/api/v1/metrics` | None | Latest monitoring metrics |
| GET | `/api/v1/history` | None | Asset history audit trail |
| GET | `/api/v1/download/windows` | None | Download Windows agent installer |
| GET | `/api/v1/download/mac` | None | Download macOS agent script |
| GET | `/api/v1/download/linux` | None | Download Linux agent script |
| POST | `/api/auth/register` | None | Register new user |
| POST | `/api/auth/login` | None | Login |
| POST | `/api/auth/logout` | Bearer | Logout |
| GET | `/api/auth/me` | Bearer | Current user info |
| GET | `/api/purchases` | None | List purchases with asset details |
| GET | `/api/notifications` | Bearer | List notifications + unread count |
| PUT | `/api/notifications/{id}/read` | Bearer | Mark notification as read |
| POST | `/api/asset-requests` | Bearer | Submit a request |
| GET | `/api/asset-requests` | Bearer | List requests (all if admin, own if user) |
| PUT | `/api/asset-requests/{id}/approve` | Admin | Approve request (auto-creates asset) |
| PUT | `/api/asset-requests/{id}/reject` | Admin | Reject request |
| PUT | `/api/assets/{id}` | Admin | Update asset |
| DELETE | `/api/assets/{id}` | Admin | Delete asset |
| POST | `/api/agents/register` | Bearer | Register agent as asset |
| PUT | `/api/assets/{id}/deallocate` | Admin | Deallocate asset |
| PUT | `/api/agents/{id}/assign` | Admin | Update asset assignment details |
| GET | `/api/admin/users` | Admin | List all users (with device counts) |
| PUT | `/api/admin/users/{email}/role` | Admin | Change user role |
| POST | `/api/screen/{agent_id}/start` | Admin | Start screen sharing |
| POST | `/api/screen/{agent_id}/stop` | Admin | Stop screen sharing |
| GET | `/api/screen/frame/{agent_id}` | None | Get latest screen frame |
| GET | `/api/screen/sharers` | Admin | List active screen sharers |
| POST | `/api/v1/ai/query` | None | Natural-language asset query AI |
| POST | `/api/groups/create` | None | Create a new asset group |
| GET | `/api/health` | None | Health check |
| POST | `/api/agent/scan` | None | Request agent scan signal |
| POST | `/api/agent/restart` | None | Request agent restart signal |

## Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase service_role key (for DB ops) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key (for auth admin) |
| `AGENT_SECRET_TOKEN` | Shared secret for agent authentication |
| `INSTALLER_WINDOWS_URL` | Public URL for the Windows agent EXE download (optional) |
| `PORT` | API server port (default: 8000) |

Loaded automatically from `.env` via `load_env.py`.

### Frontend (`asset-dashboard/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_APP_TITLE` | Browser tab title |
| `VITE_POLL_INTERVAL_MS` | Dashboard poll interval (default: 3000) |

### Agent (`asset-agent/config/config.json`)

```json
{
    "api_url": "https://asset-management-gciq.onrender.com",
    "agent_token": "your-agent-token-here",
    "checkin_interval_hours": 24,
    "heartbeat_interval_minutes": 30,
    "agent_id": "AGENT-WIN-XXXXXX",
    "db_path": "C:\\ProgramData\\AssetAgent\\storage.db",
    "log_dir": "C:\\ProgramData\\AssetAgent\\logs",
    "verify_certs": false,
    "encrypted": false
}
```

## Agent Deployment Walkthrough

### Step 1: Prepare the Server
- Note the server's IP address (`ipconfig`)
- Ensure the API port is open in Windows Firewall
- Verify the API server is running

### Step 2: Deploy the EXE
- Copy `AssetAgentSetup.exe` or `AssetAgentService.exe` to the target machine
- Place in a permanent location like `C:\Program Files\AssetAgent\`

### Step 3: Install the Service
- Right-click → **Run as Administrator**
- Select option **1** (Install & Start Service)
- Enter the server's IP address when prompted

### Step 4: Verify
- Wait 30–60 seconds for check-in
- Open dashboard → **Active Agents** tab
- The machine should appear with status **Online**

### Step 5: Register as Asset (Admin)
- In Active Agents, click **Register**
- Fill in employee details, category, company info
- The agent becomes a tracked asset in inventory

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Agent shows **Offline** | API server unreachable | Check server IP, firewall, agent `config.json` |
| Screen sharing shows "Device is offline" | Agent too old | Update to latest EXE |
| Agent not appearing | Network issue | Check `agent.log` in `C:\ProgramData\AssetAgent\logs\` |
| "Access Denied" on install | Not running as Admin | Right-click → Run as Administrator |

## Database

Key Supabase tables:

- `assets` — Asset inventory with full specs and status
- `agents` — Discovery agent records with online/offline status
- `monitoring_metrics` — CPU, RAM, disk telemetry
- `asset_requests` — Hardware/software requests from users
- `notifications` — System notifications (screen share alerts, approvals)
- `purchases` — Purchase records with warranties
- `allocations` — Asset-employee assignment history
- `asset_history` — Audit trail for all asset changes
- `user_profiles` — Extended user data and role assignments
- `employees` — Employee directory auto-created on agent registration
- `groups` — Asset grouping for organizational management

## Building the Agent EXEs

```powershell
cd asset-agent
python build_agent.py
```

Or manually:

```powershell
pyinstaller --noconfirm --clean AssetAgentService.spec
pyinstaller --noconfirm --clean AssetAgentSetup.spec
```

Output: `dist/AssetAgentService.exe`, `dist/AssetAgentSetup.exe`.

## License

MIT
