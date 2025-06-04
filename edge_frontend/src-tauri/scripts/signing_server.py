#!/usr/bin/env python3
import os
import subprocess
import tempfile
import hashlib
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Security: Use API key authentication
API_KEY = os.environ.get('SIGNING_API_KEY', 'your-secret-api-key')
ALLOWED_EXTENSIONS = {'.exe', '.msi', '.dll'}

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
        result = subprocess.run([
            'powershell.exe', '-ExecutionPolicy', 'Bypass', '-File', 
            'scripts/sign_file.ps1', '-FilePath', temp_path
        ], capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__)))
        
        if result.returncode != 0:
            app.logger.error(f"Signing failed: {result.stderr}")
            os.unlink(temp_path)
            return jsonify({'error': f'Signing failed: {result.stderr}'}), 500
        
        # Calculate hash after signing
        with open(temp_path, 'rb') as f:
            signed_hash = hashlib.sha256(f.read()).hexdigest()
        
        app.logger.info(f"Successfully signed file (new hash: {signed_hash[:16]}...)")
        
        # Return the signed file
        return send_file(temp_path, as_attachment=True, 
                        download_name=f"signed_{file.filename}",
                        mimetype='application/octet-stream')
    
    except Exception as e:
        app.logger.error(f"Error during signing: {str(e)}")
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.unlink(temp_path)
        return jsonify({'error': f'Internal error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'code-signing'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)