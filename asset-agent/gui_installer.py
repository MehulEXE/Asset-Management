import os
import sys
import shutil
import ctypes
import subprocess
import json
import random
import time

INSTALL_DIR = r"C:\Program Files\AssetAgent"
CONFIG_DIR = os.path.join(INSTALL_DIR, "config")
DATA_DIR = r"C:\ProgramData\AssetAgent"
SERVICE_EXE_NAME = "AssetAgentService.exe"

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def elevate():
    ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, subprocess.list2cmdline(sys.argv), None, 1)
    sys.exit(0)

def run_cmd(args, check=True):
    try:
        res = subprocess.run(args, capture_output=True, text=True, check=check)
        return res.stdout, res.stderr
    except subprocess.CalledProcessError as e:
        print(f"  FAILED: {' '.join(args)}")
        print(f"  {e.stderr}")
        if check:
            raise
        return "", e.stderr

def generate_agent_id():
    num = random.randint(1, 999999)
    return f"AGENT-WIN-{num:06d}"

def main():
    print("=" * 60)
    print("  Asset Discovery Agent - Setup")
    print("=" * 60)
    print()

    if not is_admin():
        print("Requesting administrator privileges...")
        time.sleep(0.5)
        elevate()
        return

    if getattr(sys, 'frozen', False):
        src = sys._MEIPASS
    else:
        src = os.path.dirname(os.path.abspath(__file__))

    print(f"[1/5] Creating installation directory...")
    os.makedirs(CONFIG_DIR, exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "logs"), exist_ok=True)
    print(f"    Target: {INSTALL_DIR}")

    print(f"[2/5] Deploying agent service binary...")
    service_src = os.path.join(src, SERVICE_EXE_NAME)
    service_dst = os.path.join(INSTALL_DIR, SERVICE_EXE_NAME)
    if os.path.exists(service_src):
        shutil.copy2(service_src, service_dst)
        size_mb = os.path.getsize(service_src) / (1024 * 1024)
        print(f"    Deployed {SERVICE_EXE_NAME} ({size_mb:.1f} MB)")
    else:
        print(f"  ERROR: {SERVICE_EXE_NAME} not found in bundle!")
        input("Press Enter to exit...")
        sys.exit(1)

    print(f"[3/5] Generating agent configuration...")
    config = {
        "api_url": "https://asset-management-gciq.onrender.com",
        "agent_token": "",
        "checkin_interval_hours": 24,
        "heartbeat_interval_minutes": 30,
        "agent_id": generate_agent_id(),
        "db_path": os.path.join(DATA_DIR, "storage.db"),
        "log_dir": os.path.join(DATA_DIR, "logs"),
        "verify_certs": False,
        "encrypted": False
    }
    config_path = os.path.join(CONFIG_DIR, "config.json")
    with open(config_path, "w") as f:
        json.dump(config, f, indent=4)
    print(f"    Agent ID: {config['agent_id']}")
    print(f"    API URL:  {config['api_url']}")
    print(f"    Config:   {config_path}")

    print(f"[4/5] Registering Windows Service...")
    print(f"    Running: {service_dst} install")
    run_cmd([service_dst, "--startup=auto", "install"], check=False)
    print(f"    Service 'AssetAgent' registered successfully")

    print(f"[5/5] Starting Windows Service...")
    print(f"    Running: {service_dst} start")
    run_cmd([service_dst, "start"], check=False)
    print(f"    Service started")

    print()
    print("=" * 60)
    print("  INSTALLATION COMPLETE")
    print("=" * 60)
    print(f"  Agent ID:     {config['agent_id']}")
    print(f"  Service Name: AssetAgent")
    print(f"  Display Name: Asset Discovery Agent")
    print(f"  Binary Path:  {service_dst}")
    print()
    print("  The agent is now running and will report")
    print("  hardware/software inventory to the API server.")
    print("=" * 60)
    print()
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
