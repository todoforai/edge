#!/usr/bin/env python3
import unittest
import json
import tempfile
import os
import sys
from unittest.mock import patch, MagicMock
import subprocess

# Add the scripts directory to the path to import the signing server
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from signing_server import app

class TestSigningServer(unittest.TestCase):
    def setUp(self):
        """Set up test edge"""
        app.config['TESTING'] = True
        self.edge = app.test_edge()
        self.api_key = 'win_signer_todoforai_2025_api_key'
        self.headers = {'Authorization': f'Bearer {self.api_key}'}

    def test_health_endpoint(self):
        """Test the basic health endpoint"""
        response = self.edge.get('/health')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'healthy')
        self.assertEqual(data['service'], 'code-signing')

    @patch('signing_server.subprocess.run')
    @patch('signing_server.os.path.exists')
    def test_status_endpoint_available(self, mock_exists, mock_subprocess):
        """Test status endpoint when service is available"""
        # Mock that sign script exists
        mock_exists.return_value = True
        
        # Mock successful PowerShell test
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_subprocess.return_value = mock_result
        
        response = self.edge.get('/status')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'available')
        self.assertEqual(data['service'], 'code-signing')
        self.assertTrue(data['ready'])
        
        # Verify PowerShell was tested
        mock_subprocess.assert_called_once_with([
            'powershell.exe', '-Command', 'Write-Output "test"'
        ], capture_output=True, text=True, timeout=5)

    @patch('signing_server.os.path.exists')
    def test_status_endpoint_script_missing(self, mock_exists):
        """Test status endpoint when sign script is missing"""
        # Mock that sign script doesn't exist
        mock_exists.return_value = False
        
        response = self.edge.get('/status')
        self.assertEqual(response.status_code, 503)
        
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'unavailable')
        self.assertEqual(data['service'], 'code-signing')
        self.assertEqual(data['error'], 'Sign script not found')

    @patch('signing_server.subprocess.run')
    @patch('signing_server.os.path.exists')
    def test_status_endpoint_powershell_unavailable(self, mock_exists, mock_subprocess):
        """Test status endpoint when PowerShell is unavailable"""
        # Mock that sign script exists
        mock_exists.return_value = True
        
        # Mock failed PowerShell test
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_subprocess.return_value = mock_result
        
        response = self.edge.get('/status')
        self.assertEqual(response.status_code, 503)
        
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'unavailable')
        self.assertEqual(data['service'], 'code-signing')
        self.assertEqual(data['error'], 'PowerShell not available')

    @patch('signing_server.subprocess.run')
    @patch('signing_server.os.path.exists')
    def test_status_endpoint_powershell_timeout(self, mock_exists, mock_subprocess):
        """Test status endpoint when PowerShell times out"""
        # Mock that sign script exists
        mock_exists.return_value = True
        
        # Mock PowerShell timeout
        mock_subprocess.side_effect = subprocess.TimeoutExpired('powershell.exe', 5)
        
        response = self.edge.get('/status')
        self.assertEqual(response.status_code, 503)
        
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'unavailable')
        self.assertEqual(data['service'], 'code-signing')
        self.assertIn('TimeoutExpired', data['error'])

    @patch('signing_server.subprocess.run')
    @patch('signing_server.os.path.exists')
    def test_status_endpoint_exception(self, mock_exists, mock_subprocess):
        """Test status endpoint when an unexpected exception occurs"""
        # Mock that sign script exists
        mock_exists.return_value = True
        
        # Mock unexpected exception
        mock_subprocess.side_effect = Exception("Unexpected error")
        
        response = self.edge.get('/status')
        self.assertEqual(response.status_code, 503)
        
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'unavailable')
        self.assertEqual(data['service'], 'code-signing')
        self.assertEqual(data['error'], 'Unexpected error')

    def test_status_endpoint_no_auth_required(self):
        """Test that status endpoint doesn't require authentication"""
        # Call without auth headers
        response = self.edge.get('/status')
        # Should not return 401 (unauthorized)
        self.assertNotEqual(response.status_code, 401)
        # Should return either 200 or 503 depending on system state
        self.assertIn(response.status_code, [200, 503])

if __name__ == '__main__':
    unittest.main()