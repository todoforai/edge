#!/usr/bin/env python3
import os
import subprocess
import tempfile
import hashlib
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
import logging
import time

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Security: Use API key authentication
API_KEY = 'win_signer_todoforai_2025_api_key'
ALLOWED_EXTENSIONS = {'.exe', '.msi', '.dll'}
# curl -X POST -H "Authorization: Bearer your-secret-api-key" -F "file=@todoforai-edge-windows-x64 (9).msi" http://signer.sixzero.xyz/sign -o "todoforai-edge-windows-x64 (9).signed.msi"

def verify_api_key():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split(' ')[1]
    return token == API_KEY

@app.route('/sign', methods=['POST'])
def sign_file():
    if not verify_api_key():
        return jsonify({'error': 'Unauthorized'}), 401
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    
    # Validate file extension
    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': f'Unsupported file type: {ext}'}), 400
    
    temp_path = None
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name
        
        # Calculate hash before signing
        with open(temp_path, 'rb') as f:
            original_hash = hashlib.sha256(f.read()).hexdigest()
        
        app.logger.info(f"Signing file: {file.filename} (hash: {original_hash[:16]}...)")
        
        # Sign the file using PowerShell script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sign_script = os.path.join(script_dir, 'sign_file.ps1')
        
        if not os.path.exists(sign_script):
            app.logger.error(f"Sign script not found: {sign_script}")
            return jsonify({'error': f'Sign script not found: {sign_script}'}), 500
        
        app.logger.info(f"Using sign script: {sign_script}")
        
        result = subprocess.run([
            'powershell.exe', '-ExecutionPolicy', 'Bypass', '-File', 
            sign_script, '-FilePath', temp_path
        ], capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            app.logger.error(f"Signing failed: {result.stderr}")
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
            return jsonify({'error': f'Signing failed: {result.stderr}'}), 500
        
        # Add a small delay to ensure file is released by Windows
        time.sleep(0.5)
        
        # Verify file exists and is readable
        if not os.path.exists(temp_path):
            app.logger.error("Signed file disappeared!")
            return jsonify({'error': 'Signed file not found after signing'}), 500
        
        try:
            file_size = os.path.getsize(temp_path)
            app.logger.info(f"Signed file size: {file_size / 1024 / 1024:.2f} MB")
            
            # Try to open the file to ensure it's not locked
            with open(temp_path, 'rb') as test_read:
                test_read.read(1)  # Read one byte to test
                
        except Exception as e:
            app.logger.error(f"Cannot read signed file: {str(e)}")
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
            return jsonify({'error': f'Cannot read signed file: {str(e)}'}), 500
        
        # Calculate hash after signing
        with open(temp_path, 'rb') as f:
            signed_hash = hashlib.sha256(f.read()).hexdigest()
        
        app.logger.info(f"Successfully signed file (new hash: {signed_hash[:16]}...)")
        
        # Return the signed file
        def cleanup_file():
            try:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
            except Exception as cleanup_error:
                app.logger.warning(f"Failed to cleanup temp file: {cleanup_error}")
        
        response = send_file(temp_path, as_attachment=True, 
                           download_name=f"signed_{file.filename}",
                           mimetype='application/octet-stream')
        response.call_on_close(cleanup_file)
        return response
    
    except subprocess.TimeoutExpired:
        app.logger.error("Signing process timed out")
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
        return jsonify({'error': 'Signing process timed out'}), 500
    except Exception as e:
        app.logger.error(f"Error during signing: {str(e)}")
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
        return jsonify({'error': f'Internal error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'code-signing'})

if __name__ == '__main__':
    print(f"🔐 Code Signing Server Starting")
    print(f"📋 Required API Key: {API_KEY}")
    print(f"🌐 Server will run on: http://0.0.0.0:9999")
    print(f"💡 Usage: curl -X POST -H \"Authorization: Bearer {API_KEY}\" -F \"file=@yourfile.exe\" http://localhost:9999/sign -o signed_file.exe")
    print("-" * 80)
    app.run(host='0.0.0.0', port=9999, debug=False)