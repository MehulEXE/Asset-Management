import os
import json
import logging
import random
import sys

logger = logging.getLogger("AssetAgent")

CONFIG_DIR = "/etc/asset-agent"
DATA_DIR = "/var/lib/asset-agent"
LOG_DIR = "/var/log/asset-agent"
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")


def _resolve_config_path():
    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
        local = os.path.join(exe_dir, "config", "config.json")
        if os.path.exists(local):
            return local
        return os.path.join(exe_dir, "config", "config.json")
    override = os.environ.get("ASSET_AGENT_CONFIG")
    if override:
        return override
    return CONFIG_FILE


class ConfigManager:
    def __init__(self, config_path=None):
        self.config_path = config_path or _resolve_config_path()
        self.config = {
            "api_url": "https://asset-management-gciq.onrender.com",
            "agent_token": "key_prod_win_agent_d43f721a",
            "checkin_interval_hours": 24,
            "heartbeat_interval_minutes": 30,
            "agent_id": "",
            "db_path": os.path.join(DATA_DIR, "storage.db"),
            "log_dir": LOG_DIR,
            "verify_certs": False
        }
        self.load_config()

    def generate_agent_id(self) -> str:
        num = random.randint(1, 999999)
        return f"AGENT-LNX-{num:06d}"

    def load_config(self):
        changed = False
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    file_data = json.load(f)
                self.config.update(file_data)
            except Exception as e:
                logger.error(f"Failed to load config: {e}. Reverting to default values.")

        if not self.config.get("agent_id"):
            self.config["agent_id"] = self.generate_agent_id()
            changed = True

        log_dir = self.config.get("log_dir")
        if log_dir and not os.path.exists(log_dir):
            try:
                os.makedirs(log_dir, exist_ok=True)
            except PermissionError:
                logger.warning(f"No permission to create log directory {log_dir}. Logging to console only.")
            except Exception as dir_err:
                logger.warning(f"Failed to create log directory {log_dir}: {dir_err}")

        if changed:
            self.save_config()

    def save_config(self):
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            with open(self.config_path, "w") as f:
                json.dump(self.config, f, indent=4)
            logger.info(f"Configuration saved to {self.config_path}")
        except PermissionError:
            logger.warning(f"No permission to write config to {self.config_path}. Run with sudo or set ASSET_AGENT_CONFIG env var.")
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    mgr = ConfigManager()
    print("Agent ID:", mgr.config["agent_id"])
    print("Config path:", mgr.config_path)
    print("DB path:", mgr.config["db_path"])
    print("Log dir:", mgr.config["log_dir"])
