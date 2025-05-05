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
    
    # Install PyInstaller if not already installed
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "PyInstaller"])
    
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
from todoforai_edge.ui import run_ui

if __name__ == "__main__":
    run_ui()
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
    
    # For macOS, determine if we're on Apple Silicon or Intel
    target_arch = None
    if is_macos:
        # Get the current architecture
        current_arch = platform.machine()
        print(f"Current architecture: {current_arch}")
        
        # On GitHub Actions, we need to specify the target architecture
        # because the runner might be different from the target
        if os.environ.get("GITHUB_ACTIONS") == "true":
            # For GitHub Actions, build a universal binary
            target_arch = "universal2"
            print(f"Building for universal2 architecture (both Intel and Apple Silicon)")
        else:
            # For local builds, use the current architecture
            target_arch = "universal2" if current_arch == "arm64" else None
            print(f"Building for architecture: {target_arch or 'default'}")
    
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
    hiddenimports=[],
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
    target_arch={"None" if target_arch is None else f"'{target_arch}'"},
    codesign_identity=None,
    entitlements_file=None,
    icon='todoforai_edge/ui/icon.ico' if os.path.exists('todoforai_edge/ui/icon.ico') else None,
)
""")
    
    # Build the executable with the custom spec file
    print("Building minimal executable...")
    
    # For macOS on GitHub Actions, we need to ensure PyInstaller can build universal2 binaries
    if is_macos and os.environ.get("GITHUB_ACTIONS") == "true":
        print("Setting up for universal2 build on macOS...")
        # Install the arm64 and x86_64 versions of Python dependencies
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", 
            "--upgrade", "--force-reinstall", 
            "--target", "arm64-site-packages",
            "--platform", "macosx_11_0_arm64", 
            "--only-binary=:all:", 
            "websockets>=10.4", "requests>=2.25.0"
        ])
        
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", 
            "--upgrade", "--force-reinstall", 
            "--target", "x86_64-site-packages",
            "--platform", "macosx_10_15_x86_64", 
            "--only-binary=:all:", 
            "websockets>=10.4", "requests>=2.25.0"
        ])
        
        # Set PYTHONPATH to include both architectures
        os.environ["PYTHONPATH"] = f"arm64-site-packages:x86_64-site-packages:{os.environ.get('PYTHONPATH', '')}"
    
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
                
                # If we're on GitHub Actions and the binary is not universal2, print a warning
                if os.environ.get("GITHUB_ACTIONS") == "true" and "universal binary" not in result.stdout:
                    print("WARNING: The binary is not a universal binary. It may not work on all Macs.")
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
