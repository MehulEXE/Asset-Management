import os
import socket
import logging
import psutil
import uuid
import re
import subprocess

logger = logging.getLogger("AssetAgent")

SYS_DMI_PATH = "/sys/class/dmi/id"


def _read_sysfs(path):
    try:
        with open(path, "r") as f:
            val = f.read().strip()
            return val if val and val.lower() != "none" else None
    except (FileNotFoundError, PermissionError, IOError):
        return None


def _run_cmd(cmd, timeout=10):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip()
    except Exception as e:
        logger.debug(f"Command {' '.join(cmd)} failed: {e}")
        return ""


def clean_value(val):
    if val is None:
        return "Unknown"
    s = str(val).strip()
    return s if s and s.lower() != "none" else "Unknown"


def get_hardware_info():
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
                continue
    except Exception as e:
        logger.error(f"Error gathering disk info: {e}")

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        info["ip_address"] = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            info["ip_address"] = socket.gethostbyname(socket.gethostname())
        except Exception as e:
            logger.error(f"Error determining IP Address: {e}")

    try:
        addrs = psutil.net_if_addrs()
        stats = psutil.net_if_stats()
        best_mac = None
        for interface, snics in addrs.items():
            is_up = stats.get(interface, None)
            if is_up and is_up.isup:
                for snic in snics:
                    if snic.family == psutil.AF_LINK or (hasattr(psutil, 'AF_PACKET') and snic.family == psutil.AF_PACKET):
                        if snic.address and not snic.address.startswith("00:00:00:00"):
                            best_mac = snic.address.replace("-", ":").upper()
                            break
            if best_mac:
                break

        if not best_mac:
            node = uuid.getnode()
            best_mac = ':'.join(re.findall('..', '%012X' % node)).upper()

        info["mac_address"] = best_mac
    except Exception as e:
        logger.error(f"Error gathering MAC Address: {e}")

    serial = (_read_sysfs(f"{SYS_DMI_PATH}/product_serial") or
              _read_sysfs(f"{SYS_DMI_PATH}/product_uuid") or
              _run_cmd(["dmidecode", "-s", "system-serial-number"]))
    if serial:
        info["serial_number"] = serial

    manufacturer = (_read_sysfs(f"{SYS_DMI_PATH}/sys_vendor") or
                    _run_cmd(["dmidecode", "-s", "system-manufacturer"]))
    if manufacturer:
        info["manufacturer"] = manufacturer

    model = (_read_sysfs(f"{SYS_DMI_PATH}/product_name") or
             _run_cmd(["dmidecode", "-s", "system-product-name"]))
    if model:
        info["model"] = model

    bios_version = (_read_sysfs(f"{SYS_DMI_PATH}/bios_version") or
                    _run_cmd(["dmidecode", "-s", "bios-version"]))
    if bios_version:
        info["bios_version"] = bios_version

    motherboard_serial = (_read_sysfs(f"{SYS_DMI_PATH}/board_serial") or
                          _read_sysfs(f"{SYS_DMI_PATH}/board_asset_tag") or
                          _run_cmd(["dmidecode", "-s", "baseboard-serial-number"]))
    if motherboard_serial:
        info["motherboard_serial"] = motherboard_serial

    cpu_model = None
    try:
        with open("/proc/cpuinfo", "r") as f:
            for line in f:
                if line.startswith("model name"):
                    cpu_model = line.split(":")[1].strip()
                    break
    except FileNotFoundError:
        pass
    if not cpu_model:
        cpu_model = _run_cmd(["sh", "-c", "lscpu | grep 'Model name' | awk -F: '{print $2}'"])
    if cpu_model:
        info["cpu"] = cpu_model

    return info


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import pprint
    pprint.pprint(get_hardware_info())
