#!/usr/bin/env python3
"""
Script to build a minimal standalone executable from the todoforai-edge package
that runs the WebSocket sidecar for Tauri integration
"""
import os
import sys
import subprocess
import shutil
import platform
from pathlib import Path

def run_command(cmd, cwd=None):
    """Run a command and print its output in real-time"""
    print(f"Running: {' '.join(str(c) for c in cmd)}")
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=cwd
    )
    
    for line in iter(process.stdout.readline, ''):
        print(line.rstrip())
    
    process.stdout.close()
    return_code = process.wait()
    
    if return_code != 0:
        print(f"Command failed with return code {return_code}")
        sys.exit(return_code)

def main():
    # Ensure we're in the right directory
    script_dir = Path(__file__).parent.absolute()
    os.chdir(script_dir)
    
    # Determine the system
    system = platform.system().lower()
    print(f"Building for {system} platform")
    
    # Install PyInstaller if not already installed
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        run_command([sys.executable, "-m", "pip", "install", "PyInstaller"])
    
    # Install required dependencies
    print("Installing required dependencies...")
    run_command([sys.executable, "-m", "pip", "install", "-e", "."])
    run_command([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
    
    # Path to the WebSocket sidecar script - use Path for proper cross-platform handling
    sidecar_path = script_dir / "edge_frontend" / "src-tauri" / "resources" / "python" / "ws_sidecar.py"
    
    if not sidecar_path.exists():
        print(f"Error: WebSocket sidecar script not found at {sidecar_path}")
        sys.exit(1)
    
    print(f"Using WebSocket sidecar script: {sidecar_path}")
    
    # Determine platform-specific hidden imports
    hidden_imports = [
        'asyncio',
        'websockets',
        'websockets.server',
        'websockets.client',
        'websockets.exceptions',
        'requests',
        'dotenv',
        'watchdog',
        'watchdog.observers',
        'watchdog.events',
        'threading',
        'logging',
        'argparse',
        
        # SSL and crypto modules - critical for Windows
        'ssl',
        '_ssl',
        'hashlib',
        '_hashlib',
        'urllib3',
        'urllib3.util.ssl_',
        'urllib3.contrib.pyopenssl',
        'certifi',
        
        # Ensure all todoforai_edge modules are included
        'todoforai_edge',
        'todoforai_edge.client',
        'todoforai_edge.config',
        'todoforai_edge.file_sync',
        'todoforai_edge.handlers',
        'todoforai_edge.workspace_handler',
        'todoforai_edge.shell_handler',
        'todoforai_edge.messages',
        'todoforai_edge.utils',
        'todoforai_edge.constants',
        'todoforai_edge.apikey',
        'todoforai_edge.protocol_handler',
        'todoforai_edge.arg_parser'
    ]
    
    # Add platform-specific imports
    if system == "windows":
        hidden_imports.extend([
            'winreg',
            '_winapi',
            'msvcrt',
            'winsound'
        ])
    elif system == "darwin":
        hidden_imports.append('plistlib')
    
    # Create a spec file with optimizations
    spec_file = "todoforai_edge_sidecar.spec"
    
    # Determine output name based on platform
    output_name = "todoforai-edge-sidecar"
    if system == "windows":
        output_name += ".exe"
    
    # Find the todoforai_edge package location
    # This is critical for editable installs
    todoforai_edge_path = script_dir
    
    # Convert paths to strings with proper format for the platform
    sidecar_path_str = str(sidecar_path).replace('\\', '\\\\')
    script_dir_str = str(script_dir).replace('\\', '\\\\')
    
    # Get SSL certificate bundle path for Windows - properly escaped
    ssl_datas = ""
    if system == "windows":
        try:
            import certifi
            cert_path = certifi.where().replace('\\', '\\\\')
            ssl_datas = f"('{cert_path}', 'certifi'),"
            print(f"Including SSL certificates from: {cert_path}")
        except ImportError:
            print("certifi not available, SSL certificates may not work")
    
    with open(spec_file, "w") as f:
        f.write(f"""# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

# Include data files
datas = [
    {ssl_datas}
]

a = Analysis(
    ['{sidecar_path_str}'],
    pathex=['{script_dir_str}'],  # Add project root to search path
    binaries=[],
    datas=datas,
    hiddenimports={hidden_imports + ['todoforai_edge.*']},  # Include all submodules
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[
        'matplotlib', 'numpy', 'pandas', 'PIL', 'PyQt5', 
        'PySide2', 'IPython', 'notebook', 'scipy',
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
    name='{output_name}',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="",
)
""")
    
    # Build the executable with the spec file
    print("Building WebSocket sidecar executable...")
    run_command([sys.executable, "-m", "PyInstaller", "--clean", spec_file])
    
    # Clean up
    os.unlink(spec_file)
    
    # Show the result
    exe_path = Path(f"dist/{output_name}")
    
    if exe_path.exists():
        size_bytes = exe_path.stat().st_size
        size_mb = size_bytes / (1024 * 1024)
        print(f"\nWebSocket sidecar executable created successfully: {exe_path}")
        print(f"Size: {size_mb:.2f} MB ({size_bytes:,} bytes)")
        
        print("\nUsage:")
        print(f"  {output_name} --host 127.0.0.1 --port 9528 [--debug]")
        print("\nThis executable runs the WebSocket sidecar that communicates with the Tauri frontend.")
        print("It eliminates the need for a separate Python installation.")
    else:
        print("Failed to create executable")

if __name__ == "__main__":
    main()