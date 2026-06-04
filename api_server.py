import load_env
import http.server
import json
import logging
import urllib.parse
import os
from datetime import datetime, timezone

from supabase import create_client, Client
from auth_service import AuthService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ITAM_API_Server")

_screen_frames: dict[str, str] = {}
_screen_active: dict[str, bool] = {}
_screen_sharer_agents: dict[str, dict] = {}

PORT = int(os.environ.get("PORT", 8000))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

_supabase: Client | None = None

def get_db() -> Client:
    global _supabase
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env or environment variables.")
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase

auth_service = AuthService()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sb_select(table: str, params: dict | None = None) -> list:
    """Select rows from a Supabase table, returning a list."""
    q = get_db().table(table).select("*")
    if params:
        for k, v in params.items():
            q = q.eq(k, v)
    data = q.execute()
    return data.data if data else []


def sb_select_one(table: str, field: str, value: str) -> dict | None:
    """Select a single row, or return None."""
    data = get_db().table(table).select("*").eq(field, value).limit(1).execute()
    rows = data.data if data else []
    return rows[0] if rows else None


def sb_insert(table: str, record: dict) -> dict | None:
    data = get_db().table(table).insert(record).execute()
    rows = data.data if data else []
    return rows[0] if rows else None


def sb_upsert(table: str, record: dict, on_conflict: str) -> dict | None:
    data = get_db().table(table).upsert(record, on_conflict=on_conflict).execute()
    rows = data.data if data else []
    return rows[0] if rows else None


def sb_update(table: str, field: str, value: str, updates: dict) -> list:
    data = get_db().table(table).update(updates).eq(field, value).execute()
    return data.data if data else []


def sb_delete(table: str, field: str, value: str) -> list:
    data = get_db().table(table).delete().eq(field, value).execute()
    return data.data if data else []


class ITAMRequestHandler(http.server.BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def _get_bearer_token(self):
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return auth_header[7:].strip()
        return None

    def _require_auth(self):
        token = self._get_bearer_token()
        if not token:
            self._send_json(401, {"error": "Authentication required. Provide Authorization: Bearer <token>"})
            return None
        user = auth_service.get_current_user(token)
        if not user:
            self._send_json(401, {"error": "Invalid or expired session token."})
            return None
        return user

    def _require_admin(self):
        user = self._require_auth()
        if user and user["role"] != "admin":
            self._send_json(403, {"error": "Admin privileges required."})
            return None
        return user

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode("utf-8"))

    def do_GET(self):
        try:
            self._handle_get()
        except Exception as e:
            logger.error(f"Unhandled error in GET {self.path}: {e}", exc_info=True)
            try:
                self._send_json(500, {"error": "Internal server error"})
            except Exception:
                pass

    def _handle_get(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        path_parts = [p for p in path.split("/") if p]

        if path == "/api/v1/assets" or path == "/api/assets":
            assets = get_db().table("assets").select("*").order("hostname").execute()
            self._send_json(200, assets.data if assets else [])

        elif path == "/api/agents":
            agents_data = get_db().table("agents").select("*").order("hostname").execute()
            agents = agents_data.data if agents_data else []
            all_assets = get_db().table("assets").select("asset_id,mac_address,employee_name").execute()
            assets_list = all_assets.data if all_assets else []
            asset_by_agent_id = {a["asset_id"]: a for a in assets_list}
            asset_by_mac = {a["mac_address"]: a for a in assets_list}
            for agent in agents:
                linked = asset_by_agent_id.get(agent["agent_id"]) or asset_by_mac.get(agent["mac_address"])
                if linked:
                    agent["employee_name"] = linked.get("employee_name", "")
                else:
                    agent["employee_name"] = ""
            self._send_json(200, agents)

        elif len(path_parts) == 3 and path_parts[0] == "api" and path_parts[1] == "agents":
            agent_id = path_parts[2]
            agent = (sb_select_one("agents", "id", agent_id) or
                     sb_select_one("agents", "agent_id", agent_id) or
                     sb_select_one("agents", "mac_address", agent_id))
            if agent:
                linked_asset = sb_select_one("assets", "asset_id", agent.get("agent_id", ""))
                if not linked_asset:
                    linked_asset = sb_select_one("assets", "mac_address", agent.get("mac_address", ""))
                agent["employee_name"] = linked_asset.get("employee_name", "") if linked_asset else ""
                self._send_json(200, agent)
            else:
                self._send_json(404, {"error": "Agent not found"})

        elif len(path_parts) == 3 and path_parts[0] == "api" and path_parts[1] == "assets":
            asset_id = path_parts[2]
            asset = (sb_select_one("assets", "id", asset_id) or
                     sb_select_one("assets", "asset_id", asset_id))
            if asset:
                self._send_json(200, asset)
            else:
                self._send_json(404, {"error": "Asset not found"})

        elif path == "/api/v1/metrics":
            metrics_raw = get_db().table("monitoring_metrics").select("*").order("timestamp", desc=True).execute()
            all_rows = metrics_raw.data if metrics_raw else []
            seen = {}
            for row in all_rows:
                aid = row.get("asset_id")
                if aid and aid not in seen:
                    seen[aid] = row
            latest = list(seen.values())
            asset_ids = [r["asset_id"] for r in latest if r.get("asset_id")]
            metrics_out = []
            if asset_ids:
                assets_data = get_db().table("assets").select("id,hostname,category").in_("id", asset_ids).execute()
                asset_map = {a["id"]: a for a in (assets_data.data if assets_data else [])}
                for row in latest:
                    asset = asset_map.get(row.get("asset_id", ""), {})
                    metrics_out.append({
                        "id": row["id"],
                        "hostname": asset.get("hostname", "Unknown"),
                        "category": asset.get("category", "Unknown"),
                        "cpu_usage": float(row.get("cpu_usage", 0)),
                        "ram_usage": float(row.get("ram_usage", 0)),
                        "disk_usage": float(row.get("disk_usage", 0)),
                        "last_seen": row.get("timestamp", ""),
                    })
            self._send_json(200, metrics_out)

        elif path == "/api/v1/history":
            history = get_db().table("asset_history").select("*").order("created_at", desc=True).limit(100).execute()
            self._send_json(200, history.data if history else [])

        elif path == "/api/v1/download/windows":
            file_path = r"D:\ASSETMANAGEMENT\asset-agent\dist\AssetAgentSetup.exe"
            if os.path.exists(file_path):
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Disposition", "attachment; filename=AssetAgentSetup.exe")
                self.send_cors_headers()
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self._send_json(404, {"error": "Windows installer file not found on server."})

        elif path == "/api/v1/download/mac":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", "attachment; filename=itam_agent_macos.sh")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b"""#!/bin/bash\necho "Installing Enterprise ITAM Discovery Agent for macOS..."\necho "Installation complete. System telemetry active."\n""")

        elif path == "/api/v1/download/linux":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", "attachment; filename=itam_agent_linux.sh")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b"""#!/bin/bash\necho "Installing Enterprise ITAM Discovery Agent for Linux..."\necho "Installation complete. System telemetry active."\n""")

        elif path == "/api/auth/me":
            user = self._require_auth()
            if user:
                self._send_json(200, {"user": user})

        elif path == "/api/admin/users":
            admin = self._require_admin()
            if admin:
                users = auth_service.list_users()
                all_assets = sb_select("assets")
                for u in users:
                    u["device_count"] = sum(
                        1 for a in all_assets
                        if a.get("employee_email", "").lower() == u["email"].lower()
                    )
                self._send_json(200, {"users": users})

        elif path == "/api/asset-requests":
            user = self._require_auth()
            if user:
                is_adm = user.get("role") == "admin"
                if is_adm:
                    rows = get_db().table("asset_requests").select("*").order("created_at", desc=True).execute()
                else:
                    rows = get_db().table("asset_requests").select("*").eq("user_email", user["email"]).order("created_at", desc=True).execute()
                self._send_json(200, rows.data if rows else [])

        elif path == "/api/purchases":
            rows = get_db().table("purchases").select("*,assets!inner(hostname,asset_id)").order("created_at", desc=True).execute()
            out = []
            for r in (rows.data or []):
                a = r.get("assets") or {}
                out.append({
                    "id": r["id"],
                    "asset_id": a.get("asset_id", r.get("asset_id", "")),
                    "hostname": a.get("hostname", "Unknown"),
                    "purchase_date": r.get("purchase_date", ""),
                    "invoice_number": r.get("invoice_number", ""),
                    "vendor": r.get("vendor", ""),
                    "cost": float(r.get("cost", 0)),
                    "warranty_start": r.get("warranty_start", ""),
                    "warranty_end": r.get("warranty_end", ""),
                })
            self._send_json(200, out)

        elif path == "/api/notifications":
            user = self._require_auth()
            if user:
                rows = get_db().table("notifications").select("*").eq("user_email", user["email"]).order("created_at", desc=True).execute()
                unread_count = sum(1 for n in (rows.data or []) if not n.get("is_read"))
                self._send_json(200, {"notifications": rows.data if rows else [], "unread_count": unread_count})

        elif len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "screen" and path_parts[2] == "frame":
            agent_id = path_parts[3]
            frame = _screen_frames.get(agent_id)
            self._send_json(200, {"frame": frame, "active": _screen_active.get(agent_id, False)})

        elif len(path_parts) == 5 and path_parts[0] == "api" and path_parts[1] == "v1" and path_parts[2] == "agent" and path_parts[3] == "screen-share-status":
            agent_id = path_parts[4]
            active = _screen_active.get(agent_id, False)
            self._send_json(200, {"active": active})

        elif path == "/api/screen/sharers":
            admin = self._require_admin()
            if admin:
                self._send_json(200, {"sharers": list(_screen_sharer_agents.values())})

        else:
            self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        try:
            self._handle_post()
        except Exception as e:
            logger.error(f"Unhandled error in POST {self.path}: {e}", exc_info=True)
            try:
                self._send_json(500, {"error": "Internal server error", "detail": str(e)})
            except Exception:
                pass

    def _handle_post(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        path_parts = [p for p in path.split("/") if p]

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length).decode("utf-8").strip() if content_length > 0 else ""
        payload = {}
        if post_data:
            try:
                payload = json.loads(post_data)
            except json.JSONDecodeError:
                self._send_json(400, {"error": "Invalid JSON"})
                return

        db = get_db()

        if path == "/api/v1/agent/checkin":
            agent_id = payload.get("agent_id")
            hostname = payload.get("hostname", "Unknown")
            mac_address = payload.get("mac_address", "Unknown").replace("-", ":").upper().strip()

            if not agent_id:
                self._send_json(400, {"error": "agent_id is required"})
                return

            serial_number = payload.get("serial_number", "Unknown").strip().upper()
            dedup_key = serial_number if (serial_number and serial_number not in ["UNKNOWN", ""]) else (mac_address if mac_address and mac_address != "UNKNOWN" else agent_id)

            agent_rec = {
                "agent_id": agent_id,
                "hostname": hostname,
                "mac_address": mac_address,
                "ip_address": payload.get("ip_address", "Unknown"),
                "serial_number": payload.get("serial_number", "Unknown"),
                "agent_version": payload.get("agent_version", "1.0.0"),
                "os_name": payload.get("os_name", "Unknown"),
                "os_version": payload.get("os_version", "Unknown"),
                "cpu_model": payload.get("cpu", "Unknown"),
                "cpu_cores": payload.get("cpu_cores", 0),
                "ram_total": payload.get("ram_total", "Unknown"),
                "disks": payload.get("disks", []),
                "status": "Online",
                "last_checkin": now_iso(),
                "software_inventory": payload.get("software_inventory", []),
            }

            existing = sb_select_one("agents", "agent_id", agent_id)
            if existing:
                sb_update("agents", "agent_id", agent_id, agent_rec)
            elif mac_address and mac_address != "UNKNOWN":
                existing = sb_select_one("agents", "mac_address", mac_address)
                if existing:
                    sb_update("agents", "mac_address", mac_address, agent_rec)
                else:
                    sb_insert("agents", agent_rec)
            else:
                sb_insert("agents", agent_rec)

            history_entry = {
                "event_type": "Discovery",
                "description": f"Windows Agent checked in full hardware & software inventory from {hostname}.",
                "changed_by": "AGENT",
            }
            sb_insert("asset_history", history_entry)

            self._send_json(200, {"status": "success", "message": "Check-in successful"})

        elif path == "/api/v1/agent/heartbeat":
            hostname = payload.get("hostname", "Unknown")
            ip_addr = payload.get("ip_address", "")

            existing = sb_select_one("agents", "hostname", hostname)
            if not existing and ip_addr:
                existing = sb_select_one("agents", "ip_address", ip_addr)

            agent_id_val = None
            if existing:
                sb_update("agents", "id", existing["id"], {"status": "Online", "last_checkin": now_iso()})
                agent_id_val = existing["id"]

            cpu = float(payload.get("cpu_usage", "0%").replace("%", ""))
            ram = float(payload.get("memory_usage", "0%").replace("%", ""))
            disk = float(payload.get("disk_usage", "0%").replace("%", ""))

            if agent_id_val:
                metric_rec = {
                    "cpu_usage": cpu,
                    "ram_usage": ram,
                    "disk_usage": disk,
                    "asset_id": agent_id_val,
                }
                sb_insert("monitoring_metrics", metric_rec)

            self._send_json(200, {"status": "success"})

        elif path == "/api/agents/register":
            agent_id_or_mac = payload.get("id") or payload.get("mac_address")
            agent = (sb_select_one("agents", "id", agent_id_or_mac) or
                     sb_select_one("agents", "agent_id", agent_id_or_mac) or
                     sb_select_one("agents", "mac_address", agent_id_or_mac))

            if not agent:
                self._send_json(404, {"status": "error", "message": "Agent not found"})
                return

            sb_update("agents", "id", agent["id"], {"registration_status": "Registered"})

            asset_rec = {
                "asset_id": agent["agent_id"],
                "hostname": agent["hostname"],
                "category": payload.get("category", "Laptop"),
                "manufacturer": agent.get("manufacturer", "Lenovo"),
                "model": agent.get("model", "ThinkPad"),
                "serial_number": agent.get("serial_number", "Unknown"),
                "os_name": agent["os_name"],
                "os_version": agent["os_version"],
                "ip_address": agent["ip_address"],
                "mac_address": agent["mac_address"],
                "cpu_model": agent["cpu_model"],
                "cpu_cores": agent["cpu_cores"],
                "ram_total": agent["ram_total"],
                "disks": agent.get("disks", []),
                "software_inventory": agent.get("software_inventory", []),
                "status": "Allocated",
                "last_seen": now_iso(),
                "company": payload.get("company", "Default Corp"),
                "department": payload.get("department", "IT Dept"),
                "location": payload.get("location", "Main Office"),
                "employee_name": payload.get("employee_name", "Unassigned"),
                "employee_id": payload.get("employee_id", "N/A"),
                "employee_email": payload.get("employee_email", ""),
                "employee_phone": payload.get("employee_phone", ""),
                "manager_name": payload.get("manager_name", ""),
                "asset_tag": payload.get("asset_tag", f"TAG-{agent['agent_id']}"),
                "purchase_date": payload.get("purchase_date", ""),
                "warranty_expiry": payload.get("warranty_expiry", ""),
                "vendor_name": payload.get("vendor_name", ""),
            }
            created_asset = sb_insert("assets", asset_rec)

            history_entry = {
                "event_type": "Allocation",
                "description": f"Agent registered as asset {payload.get('asset_tag')} and assigned to {payload.get('employee_name')}.",
                "changed_by": "Administrator",
            }
            sb_insert("asset_history", history_entry)

            # Create employee record
            emp_id_val = payload.get("employee_id")
            if emp_id_val:
                existing_emp = sb_select_one("employees", "employee_id", emp_id_val)
                if not existing_emp:
                    sb_insert("employees", {
                        "employee_id": emp_id_val,
                        "name": payload.get("employee_name", ""),
                        "email": payload.get("employee_email", ""),
                        "phone": payload.get("employee_phone", ""),
                        "manager_name": payload.get("manager_name", ""),
                    })

            self._send_json(200, {"status": "success", "message": "Agent registered successfully", "asset": created_asset})

        elif path == "/api/groups/create":
            group_rec = {
                "name": payload.get("name"),
                "group_type": payload.get("group_type", "General"),
            }
            created = sb_insert("groups", group_rec)
            self._send_json(200, {"status": "success", "group": created})

        elif path == "/api/agent/scan":
            import subprocess
            import sys
            logger.info("Immediate active agent scan triggered via UI!")
            agent_script = os.path.join("asset-agent", "main.py")
            try:
                subprocess.Popen([sys.executable, agent_script, "--oneshot"])
                self._send_json(200, {"status": "success", "message": "Scan triggered successfully"})
            except Exception as e:
                logger.error(f"Failed to launch immediate agent scan: {e}")
                self._send_json(500, {"status": "error", "message": str(e)})

        elif path == "/api/agent/restart":
            import subprocess
            import sys
            logger.info("Agent restart requested via UI!")
            service_restarted = False
            try:
                subprocess.run(["powershell", "-Command", "Restart-Service -Name AssetAgent -ErrorAction Stop"], check=True, capture_output=True, text=True)
                service_restarted = True
                logger.info("Windows Service 'AssetAgent' restarted successfully via PowerShell.")
            except Exception:
                logger.warning("Failed to restart Windows Service. Falling back to process restart.")
            try:
                agent_script = os.path.join("asset-agent", "main.py")
                subprocess.Popen([sys.executable, agent_script])
                msg = "Agent service restarted successfully." if service_restarted else "Agent successfully restarted in active background process mode."
                self._send_json(200, {"status": "success", "message": msg, "service_restarted": service_restarted})
            except Exception as e:
                logger.error(f"Failed to restart agent process: {e}")
                self._send_json(500, {"status": "error", "message": str(e)})

        elif path == "/api/asset-requests":
            user = self._require_auth()
            if user:
                request_type = payload.get("request_type")
                form_data = payload.get("form_data", {})
                if request_type not in ("hardware", "software"):
                    self._send_json(400, {"error": "request_type must be 'hardware' or 'software'"})
                    return
                rec = {
                    "user_email": user["email"],
                    "user_name": user["name"],
                    "request_type": request_type,
                    "status": "pending",
                    "form_data": form_data,
                }
                created = sb_insert("asset_requests", rec)
                self._send_json(201, created or {"error": "Failed to create request"})

        elif path == "/api/auth/register":
            try:
                result = auth_service.register(
                    name=payload.get("name", ""),
                    email=payload.get("email", ""),
                    password=payload.get("password", "")
                )
                self._send_json(201, result)
            except ValueError as e:
                self._send_json(400, {"error": str(e)})

        elif path == "/api/auth/login":
            try:
                result = auth_service.login(
                    email=payload.get("email", ""),
                    password=payload.get("password", "")
                )
                self._send_json(200, result)
            except ValueError as e:
                self._send_json(401, {"error": str(e)})

        elif path == "/api/auth/logout":
            token = self._get_bearer_token()
            if token:
                auth_service.logout(token)
            self._send_json(200, {"message": "Logged out successfully."})

        elif path == "/api/v1/agent/screen-frame":
            agent_id = payload.get("agent_id")
            frame = payload.get("frame")
            if agent_id and frame:
                _screen_frames[agent_id] = frame
                self._send_json(200, {"status": "ok"})
            else:
                self._send_json(400, {"error": "agent_id and frame required"})

        elif path == "/api/v1/agent/screen-sharer-checkin":
            agent_id = payload.get("agent_id")
            hostname = payload.get("hostname")
            if agent_id:
                _screen_sharer_agents[agent_id] = {
                    "agent_id": agent_id,
                    "hostname": hostname or "Unknown",
                    "last_checkin": now_iso(),
                }
                self._send_json(200, {"status": "ok", "active": _screen_active.get(agent_id, False)})
            else:
                self._send_json(400, {"error": "agent_id required"})

        elif path == "/api/v1/agent/screen-share-stop-ack":
            agent_id = payload.get("agent_id")
            if agent_id:
                _screen_active[agent_id] = False
                _screen_frames.pop(agent_id, None)
                self._send_json(200, {"status": "ok"})
            else:
                self._send_json(400, {"error": "agent_id required"})

        elif len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "screen" and path_parts[3] == "start":
            admin = self._require_admin()
            if admin:
                agent_id = path_parts[2]
                _screen_active[agent_id] = True
                hostname = payload.get("hostname", agent_id)
                asset = sb_select_one("assets", "asset_id", agent_id)
                if not asset:
                    asset = sb_select_one("assets", "hostname", hostname)
                user_email = ""
                if asset:
                    user_email = asset.get("employee_email", "")
                if user_email:
                    sb_insert("notifications", {
                        "user_email": user_email,
                        "title": "Admin is Watching 👁️",
                        "message": f"Your IT administrator is viewing your screen on {hostname}.",
                        "type": "screen_share",
                    })
                self._send_json(200, {"status": "screen_share_started"})

        elif len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "screen" and path_parts[3] == "stop":
            admin = self._require_admin()
            if admin:
                agent_id = path_parts[2]
                _screen_active[agent_id] = False
                _screen_frames.pop(agent_id, None)
                self._send_json(200, {"status": "screen_share_stopped"})

        elif path == "/api/v1/ai/query":
            query_text = payload.get("query", "").strip()
            if not query_text:
                self._send_json(400, {"error": "query is required"})
                return

            lower = query_text.lower()

            if any(w in lower for w in ["warranty", "expir", "warranties"]):
                result = get_db().table("purchases").select("*,assets!inner(hostname,asset_id,model,category)").order("warranty_end").limit(100).execute()
                data = result.data if result else []
                expired = sum(1 for r in data if r.get("warranty_end") and r["warranty_end"] <= now_iso()[:10])
                summary = f"Found {len(data)} purchase records with warranty info. {expired} warranties have expired."
                sql = "SELECT purchases.*, assets.hostname, assets.model, assets.category FROM purchases JOIN assets ON purchases.asset_id = assets.id ORDER BY warranty_end;"

            elif any(w in lower for w in ["software", "application", "app"]):
                result = get_db().table("assets").select("id,hostname,category,software_inventory,os_name").limit(100).execute()
                data = result.data if result else []
                from collections import Counter
                sw_counts = Counter()
                for asset in data:
                    sw_list = asset.get("software_inventory") or []
                    for sw in sw_list:
                        name = sw.get("name") or sw.get("DisplayName", "Unknown") if isinstance(sw, dict) else str(sw)
                        sw_counts[name] += 1
                top = sw_counts.most_common(10)
                summary = f"Scanned {len(data)} devices. Most installed: " + ", ".join(f"{s[0]} ({s[1]})" for s in top[:5]) + "."
                sql = "SELECT id, hostname, software_inventory FROM assets;"

            elif any(w in lower for w in ["cpu", "ram", "memory", "disk", "telemetry", "usage"]):
                result = get_db().table("monitoring_metrics").select("*,assets!inner(hostname)").order("timestamp", desc=True).limit(50).execute()
                data = result.data if result else []
                high_ram = [r for r in data if r.get("ram_usage", 0) > 80]
                summary = f"Found {len(data)} recent telemetry readings. {len(high_ram)} assets exceed 80% RAM usage."
                sql = "SELECT monitoring_metrics.*, assets.hostname FROM monitoring_metrics JOIN assets ON monitoring_metrics.asset_id = assets.id ORDER BY timestamp DESC LIMIT 50;"

            elif any(w in lower for w in ["purchase", "invoice", "vendor", "cost"]):
                result = get_db().table("purchases").select("*,assets!inner(hostname,asset_id)").order("created_at", desc=True).limit(100).execute()
                data = result.data if result else []
                total = sum(r.get("cost", 0) or 0 for r in data)
                summary = f"Found {len(data)} purchase records. Total cost: ${total:,.2f}."
                sql = "SELECT purchases.*, assets.hostname FROM purchases JOIN assets ON purchases.asset_id = assets.id ORDER BY created_at DESC;"

            elif any(w in lower for w in ["history", "event", "audit", "log"]):
                result = get_db().table("asset_history").select("*").order("created_at", desc=True).limit(100).execute()
                data = result.data if result else []
                summary = f"Found {len(data)} historical events."
                sql = "SELECT * FROM asset_history ORDER BY created_at DESC LIMIT 100;"

            else:
                result = get_db().table("assets").select("*").order("hostname").limit(100).execute()
                data = result.data if result else []
                statuses = {}
                for a in data:
                    s = a.get("status", "Unknown")
                    statuses[s] = statuses.get(s, 0) + 1
                status_str = ", ".join(f"{k}: {v}" for k, v in statuses.items())
                summary = f"Found {len(data)} assets. Status breakdown — {status_str}."
                sql = "SELECT * FROM assets ORDER BY hostname;"

            self._send_json(200, {"results": data, "sql": sql, "summary": summary, "count": len(data)})

        else:
            self._send_json(404, {"error": "Not found"})

    def do_PUT(self):
        try:
            self._handle_put()
        except Exception as e:
            logger.error(f"Unhandled error in PUT {self.path}: {e}", exc_info=True)
            try:
                self._send_json(500, {"error": "Internal server error"})
            except Exception:
                pass

    def _handle_put(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        path_parts = [p for p in path.split("/") if p]

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length).decode("utf-8").strip() if content_length > 0 else ""
        payload = {}
        if post_data:
            try:
                payload = json.loads(post_data)
            except json.JSONDecodeError:
                pass

        if len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "agents" and path_parts[3] == "assign":
            agent_identifier = path_parts[2]
            asset = (sb_select_one("assets", "id", agent_identifier) or
                     sb_select_one("assets", "asset_id", agent_identifier) or
                     sb_select_one("assets", "mac_address", agent_identifier))
            if asset:
                updates = {}
                for field in ["company", "employee_name", "employee_id", "employee_email", "employee_phone", "manager_name", "department", "location"]:
                    if field in payload:
                        updates[field] = payload[field]
                if "groups" in payload:
                    updates["groups"] = payload["groups"]
                sb_update("assets", "id", asset["id"], updates)
                asset.update(updates)
                self._send_json(200, {"status": "success", "message": "Assignments updated successfully", "asset": asset})
            else:
                self._send_json(404, {"error": "Asset not found for assignment"})

        elif len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "assets" and path_parts[3] == "deallocate":
            asset_identifier = path_parts[2]
            asset = (sb_select_one("assets", "id", asset_identifier) or
                     sb_select_one("assets", "asset_id", asset_identifier))
            if asset:
                updates = {
                    "employee_name": "",
                    "employee_id": "",
                    "employee_email": "",
                    "employee_phone": "",
                    "manager_name": "",
                    "company": "",
                    "department": "",
                    "location": "",
                    "status": "Available",
                }
                sb_update("assets", "id", asset["id"], updates)
                asset.update(updates)
                self._send_json(200, {"status": "success", "message": "Device deallocated successfully", "asset": asset})
            else:
                self._send_json(404, {"error": "Asset not found"})

        elif len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "asset-requests" and path_parts[3] == "approve":
            admin = self._require_admin()
            if admin:
                req_id = path_parts[2]
                req = sb_select_one("asset_requests", "id", req_id)
                if not req:
                    self._send_json(404, {"error": "Request not found"})
                else:
                    fd = req.get("form_data", {})
                    if isinstance(fd, str):
                        try:
                            fd = json.loads(fd)
                        except json.JSONDecodeError:
                            fd = {}
                    asset_id_val = req.get("id", req_id)[:8]
                    valid_categories = {'Laptop', 'Desktop', 'Server', 'Printer', 'Network Device', 'Firewall', 'Mobile Device', 'Software License'}
                    category = fd.get("category", "Laptop")
                    if category not in valid_categories:
                        category = "Laptop"
                    def _val(v):
                        return v if v else None
                    asset_rec = {
                        "asset_id": f"REQ-{asset_id_val}" if req["request_type"] == "hardware" else f"SW-{asset_id_val}",
                        "hostname": fd.get("model") or fd.get("name") or ("Requested Hardware" if req["request_type"] == "hardware" else "Software Asset"),
                        "category": "Software License" if req["request_type"] != "hardware" else category,
                        "serial_number": fd.get("serial_number") or (f"REQ-{req_id[:8]}" if req["request_type"] == "hardware" else f"LIC-{req_id[:8]}"),
                        "manufacturer": fd.get("manufacturer") or fd.get("publisher") or "Unknown",
                        "model": fd.get("model") or fd.get("name") or "Unknown",
                        "purchase_date": _val(fd.get("purchase_date") or fd.get("expiry_date")),
                        "employee_name": req["user_name"],
                        "employee_email": req["user_email"],
                        "status": "Allocated",
                        "os_name": "Unknown" if req["request_type"] == "hardware" else "N/A",
                        "os_version": "Unknown" if req["request_type"] == "hardware" else "N/A",
                        "ip_address": "Unknown" if req["request_type"] == "hardware" else "N/A",
                        "mac_address": "Unknown" if req["request_type"] == "hardware" else "N/A",
                        "cpu_model": "Unknown" if req["request_type"] == "hardware" else "N/A",
                        "cpu_cores": 0,
                        "ram_total": "Unknown" if req["request_type"] == "hardware" else "N/A",
                        "disks": [],
                        "software_inventory": [],
                        "last_seen": now_iso(),
                    }
                    created_asset = sb_insert("assets", asset_rec)
                    if not created_asset:
                        self._send_json(500, {"error": "Failed to create asset from request"})
                    else:
                        sb_update("asset_requests", "id", req_id, {"status": "approved", "reviewed_at": now_iso(), "reviewed_by": admin["email"], "admin_notes": payload.get("notes", "")})
                        if req["request_type"] != "hardware":
                            purchase_rec = {
                                "asset_id": created_asset["id"],
                                "purchase_date": _val(fd.get("purchase_date") or fd.get("expiry_date")),
                                "invoice_number": f"INV-{req_id[:8].upper()}",
                                "vendor": fd.get("publisher") or "Unknown Vendor",
                                "cost": float(fd.get("total_cost", 0)) if fd.get("total_cost") else 0,
                                "warranty_start": _val(fd.get("purchase_date") or fd.get("expiry_date")),
                                "warranty_end": _val(fd.get("expiry_date")),
                            }
                            sb_insert("purchases", purchase_rec)
                        notif = {
                            "user_email": req["user_email"],
                            "title": "Request Approved",
                            "message": f"Your {req['request_type']} request for \"{fd.get('name') or fd.get('model') or fd.get('category', 'item')}\" has been approved.",
                            "type": "request_approved",
                            "related_request_id": req_id,
                        }
                        sb_insert("notifications", notif)
                        self._send_json(200, {"status": "success"})

        elif len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "asset-requests" and path_parts[3] == "reject":
            admin = self._require_admin()
            if admin:
                req_id = path_parts[2]
                req = sb_select_one("asset_requests", "id", req_id)
                if not req:
                    self._send_json(404, {"error": "Request not found"})
                else:
                    sb_update("asset_requests", "id", req_id, {"status": "rejected", "reviewed_at": now_iso(), "reviewed_by": admin["email"], "admin_notes": payload.get("notes", "")})
                    fd = req.get("form_data", {})
                    notif = {
                        "user_email": req["user_email"],
                        "title": "Request Rejected",
                        "message": f"Your {req['request_type']} request for \"{fd.get('name') or fd.get('model') or fd.get('category', 'item')}\" has been rejected." + (f" Reason: {payload['notes']}" if payload.get("notes") else ""),
                        "type": "request_rejected",
                        "related_request_id": req_id,
                    }
                    sb_insert("notifications", notif)
                    self._send_json(200, {"status": "success"})

        elif len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "notifications" and path_parts[3] == "read":
            user = self._require_auth()
            if user:
                notif_id = path_parts[2]
                n = sb_select_one("notifications", "id", notif_id)
                if n and n.get("user_email") == user["email"]:
                    sb_update("notifications", "id", notif_id, {"is_read": True})
                self._send_json(200, {"status": "success"})

        elif (len(path_parts) == 5 and path_parts[0] == "api" and path_parts[1] == "admin"
              and path_parts[2] == "users" and path_parts[4] == "role"):
            admin = self._require_admin()
            if admin:
                target_email = urllib.parse.unquote(path_parts[3])
                new_role = payload.get("role", "")
                try:
                    result = auth_service.set_role(target_email, new_role, admin["email"])
                    self._send_json(200, result)
                except ValueError as e:
                    self._send_json(400, {"error": str(e)})

        elif len(path_parts) == 3 and path_parts[0] == "api" and path_parts[1] == "assets":
            admin = self._require_admin()
            if admin:
                asset_id = path_parts[2]
                existing = (sb_select_one("assets", "id", asset_id) or
                            sb_select_one("assets", "asset_id", asset_id))
                if not existing:
                    self._send_json(404, {"error": "Asset not found"})
                else:
                    allowed_fields = {
                        "hostname", "category", "manufacturer", "model",
                        "serial_number", "os_name", "os_version", "ip_address",
                        "mac_address", "cpu_model", "cpu_cores", "ram_total",
                        "disks", "software_inventory", "status",
                        "employee_name", "employee_email", "employee_id",
                        "company", "department", "location", "purchase_date",
                        "asset_tag", "vendor_name", "warranty_expiry",
                    }
                    updates = {k: v for k, v in payload.items() if k in allowed_fields}
                    if updates:
                        sb_update("assets", "id", existing["id"], updates)
                    self._send_json(200, {"status": "success", "asset": {**existing, **updates}})

        else:
            self._send_json(404, {"error": "Not found"})

    def do_DELETE(self):
        try:
            self._handle_delete()
        except Exception as e:
            logger.error(f"Unhandled error in DELETE {self.path}: {e}", exc_info=True)
            try:
                self._send_json(500, {"error": "Internal server error"})
            except Exception:
                pass

    def _handle_delete(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        path_parts = [p for p in path.split("/") if p]

        if len(path_parts) == 3 and path_parts[0] == "api" and path_parts[1] == "assets":
            asset_identifier = path_parts[2]
            asset = (sb_select_one("assets", "id", asset_identifier) or
                     sb_select_one("assets", "asset_id", asset_identifier))
            if asset:
                hostname = asset.get("hostname", "Unknown")
                sb_delete("assets", "id", asset["id"])
                sb_update("agents", "mac_address", asset.get("mac_address", ""), {"registration_status": "Unregistered"})
                history_entry = {
                    "event_type": "Disposal",
                    "description": f"Asset retired and permanently removed from catalog: {hostname}.",
                    "changed_by": "Administrator",
                }
                sb_insert("asset_history", history_entry)
                self._send_json(200, {"status": "success", "message": "Asset deleted successfully"})
            else:
                self._send_json(404, {"error": "Asset not found"})
        else:
            self._send_json(404, {"error": "Not found"})


def run(server_class=http.server.HTTPServer, handler_class=ITAMRequestHandler):
    server_address = ("", PORT)
    httpd = server_class(server_address, handler_class)
    logger.info(f"ITAM Central API Server running on port {PORT}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Stopping ITAM Central API Server...")
        httpd.server_close()


if __name__ == "__main__":
    run()
