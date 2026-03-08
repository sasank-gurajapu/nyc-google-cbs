"""
Routes API Service — directions, travel time, distance, polylines.

Uses the Google Routes API (v2) REST endpoint.
"""

from __future__ import annotations

import httpx
from app.config import SETTINGS

API_KEY = SETTINGS["GOOGLE_API_KEY"]

ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

FIELD_MASK = (
    "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,"
    "routes.legs,routes.travelAdvisory,routes.routeLabels"
)


async def compute_routes(
    origin: dict,
    destination: dict,
    travel_mode: str = "DRIVE",
    compute_alternatives: bool = True,
    departure_time: str | None = None,
    waypoints: list[dict] | None = None,
) -> dict:
    """
    Compute one or more routes between an origin and destination.

    Parameters:
      origin        — {"address": "..."} or {"latitude": ..., "longitude": ...}
      destination   — same format as origin
      travel_mode   — DRIVE | WALK | BICYCLE | TRANSIT | TWO_WHEELER
      compute_alternatives — whether to return alternate routes
      departure_time — RFC 3339 timestamp for traffic-aware routing
      waypoints     — list of intermediate stops, same format as origin

    Returns the full Routes API response with legs, duration, distance, polyline.
    """

    def _to_waypoint(loc: dict) -> dict:
        if "address" in loc:
            return {"address": loc["address"]}
        return {
            "location": {
                "latLng": {
                    "latitude": loc["latitude"],
                    "longitude": loc["longitude"],
                }
            }
        }

    body: dict = {
        "origin": {"waypoint": _to_waypoint(origin)},
        "destination": {"waypoint": _to_waypoint(destination)},
        "travelMode": travel_mode,
        "computeAlternativeRoutes": compute_alternatives,
        "routingPreference": "TRAFFIC_AWARE" if travel_mode == "DRIVE" else "ROUTING_PREFERENCE_UNSPECIFIED",
        "polylineEncoding": "ENCODED_POLYLINE",
    }

    if departure_time:
        body["departureTime"] = departure_time

    if waypoints:
        body["intermediates"] = [
            {"waypoint": _to_waypoint(wp)} for wp in waypoints
        ]

    headers = {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(ROUTES_URL, json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()
