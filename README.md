# ITAM Portal — IT Asset Management System

A full-stack IT Asset Management system with automatic endpoint discovery, hardware/software inventory, live telemetry, remote screen sharing, and request/approval workflow.

## Features

### Asset Discovery & Inventory
- Windows agent automatically discovers hardware (CPU, RAM, disks, serial, MAC), OS details, installed software, and security posture
- Agent runs as a Windows service with periodic check-ins and heartbeats
- Offline queuing — agents cache payloads locally when the API is unreachable and sync on reconnection
- Web dashboard displays all discovered assets, agents, and live status

### Live Telemetry & Screen Sharing
- **Live Telemetry** (admin-only): View CPU, RAM, and disk usage from active agents
- **Screen Sharing** (admin-only): Watch a remote user's desktop in real-time. Agent streams JPEG base64 frames at ~3–5 FPS
- Admin starts/stops screen sharing from the dashboard; the agent shows a Windows tray notification to the user

### Asset Requests & Approvals
- Users submit hardware/software requests via the dashboard
- Admins review, approve, or reject pending requests
- Approved requests automatically create asset records in the inventory

### Allocation Tracking
- Assign assets to employees with full audit trail
- Return assets with history logs
- Track allocation status (Available / Allocated / In Repair / Retired / Disposed)

### Purchase & Warranty Management
- Record purchases with invoice numbers, vendors, costs, and warranty periods
- View all purchase history alongside asset records

### Role-Based Access Control
- Two roles: **Admin** (full access) and **User** (read-only + requests)
- Admin-only tabs: Purchases, Allocations, Live Telemetry, User Management, Security Settings
- Non-admin users only see assets allocated to them

### Fleet Grouping
- Organize assets into custom groups (department-based, location-based)

### AI Assistant
- Built-in AI chat assistant for natural-language queries about your asset inventory

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.12 — pure `http.server` (no framework) |
| Database | Supabase (PostgreSQL) — serverless |
| Auth | Supabase Auth (JWT) |
| Frontend | React 18 + TypeScript + Vite |
| Agent | Python 3.12 — WMI, psutil, mss, pywin32 |
| Icons | lucide-react |
| Packaging | PyInstaller — standalone agent EXE |

## Project Structure

```
D:\ASSETMANAGEMENT\
├── api_server.py              # REST API server (port 8000)
├── auth_service.py            # Supabase auth wrapper
├── requirements.txt           # Python dependencies
├── supabase_migration.sql     # Database schema
├── set_admin.py               # CLI tool: promote/demote users
├── debug_db.py                # CLI tool: inspect database rows
├── README.md
├── .env.example
│
├── asset-dashboard/           # React frontend
│   ├── .env                   # Frontend environment config
│   ├── src/
│   │   ├── App.tsx            # Main app with sidebar + tab routing
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx # Auth state management
│   │   ├── services/
│   │   │   ├── authService.ts # Auth API client
│   │   │   └── supabaseClient.ts
│   │   └── components/
│   │       ├── Dashboard.tsx
│   │       ├── AssetList.tsx
│   │       ├── ActiveAgents.tsx
│   │       ├── LiveTelemetry.tsx
│   │       ├── ScreenViewer.tsx
│   │       ├── AssetRequests.tsx
│   │       ├── Purchases.tsx
│   │       ├── Allocation.tsx
│   │       ├── UserManagement.tsx
│   │       ├── SecuritySettings.tsx
│   │       ├── AIAssistant.tsx
│   │       ├── NotificationBell.tsx
│   │       └── LoginScreen.tsx
│   └── package.json
│
└── asset-agent/               # Windows discovery agent
    ├── main.py                # Agent CLI entry point + daemon loop
    ├── installer.py           # Windows service installer/uninstaller
    ├── screen_capture.py      # Screen capture module (mss + PIL)
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
    └── dist/
        └── AssetAgentService.exe     # Standalone agent executable (PyInstaller)
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

Copy `.env.example` to `.env` and fill in your Supabase credentials (see Environment Variables below).

Apply the database schema to your Supabase project:
1. Open your Supabase project dashboard → SQL Editor
2. Paste and run the contents of `supabase_migration.sql`

### 2. Start the API Server

```powershell
python api_server.py
```

The server starts on **https://asset-management-gciq.onrender.com**.

### 3. Setup & Start Frontend

```powershell
cd asset-dashboard
npm install
```

Create `asset-dashboard/.env` with your Supabase credentials (see `.env.example` in the root), then:

```powershell
npm run dev
```

The frontend starts on **https://asset-management-phi-eight.vercel.app/**.

Open your browser and navigate to http://localhost:5173. Register the first account, then promote it to admin:

```powershell
python set_admin.py your@email.com admin
```

### 4. Deploy the Agent on a Machine

There are two ways to run the agent:

#### Option A: Standalone EXE (recommended for end-users)

On the target machine (Windows 10/11):
1. Copy `asset-agent/dist/AssetAgentService.exe` (the main agent) and optionally `asset-agent/dist/AssetAgentSetup.exe` (installer) to the machine
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
4. Select **1** to install the service with auto-start
5. When prompted, enter the server's IP address (e.g., `192.168.1.100`) auto-generate an ID (`AGENT-WIN-XXXXXX`), collect inventory, and appear in the Active Agents tab within 30 seconds.

#### Option B: Python source (for development)

```powershell
cd asset-agent
# Edit config/config.json to point api_url to your server
python main.py
```

#### Option C: Installer script (copies source files)

```powershell
cd asset-agent
python installer.py   # Must run as Administrator
```

### Network Requirements

- The API server's port 8000 must be reachable from the agent machines
- Open Windows Firewall inbound rule for port 8000 on the server
- Agents connect via HTTP (or HTTPS with `verify_certs: true`)

## API Endpoints

### Agent Endpoints (no auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/agent/checkin` | Full inventory check-in |
| POST | `/api/v1/agent/heartbeat` | CPU/RAM/disk heartbeat |
| POST | `/api/v1/agent/screen-frame` | Upload screen capture frame |
| POST | `/api/v1/agent/screen-sharer-checkin` | Screen sharer status poll |
| POST | `/api/v1/agent/screen-share-stop-ack` | Screen share stop acknowledgment |

### Dashboard Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/assets` | None | List all assets |
| GET | `/api/agents` | None | List all agents |
| GET | `/api/v1/metrics` | None | Latest monitoring metrics |
| GET | `/api/v1/history` | None | Asset history audit trail |
| POST | `/api/auth/register` | None | Register new user |
| POST | `/api/auth/login` | None | Login |
| POST | `/api/auth/logout` | Bearer | Logout |
| GET | `/api/auth/me` | Bearer | Current user info |
| POST | `/api/asset-requests` | Bearer | Submit a request |
| GET | `/api/asset-requests` | Bearer | List requests |
| PUT | `/api/asset-requests/{id}/approve` | Admin | Approve request |
| PUT | `/api/asset-requests/{id}/reject` | Admin | Reject request |
| PUT | `/api/assets/{id}` | Admin | Update asset |
| DELETE | `/api/assets/{id}` | Admin | Delete asset |
| POST | `/api/agents/register` | None | Register agent as asset |
| PUT | `/api/agents/{id}/assign` | None | Assign asset to employee |
| GET | `/api/admin/users` | Admin | List all users |
| PUT | `/api/admin/users/{email}/role` | Admin | Change user role |
| POST | `/api/screen/{agent_id}/start` | Admin | Start screen sharing |
| POST | `/api/screen/{agent_id}/stop` | Admin | Stop screen sharing |
| GET | `/api/screen/frame/{agent_id}` | None | Get latest screen frame |

## Environment Variables

### Backend (`api_server.py` / `auth_service.py`)

The backend currently reads Supabase credentials from hardcoded values in `api_server.py` and `auth_service.py`. To configure for a different Supabase project, edit these files directly:

| File | Variable | Description |
|------|----------|-------------|
| `api_server.py` (line ~10) | `SUPABASE_URL` | Supabase project URL |
| `api_server.py` (line ~11) | `SUPABASE_KEY` | Supabase service_role key |
| `auth_service.py` (line ~13) | `SUPABASE_URL` | Supabase project URL |
| `auth_service.py` (line ~14) | `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `auth_service.py` (line ~18) | `SUPABASE_SERVICE_KEY` | Supabase service_role key |

### Frontend (`asset-dashboard/.env`)

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_TITLE=ITAM Portal
VITE_POLL_INTERVAL_MS=3000
```

### Agent (`asset-agent/config/config.json`)

```json
{
    "api_url": "http://localhost:8000",
    "agent_token": "key_prod_win_agent_d43f721a",
    "checkin_interval_hours": 24,
    "heartbeat_interval_minutes": 30
}
```

## Agent Activation Steps (End-User Laptop)

Follow these steps on each machine that should report to the central ITAM server:

### Step 1: Prepare the Server
- Note the server's IP address (run `ipconfig` on the server machine)
- Ensure port 8000 is open in Windows Firewall:
  ```powershell
  New-NetFirewallRule -DisplayName "ITAM API" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
  ```
- Verify the API server is running (`http://server-ip:8000`)

### Step 2: Deploy the Agent EXE
- Copy `asset-agent/dist/AssetAgentService.exe` to the target machine (USB, network share, or download)
- Place it in a permanent location like `C:\Program Files\AssetAgent\`

### Step 3: Install the Service
- Right-click `AssetAgentService.exe` → **Run as Administrator**
- The interactive menu appears
- Select option **1** (Install & Start Service)
- Enter the server's IP address when prompted (or accept `localhost:8000` if running locally)

### Step 4: Verify
- Wait 30–60 seconds for the agent to check in
- Open the ITAM dashboard → **Active Agents** tab
- The new machine should appear in the list with status **Online**

### Step 5: Register as Asset (Admin)
- In Active Agents, click **Register** on the new agent
- Fill in employee details, category, and company info
- The agent becomes a tracked asset in the Asset Inventory

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Agent shows **Offline** | API server unreachable | Check server IP, firewall, and agent's `config.json` `api_url` |
| "ModuleNotFoundError" when running EXE | Corrupted build | Re-download `AssetAgentService.exe` from the server's dist folder |
| Screen sharing shows "Device is offline" | Agent is running old version without screen capture | Update agent to the latest `AssetAgentService.exe` |
| Agent not appearing in list | Network connectivity issue | Check `agent.log` in `C:\ProgramData\AssetAgent\logs\` |
| "Access Denied" on install | Not running as Administrator | Right-click → Run as Administrator |

## Database

The schema is defined in `supabase_migration.sql`. Key tables:

- `assets` — Asset inventory with full specs and status
- `agents` — Discovery agent records with online/offline status
- `monitoring_metrics` — CPU, RAM, disk telemetry
- `asset_requests` — Hardware/software requests from users
- `notifications` — System notifications (screen share alerts, approvals)
- `purchases` — Purchase records with warranties
- `allocations` — Asset-employee assignment history
- `asset_history` — Audit trail for all asset changes

## Development

### Building the Agent EXE

```powershell
cd asset-agent
pyinstaller --onefile --name "AssetAgentService" `
  --add-data "config;config" `
  --hidden-import win32timezone --hidden-import plyer.platforms.win.notification `
  "service/windows_service.py"
```

Output: `dist/AssetAgentService.exe`
