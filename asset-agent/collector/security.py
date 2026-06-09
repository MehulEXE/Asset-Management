import logging
import datetime
import subprocess
from collector.hardware import get_wmi_connection, release_wmi_connection, clean_value, HAS_WMI

try:
    import pythoncom
    HAS_PYTHONCOM = True
except ImportError:
    HAS_PYTHONCOM = False

logger = logging.getLogger("AssetAgent")

# Subprocess helper — runs a command and returns stdout, swallowing errors
def _run_silent(args, timeout=10):
    """Run a subprocess command silently, returning stdout or empty string on failure."""
    try:
        res = subprocess.run(
            args, capture_output=True, text=True, timeout=timeout,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        return res.stdout
    except Exception as e:
        logger.debug(f"Subprocess {args[0]} failed: {e}")
        return ""


def _check_defender_via_sc():
    """Check Windows Defender service status via sc.exe (works on all SKUs)."""
    try:
        out = _run_silent(["sc.exe", "query", "WinDefend"])
        if "RUNNING" in out.upper():
            return "Enabled/Running"
        elif "STOPPED" in out.upper():
            return "Disabled/Stopped"
    except Exception as e:
        logger.debug(f"sc.exe WinDefend check failed: {e}")
    return None


def _check_defender_via_powershell():
    """Check Defender real-time protection via PowerShell Get-MpComputerStatus."""
    try:
        out = _run_silent([
            "powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
            "(Get-MpComputerStatus).RealTimeProtectionEnabled"
        ], timeout=15)
        if "True" in out:
            return "Enabled/Running"
        elif "False" in out:
            return "Disabled/Stopped"
    except Exception as e:
        logger.debug(f"PowerShell Defender check failed: {e}")
    return None


def get_security_info():
    """Gathers Windows security statuses: Defender, Firewall, BitLocker, and Updates."""
    info = {
        "windows_defender": "Unknown",
        "firewall_status": "Unknown",
        "bitlocker_status": "Unknown",
        "last_update_date": "Unknown"
    }

    c = get_wmi_connection()
    
    # =========================================================================
    # 1. Windows Defender Status
    # =========================================================================
    try:
        defender_resolved = False

        # Method A: WMI SecurityCenter2 (only available on Client SKUs, not Server)
        if HAS_WMI:
            try:
                import wmi
                sc2 = wmi.WMI(namespace=r"root\SecurityCenter2")
                products = sc2.AntiVirusProduct()
                for product in products:
                    name = str(product.displayName).lower()
                    if "windows defender" in name or "windows protector" in name:
                        state = product.productState
                        state_hex = f"{state:06x}"
                        if len(state_hex) >= 6 and state_hex[2:4] in ["10", "11"]:
                            info["windows_defender"] = "Enabled/Running"
                            defender_resolved = True
                            break
                if not defender_resolved and products:
                    # SecurityCenter2 responded but Defender wasn't found as enabled
                    info["windows_defender"] = "Disabled/Stopped"
                    defender_resolved = True
            except Exception as e:
                logger.debug(f"SecurityCenter2 AntiVirusProduct query skipped/failed: {e}")

        # Method B: sc.exe query (works on Server and Client)
        if not defender_resolved:
            result = _check_defender_via_sc()
            if result:
                info["windows_defender"] = result
                defender_resolved = True

        # Method C: PowerShell Get-MpComputerStatus (most reliable but slowest)
        if not defender_resolved:
            result = _check_defender_via_powershell()
            if result:
                info["windows_defender"] = result
                defender_resolved = True

        # Method D: WMI WinDefend service state (fallback)
        if not defender_resolved and c:
            try:
                services = c.Win32_Service(Name="WinDefend")
                if services:
                    status = services[0].State
                    if str(status).lower() == "running":
                        info["windows_defender"] = "Enabled/Running"
                    else:
                        info["windows_defender"] = "Disabled/Stopped"
            except Exception as e:
                logger.debug(f"WMI WinDefend service query failed: {e}")

    except Exception as e:
        logger.error(f"Error checking Windows Defender status: {e}")
        info["windows_defender"] = "Unknown"

    # =========================================================================
    # 2. Firewall Status
    # =========================================================================
    try:
        firewall_resolved = False

        # Method A: SecurityCenter2 FirewallProduct (Client SKUs only)
        if HAS_WMI:
            try:
                import wmi
                sc2 = wmi.WMI(namespace=r"root\SecurityCenter2")
                products = sc2.FirewallProduct()
                for product in products:
                    state = product.productState
                    state_hex = f"{state:06x}"
                    if len(state_hex) >= 6 and state_hex[2:4] in ["10", "11"]:
                        info["firewall_status"] = "Enabled"
                        firewall_resolved = True
                        break
            except Exception as e:
                logger.debug(f"SecurityCenter2 FirewallProduct query skipped/failed: {e}")

        # Method B: netsh advfirewall (works on all SKUs)
        if not firewall_resolved:
            try:
                out = _run_silent(["netsh", "advfirewall", "show", "allprofiles"])
                if out:
                    # Check if at least one profile has State = ON
                    lines_upper = out.upper()
                    if "STATE" in lines_upper and "ON" in lines_upper:
                        info["firewall_status"] = "Enabled"
                        firewall_resolved = True
                    elif "STATE" in lines_upper:
                        info["firewall_status"] = "Disabled"
                        firewall_resolved = True
            except Exception as netsh_err:
                logger.warning(f"netsh firewall fallback failed: {netsh_err}")

        if not firewall_resolved:
            info["firewall_status"] = "Unknown"

    except Exception as e:
        logger.error(f"Error checking Firewall status: {e}")
        info["firewall_status"] = "Unknown"

    # =========================================================================
    # 3. BitLocker Status
    # =========================================================================
    try:
        bitlocker_status_list = []

        # Method A: WMI Win32_EncryptableVolume (requires admin/SYSTEM)
        if HAS_WMI:
            try:
                import wmi
                b_wmi = wmi.WMI(namespace=r"root\CIMV2\Security\MicrosoftVolumeEncryption")
                volumes = b_wmi.Win32_EncryptableVolume()
                for vol in volumes:
                    letter = vol.DriveLetter
                    # ProtectionStatus: 0 = Off, 1 = On, 2 = Unknown
                    status_map = {0: "Off", 1: "On", 2: "Unknown"}
                    try:
                        status = status_map.get(vol.GetProtectionStatus()[0], "Unknown")
                    except Exception:
                        status = "Unknown"
                    if letter:
                        bitlocker_status_list.append(f"{letter} ({status})")
            except Exception as e:
                logger.debug(f"Win32_EncryptableVolume WMI query skipped/failed: {e}")
                
        if bitlocker_status_list:
            info["bitlocker_status"] = ", ".join(bitlocker_status_list)
        else:
            # Method B: manage-bde command line (requires admin)
            try:
                out = _run_silent(["manage-bde", "-status", "C:"])
                if "Percentage Encrypted:" in out:
                    lines = out.split("\n")
                    percent = "Unknown"
                    for l in lines:
                        if "Percentage Encrypted:" in l:
                            percent = l.split(":")[-1].strip()
                            break
                    info["bitlocker_status"] = f"C: (Encrypted: {percent})"
                elif out:
                    info["bitlocker_status"] = "Off"
                else:
                    info["bitlocker_status"] = "Not Available"
            except Exception as bde_err:
                logger.warning(f"manage-bde bitlocker check failed: {bde_err}")
                info["bitlocker_status"] = "Not Available"

    except Exception as e:
        logger.error(f"Error checking BitLocker status: {e}")
        info["bitlocker_status"] = "Unknown"

    # =========================================================================
    # 4. Last Windows Update Date
    # =========================================================================
    try:
        latest_date = None

        # Method A: WMI Win32_QuickFixEngineering
        if c:
            try:
                qfes = c.Win32_QuickFixEngineering()
                for qfe in qfes:
                    date_str = qfe.InstalledOn
                    if date_str:
                        try:
                            dt = None
                            date_str = str(date_str).strip()
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
            except Exception as qfe_err:
                logger.debug(f"WMI QFE query failed: {qfe_err}")

        if latest_date:
            info["last_update_date"] = latest_date.strftime("%Y-%m-%d")
        else:
            # Method B: COM Windows Update Agent history
            if HAS_PYTHONCOM:
                try:
                    import win32com.client
                    pythoncom.CoInitialize()
                    try:
                        update_session = win32com.client.Dispatch("Microsoft.Update.Session")
                        update_searcher = update_session.CreateUpdateSearcher()
                        count = update_searcher.GetTotalHistoryCount()
                        if count > 0:
                            history = update_searcher.QueryHistory(0, 1)
                            if history and len(history) > 0:
                                last_update_obj = history[0]
                                info["last_update_date"] = last_update_obj.Date.strftime("%Y-%m-%d")
                    finally:
                        pythoncom.CoUninitialize()
                except Exception as e:
                    logger.debug(f"COM Microsoft.Update.Session query failed: {e}")

            # Method C: PowerShell fallback
            if info["last_update_date"] == "Unknown":
                try:
                    out = _run_silent([
                        "powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
                        "(Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1).InstalledOn.ToString('yyyy-MM-dd')"
                    ], timeout=15)
                    if out and out.strip():
                        info["last_update_date"] = out.strip()
                except Exception as ps_err:
                    logger.debug(f"PowerShell Get-HotFix fallback failed: {ps_err}")
                
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
