"""
Application configuration — loads settings from the project-root config.
"""

import os
import sys

# Add project root to path so we can import the root-level config.py
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from config import GOOGLE_API_KEY, GEMINI_API_KEY  # noqa: E402

SETTINGS = {
    "GOOGLE_API_KEY": GOOGLE_API_KEY,
    "GEMINI_API_KEY": GEMINI_API_KEY,
}
