"""
Geocoding API Service — convert between addresses and coordinates.

Provides:
  - geocode:         address string  →  lat/lng + components
  - reverse_geocode: lat/lng         →  formatted address + components
"""

import httpx
from app.config import SETTINGS

API_KEY = SETTINGS["GOOGLE_API_KEY"]

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


async def geocode(address: str) -> dict:
    """
    Forward geocoding — convert a human-readable address to coordinates.
    Returns the full Google Geocoding API response.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GEOCODE_URL,
            params={"address": address, "key": API_KEY},
        )
        resp.raise_for_status()
        return resp.json()


async def reverse_geocode(latitude: float, longitude: float) -> dict:
    """
    Reverse geocoding — convert lat/lng to a human-readable address.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GEOCODE_URL,
            params={
                "latlng": f"{latitude},{longitude}",
                "key": API_KEY,
            },
        )
        resp.raise_for_status()
        return resp.json()
