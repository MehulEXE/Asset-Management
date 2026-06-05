import logging
import datetime
import subprocess
from collector.hardware import get_wmi_connection, release_wmi_connection, clean_value, HAS_WMI

logger = logging.getLogger("AssetAgent")

def get_security_info():
    """Gathers Windows security statuses: Defender, Firewall, BitLocker, and Updates."""
    info = {
        "windows_defender": "Unknown",
        "firewall_status": "Unknown",
        "bitlocker_status": "Unknown",
        "last_update_date": "Unknown"
    }

    c = get_wmi_connection()
    
    # 1. Windows Defender Status
    try:
        # Check WinDefend Service status first
        defender_service_running = False
        if c:
            services = c.Win32_Service(Name="WinDefend")
            if services:
                status = services[0].State
                defender_service_running = (str(status).lower() == "running")
        
        # Also query root\SecurityCenter2 for Antivirus products
        antivirus_enabled = False
        if HAS_WMI:
            try:
                import pythoncom
                import wmi
                # Query SecurityCenter2
                sc2 = wmi.WMI(namespace=r"root\SecurityCenter2")
                products = sc2.AntiVirusProduct()
                for product in products:
                    name = str(product.displayName).lower()
                    if "windows defender" in name or "windows protector" in name or defender_service_running:
                        state = product.productState
                        # Parse productState bitmask (generally if 3rd hex digit is 1, e.g. 0x10 or 0x11, it's active)
                        state_hex = f"{state:06x}"
                        # In the SecurityCenter2 state representation:
                        # 2nd byte (middle pair) handles enabling. '10' or '11' means enabled.
                        if len(state_hex) >= 6 and state_hex[2:4] in ["10", "11"]:
                            antivirus_enabled = True
                            break
            except Exception as e:
                logger.debug(f"SecurityCenter2 AntiVirusProduct query skipped/failed: {e}")
        
        if antivirus_enabled or defender_service_running:
            info["windows_defender"] = "Enabled/Running"
        else:
            info["windows_defender"] = "Disabled/Stopped"
    except Exception as e:
        logger.error(f"Error checking Windows Defender status: {e}")
        info["windows_defender"] = "Unknown"

    # 2. Firewall Status
    try:
        firewall_active = False
        if HAS_WMI:
            try:
                import wmi
                sc2 = wmi.WMI(namespace=r"root\SecurityCenter2")
                products = sc2.FirewallProduct()
                for product in products:
                    state = product.productState
                    state_hex = f"{state:06x}"
                    if len(state_hex) >= 6 and state_hex[2:4] in ["10", "11"]:
                        firewall_active = True
                        break
            except Exception as e:
                logger.debug(f"SecurityCenter2 FirewallProduct query skipped/failed: {e}")

        # Fallback to netsh if SecurityCenter2 was inconclusive
        if not firewall_active:
            try:
                # Advfirewall check
                res = subprocess.run(
                    ["netsh", "advfirewall", "show", "allprofiles"],
                    capture_output=True, text=True, timeout=5, creationflags=subprocess.CREATE_NO_WINDOW
                )
                if "ON" in res.stdout.upper() and "State" in res.stdout:
                    firewall_active = True
            except Exception as netsh_err:
                logger.warning(f"netsh firewall fallback failed: {netsh_err}")

        info["firewall_status"] = "Enabled" if firewall_active else "Disabled"
    except Exception as e:
        logger.error(f"Error checking Firewall status: {e}")
        info["firewall_status"] = "Unknown"

    # 3. BitLocker Status
    # We query win32_EncryptableVolume in root\CIMV2\Security\MicrosoftVolumeEncryption namespace
    try:
        bitlocker_status_list = []
        if HAS_WMI:
            try:
                import wmi
                b_wmi = wmi.WMI(namespace=r"root\CIMV2\Security\MicrosoftVolumeEncryption")
                volumes = b_wmi.Win32_EncryptableVolume()
                for vol in volumes:
                    letter = vol.DriveLetter
                    # ProtectionStatus: 0 = Off, 1 = On, 2 = Unknown
                    status_map = {0: "Off", 1: "On", 2: "Unknown"}
                    status = status_map.get(vol.GetProtectionStatus()[0], "Unknown")
                    if letter:
                        bitlocker_status_list.append(f"{letter} ({status})")
            except Exception as e:
                logger.debug(f"Win32_EncryptableVolume WMI query skipped/failed: {e}")
                
        if bitlocker_status_list:
            info["bitlocker_status"] = ", ".join(bitlocker_status_list)
        else:
            # Fallback to run manage-bde -status
            try:
                res = subprocess.run(
                    ["manage-bde", "-status", "C:"],
                    capture_output=True, text=True, timeout=5, creationflags=subprocess.CREATE_NO_WINDOW
                )
                if "Percentage Encrypted:" in res.stdout:
                    lines = res.stdout.split("\n")
                    percent = "Unknown"
                    for l in lines:
                        if "Percentage Encrypted:" in l:
                            percent = l.split(":")[-1].strip()
                            break
                    info["bitlocker_status"] = f"C: (Encrypted: {percent})"
                else:
                    info["bitlocker_status"] = "Off"
            except Exception as bde_err:
                logger.warning(f"manage-bde bitlocker check failed: {bde_err}")
                info["bitlocker_status"] = "Off"
    except Exception as e:
        logger.error(f"Error checking BitLocker status: {e}")
        info["bitlocker_status"] = "Unknown"

    # 4. Last Windows Update Date
    # Gathered via WMI Win32_QuickFixEngineering (QFE) sorted by InstalledOn
    try:
        latest_date = None
        if c:
            qfes = c.Win32_QuickFixEngineering()
            for qfe in qfes:
                date_str = qfe.InstalledOn
                if date_str:
                    try:
                        # QFE InstalledOn dates can come in various formats (e.g. '08/15/2023', '2023-08-15', etc.)
                        # Normalize to a datetime object
                        dt = None
                        date_str = str(date_str).strip()
                        # Hex representation sometimes happens or standard locale formats
                        for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y", "%Y%m%d"):
                            try:
                                dt = datetime.datetime.strptime(date_str, fmt)
                                break
                            except ValueError:
                                continue
                        
                        if dt and (latest_date is None or dt > latest_date):
                            latest_date = dt
                    except Exception:
                        pass
        
                    except Exception as date_err:
                        logger.debug(f"Failed to parse QFE date '{date_str}': {date_err}")

        if latest_date:
            info["last_update_date"] = latest_date.strftime("%Y-%m-%d")
        else:
            # Try to query Windows Update Agent history via COM
            try:
                import win32com.client
                pythoncom.CoInitialize()
                update_session = win32com.client.Dispatch("Microsoft.Update.Session")
                update_searcher = update_session.CreateUpdateSearcher()
                count = update_searcher.GetTotalHistoryCount()
                if count > 0:
                    history = update_searcher.QueryHistory(0, 1)
                    if history and len(history) > 0:
                        last_update_obj = history[0]
                        info["last_update_date"] = last_update_obj.Date.strftime("%Y-%m-%d")
            except Exception as e:
                logger.debug(f"COM Microsoft.Update.Session query failed: {e}")
                
    except Exception as e:
        logger.error(f"Error determining Last Windows Update Date: {e}")
        
    finally:
        if c:
            release_wmi_connection()

    return info

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import pprint
    pprint.pprint(get_security_info())
