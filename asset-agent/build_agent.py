import os
import subprocess
import sys

AGENT_DIR = os.path.dirname(os.path.abspath(__file__))

def run(cmd, desc=""):
    print(f"[BUILD] {desc}")
    print(f"        {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=AGENT_DIR)
    if result.returncode != 0:
        print(f"[FAILED] Exit code {result.returncode}")
        sys.exit(result.returncode)
    return result

def main():
    print("=" * 60)
    print("  Asset Discovery Agent - Build Script")
    print("=" * 60)
    print()

    build_dir = os.path.join(AGENT_DIR, "build")
    if os.path.exists(build_dir):
        import shutil
        shutil.rmtree(build_dir)

    print("Step 1/2: Building AssetAgentService.exe (Windows Service)...")
    run(
        ["pyinstaller", "--noconfirm", "--clean", "AssetAgentService.spec"],
        "AssetAgentService.exe"
    )

    service_exe = os.path.join(AGENT_DIR, "dist", "AssetAgentService.exe")
    if not os.path.exists(service_exe):
        print(f"[ERROR] AssetAgentService.exe was not built at {service_exe}")
        sys.exit(1)

    print()
    print("Step 2/2: Building AssetAgentSetup.exe (Installer)...")
    run(
        ["pyinstaller", "--noconfirm", "--clean", "AssetAgentSetup.spec"],
        "AssetAgentSetup.exe"
    )

    setup_exe = os.path.join(AGENT_DIR, "dist", "AssetAgentSetup.exe")
    if not os.path.exists(setup_exe):
        print(f"[ERROR] AssetAgentSetup.exe was not built at {setup_exe}")
        sys.exit(1)

    service_size = os.path.getsize(service_exe) / (1024 * 1024)
    setup_size = os.path.getsize(setup_exe) / (1024 * 1024)

    print()
    print("=" * 60)
    print("  BUILD COMPLETE")
    print("=" * 60)
    print(f"  AssetAgentService.exe  ({service_size:.1f} MB)")
    print(f"    {service_exe}")
    print(f"  AssetAgentSetup.exe    ({setup_size:.1f} MB)")
    print(f"    {setup_exe}")
    print("=" * 60)

if __name__ == "__main__":
    main()
