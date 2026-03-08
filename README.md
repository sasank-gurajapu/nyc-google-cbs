# 🗺️ Geol — Explore Cities the Way You Actually Think

**NYC Build With AI Hackathon · Live Agents Category**

**Team**: Vivek Gandhari · Abhishek Pillai · Sasank Gurajapu

---

## The Problem

Exploring a city is a *subjective* experience. Sometimes you know exactly where you're going — but most of the time, you're thinking in feelings and vibes, not keywords.

> *"What are some new and upcoming coffee places in Upper West Side?"*
> *"Best dentist under $100 in Chelsea?"*
> *"Somewhere calm and cozy to work this afternoon…"*

These are the prompts that reflect how we **actually think** about finding places. Traditional map search doesn't get it — it's built for keywords, not conversations.

---

## The Solution

**Geol** is a real-time conversational voice agent that understands the *subjective* way you look for places — and talks back.

Speak naturally. Get interrupted? It adapts. Ask follow-ups? It remembers. The agent converses with you to understand your preferences, then surfaces the best options for *you* to decide.

> **"Hey, I'm looking for somewhere cozy to work — quiet, good coffee, laptop-friendly"**
> → *"Got it! Where are you right now?"*
> → *"Downtown Boston"*
> → *"Found three great spots. Thinking Cup on Tremont has reviews calling it 'peaceful' and 'perfect for laptops'…"*

---

## How It Works

```
User speaks naturally
        ↓
Gemini Multimodal Live API (real-time bidirectional audio)
        ↓
Intent extraction: place type + qualitative attributes + location
        ↓
Google Places API → fetch places + reviews
        ↓
Gemini Flash analyzes reviews semantically (not keyword matching)
        ↓
Agent speaks results conversationally + visual cards appear
        ↓
One tap → Google Maps navigation
```

- **AI**: Gemini Multimodal Live API (conversation), Vertex AI Gemini 1.5 Flash (review analysis)
- **Maps**: Google Places API (New) — text search + place details + reviews
- **Backend**: Node.js + Express on Cloud Run (WebSocket support)
- **Frontend**: Vanilla JS / React + Tailwind, WebRTC audio streaming
- **Hosting**: Google Cloud Run + Firebase Hosting

---

## Example Interactions

**Finding a workspace**
> *"Where can I work for a few hours? I like some background noise, good WiFi."*
> → Agent finds cafes, filters by reviews mentioning WiFi + outlets + long-stay welcome.

**Date night**
> *"I want to take someone somewhere romantic for dinner tonight — Italian, not too pricey."*
> → Agent surfaces candlelit spots with "intimate" and "date night" in reviews.

**Hidden gems**
> *"Show me a coffee shop that's not touristy, somewhere locals actually go."*
> → Agent scores places by local reviewer concentration and low chain-ness.

---

*Built at NYC Build With AI Hackathon · March 2026 · Live Agents Category*
*8–10 hour build · Google Cloud · Gemini Live API · Places API*
