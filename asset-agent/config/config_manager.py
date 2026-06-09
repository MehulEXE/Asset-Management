import os
import json
import logging
import random
import sys

try:
    import win32crypt
    HAS_DPAPI = True
except ImportError:
    HAS_DPAPI = False

logger = logging.getLogger("AssetAgent")

def _resolve_config_path():
    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
        local = os.path.join(exe_dir, "config", "config.json")
        if os.path.exists(local):
            return local
        return os.path.join(sys._MEIPASS, "config", "config.json")
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

class ConfigManager:
    def __init__(self, config_path=None):
        self.config_path = config_path or _resolve_config_path()
        self.config = {
            "api_url": "https://asset-management-gciq.onrender.com",
            "agent_token": "DEFAULT_API_TOKEN",
            "checkin_interval_hours": 24,
            "heartbeat_interval_minutes": 30,
            "agent_id": "",
            "db_path": r"C:\ProgramData\AssetAgent\storage.db",
            "log_dir": r"C:\ProgramData\AssetAgent\logs",
            "verify_certs": False,  # Default to False for self-signed certificates unless explicitly requested
            "encrypted": False
        }
        self.load_config()

    def generate_agent_id(self) -> str:
        """Generates a unique Agent ID in the format AGENT-WIN-000001."""
        num = random.randint(1, 999999)
        return f"AGENT-WIN-{num:06d}"

    def encrypt_val(self, val: str) -> str:
        """Encrypts a string using Windows DPAPI machine-wide scope."""
        if not val or not HAS_DPAPI:
            return val
        try:
            val_bytes = val.encode("utf-8")
            # 1 = CRYPTPROTECT_LOCAL_MACHINE (allows any local system process/service to decrypt)
            encrypted = win32crypt.CryptProtectData(val_bytes, "AssetAgentKey", None, None, None, 1)
            # Return as hex string for easy JSON storage
            return encrypted.hex()
        except Exception as e:
            logger.error(f"DPAPI encryption failed: {e}")
            return val

    def decrypt_val(self, encrypted_hex: str) -> str:
        """Decrypts a hex-encoded string using Windows DPAPI."""
        if not encrypted_hex or not HAS_DPAPI:
            return encrypted_hex
        try:
            encrypted_bytes = bytes.fromhex(encrypted_hex)
            _, decrypted = win32crypt.CryptUnprotectData(encrypted_bytes, None, None, None, 0)
            return decrypted.decode("utf-8")
        except Exception as e:
            logger.warning(f"DPAPI decryption failed (token may be plaintext): {e}")
            return encrypted_hex

    def load_config(self):
        """Loads configuration from file and initializes missing fields."""
        changed = False
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    file_data = json.load(f)
                
                # Update config dictionary with file data
                self.config.update(file_data)
                
                # Decrypt sensitive fields if marked as encrypted
                if self.config.get("encrypted", False):
                    raw_token = self.config["agent_token"]
                    decrypted = self.decrypt_val(raw_token)
                    
                    # Validate decrypted token — if DPAPI fails (e.g. config moved to
                    # a different machine), decrypt_val returns the raw hex string.
                    # A valid token should NOT be a long hex-only string.
                    if decrypted == raw_token and len(raw_token) > 50 and all(c in '0123456789abcdefABCDEF' for c in raw_token):
                        logger.error(
                            "DPAPI decryption failed — the agent token appears to be an "
                            "encrypted blob that could not be decrypted on this machine. "
                            "This typically happens when config.json was copied from another "
                            "machine. The agent will re-encrypt with the correct token."
                        )
                        # Restore the default plaintext token so the agent can still function
                        self.config["agent_token"] = "key_prod_win_agent_d43f721a"
                        self.config["encrypted"] = False
                        changed = True
                    else:
                        self.config["agent_token"] = decrypted
                
            except Exception as e:
                logger.error(f"Failed to load config: {e}. Reverting to default values.")

        # Ensure Agent ID exists and persists
        if not self.config.get("agent_id"):
            self.config["agent_id"] = self.generate_agent_id()
            changed = True

        # Ensure directories exist
        log_dir = self.config.get("log_dir")
        if log_dir and not os.path.exists(log_dir):
            try:
                os.makedirs(log_dir, exist_ok=True)
            except Exception as dir_err:
                logger.warning(f"Failed to create log directory {log_dir}: {dir_err}")

        if changed:
            self.save_config()

    def save_config(self):
        """Saves current configuration to file, encrypting sensitive fields."""
        try:
            # We clone the config to encrypt before saving
            export_config = self.config.copy()
            
            if HAS_DPAPI and not export_config.get("encrypted", False):
                # Encrypt token
                token = export_config.get("agent_token", "")
                if token and token != "DEFAULT_API_TOKEN":
                    export_config["agent_token"] = self.encrypt_val(token)
                    export_config["encrypted"] = True

            # Ensure parent directories exist
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)

            with open(self.config_path, "w") as f:
                json.dump(export_config, f, indent=4)
                
            logger.info("Configuration saved successfully.")
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")

if __name__ == "__main__":
    # Test execution
    logging.basicConfig(level=logging.INFO)
    mgr = ConfigManager()
    print("Agent ID:", mgr.config["agent_id"])
    print("API Token:", mgr.config["agent_token"])
    mgr.save_config()
