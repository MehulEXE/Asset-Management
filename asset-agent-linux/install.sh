#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo "  ITAM Linux Asset Discovery Agent Installer"
echo "============================================"

if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This installer must be run as root (sudo)." >&2
    exit 1
fi

# Detect URL — use env var or default to the same API that served this script
BASE_URL="${INSTALLER_BASE_URL:-https://asset-management-gciq.onrender.com}"
TARBALL_URL="$BASE_URL/api/v1/download/linux/tarball"
AGENT_DIR="/opt/asset-agent"
CONFIG_DIR="/etc/asset-agent"
DATA_DIR="/var/lib/asset-agent"
LOG_DIR="/var/log/asset-agent"
SERVICE_USER="assetagent"

# Install system deps
echo ""
echo "[1/6] Installing system dependencies..."
if command -v apt-get &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq python3 python3-pip dmidecode curl 2>/dev/null || true
elif command -v dnf &>/dev/null; then
    dnf install -y python3 python3-pip dmidecode curl
elif command -v yum &>/dev/null; then
    yum install -y python3 python3-pip dmidecode curl
fi

# Download agent package
echo ""
echo "[2/6] Downloading agent package..."
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

curl -sL "$TARBALL_URL" -o "$TMP_DIR/agent.tar.gz"
if [ ! -s "$TMP_DIR/agent.tar.gz" ]; then
    echo "Error: Failed to download agent from $TARBALL_URL" >&2
    exit 1
fi
tar -xzf "$TMP_DIR/agent.tar.gz" -C "$TMP_DIR"

# Create user
echo "[3/6] Creating service user..."
id -u "$SERVICE_USER" &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"

# Create directories
echo "[4/6] Creating directories..."
mkdir -p "$AGENT_DIR" "$CONFIG_DIR" "$DATA_DIR" "$LOG_DIR"
cp -r "$TMP_DIR"/* "$AGENT_DIR/"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR" "$LOG_DIR"
chmod -R 755 "$AGENT_DIR"

# Install pip deps
echo "[5/6] Installing Python dependencies..."
python3 -m pip install --upgrade pip --quiet
python3 -m pip install -r "$AGENT_DIR/requirements.txt" --quiet

# Create systemd service
echo "[6/6] Creating systemd service..."
cat > /etc/systemd/system/asset-agent.service << 'EOF'
[Unit]
Description=ITAM Asset Discovery Agent (Linux)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=assetagent
Group=assetagent
WorkingDirectory=/opt/asset-agent
ExecStart=/usr/bin/python3 /opt/asset-agent/main.py
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/asset-agent/agent.log
StandardError=append:/var/log/asset-agent/agent.log
Environment=ASSET_AGENT_CONFIG=/etc/asset-agent/config.json

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload

# Write default config if not exists
if [ ! -f "$CONFIG_DIR/config.json" ]; then
    cat > "$CONFIG_DIR/config.json" << 'CONFIGEOF'
{
    "api_url": "https://asset-management-gciq.onrender.com",
    "agent_token": "key_prod_win_agent_d43f721a",
    "checkin_interval_hours": 24,
    "heartbeat_interval_minutes": 30,
    "agent_id": "",
    "db_path": "/var/lib/asset-agent/storage.db",
    "log_dir": "/var/log/asset-agent",
    "verify_certs": false
}
CONFIGEOF
    echo "  Agent token pre-configured. No manual editing needed."
fi

echo ""
echo "============================================"
echo "  Installation Complete!"
echo "============================================"
echo ""
echo "  sudo systemctl start  asset-agent"
echo "  sudo systemctl enable asset-agent"
echo "  sudo tail -f /var/log/asset-agent/agent.log"
echo "  sudo python3 /opt/asset-agent/main.py --oneshot"
echo ""
