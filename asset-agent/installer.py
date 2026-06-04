import os
import sys
import shutil
import ctypes
import subprocess
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AssetAgentInstaller")

INSTALL_DIR = r"C:\Program Files\AssetAgent"
CONFIG_DIR = os.path.join(INSTALL_DIR, "config")
SERVICE_SRC_FILE = "windows_service.py"

def is_admin():
    """Check if the current script is running with administrative privileges."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def run_cmd(args, check=True):
    """Safely runs a command shell and returns result."""
    try:
        res = subprocess.run(args, capture_output=True, text=True, check=check)
        return res.stdout, res.stderr
    except subprocess.CalledProcessError as e:
        logger.error(f"Command {' '.join(args)} failed: {e.stderr}")
        if check:
            raise
        return "", e.stderr

def install():
    logger.info("Starting Asset Discovery Agent installation...")
    
    if not is_admin():
        logger.error("Installation FAILED: This installer must be run with Administrator privileges!")
        sys.exit(1)

    # 1. Create directory structure
    logger.info(f"Creating installation directory: {INSTALL_DIR}")
    os.makedirs(INSTALL_DIR, exist_ok=True)
    os.makedirs(CONFIG_DIR, exist_ok=True)

    # 2. Copy code files to destination
    logger.info("Copying agent application files...")
    src_dir = os.path.dirname(os.path.abspath(__file__))
    
    # We copy main modules and folder directories
    items_to_copy = ["collector", "api", "storage", "config", "service", "main.py", "screen_capture.py"]
    for item in items_to_copy:
        src_path = os.path.join(src_dir, item)
        dest_path = os.path.join(INSTALL_DIR, item)
        
        if not os.path.exists(src_path):
            continue
            
        try:
            if os.path.isdir(src_path):
                if os.path.exists(dest_path):
                    shutil.rmtree(dest_path)
                shutil.copytree(src_path, dest_path)
            else:
                shutil.copy2(src_path, dest_path)
            logger.info(f"Copied: {item}")
        except Exception as e:
            logger.error(f"Failed to copy {item}: {e}")
            sys.exit(1)

    # 3. Create persistent directories in C:\ProgramData for database and logs
    programdata_dir = r"C:\ProgramData\AssetAgent"
    os.makedirs(os.path.join(programdata_dir, "logs"), exist_ok=True)
    logger.info(f"Configured persistent storage and logs at: {programdata_dir}")

    # 4. Register the Windows Service using the copied service wrapper
    logger.info("Registering Windows Service...")
    service_py_path = os.path.join(INSTALL_DIR, "service", "windows_service.py")
    
    # We use python to register the service with pywin32
    python_exe = sys.executable
    try:
        run_cmd([python_exe, service_py_path, "--startup=auto", "install"])
        logger.info("Service registered successfully with Automatic startup.")
    except Exception as e:
        logger.error(f"Failed to register service: {e}")
        sys.exit(1)

    # 5. Start the Service
    logger.info("Starting the Asset Discovery Agent service...")
    try:
        run_cmd([python_exe, service_py_path, "start"])
        logger.info("Service started successfully!")
    except Exception as e:
        logger.warning(f"Service registration was successful, but auto-start failed: {e}. You can start it manually from services.msc.")

    logger.info("Installation completed successfully!")


def uninstall():
    logger.info("Starting Asset Discovery Agent uninstallation...")
    
    if not is_admin():
        logger.error("Uninstallation FAILED: Must be run with Administrator privileges!")
        sys.exit(1)

    service_py_path = os.path.join(INSTALL_DIR, "service", "windows_service.py")
    python_exe = sys.executable

    # 1. Stop and Remove Service
    if os.path.exists(service_py_path):
        logger.info("Stopping and removing Windows Service...")
        try:
            run_cmd([python_exe, service_py_path, "stop"], check=False)
            run_cmd([python_exe, service_py_path, "remove"], check=False)
            logger.info("Service stopped and removed.")
        except Exception as e:
            logger.error(f"Failed to remove service gracefully: {e}")
    else:
        # Fallback to standard sc command
        logger.info("Service script not found, trying fallback sc.exe commands...")
        run_cmd(["sc.exe", "stop", "AssetAgent"], check=False)
        run_cmd(["sc.exe", "delete", "AssetAgent"], check=False)

    # 2. Delete installation directory
    if os.path.exists(INSTALL_DIR):
        logger.info(f"Removing files from {INSTALL_DIR}")
        try:
            shutil.rmtree(INSTALL_DIR)
            logger.info("Application files deleted.")
        except Exception as e:
            logger.error(f"Could not remove all files in installation directory: {e}")

    logger.info("Uninstallation completed successfully! (Logs and SQLite queue in C:\\ProgramData\\AssetAgent are preserved).")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--uninstall":
        uninstall()
    else:
        install()
