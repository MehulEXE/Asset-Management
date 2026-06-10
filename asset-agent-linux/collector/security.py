import logging
import subprocess
import datetime
import os

logger = logging.getLogger("AssetAgent")


def _run_cmd(cmd, timeout=10):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip(), result.returncode
    except FileNotFoundError:
        return "", -1
    except Exception as e:
        logger.debug(f"Command {' '.join(cmd)} failed: {e}")
        return "", -1


def _check_clamav():
    out, rc = _run_cmd(["systemctl", "is-active", "clamav-daemon"])
    if rc == 0 and out.strip().lower() == "active":
        return "Enabled/Running"
    out2, rc2 = _run_cmd(["systemctl", "is-active", "clamav-freshclam"])
    if rc2 == 0 and out2.strip().lower() == "active":
        return "Enabled/Running"
    out3, rc3 = _run_cmd(["which", "clamscan"])
    if rc3 == 0 and out3.strip():
        return "Installed (service not running)"
    return "Not Installed"


def _check_firewall():
    out, rc = _run_cmd(["ufw", "status"])
    if rc == 0:
        if "Status: active" in out or "active" in out.lower():
            return "Enabled"
        elif "Status: inactive" in out:
            return "Disabled"
        return "Unknown"

    out2, rc2 = _run_cmd(["firewall-cmd", "--state"])
    if rc2 == 0 and out2.strip().lower() == "running":
        return "Enabled"
    elif rc2 == 0:
        return "Running"

    out3, rc3 = _run_cmd(["iptables", "-L", "-n"])
    if rc3 == 0:
        if out3 and "Chain" in out3:
            return "Enabled (iptables)"
        return "Disabled"

    return "Unknown"


def _check_disk_encryption():
    try:
        lsblk_out, rc = _run_cmd([
            "lsblk", "-o", "NAME,TYPE,FSTYPE,MOUNTPOINT", "-n"
        ])
        if rc == 0 and lsblk_out:
            encrypted = []
            for line in lsblk_out.splitlines():
                parts = line.split()
                if len(parts) >= 3 and parts[2] in ("crypto_LUKS",):
                    encrypted.append(parts[0])
            if encrypted:
                return f"Encrypted ({', '.join(encrypted)})"
    except Exception:
        pass

    out2, rc2 = _run_cmd(["cryptsetup", "status"])
    if rc2 == 0 and out2.strip():
        return "Encrypted"
    if rc2 != 0 and out2.strip():
        return "Encrypted (partial)"

    return "Not Encrypted"


def _check_last_update():
    apt_log = "/var/log/apt/history.log"
    dnf_log = "/var/log/dnf.log"
    yum_log = "/var/log/yum.log"
    pacman_log = "/var/log/pacman.log"

    log_files = [apt_log, dnf_log, yum_log, pacman_log]
    for log_file in log_files:
        if not os.path.isfile(log_file):
            continue
        try:
            with open(log_file, "r", errors="ignore") as f:
                lines = f.readlines()
            for line in reversed(lines):
                line = line.strip()
                if log_file == apt_log:
                    if line.startswith("Start-Date:"):
                        date_str = line.replace("Start-Date:", "").strip()
                        try:
                            dt = datetime.datetime.strptime(date_str, "%Y-%m-%d  %H:%M:%S")
                            return dt.strftime("%Y-%m-%d %H:%M:%S")
                        except ValueError:
                            return date_str
                elif log_file == dnf_log or log_file == yum_log:
                    parts = line.split()
                    if len(parts) >= 2:
                        try:
                            dt = datetime.datetime.strptime(parts[0], "%Y-%m-%d")
                            return dt.strftime("%Y-%m-%d")
                        except ValueError:
                            pass
                elif log_file == pacman_log:
                    if "installed" in line or "upgraded" in line:
                        parts = line.split()
                        if len(parts) >= 1:
                            date_str = parts[0].split("[")[-1].split("]")[0] if "[" in parts[0] else parts[0]
                            try:
                                dt = datetime.datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S%z")
                                return dt.strftime("%Y-%m-%d %H:%M:%S")
                            except ValueError:
                                pass
        except Exception as e:
            logger.debug(f"Failed to parse {log_file}: {e}")
            continue

    return "Unknown"


def get_security_info():
    info = {
        "firewall_status": "Unknown",
        "antivirus_status": "Unknown",
        "disk_encryption_status": "Unknown",
        "last_update_date": "Unknown"
    }

    try:
        info["firewall_status"] = _check_firewall()
    except Exception as e:
        logger.error(f"Error checking firewall status: {e}")

    try:
        info["antivirus_status"] = _check_clamav()
    except Exception as e:
        logger.error(f"Error checking antivirus status: {e}")

    try:
        info["disk_encryption_status"] = _check_disk_encryption()
    except Exception as e:
        logger.error(f"Error checking disk encryption: {e}")

    try:
        info["last_update_date"] = _check_last_update()
    except Exception as e:
        logger.error(f"Error checking last update date: {e}")

    return info


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import pprint
    pprint.pprint(get_security_info())
