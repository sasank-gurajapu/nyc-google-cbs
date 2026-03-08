"""
Places Aggregate API Service — provides density/distribution insights.

Lets you understand how many places of a given type exist in a geographic area.
"""

from __future__ import annotations

import httpx
from app.config import SETTINGS

API_KEY = SETTINGS["GOOGLE_API_KEY"]

AGGREGATE_BASE = "https://places.googleapis.com/v1/places:aggregate"


async def aggregate_places(
    latitude: float,
    longitude: float,
    radius: float = 5000,
    included_types: list[str] | None = None,
) -> dict:
    """
    Get aggregate statistics (count / density) of places within a circle.

    Parameters:
      latitude, longitude — center of the search area
      radius — meters
      included_types — e.g. ["restaurant", "park", "hospital"]

    Returns Google's aggregate response with counts per type.
    """
    body: dict = {
        "locationRestriction": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": radius,
            }
        },
    }
    if included_types:
        body["includedTypes"] = included_types

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            AGGREGATE_BASE,
            json=body,
            headers={
                "X-Goog-Api-Key": API_KEY,
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        return resp.json()
