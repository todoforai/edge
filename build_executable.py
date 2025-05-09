#!/usr/bin/env python3
"""
Script to build a minimal standalone executable from the todoforai-edge package
"""
import os
import sys
import subprocess
import shutil
import platform
from pathlib import Path

def main():
    # Ensure we're in the right directory
    os.chdir(Path(__file__).parent)
    
    # Install PyInstaller and required dependencies if not already installed
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "PyInstaller"])
    
    # Install required dependencies from requirements.txt
    print("Installing required dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
    
    # Find the Azure theme directory
    theme_dir = Path("todoforai_edge/ui/")
    
    if theme_dir.exists() and theme_dir.is_dir():
        print(f"Found Azure theme directory at: {theme_dir}")
    
    if not theme_dir:
        print("Azure theme directory not found. The executable may not have proper styling.")
    
    # Create a simple entry point script
    entry_point = "todoforai_executable.py"
    with open(entry_point, "w") as f:
        f.write("""#!/usr/bin/env python3
import sys
import asyncio
from todoforai_edge.app import run_app

if __name__ == "__main__":
    asyncio.run(run_app())
""")
    
    # Create a custom spec file with more aggressive optimizations
    spec_file = "todoforai_edge_minimal.spec"
    
    # Determine the correct path for the Azure theme
    theme_data = []
    if theme_dir:
        # Include the entire theme directory in the executable
        # We need to make sure the theme directory is included with its full path structure
        theme_data = [(str(theme_dir), str(theme_dir))]
        print(f"Adding theme {theme_data}")
    
    # Check if we're on macOS
    is_macos = sys.platform == "darwin"
    
    # For macOS, determine the current architecture
    target_arch = None
    if is_macos:
        # Get the current architecture
        current_arch = platform.machine()
        print(f"Current architecture: {current_arch}")
        
        # We'll build for the native architecture only
        # The universal binary will be created by merging in the GitHub workflow
        print(f"Building for native architecture: {current_arch}")
    
    with open(spec_file, "w") as f:
        f.write(f"""# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

# Include the Azure theme files
datas = {theme_data}

a = Analysis(
    ['todoforai_executable.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'asyncio', 'tkinter', 'dotenv', 'customtkinter', 'watchdog',
        'todoforai_edge.ui', 'todoforai_edge.ui.auth_window', 'todoforai_edge.ui.client_window',
        'websockets', 'requests'
    ],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[
        'matplotlib', 'numpy', 'pandas', 'PIL', 'PyQt5', 
        'PySide2', 'IPython', 'notebook', 'scipy', 'cryptography',
        'unittest', 'pydoc', 'doctest', 'pdb', 
        'pydoc_data', 'test', 'distutils', 'setuptools', 'curses', 
        'lib2to3', 'pkg_resources'
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='todoforai-edge',
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Changed to True for debugging (you can change back to False later)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,  # Build for native architecture only
    codesign_identity=None,
    entitlements_file=None,
    icon='todoforai_edge/ui/icon.ico' if os.path.exists('todoforai_edge/ui/icon.ico') else None,
)
""")
    
    # Build the executable with the custom spec file
    print("Building minimal executable...")
    
    # Build the executable
    subprocess.check_call([
        "pyinstaller",
        "--clean",
        spec_file
    ])
    
    # Clean up
    os.unlink(entry_point)
    os.unlink(spec_file)
    
    # Show the result
    exe_path = Path("dist/todoforai-edge")
    if sys.platform == "win32":
        exe_path = Path("dist/todoforai-edge.exe")
    
    if exe_path.exists():
        size_bytes = exe_path.stat().st_size
        size_mb = size_bytes / (1024 * 1024)
        print(f"\nMinimal executable created successfully: {exe_path}")
        print(f"Size: {size_mb:.2f} MB ({size_bytes:,} bytes)")
        
        # For macOS, check the architecture of the built binary
        if is_macos:
            try:
                result = subprocess.run(["file", str(exe_path)], capture_output=True, text=True)
                print(f"Binary architecture: {result.stdout.strip()}")
            except subprocess.SubprocessError:
                print("Could not determine binary architecture")
        
        # Try to compress with UPX if available
        try:
            print("\nAttempting further compression with UPX...")
            subprocess.check_call(["upx", "--best", str(exe_path)])
            
            # Show compressed size
            size_bytes = exe_path.stat().st_size
            size_mb = size_bytes / (1024 * 1024)
            print(f"Compressed size: {size_mb:.2f} MB ({size_bytes:,} bytes)")
        except (subprocess.SubprocessError, FileNotFoundError):
            print("UPX compression not available or failed. Install UPX for further size reduction.")
    else:
        print("Failed to create executable")

if __name__ == "__main__":
    main()
