"""
Todo4AI Client - Python client for Todo4AI service
"""

from .client import TODOforAIEdge
from .apikey import authenticate_and_get_api_key
from .constants import (
    ServerResponse, Front2Edge, Edge2Agent, Agent2Edge, Edge2Front,
    SR, FE, EA, AE, EF
)


__version__ = "0.1.0"
