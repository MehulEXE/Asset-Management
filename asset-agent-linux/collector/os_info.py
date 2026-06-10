import platform
import logging
import time
import datetime
import socket
import subprocess
import psutil

logger = logging.getLogger("AssetAgent")

try:
    import distro
    HAS_DISTRO = True
except ImportError:
    HAS_DISTRO = False


def get_uptime_seconds():
    try:
        return time.time() - psutil.boot_time()
    except Exception as e:
        logger.error(f"Error computing system uptime: {e}")
        return 0


def _read_os_release():
    info = {"os_name": "Linux", "os_version": "Unknown", "os_id": "linux"}
    try:
        with open("/etc/os-release", "r") as f:
            for line in f:
                line = line.strip()
                if "=" in line:
                    key, val = line.split("=", 1)
                    val = val.strip('"')
                    if key == "NAME":
                        info["os_name"] = val
                    elif key == "VERSION_ID":
                        info["os_version"] = val
                    elif key == "ID":
                        info["os_id"] = val
    except FileNotFoundError:
        pass
    return info


def get_os_and_user_info():
    os_release = _read_os_release()

    info = {
        "os_name": os_release.get("os_name", "Linux"),
        "os_version": os_release.get("os_version", "Unknown"),
        "build_number": platform.release(),
        "architecture": platform.machine(),
        "uptime": "Unknown",
        "logged_in_user": "None",
        "domain_name": "",
        "last_login_time": "Unknown"
    }

    try:
        uptime_sec = get_uptime_seconds()
        days, rem = divmod(uptime_sec, 86400)
        hours, rem = divmod(rem, 3600)
        minutes, seconds = divmod(rem, 60)
        info["uptime"] = f"{int(days)}d {int(hours)}h {int(minutes)}m"
    except Exception as uptime_err:
        logger.warning(f"Failed to format uptime: {uptime_err}")

    try:
        users = psutil.users()
        if users:
            info["logged_in_user"] = ", ".join(u.name for u in users)
        else:
            info["logged_in_user"] = "No user logged in"
    except Exception as e:
        logger.error(f"Error getting logged-in users: {e}")

    try:
        fqdn = socket.getfqdn()
        if "." in fqdn:
            info["domain_name"] = fqdn.split(".", 1)[1]
    except Exception:
        pass

    try:
        result = subprocess.run(
            ["last", "-2"],
            capture_output=True, text=True, timeout=5
        )
        if result.stdout:
            lines = [l for l in result.stdout.splitlines() if l.strip()]
            for line in lines[:5]:
                if "still logged in" in line:
                    continue
                parts = line.split()
                if len(parts) >= 5 and parts[0] not in ("wtmp", "reboot"):
                    date_str = " ".join(parts[3:6])
                    try:
                        parsed = datetime.datetime.strptime(date_str, "%a %b %d %H:%M")
                        parsed = parsed.replace(year=datetime.datetime.now().year)
                        info["last_login_time"] = parsed.strftime("%Y-%m-%d %H:%M:%S")
                        break
                    except ValueError:
                        continue
    except Exception as e:
        logger.debug(f"Failed to parse last login from 'last' command: {e}")

    return info


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import pprint
    pprint.pprint(get_os_and_user_info())
