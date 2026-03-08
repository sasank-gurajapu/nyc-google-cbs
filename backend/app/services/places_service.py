"""
Places API Service — wraps Google Maps Places API (New).

Provides:
  - text_search: Search for places by a text query
  - nearby_search: Find places near a lat/lng
  - place_details: Get full details for a single place
  - place_photos: Get a photo URL for a place photo reference
  - autocomplete: Get place predictions as the user types
"""

from __future__ import annotations

import httpx
from app.config import SETTINGS

API_KEY = SETTINGS["GOOGLE_API_KEY"]

# ──────────────────────────────────────────────
# Places API (New) — uses the v1 REST endpoints
# ──────────────────────────────────────────────

PLACES_BASE = "https://places.googleapis.com/v1"

COMMON_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.location,places.rating,places.userRatingCount,"
    "places.types,places.websiteUri,places.nationalPhoneNumber,"
    "places.currentOpeningHours,places.priceLevel,"
    "places.photos,places.editorialSummary,places.reviews"
)

DETAIL_FIELD_MASK = (
    "id,displayName,formattedAddress,location,rating,"
    "userRatingCount,types,websiteUri,nationalPhoneNumber,"
    "currentOpeningHours,priceLevel,photos,editorialSummary,"
    "reviews,goodForChildren,parkingOptions,accessibilityOptions"
)


async def text_search(
    query: str,
    location_bias: dict | None = None,
    max_results: int = 10,
) -> dict:
    """
    Search for places using a free-form text query.
    e.g. "best pizza in Manhattan"
    """
    body: dict = {
        "textQuery": query,
        "maxResultCount": max_results,
        "languageCode": "en",
    }
    if location_bias:
        # location_bias = {"latitude": ..., "longitude": ..., "radius": ...}
        body["locationBias"] = {
            "circle": {
                "center": {
                    "latitude": location_bias["latitude"],
                    "longitude": location_bias["longitude"],
                },
                "radius": location_bias.get("radius", 5000),
            }
        }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PLACES_BASE}/places:searchText",
            json=body,
            headers={
                "X-Goog-Api-Key": API_KEY,
                "X-Goog-FieldMask": COMMON_FIELD_MASK,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def nearby_search(
    latitude: float,
    longitude: float,
    radius: float = 1000,
    included_types: list[str] | None = None,
    max_results: int = 10,
) -> dict:
    """
    Find places near a given point.
    included_types example: ["restaurant", "cafe"]
    """
    body: dict = {
        "locationRestriction": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": radius,
            }
        },
        "maxResultCount": max_results,
        "languageCode": "en",
    }
    if included_types:
        body["includedTypes"] = included_types

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PLACES_BASE}/places:searchNearby",
            json=body,
            headers={
                "X-Goog-Api-Key": API_KEY,
                "X-Goog-FieldMask": COMMON_FIELD_MASK,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def place_details(place_id: str) -> dict:
    """
    Get rich details for a single place by its place ID.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{PLACES_BASE}/places/{place_id}",
            headers={
                "X-Goog-Api-Key": API_KEY,
                "X-Goog-FieldMask": DETAIL_FIELD_MASK,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def place_photos(photo_name: str, max_width: int = 400) -> str:
    """
    Return a usable photo URL from a Places photo resource name.
    photo_name looks like: "places/<id>/photos/<ref>"
    """
    url = (
        f"{PLACES_BASE}/{photo_name}/media"
        f"?maxWidthPx={max_width}&key={API_KEY}"
    )
    return url


async def autocomplete(query: str, location_bias: dict | None = None) -> dict:
    """
    Get autocomplete predictions for a partial query.
    """
    body: dict = {
        "input": query,
        "languageCode": "en",
    }
    if location_bias:
        body["locationBias"] = {
            "circle": {
                "center": {
                    "latitude": location_bias["latitude"],
                    "longitude": location_bias["longitude"],
                },
                "radius": location_bias.get("radius", 50000),
            }
        }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PLACES_BASE}/places:autocomplete",
            json=body,
            headers={
                "X-Goog-Api-Key": API_KEY,
            },
        )
        resp.raise_for_status()
        return resp.json()
