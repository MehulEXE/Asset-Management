import logging
import subprocess
import os

logger = logging.getLogger("AssetAgent")


def _run_cmd(cmd, timeout=30):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip(), result.returncode
    except FileNotFoundError:
        return "", -1
    except Exception as e:
        logger.debug(f"Command {' '.join(cmd)} failed: {e}")
        return "", -1


def _parse_dpkg():
    software_list = []
    out, rc = _run_cmd([
        "dpkg-query", "-W",
        "-f=${Package}\t${Version}\t${Maintainer}\t${Installed-Size}\n"
    ])
    if rc != 0 or not out:
        return None

    for line in out.splitlines():
        parts = line.split("\t", 3)
        if len(parts) >= 2:
            software_list.append({
                "name": parts[0],
                "version": parts[1],
                "publisher": parts[2] if len(parts) >= 3 else "Unknown",
                "install_date": "Unknown"
            })
    return software_list


def _parse_rpm():
    software_list = []
    out, rc = _run_cmd([
        "rpm", "-qa", "--queryformat=%{NAME}\t%{VERSION}\t%{VENDOR}\t%{SIZE}\n"
    ])
    if rc != 0 or not out:
        return None

    for line in out.splitlines():
        parts = line.split("\t", 3)
        if len(parts) >= 2:
            software_list.append({
                "name": parts[0],
                "version": parts[1],
                "publisher": parts[2] if len(parts) >= 3 and parts[2] else "Unknown",
                "install_date": "Unknown"
            })
    return software_list


def _list_desktop_files():
    software_list = []
    seen = set()
    search_dirs = ["/usr/share/applications", "/usr/local/share/applications"]
    for d in search_dirs:
        if not os.path.isdir(d):
            continue
        try:
            for fname in os.listdir(d):
                if not fname.endswith(".desktop"):
                    continue
                path = os.path.join(d, fname)
                name = None
                version = "Unknown"
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith("Name=") and not line.startswith("Name["):
                                name = line.split("=", 1)[1]
                            elif line.startswith("Version="):
                                v = line.split("=", 1)[1]
                                if v:
                                    version = v
                except Exception:
                    continue
                if name and name.lower() not in seen:
                    seen.add(name.lower())
                    software_list.append({
                        "name": name,
                        "version": version,
                        "publisher": "Unknown",
                        "install_date": "Unknown"
                    })
        except Exception:
            continue
    return software_list


def get_installed_software():
    logger.info("Collecting installed software...")

    packages = _parse_dpkg()
    if packages is not None:
        logger.info(f"Found {len(packages)} packages via dpkg.")
        packages.sort(key=lambda x: x["name"].lower())
        return packages

    packages = _parse_rpm()
    if packages is not None:
        logger.info(f"Found {len(packages)} packages via rpm.")
        packages.sort(key=lambda x: x["name"].lower())
        return packages

    packages = _list_desktop_files()
    logger.info(f"Found {len(packages)} applications via .desktop files (fallback).")
    packages.sort(key=lambda x: x["name"].lower())
    return packages


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    apps = get_installed_software()
    print(f"Total apps found: {len(apps)}")
    if apps:
        import pprint
        pprint.pprint(apps[:10])
