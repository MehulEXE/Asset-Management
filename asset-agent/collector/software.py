import winreg
import logging
import datetime

logger = logging.getLogger("AssetAgent")

def normalize_date(date_str):
    """Normalize registry InstallDate values (e.g. '20230815' to '2023-08-15')."""
    if not date_str:
        return "Unknown"
    date_str = str(date_str).strip()
    if len(date_str) == 8 and date_str.isdigit():
        try:
            return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
        except Exception:
            pass
    return date_str

def get_installed_software():
    """Reads software inventory from the Windows Registry (HKLM 64-bit and 32-bit)."""
    software_list = []
    seen_apps = set() # Avoid duplicates

    registry_paths = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", winreg.KEY_WOW64_64KEY),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", winreg.KEY_WOW64_32KEY),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall", winreg.KEY_WOW64_32KEY)
    ]

    for hive, path, access_flag in registry_paths:
        try:
            # Combine KEY_READ with access_flag for correct architecture view
            reg_key = winreg.OpenKey(hive, path, 0, winreg.KEY_READ | access_flag)
        except OSError:
            # Key doesn't exist or is not readable (Wow6432Node on 32-bit OS)
            continue

        try:
            num_subkeys = winreg.QueryInfoKey(reg_key)[0]
            for i in range(num_subkeys):
                try:
                    subkey_name = winreg.EnumKey(reg_key, i)
                    subkey = winreg.OpenKey(reg_key, subkey_name)
                except OSError:
                    continue

                try:
                    # Get DisplayName (essential, skip if missing)
                    try:
                        app_name, _ = winreg.QueryValueEx(subkey, "DisplayName")
                        app_name = str(app_name).strip()
                        if not app_name or app_name.startswith("Update for Windows") or app_name.startswith("Security Update for"):
                            continue
                    except OSError:
                        continue

                    # Get details with safe fallbacks
                    try:
                        version, _ = winreg.QueryValueEx(subkey, "DisplayVersion")
                        version = str(version).strip()
                    except OSError:
                        version = "Unknown"

                    try:
                        publisher, _ = winreg.QueryValueEx(subkey, "Publisher")
                        publisher = str(publisher).strip()
                    except OSError:
                        publisher = "Unknown"

                    try:
                        install_date_raw, _ = winreg.QueryValueEx(subkey, "InstallDate")
                        install_date = normalize_date(install_date_raw)
                    except OSError:
                        install_date = "Unknown"

                    # Deduplicate based on Name and Version
                    dedup_key = f"{app_name.lower()}||{version.lower()}"
                    if dedup_key not in seen_apps:
                        seen_apps.add(dedup_key)
                        software_list.append({
                            "name": app_name,
                            "version": version,
                            "publisher": publisher,
                            "install_date": install_date
                        })
                except Exception as e:
                    logger.debug(f"Error reading subkey: {e}")
                finally:
                    try:
                        winreg.CloseKey(subkey)
                    except OSError:
                        pass
        except Exception as e:
            logger.error(f"Error enumerating registry key {path}: {e}")
        finally:
            try:
                winreg.CloseKey(reg_key)
            except OSError:
                pass

    # Sort software alphabetically
    software_list.sort(key=lambda x: x["name"].lower())
    logger.info(f"Successfully collected {len(software_list)} installed software packages.")
    return software_list

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    apps = get_installed_software()
    print(f"Total apps found: {len(apps)}")
    if apps:
        import pprint
        pprint.pprint(apps[:5])
