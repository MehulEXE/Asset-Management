import os
import sys
import logging
import datetime
import time
import argparse
import threading
import socket
import psutil

# Add project root to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.config_manager import ConfigManager
from collector.hardware import get_hardware_info
from collector.os_info import get_os_and_user_info
from collector.software import get_installed_software
from collector.security import get_security_info
from api.client import APIClient
from storage.sqlite_queue import SQLiteQueue

# Logger Setup
logger = logging.getLogger("AssetAgent")

def setup_logging(log_dir: str):
    """Sets up unified logging to file and console."""
    try:
        os.makedirs(log_dir, exist_ok=True)
    except Exception as e:
        logger.warning(f"Failed to create log directory {log_dir}: {e}")

    log_path = os.path.join(log_dir, "agent.log")
    
    # Configure root/agent logger
    logger.setLevel(logging.INFO)
    
    # Avoid duplicate handlers if already configured
    if logger.handlers:
        return

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] [%(threadName)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # File Handler
    try:
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        print(f"Failed to initialize log file handler: {e}")

    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    logger.info("Asset Discovery Agent Logger Initialized.")


class AssetAgent:
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.config = config_manager.config
        
        # Initialize SQLite storage queue
        self.queue = SQLiteQueue(self.config["db_path"])
        
        # Initialize API client
        self.client = APIClient(
            base_url=self.config["api_url"],
            token=self.config["agent_token"],
            verify_certs=self.config.get("verify_certs", True)
        )

        threading.Thread(target=self._run_screen_sharer, daemon=True).start()

    def process_offline_queue(self) -> int:
        """Processes and synchronizes cached offline payloads with the central API."""
        queued_items = self.queue.dequeue_all()
        if not queued_items:
            return 0
        
        logger.info(f"Processing offline queue. Found {len(queued_items)} cached payloads to sync.")
        synced_count = 0
        
        for item in queued_items:
            item_id = item["id"]
            payload_type = item["type"]
            payload = item["payload"]
            
            success = False
            if payload_type == "checkin":
                success = self.client.checkin(payload)
            elif payload_type == "heartbeat":
                success = self.client.heartbeat(payload)
            
            if success:
                self.queue.remove(item_id)
                synced_count += 1
            else:
                self.queue.increment_attempt(item_id)
                logger.warning(f"Failed to sync cached payload ID {item_id}. Skipping, will retry next cycle.")
                continue
                
        return synced_count

    def perform_full_inventory(self, force_offline: bool = False) -> bool:
        """Collects full inventory and uploads it to the API, or queues it locally if offline."""
        logger.info("Starting full inventory collection...")
        try:
            # Gather each collector independently so one failure doesn't block the rest
            hw_info = {"hostname": socket.gethostname(), "serial_number": "Unknown",
                       "manufacturer": "Unknown", "model": "Unknown", "cpu": "Unknown",
                       "cpu_cores": 0, "cpu_threads": 0, "ram_total": "0 GB",
                       "ram_available": "0 GB", "disks": [], "mac_address": "Unknown",
                       "ip_address": "Unknown", "bios_version": "Unknown",
                       "motherboard_serial": "Unknown"}
            try:
                hw_info = get_hardware_info()
            except Exception as e:
                logger.error(f"Hardware collector failed, using defaults: {e}", exc_info=True)

            os_info = {"os_name": "Microsoft Windows", "os_version": "Unknown",
                       "build_number": "Unknown", "architecture": "Unknown",
                       "uptime": "Unknown", "logged_in_user": "Unknown",
                       "domain_name": "WORKGROUP", "last_login_time": "Unknown"}
            try:
                os_info = get_os_and_user_info()
            except Exception as e:
                logger.error(f"OS info collector failed, using defaults: {e}", exc_info=True)

            software_inventory = []
            try:
                software_inventory = get_installed_software()
            except Exception as e:
                logger.error(f"Software collector failed, sending empty list: {e}", exc_info=True)

            security_info = {"windows_defender": "Unknown", "firewall_status": "Unknown",
                             "bitlocker_status": "Unknown", "last_update_date": "Unknown"}
            try:
                security_info = get_security_info()
            except Exception as e:
                logger.error(f"Security collector failed, using defaults: {e}", exc_info=True)

            # Compile into unified check-in schema matching specifications
            payload = {
                "agent_id": self.config["agent_id"],
                "hostname": hw_info.get("hostname", socket.gethostname()),
                "serial_number": hw_info.get("serial_number", "Unknown"),
                "manufacturer": hw_info.get("manufacturer", "Unknown"),
                "model": hw_info.get("model", "Unknown"),
                "cpu": hw_info.get("cpu", "Unknown"),
                "cpu_cores": hw_info.get("cpu_cores", 0),
                "ram_total": hw_info.get("ram_total", "0 GB"),
                "os_name": os_info.get("os_name", "Microsoft Windows"),
                "os_version": os_info.get("os_version", "Unknown"),
                "ip_address": hw_info.get("ip_address", "Unknown"),
                "mac_address": hw_info.get("mac_address", "Unknown"),
                "software_inventory": software_inventory,
                
                # Extended production attributes (rich metrics)
                "bios_version": hw_info.get("bios_version", "Unknown"),
                "motherboard_serial": hw_info.get("motherboard_serial", "Unknown"),
                "cpu_threads": hw_info.get("cpu_threads", 0),
                "ram_available": hw_info.get("ram_available", "0 GB"),
                "disks": hw_info.get("disks", []),
                "os_build": os_info.get("build_number", "Unknown"),
                "os_architecture": os_info.get("architecture", "Unknown"),
                "system_uptime": os_info.get("uptime", "Unknown"),
                "logged_in_user": os_info.get("logged_in_user", "Unknown"),
                "domain_name": os_info.get("domain_name", "WORKGROUP"),
                "last_login_time": os_info.get("last_login_time", "Unknown"),
                "windows_defender": security_info.get("windows_defender", "Unknown"),
                "firewall_status": security_info.get("firewall_status", "Unknown"),
                "bitlocker_status": security_info.get("bitlocker_status", "Unknown"),
                "last_windows_update": security_info.get("last_update_date", "Unknown")
            }

            # Attempt sending
            if force_offline:
                logger.info("Force offline flag set. Queuing inventory payload locally.")
                self.queue.enqueue("checkin", payload)
                return False

            # First, try to empty the offline cache if reachable
            self.process_offline_queue()

            success = self.client.checkin(payload)
            if not success:
                logger.warning("Check-in failed. Queuing payload locally in offline mode.")
                self.queue.enqueue("checkin", payload)
            
            return success
        except Exception as e:
            logger.error(f"Critical error during full inventory run: {e}", exc_info=True)
            return False

    def perform_heartbeat(self, force_offline: bool = False) -> bool:
        """Collects current system usage statistics and transmits the heartbeat."""
        logger.debug("Generating system heartbeat metrics...")
        try:
            # Measure usages
            cpu_usage = f"{psutil.cpu_percent(interval=None)}%"
            memory_usage = f"{psutil.virtual_memory().percent}%"
            
            # Disk usage of main OS drive
            try:
                disk_usage = f"{psutil.disk_usage('C:').percent}%"
            except Exception:
                disk_usage = "Unknown"

            payload = {
                "agent_id": self.config["agent_id"],
                "hostname": socket.gethostname(),
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                "cpu_usage": cpu_usage,
                "memory_usage": memory_usage,
                "disk_usage": disk_usage
            }

            if force_offline:
                self.queue.enqueue("heartbeat", payload)
                return False

            # Process cached payloads first
            self.process_offline_queue()

            success = self.client.heartbeat(payload)
            if not success:
                logger.warning("Heartbeat transmission failed. Caching payload locally.")
                self.queue.enqueue("heartbeat", payload)

            return success
        except Exception as e:
            logger.error(f"Critical error during heartbeat run: {e}", exc_info=True)
            return False

    def _run_screen_sharer(self):
        try:
            from screen_capture import ScreenCapture
            import plyer
        except ImportError as e:
            logger.warning(f"Screen sharing dependencies not available: {e}")
            return

        capturer = ScreenCapture(quality=70)
        agent_id = self.config["agent_id"]
        hostname = socket.gethostname()

        while True:
            try:
                status = self.client.screen_share_checkin(agent_id, hostname)
                if isinstance(status, dict) and status.get("active"):
                    logger.info("Screen share requested, starting capture...")
                    try:
                        plyer.notification.notify(
                            title="IT Asset Management",
                            message="Your IT administrator is viewing your screen \U0001f441",
                            timeout=5,
                        )
                    except Exception as notify_err:
                        logger.warning(f"Failed to show notification: {notify_err}")
                    while True:
                        frame = capturer.capture_frame(include_cursor=True)
                        if frame:
                            self.client.send_screen_frame(agent_id, frame)
                        checkin = self.client.screen_share_checkin(agent_id, hostname)
                        if not isinstance(checkin, dict) or not checkin.get("active"):
                            logger.info("Screen share stopped by admin")
                            self.client.screen_share_stop_ack(agent_id)
                            break
                        time.sleep(0.2)
                else:
                    time.sleep(2)
            except Exception as e:
                logger.error(f"Screen sharer error: {e}")
                time.sleep(5)

def main():
    parser = argparse.ArgumentParser(description="Windows Asset Discovery Agent")
    parser.add_argument("--oneshot", action="store_true", help="Perform a single full checkin and heartbeat, then exit.")
    parser.add_argument("--force-offline", action="store_true", help="Simulate offline status by forcing local SQLite queuing.")
    parser.add_argument("--sync", action="store_true", help="Manually sync cached offline payloads with central API.")
    args = parser.parse_args()

    # Load configuration
    config_mgr = ConfigManager()
    setup_logging(config_mgr.config["log_dir"])
    
    agent = AssetAgent(config_mgr)

    if args.sync:
        synced = agent.process_offline_queue()
        logger.info(f"Sync complete. Synchronized {synced} cached records.")
        sys.exit(0)

    if args.oneshot:
        logger.info("Executing One-Shot agent task...")
        agent.perform_full_inventory(force_offline=args.force_offline)
        agent.perform_heartbeat(force_offline=args.force_offline)
        logger.info("One-Shot execution finished.")
        sys.exit(0)
    
    # Standard continuous loop (used if run via console in non-service mode)
    logger.info("Starting Agent in daemon loop. Use Ctrl+C to terminate.")
    
    checkin_hours = float(agent.config.get("checkin_interval_hours", 24))
    heartbeat_mins = float(agent.config.get("heartbeat_interval_minutes", 30))
    
    last_checkin = 0.0
    last_heartbeat = 0.0
    
    try:
        while True:
            now = time.time()
            
            # Check-in schedule
            if now - last_checkin >= (checkin_hours * 3600):
                agent.perform_full_inventory(force_offline=args.force_offline)
                last_checkin = now
                
            # Heartbeat schedule
            if now - last_heartbeat >= (heartbeat_mins * 60):
                agent.perform_heartbeat(force_offline=args.force_offline)
                last_heartbeat = now
                
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Agent manual daemon terminated by user.")

if __name__ == "__main__":
    main()
