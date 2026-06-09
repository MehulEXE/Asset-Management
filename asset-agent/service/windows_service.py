import os
import sys
import time
import logging
import win32serviceutil  # type: ignore
import win32service # type: ignore
import win32event #type:ignore
import servicemanager  # type: ignore
import pythoncom

# Make sure agent modules are importable (works in both source and frozen EXE)
if getattr(sys, 'frozen', False):
    sys.path.insert(0, sys._MEIPASS)
else:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.config_manager import ConfigManager
from main import AssetAgent, setup_logging

logger = logging.getLogger("AssetAgent")

class AssetDiscoveryAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "AssetAgent"
    _svc_display_name_ = "Asset Discovery Agent"
    _svc_description_ = (
        "Automatically collects hardware, operating system, network, "
        "and software inventory, and securely reports it to central Asset Management."
    )

    def __init__(self, args):
        super().__init__(args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.is_running = True

        # Initialize configurations and logging
        self.config_mgr = ConfigManager()
        setup_logging(self.config_mgr.config["log_dir"])
        self.agent = AssetAgent(self.config_mgr)

    def SvcStop(self):
        logger.info("Service stop request received. Initiating shutdown procedure...")
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        self.is_running = False
        win32event.SetEvent(self.hWaitStop)

    def SvcDoRun(self):
        logger.info("--- Windows Asset Discovery Agent Service Starting ---")
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, "")
        )
        
        # Initialize COM for the service main thread
        pythoncom.CoInitialize()
        
        try:
            # Set schedules
            checkin_hours = float(self.agent.config.get("checkin_interval_hours", 24))
            heartbeat_mins = float(self.agent.config.get("heartbeat_interval_minutes", 30))
            
            checkin_interval = checkin_hours * 3600
            heartbeat_interval = heartbeat_mins * 60
            
            # Perform initial inventory check-in and heartbeat immediately on startup
            logger.info("Executing initial startup check-in and heartbeat...")
            try:
                self.agent.perform_full_inventory()
            except Exception as inv_err:
                logger.error(f"Initial inventory check-in failed (will retry next cycle): {inv_err}", exc_info=True)
            try:
                self.agent.perform_heartbeat()
            except Exception as hb_err:
                logger.error(f"Initial heartbeat failed (will retry next cycle): {hb_err}", exc_info=True)
            
            last_checkin = time.time()
            last_heartbeat = time.time()
            
            # The main service execution loop
            # Sleep 5 seconds at a time to listen for service stop commands responsively
            check_interval_ms = 5000
            
            while self.is_running:
                # Wait on stop event. If stop event is fired, WaitForSingleObject returns immediately (0).
                # Otherwise, it times out after check_interval_ms.
                rc = win32event.WaitForSingleObject(self.hWaitStop, check_interval_ms)
                if rc == win32event.WAIT_OBJECT_0:
                    logger.info("Service stop signal detected in main loop.")
                    break
                
                # Check schedules
                now = time.time()
                
                if now - last_checkin >= checkin_interval:
                    try:
                        self.agent.perform_full_inventory()
                    except Exception as inv_err:
                        logger.error(f"Scheduled inventory failed (will retry next cycle): {inv_err}", exc_info=True)
                    last_checkin = now
                    
                if now - last_heartbeat >= heartbeat_interval:
                    try:
                        self.agent.perform_heartbeat()
                    except Exception as hb_err:
                        logger.error(f"Scheduled heartbeat failed (will retry next cycle): {hb_err}", exc_info=True)
                    last_heartbeat = now
                    
        except Exception as e:
            logger.critical(f"Unhandled exception in service main thread: {e}", exc_info=True)
            servicemanager.LogErrorMsg(f"AssetAgent service error: {e}")
        finally:
            pythoncom.CoUninitialize()
            logger.info("--- Windows Asset Discovery Agent Service Stopped ---")
            servicemanager.LogMsg(
                servicemanager.EVENTLOG_INFORMATION_TYPE,
                servicemanager.PYS_SERVICE_STOPPED,
                (self._svc_name_, "")
            )

def show_menu():
    print("=" * 60)
    print("  ASSET DISCOVERY AGENT — Setup & Management")
    print("=" * 60)
    print()
    print("  1) Install & Start Service  (requires Admin)")
    print("  2) Start Service            (requires Admin)")
    print("  3) Stop Service             (requires Admin)")
    print("  4) Remove Service           (requires Admin)")
    print("  5) Run Agent in Console     (for testing)")
    print("  6) Exit")
    print()
    return input("  Select an option [1-6]: ").strip()


def handle_menu_choice(choice: str):
    import subprocess
    exe = sys.executable if hasattr(sys, "frozen") else sys.argv[0]
    if choice == "1":
        print("\n>> Installing service (auto-start) ...")
        subprocess.call([exe, "--startup=auto", "install"])
        print("\n>> Starting service ...")
        subprocess.call([exe, "start"])
    elif choice == "2":
        subprocess.call([exe, "start"])
    elif choice == "3":
        subprocess.call([exe, "stop"])
    elif choice == "4":
        print("\n>> Stopping service ...")
        subprocess.call([exe, "stop"])
        print("\n>> Removing service ...")
        subprocess.call([exe, "remove"])
    elif choice == "5":
        print("\n>> Running agent in console (debug mode) ...")
        sys.argv = [sys.argv[0], "debug"]
        win32serviceutil.HandleCommandLine(AssetDiscoveryAgentService)
    else:
        return False
    return True


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("install", "start", "stop", "remove", "debug"):
        win32serviceutil.HandleCommandLine(AssetDiscoveryAgentService)
    elif len(sys.argv) > 1:
        win32serviceutil.HandleCommandLine(AssetDiscoveryAgentService)
    else:
        try:
            servicemanager.Initialize()
            servicemanager.PrepareToHostSingle(AssetDiscoveryAgentService)
            servicemanager.StartServiceCtrlDispatcher()
        except Exception:
            pass

        while True:
            try:
                choice = show_menu()
                if not handle_menu_choice(choice):
                    break
            except (KeyboardInterrupt, EOFError):
                break
            print()
            input("Press Enter to continue ...")

        print("\nExiting. Goodbye!")

