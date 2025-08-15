#!/usr/bin/env python3
"""
Simple wrapper script to run the TODOforAI Edge client directly.
This avoids the relative import issues when running app.py directly.
"""
import sys
import os

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Import and run the main function
from todoforai_edge.app import main

if __name__ == "__main__":
    main()
