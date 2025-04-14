#!/usr/bin/env python3
from setuptools import setup

# This file is here for backward compatibility with older pip versions
# Modern installations will use pyproject.toml instead
setup(
entry_points={
    'console_scripts': [
        'todoforai-edge=todoforai_edge.app:main',  # Changed from cli:main to app:main
    ],
},
)
