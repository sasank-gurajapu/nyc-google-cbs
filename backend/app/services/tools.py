"""
Shared tool declarations and executor for both the standard Gemini agent
and the Gemini Live real-time agent.

All Google Maps API tool definitions live here so they stay in sync.
"""

from __future__ import annotations

import json
from typing import Dict

from google.genai import types

from app.services import (
    places_service,
    places_aggregate_service,
    geocoding_service,
    routes_service,
)

# ── System instruction (shared) ────────────────────────────────────

SYSTEM_INSTRUCTION = """\
You are a friendly, knowledgeable local assistant powered by Google Maps data.
You have a warm, conversational tone — like a local friend who knows the area well.

IMPORTANT — USER LOCATION:
The user's current coordinates will be provided at the start of each session.
ALWAYS use these coordinates when calling tools like nearby_search or text_search
to give location-relevant results. Do NOT assume they are in NYC or any specific city.

CONVERSATION CONTEXT:
- If the user asks the same or similar question multiple times, treat it as ONE question.
- Do NOT repeat the same search — just acknowledge and refine if needed.
- Remember what you already told them and build on it.
- If they're repeating, gently clarify: "I just shared some options — would you like more details on any of them?"

When the user asks a question, decide which Google Maps API tool(s) you need
to call to answer it. You may call multiple tools in sequence if needed.

TOOL SELECTION RULES:
- Finding places (restaurants, parks, shops, etc.) → use text_search or nearby_search.
- Specific place details, hours, reviews → use place_details.
- Need coordinates for an address/landmark → use geocode first, then other tools.
- Directions, travel time, routes → use compute_routes.
- Counting places, density, distribution → use aggregate_places.
- Address/landmark mentioned → geocode it first before nearby_search or aggregate_places.
- ALWAYS pass the user's latitude/longitude to location-based tools.

RESPONSE RULES — THIS IS CRITICAL:
- After receiving API results, you MUST immediately speak about them.
- Keep your responses BRIEF and highly conversational. Sound like a real person on a phone call.
- Select the TOP 2-3 BEST options to mention. Do NOT overwhelm the user with long lists.
- Mention key facts naturally: name, why it's good, rating, distance.
- Do NOT read full addresses or exact numerical coordinates. Use conversational directions ("just a few blocks away", "on 5th Ave").
- Never dump raw data. Be selective, concise, and helpful.
- If no results are found, say so kindly and suggest alternatives.
- ALWAYS continue speaking after tool calls complete — never stay silent.\
"""

# ── Tool function declarations ──────────────────────────────────────

text_search_decl = types.FunctionDeclaration(
    name="text_search",
    description=(
        "Search for places using a free-form text query. "
        "Good for questions like 'best pizza in Manhattan' or "
        "'museums near Central Park'. Returns a list of places "
        "with name, address, rating, location, types, phone, "
        "website, hours, price level, photos, and reviews."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "query": types.Schema(type="STRING", description="The search query, e.g. 'Italian restaurants in SoHo NYC'"),
            "latitude": types.Schema(type="NUMBER", description="Optional latitude to bias results toward"),
            "longitude": types.Schema(type="NUMBER", description="Optional longitude to bias results toward"),
            "radius": types.Schema(type="NUMBER", description="Search radius in meters (default 5000)"),
            "max_results": types.Schema(type="INTEGER", description="Max number of results to return (default 10, max 20)"),
        },
        required=["query"],
    ),
)

nearby_search_decl = types.FunctionDeclaration(
    name="nearby_search",
    description=(
        "Find places near a specific latitude/longitude. "
        "Use when the user asks 'what's near X' or 'restaurants "
        "within 500m of here'. You must provide lat/lng. "
        "Returns places with name, address, rating, types, etc."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "latitude": types.Schema(type="NUMBER", description="Latitude of the center point"),
            "longitude": types.Schema(type="NUMBER", description="Longitude of the center point"),
            "radius": types.Schema(type="NUMBER", description="Search radius in meters (default 1000)"),
            "included_types": types.Schema(
                type="ARRAY",
                items=types.Schema(type="STRING"),
                description="Place types to filter by, e.g. ['restaurant', 'cafe']",
            ),
            "max_results": types.Schema(type="INTEGER", description="Max number of results (default 10)"),
        },
        required=["latitude", "longitude"],
    ),
)

place_details_decl = types.FunctionDeclaration(
    name="place_details",
    description=(
        "Get detailed information about a specific place by its "
        "place ID. Returns name, address, phone, website, hours, "
        "rating, reviews, price level, photos, accessibility, "
        "parking options, and more."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "place_id": types.Schema(type="STRING", description="The Google Place ID"),
        },
        required=["place_id"],
    ),
)

geocode_decl = types.FunctionDeclaration(
    name="geocode",
    description=(
        "Convert a human-readable address or landmark name into "
        "latitude/longitude coordinates and address components. "
        "Use this when you need coordinates for other tools."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "address": types.Schema(type="STRING", description="The address or landmark, e.g. 'Empire State Building'"),
        },
        required=["address"],
    ),
)

reverse_geocode_decl = types.FunctionDeclaration(
    name="reverse_geocode",
    description="Convert latitude/longitude coordinates into a human-readable address.",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "latitude": types.Schema(type="NUMBER", description="Latitude"),
            "longitude": types.Schema(type="NUMBER", description="Longitude"),
        },
        required=["latitude", "longitude"],
    ),
)

compute_routes_decl = types.FunctionDeclaration(
    name="compute_routes",
    description=(
        "Compute directions / routes between an origin and "
        "destination. Returns duration, distance, polyline, "
        "step-by-step legs, and traffic info. Supports driving, "
        "walking, bicycling, and transit."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "origin_address": types.Schema(type="STRING", description="Starting address or landmark"),
            "destination_address": types.Schema(type="STRING", description="Ending address or landmark"),
            "travel_mode": types.Schema(type="STRING", description="Mode of transport: DRIVE, WALK, BICYCLE, or TRANSIT (default DRIVE)"),
        },
        required=["origin_address", "destination_address"],
    ),
)

aggregate_places_decl = types.FunctionDeclaration(
    name="aggregate_places",
    description=(
        "Get aggregate statistics (count/density) of places "
        "of certain types within a geographic area. Great for "
        "questions like 'how many restaurants are within 1km of "
        "Times Square' or 'density of parks in Brooklyn'."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "latitude": types.Schema(type="NUMBER", description="Latitude of the center point"),
            "longitude": types.Schema(type="NUMBER", description="Longitude of the center point"),
            "radius": types.Schema(type="NUMBER", description="Radius in meters (default 5000)"),
            "included_types": types.Schema(
                type="ARRAY",
                items=types.Schema(type="STRING"),
                description="Place types to count, e.g. ['restaurant', 'park']",
            ),
        },
        required=["latitude", "longitude"],
    ),
)

# All tool declarations bundled for Gemini
TOOL_DECLARATIONS = [
    text_search_decl,
    nearby_search_decl,
    place_details_decl,
    geocode_decl,
    reverse_geocode_decl,
    compute_routes_decl,
    aggregate_places_decl,
]

TOOLS = [types.Tool(function_declarations=TOOL_DECLARATIONS)]


# ── Tool execution dispatcher ──────────────────────────────────────

async def execute_tool(name: str, args: dict) -> dict:
    """Call the appropriate Google Maps service function and return its result."""

    if name == "text_search":
        location_bias = None
        if "latitude" in args and "longitude" in args:
            location_bias = {
                "latitude": args["latitude"],
                "longitude": args["longitude"],
                "radius": args.get("radius", 5000),
            }
        return await places_service.text_search(
            query=args["query"],
            location_bias=location_bias,
            max_results=args.get("max_results", 10),
        )

    elif name == "nearby_search":
        return await places_service.nearby_search(
            latitude=args["latitude"],
            longitude=args["longitude"],
            radius=args.get("radius", 1000),
            included_types=args.get("included_types"),
            max_results=args.get("max_results", 10),
        )

    elif name == "place_details":
        return await places_service.place_details(place_id=args["place_id"])

    elif name == "geocode":
        return await geocoding_service.geocode(address=args["address"])

    elif name == "reverse_geocode":
        return await geocoding_service.reverse_geocode(
            latitude=args["latitude"],
            longitude=args["longitude"],
        )

    elif name == "compute_routes":
        return await routes_service.compute_routes(
            origin={"address": args["origin_address"]},
            destination={"address": args["destination_address"]},
            travel_mode=args.get("travel_mode", "DRIVE"),
        )

    elif name == "aggregate_places":
        return await places_aggregate_service.aggregate_places(
            latitude=args["latitude"],
            longitude=args["longitude"],
            radius=args.get("radius", 5000),
            included_types=args.get("included_types"),
        )

    return {"error": f"Unknown tool: {name}"}
