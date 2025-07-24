"""
TODO for AI Edge - Python client for TODO for AI service
"""

from .client import TODOforAIEdge
from .apikey import authenticate_and_get_api_key
from .constants.constants import (
    ServerResponse, Front2Edge, Edge2Agent, Agent2Edge, Edge2Front,
    SR, FE, EA, AE, EF
)
from .config import Config

__version__ = "0.10.73"  # Changed from "0.1.0" to match pyproject.toml
