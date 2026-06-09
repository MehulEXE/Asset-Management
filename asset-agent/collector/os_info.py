import platform
import logging
import time
import datetime
import threading
import subprocess
from collector.hardware import get_wmi_connection, release_wmi_connection, clean_value

logger = logging.getLogger("AssetAgent")

def get_uptime_seconds():
    """Returns system uptime in seconds using psutil."""
    try:
        boot_time = psutil_boot_time()
        return time.time() - boot_time
    except Exception as e:
        logger.error(f"Error computing system uptime: {e}")
        return 0

def psutil_boot_time():
    import psutil
    return psutil.boot_time()

def get_os_and_user_info():
    """Gathers comprehensive OS and current user details."""
    info = {
        "os_name": "Microsoft Windows",
        "os_version": platform.win32_ver()[0] or "Unknown",
        "build_number": platform.win32_ver()[1] or "Unknown",
        "architecture": platform.machine() or "32-bit",
        "uptime": "Unknown",
        "logged_in_user": "None",
        "domain_name": "WORKGROUP",
        "last_login_time": "Unknown"
    }

    # Uptime format
    try:
        uptime_sec = get_uptime_seconds()
        days, rem = divmod(uptime_sec, 86400)
        hours, rem = divmod(rem, 3600)
        minutes, seconds = divmod(rem, 60)
        info["uptime"] = f"{int(days)}d {int(hours)}h {int(minutes)}m"
    except Exception as uptime_err:
        logger.warning(f"Failed to format uptime: {uptime_err}")

    # Gather via WMI
    c = get_wmi_connection()
    if c:
        try:
            # OS details
            for os_item in c.Win32_OperatingSystem():
                info["os_name"] = clean_value(os_item.Caption)
                info["os_version"] = clean_value(os_item.Version)
                info["build_number"] = clean_value(os_item.BuildNumber)
                info["architecture"] = clean_value(os_item.OSArchitecture)

            # Computer System details
            for cs in c.Win32_ComputerSystem():
                # UserName returns the currently logged on user, e.g. "DOMAIN\Username"
                user_val = cs.UserName
                if user_val:
                    info["logged_in_user"] = clean_value(user_val)
                else:
                    # Fallback: check if explorer.exe process exists and get its owner
                    explorer_owner = get_explorer_owner(c)
                    if explorer_owner:
                        info["logged_in_user"] = explorer_owner
                    else:
                        info["logged_in_user"] = "No user logged in"
                
                info["domain_name"] = clean_value(cs.Domain)

            # Last login time / Active session info
            # Query Win32_NetworkLoginProfile for interactive logon
            # NOTE: This WMI class can be extremely slow (30+ seconds) on domain-joined
            # or Server machines, so we run it in a thread with a timeout.
            last_login = None
            login_result = [None]  # mutable container for thread result

            def _query_login_profiles(wmi_conn, result_holder):
                try:
                    for profile in wmi_conn.Win32_NetworkLoginProfile():
                        if profile.LastLogon and profile.Name and not profile.Name.startswith("NT AUTHORITY"):
                            result_holder[0] = profile.LastLogon
                            break
                except Exception as lp_err:
                    logger.debug(f"Win32_NetworkLoginProfile query failed: {lp_err}")

            login_thread = threading.Thread(target=_query_login_profiles, args=(c, login_result), daemon=True)
            login_thread.start()
            login_thread.join(timeout=10)  # Wait at most 10 seconds

            if login_thread.is_alive():
                logger.warning("Win32_NetworkLoginProfile query timed out after 10s, skipping.")
            else:
                last_login = login_result[0]
            
            if last_login:
                # Format: yyyymmddhhmmss.ffffff+zzz
                # Parse to readable string
                try:
                    dt = datetime.datetime.strptime(last_login.split('.')[0], "%Y%m%d%H%M%S")
                    info["last_login_time"] = dt.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    info["last_login_time"] = str(last_login)
            else:
                # Fallback: get boot time as a proxy for last login
                try:
                    boot_time_dt = datetime.datetime.fromtimestamp(psutil_boot_time())
                    info["last_login_time"] = boot_time_dt.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    info["last_login_time"] = "Unknown"

        except Exception as e:
            logger.error(f"WMI OS/User query failed: {e}")
        finally:
            release_wmi_connection()

    return info

def get_explorer_owner(c_wmi):
    """Finds the owner of the explorer.exe process as fallback for logged-in user.
    
    WMI GetOwner() returns a tuple: (returnValue, user, domain)
    where returnValue=0 means success.
    """
    try:
        for process in c_wmi.Win32_Process(Name="explorer.exe"):
            owner_info = process.GetOwner()
            # GetOwner() returns (returnValue, user, domain)
            # returnValue=0 means success, user is at index 2, domain at index 1
            # Actually the WMI python wrapper returns: (return_value, user, domain)
            if owner_info and len(owner_info) >= 3 and owner_info[0] == 0:
                user = owner_info[2]   # user name
                domain = owner_info[1] # domain
                if user:
                    return f"{domain}\\{user}" if domain else user
            elif owner_info and len(owner_info) >= 2:
                # Some WMI wrappers return just (user, domain) without returnValue
                user = owner_info[0]
                domain = owner_info[1] if len(owner_info) > 1 else None
                if user and not str(user).isdigit():  # Ensure it's not the return code
                    return f"{domain}\\{user}" if domain else str(user)
    except Exception as explorer_err:
        logger.warning(f"Failed to get explorer.exe owner: {explorer_err}")
    return None

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import pprint
    pprint.pprint(get_os_and_user_info())
