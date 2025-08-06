#!/usr/bin/env python3
"""
Simple script to build the WebSocket sidecar executable
"""
import subprocess
import sys
from pathlib import Path

def main():
    script_dir = Path(__file__).parent
    sidecar_path = script_dir / "edge_frontend/src-tauri/resources/python/ws_sidecar.py"
    
    # Simple PyInstaller command with just the essentials
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", "todoforai-edge-sidecar",
        "--hidden-import", "todoforai_edge",
        "--hidden-import", "fastmcp",
        "--hidden-import", "pydantic",
        "--collect-all", "fastmcp",  # This collects all fastmcp metadata
        "--collect-all", "pydantic",
        str(sidecar_path)
    ]
    
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=script_dir)
    
    if result.returncode == 0:
        print("✅ Build successful!")
        exe_path = script_dir / "dist/todoforai-edge-sidecar"
        if exe_path.exists():
            size_mb = exe_path.stat().st_size / (1024 * 1024)
            print(f"📦 Executable: {exe_path} ({size_mb:.1f} MB)")
    else:
        print("❌ Build failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()