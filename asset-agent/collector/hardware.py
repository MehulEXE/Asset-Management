import os
import socket
import logging
import psutil
import uuid
import re

# WMI & PythonCOM (for running safely within threads/services)
try:
    import pythoncom
    import wmi
    HAS_WMI = True
except ImportError:
    HAS_WMI = False

logger = logging.getLogger("AssetAgent")

def get_wmi_connection():
    """Helper to initialize WMI inside a thread with proper COM initialization."""
    if not HAS_WMI:
        return None
    try:
        pythoncom.CoInitialize()
        return wmi.WMI()
    except Exception as e:
        logger.error(f"Failed to initialize WMI: {e}")
        return None

def release_wmi_connection():
    """Helper to release WMI/COM resources."""
    if HAS_WMI:
        try:
            pythoncom.CoUninitialize()
        except Exception as e:
            logger.warning(f"Failed to release WMI/COM resources: {e}")

def clean_value(val):
    """Normalize and clean string values, stripping extra whitespaces."""
    if val is None:
        return "Unknown"
    s = str(val).strip()
    return s if s and s.lower() != "none" else "Unknown"

def get_hardware_info():
    """Gathers all system hardware details with safe WMI & psutil fallbacks."""
    info = {
        "hostname": socket.gethostname(),
        "serial_number": "Unknown",
        "manufacturer": "Unknown",
        "model": "Unknown",
        "bios_version": "Unknown",
        "motherboard_serial": "Unknown",
        "cpu": "Unknown",
        "cpu_cores": 0,
        "cpu_threads": 0,
        "ram_total": "0 GB",
        "ram_available": "0 GB",
        "disks": [],
        "mac_address": "Unknown",
        "ip_address": "Unknown"
    }

    # 1. Gather psutil cpu/ram/disk details
    try:
        vm = psutil.virtual_memory()
        info["ram_total"] = f"{vm.total / (1024**3):.2f} GB"
        info["ram_available"] = f"{vm.available / (1024**3):.2f} GB"
    except Exception as e:
        logger.error(f"Error gathering memory info: {e}")

    try:
        info["cpu_cores"] = psutil.cpu_count(logical=False) or 0
        info["cpu_threads"] = psutil.cpu_count(logical=True) or 0
    except Exception as e:
        logger.error(f"Error gathering CPU core counts: {e}")

    # Gather Disks
    try:
        for partition in psutil.disk_partitions(all=False):
            if 'cdrom' in partition.opts or not partition.mountpoint:
                continue
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                info["disks"].append({
                    "drive": partition.mountpoint,
                    "total_size": f"{usage.total / (1024**3):.2f} GB",
                    "used_size": f"{usage.used / (1024**3):.2f} GB",
                    "free_size": f"{usage.free / (1024**3):.2f} GB"
                })
            except (PermissionError, FileNotFoundError):
                # Drive not ready or permission denied (e.g. system reserved/recovery partition)
                continue
    except Exception as e:
        logger.error(f"Error gathering disk info: {e}")

    # Network Info
    try:
        # Get active local IP address
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Does not send actual data, just establishes local interface binding
        s.connect(("8.8.8.8", 80))
        info["ip_address"] = s.getsockname()[0]
        s.close()
    except Exception as ip_err:
        logger.warning(f"Failed to get IP via UDP connect, trying fallback: {ip_err}")
        # Fallback to local host IP
        try:
            info["ip_address"] = socket.gethostbyname(socket.gethostname())
        except Exception as e:
            logger.error(f"Error determining IP Address: {e}")

    try:
        # Look for primary active MAC address using net_if_addrs
        addrs = psutil.net_if_addrs()
        stats = psutil.net_if_stats()
        best_mac = None
        for interface, snics in addrs.items():
            is_up = stats.get(interface, None)
            if is_up and is_up.isup:
                for snic in snics:
                    if snic.family == psutil.AF_LINK or (hasattr(psutil, 'AF_PACKET') and snic.family == psutil.AF_PACKET):
                        # Ensure it is a valid unicast MAC and not loopback
                        if snic.address and not snic.address.startswith("00:00:00:00"):
                            best_mac = snic.address.replace("-", ":").upper()
                            break
            if best_mac:
                break
        
        if not best_mac:
            # Fallback using uuid
            node = uuid.getnode()
            best_mac = ':'.join(re.findall('..', '%012X' % node)).upper()
            
        info["mac_address"] = best_mac
    except Exception as e:
        logger.error(f"Error gathering MAC Address: {e}")

    # 2. Gather BIOS, Manufacturer, Model, Motherboard from WMI
    c = get_wmi_connection()
    if c:
        try:
            # System details
            for system in c.Win32_ComputerSystem():
                info["manufacturer"] = clean_value(system.Manufacturer)
                info["model"] = clean_value(system.Model)

            # BIOS & System Serial Number
            for bios in c.Win32_Bios():
                info["serial_number"] = clean_value(bios.SerialNumber)
                info["bios_version"] = clean_value(bios.Version)

            # Motherboard
            for board in c.Win32_BaseBoard():
                info["motherboard_serial"] = clean_value(board.SerialNumber)

            # CPU
            for processor in c.Win32_Processor():
                info["cpu"] = clean_value(processor.Name)
                
        except Exception as e:
            logger.error(f"WMI hardware query failed: {e}")
        finally:
            release_wmi_connection()

    return info

if __name__ == "__main__":
    # Test execution
    logging.basicConfig(level=logging.INFO)
    import pprint
    pprint.pprint(get_hardware_info())
