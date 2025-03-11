#!/usr/bin/env python3
"""
Script to build a standalone executable from the todo4ai-client package
"""
import os
import sys
import subprocess
import shutil
from pathlib import Path

def main():
    # Ensure we're in the right directory
    os.chdir(Path(__file__).parent)
    
    # Install PyInstaller if not already installed
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "PyInstaller"])
    
    # Create a simple entry point script
    entry_point = "todo4ai_executable.py"
    with open(entry_point, "w") as f:
        f.write("""#!/usr/bin/env python3
import sys
from todo4ai_client.cli import main

if __name__ == "__main__":
    sys.exit(main())
""")
    
    # Build the executable
    print("Building executable...")
    subprocess.check_call([
        "pyinstaller",
        "--onefile",  # Create a single executable file
        "--name", "todo4ai-client",
        entry_point
    ])
    
    # Clean up
    os.unlink(entry_point)
    
    # Show the result
    exe_path = Path("dist/todo4ai-client")
    if sys.platform == "win32":
        exe_path = Path("dist/todo4ai-client.exe")
    
    if exe_path.exists():
        size_bytes = exe_path.stat().st_size
        size_mb = size_bytes / (1024 * 1024)
        print(f"\nExecutable created successfully: {exe_path}")
        print(f"Size: {size_mb:.2f} MB ({size_bytes:,} bytes)")
    else:
        print("Failed to create executable")

if __name__ == "__main__":
    main()
