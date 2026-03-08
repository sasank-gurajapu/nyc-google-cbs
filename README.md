

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
# 🗺️ Geol — AI-Powered Place Exploration Agent

**Team:** Vivek Gandhari · Abhishek Pillai · Sasank Gurajapu · Anand Singh
**Additional Team Members:** Gemini · Claude · Figma

---

## Problem Statement

People visit or research places every day — neighborhoods, cities, landmarks — but the experience of *discovering* a place is fragmented. You search Google for reviews, flip to Zillow for real estate, visit Wikipedia for history, and watch YouTube for visuals. There's no single immersive, conversational experience that lets you **explore a place as a story**.

Travelers, remote workers, relocators, and the simply curious have no way to ask *"tell me everything interesting about this corner of the world"* — and get a rich, multi-layered, voice-driven answer back.

**Geol** solves this: a voice-first AI agent that transforms any place into a living, breathing narrative — surfacing fun facts, local events, real estate context, and AI-reconstructed historical imagery of how that place looked across time.

---

## Solution

Geol is a conversational place exploration agent. Users speak or type a location — a city, neighborhood, street, or landmark — and the agent becomes a **storytelling guide** that takes them on a journey through that place across multiple dimensions:

- 🎙️ **Voice-in, voice-out** — Natural conversation via Web Speech API
- 🧠 **Agentic AI** — Google Gemini orchestrates multi-tool reasoning to gather, synthesize, and narrate
- 📍 **Location-aware** — Can auto-detect user location or accept any typed/spoken input
- 🏛️ **Historical Time Travel** — Imagen 3-generated imagery shows how a place looked in different eras
- 🗺️ **Street View** — Live current imagery via Google Street View
- 🎉 **Nearby Places** — Points of interest and things to explore around any location
- 🤩 **Fun Facts & Lore** — Surprising, delightful stories about the place

---

## Tech Stack & Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  React (TypeScript) · Vite · Tailwind CSS v4 · shadcn/ui   │
│  @vis.gl/react-google-maps · Web Speech API                 │
└────────────────────────┬────────────────────────────────────┘
                         │ REST
┌────────────────────────▼────────────────────────────────────┐
│                   BACKEND / AGENTIC CORE                    │
│  Deno · Hono · Supabase Edge Functions                      │
│  Gemini 2.0 Flash → Flash Lite → 1.5 Flash 8B (fallback)   │
│  Orchestrates tool calls based on user intent               │
└──┬─────────────────┬──────────────────┬─────────────────────┘
   │                 │                  │
┌──▼──────────┐ ┌────▼──────────┐ ┌────▼──────────────────┐
│  Places &   │ │  Geocoding &  │ │  Historical Imagery   │
│  Street View│ │  Street View  │ │                       │
│             │ │               │ │  Imagen 3.0 Generate  │
│ Places API  │ │ Geocoding API │ │  002 → 001 →          │
│ (New) +     │ │ + Gemini      │ │  gemini-2.0-flash-exp │
│ Street View │ │ fallback      │ │  (fallback chain)     │
│ Static API  │ │               │ │                       │
└─────────────┘ └───────────────┘ └───────────────────────┘
```

### Google APIs

| API | Usage |
|---|---|
| Maps JavaScript API | Interactive map rendering |
| Places API (New) | Nearby POI fetching |
| Street View Static API | Current street view images |
| Geocoding API | Address/coordinate resolution (Gemini fallback) |
| Gemini API | Conversational AI, geocoding, historical image generation |
| Imagen 3 API | Historical image generation |

### Agent Flow

```
User speaks "Tell me about Brooklyn Bridge"
        ↓
  Speech → Text (Web Speech API)
        ↓
  Gemini 2.0 Flash receives intent + location context
        ↓
  Gemini orchestrates parallel tool calls:
    ├── Places API (New) → nearby POIs, descriptions
    ├── Geocoding API → coordinate resolution
    ├── Street View Static API → current place imagery
    └── Imagen 3 → "Brooklyn Bridge in 1890, sepia photograph"
        ↓
  Gemini synthesizes into narrative story
        ↓
  Web Speech API speaks the response
  Google Maps pins the location
  Historical images render in timeline carousel
```
