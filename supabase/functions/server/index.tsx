import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-3c4885b3/health", (c) => {
  return c.json({ status: "ok" });
});

// Endpoint to get Google Maps API key
app.get("/make-server-3c4885b3/maps-key", (c) => {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY not configured");
    return c.json({ error: "Google Maps API key not configured" }, 500);
  }
  
  return c.json({ apiKey });
});

// Geocode an address string to lat/lng using Gemini AI (no Geocoding API needed)
app.post("/make-server-3c4885b3/geocode", async (c) => {
  try {
    const { address } = await c.req.json();
    if (!address) return c.json({ error: "Address is required" }, 400);

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) return c.json({ error: "Gemini API key not configured" }, 500);

    // Use Gemini to resolve location name/address to coordinates
    const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash-8b"];
    
    const prompt = `Given the location "${address}", return ONLY a JSON object with the latitude, longitude, and the full formatted address. 
If the input looks like coordinates (e.g. "37.7749,-122.4194" or "37.7749, -122.4194"), reverse geocode them to find the address at those coordinates.
If it's a place name, city, landmark, or address, find its coordinates.
Return ONLY valid JSON in this exact format, no other text:
{"lat": <number>, "lng": <number>, "address": "<full formatted address>"}
If you cannot identify the location, return: {"error": "not_found"}`;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 200,
              responseMimeType: "application/json",
            },
          }),
        });

        if (!response.ok) {
          console.log(`Geocode model ${model} HTTP error:`, response.status);
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        console.log(`Geocode response from ${model}:`, text);

        const parsed = JSON.parse(text.trim());
        if (parsed.error) {
          return c.json({ error: "Location not found" }, 404);
        }
        if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
          return c.json({
            lat: parsed.lat,
            lng: parsed.lng,
            address: parsed.address || address,
          });
        }
      } catch (err) {
        console.log(`Geocode model ${model} error:`, err);
      }
    }

    return c.json({ error: "Location not found" }, 404);
  } catch (error) {
    console.error("Geocode error:", error);
    return c.json({ error: "Failed to geocode address" }, 500);
  }
});

// Nearby places of interest within a radius
app.post("/make-server-3c4885b3/nearby-places", async (c) => {
  try {
    const { lat, lng, radiusMiles = 2 } = await c.req.json();
    if (lat == null || lng == null) return c.json({ error: "lat/lng required" }, 400);

    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!mapsKey) return c.json({ error: "Maps API key not configured" }, 500);

    const radiusMeters = Math.round(radiusMiles * 1609.34);

    // Use Places API (New) Nearby Search
    const url = "https://places.googleapis.com/v1/places:searchNearby";
    const body = {
      includedTypes: [
        "tourist_attraction",
        "museum",
        "park",
        "art_gallery",
        "historical_landmark",
        "church",
        "library",
        "stadium",
        "monument",
        "aquarium",
        "zoo",
        "amusement_park",
        "national_park",
      ],
      maxResultCount: 15,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    };

    console.log("Fetching nearby places at", lat, lng, "radius", radiusMeters, "m");

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": mapsKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.photos,places.rating,places.editorialSummary,places.primaryType",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Places API error:", resp.status, errText);
      return c.json({ error: "Failed to fetch nearby places", details: errText }, 500);
    }

    const data = await resp.json();
    const places = (data.places || []).map((p: any) => {
      // Build a photo URL if available
      let photoUrl = "";
      let photoName = "";
      if (p.photos && p.photos.length > 0) {
        photoName = p.photos[0].name;
        photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=200&maxHeightPx=200&key=${mapsKey}`;
      }

      return {
        id: p.id,
        name: p.displayName?.text || "Unknown",
        address: p.formattedAddress || "",
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        types: p.types || [],
        primaryType: p.primaryType || "",
        rating: p.rating || null,
        photoUrl,
        photoName,
        summary: p.editorialSummary?.text || "",
      };
    });

    console.log(`Found ${places.length} nearby places`);
    return c.json({ places });
  } catch (error) {
    console.error("Nearby places error:", error);
    return c.json({ error: "Failed to fetch nearby places" }, 500);
  }
});

// Text-based place search — "pizza near me", "coffee shops", etc.
app.post("/make-server-3c4885b3/search-places", async (c) => {
  try {
    const { query, lat, lng } = await c.req.json();
    if (!query) return c.json({ error: "query required" }, 400);
    if (lat == null || lng == null) return c.json({ error: "lat/lng required" }, 400);

    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!mapsKey) return c.json({ error: "Maps API key not configured" }, 500);

    const url = "https://places.googleapis.com/v1/places:searchText";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": mapsKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.photos,places.rating,places.editorialSummary,places.primaryType",
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 10,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 8046, // ~5 miles
          },
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Places Text Search error:", resp.status, errText);
      return c.json({ error: "Failed to search places" }, 500);
    }

    const data = await resp.json();
    const places = (data.places || []).map((p: any) => {
      let photoUrl = "";
      let photoName = "";
      if (p.photos && p.photos.length > 0) {
        photoName = p.photos[0].name;
        photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=200&maxHeightPx=200&key=${mapsKey}`;
      }
      return {
        id: p.id,
        name: p.displayName?.text || "Unknown",
        address: p.formattedAddress || "",
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        types: p.types || [],
        primaryType: p.primaryType || "",
        rating: p.rating || null,
        photoUrl,
        photoName,
        summary: p.editorialSummary?.text || "",
      };
    });

    console.log(`Text search for "${query}" found ${places.length} places`);
    return c.json({ places, query });
  } catch (error) {
    console.error("Search places error:", error);
    return c.json({ error: "Failed to search places" }, 500);
  }
});

// Get AI-generated facts about a specific place
app.post("/make-server-3c4885b3/place-info", async (c) => {
  try {
    const { placeName, placeAddress, lat, lng, primaryType } = await c.req.json();
    if (!placeName) return c.json({ error: "Place name required" }, 400);

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return c.json({
        message: `${placeName} is a notable place at ${placeAddress}. Ask me more about it!`,
        facts: [`${placeName} is located at ${placeAddress}.`],
        historicalImagePrompt: `A historical scene of ${placeName} as it appeared 100 years ago.`,
      });
    }

    const requestBody = {
      contents: [{
        parts: [{
          text: `You are GEOL, a location expert. Give me interesting information about "${placeName}" located at ${placeAddress} (${lat}, ${lng}). Type: ${primaryType || "place of interest"}.

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "message": "A brief, engaging 2-3 sentence description of this place",
  "facts": ["interesting fact about the place or its surrounding neighborhood", "interesting fact about the area's culture or history", "fun local trivia", "notable nearby landmark or fact"],
  "historicalFact": "A fascinating historical fact about this place or its immediate neighborhood",
  "historicalImagePrompt": "A vivid description of what this place looked like 100 years ago, with period-accurate details",
  "events": [
    {"title": "Event name near this place", "date": "Month Year or recurring schedule", "description": "Brief description", "link": "#"}
  ],
  "realEstate": [
    {"address": "Nearby street address", "price": "$X,XXX,XXX", "type": "House/Condo/Apartment", "listingType": "buy", "link": "#"},
    {"address": "Nearby street address", "price": "$X,XXX/mo", "type": "Apartment/House", "listingType": "rent", "link": "#"}
  ]
}`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    };

    const llmResponse = await callGeminiWithFallback(geminiApiKey, requestBody);

    if (!llmResponse.ok) {
      await llmResponse.text();
      return c.json({
        message: `${placeName} is a popular destination at ${placeAddress}.`,
        facts: [`${placeName} is located at ${placeAddress}.`],
        historicalImagePrompt: `A historical scene of ${placeName} as it appeared 100 years ago.`,
      });
    }

    const llmData = await llmResponse.json();
    if (!llmData.candidates?.[0]?.content?.parts?.[0]?.text) {
      return c.json({
        message: `${placeName} is a notable place in the area.`,
        facts: [],
      });
    }

    const raw = llmData.candidates[0].content.parts[0].text;
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    try {
      return c.json(JSON.parse(cleaned));
    } catch {
      return c.json({ message: cleaned.substring(0, 300), facts: [] });
    }
  } catch (error) {
    console.error("Place info error:", error);
    return c.json({ error: "Failed to get place info" }, 500);
  }
});

// Models to try in order for text (each has separate quota)
const GEMINI_TEXT_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-8b",
];

// Helper: call Gemini with model fallback and retry on 429
async function callGeminiWithFallback(
  geminiApiKey: string,
  requestBody: object,
  models: string[] = GEMINI_TEXT_MODELS
): Promise<Response> {
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    console.log(`Trying Gemini model: ${model}`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 429) {
      console.log(`Model ${model} rate limited, trying next model...`);
      await response.text();
      continue;
    }

    if (response.status === 404) {
      console.log(`Model ${model} not found, trying next model...`);
      await response.text();
      continue;
    }

    return response;
  }

  console.error("All Gemini models exhausted quota");
  return new Response(
    JSON.stringify({
      error: {
        code: 429,
        message: "All available Gemini models have exceeded their quota.",
        status: "RESOURCE_EXHAUSTED",
      },
    }),
    { status: 429, headers: { "Content-Type": "application/json" } }
  );
}

// System prompt for the GEOL conversational agent
const SYSTEM_PROMPT = `You are GEOL (Geographic Explorer & Oracle of Locations), a friendly and knowledgeable conversational AI assistant specializing in locations and places.

Your personality:
- Enthusiastic about geography, history, and culture
- Conversational and engaging — you chat naturally, not robotically
- You proactively offer interesting tidbits and follow-up suggestions
- You use light humor when appropriate

Your capabilities:
- Share fun and surprising facts about any location
- Provide rich historical context and stories
- List upcoming local events
- Provide real estate market insights
- Describe what a place looked like historically

When the user first connects from a location, give them an exciting welcome with highlights about their area.

IMPORTANT: Always respond with valid JSON in this exact structure (no markdown, no code blocks):
{
  "message": "Your conversational response text here",
  "info": {
    "facts": ["fact 1", "fact 2"],
    "historicalFacts": ["historical fact 1", "historical fact 2"],
    "events": [{"title": "Event", "date": "Date", "description": "Desc", "link": "https://..."}],
    "realEstate": [{"address": "Addr", "price": "Price", "type": "Type", "listingType": "buy", "link": "https://..."}],
    "historicalImagePrompt": "A detailed prompt describing what this place looked like 100 years ago, suitable for image generation. Be specific about architecture, streets, people, vehicles, and atmosphere of the era."
  },
  "suggestedQuestions": ["Follow-up question 1?", "Follow-up question 2?", "Follow-up question 3?"]
}

For the info section:
- Only include categories that are relevant to the current query
- facts: Interesting, surprising, or fun facts
- historicalFacts: Historical events, stories, and context
- events: Real upcoming events in the area (use realistic dates in 2026). Always include a real or plausible URL for each event (e.g. eventbrite.com, local venue website, meetup.com).
- realEstate: Include BOTH properties for sale AND properties for rent. Use "listingType": "buy" for purchases and "listingType": "rent" for rentals. For rentals, price should be monthly rent (e.g. "$2,800/mo"). Link to realistic listing URLs (zillow.com, streeteasy.com, apartments.com, realtor.com).
- historicalImagePrompt: Always include this — make it vivid and specific for the location
- suggestedQuestions: 2-3 natural follow-up questions the user might want to ask`;

// Conversational chat endpoint
app.post("/make-server-3c4885b3/chat", async (c) => {
  try {
    const { messages, location } = await c.req.json();
    
    if (!messages || !location) {
      return c.json({ error: "Messages and location are required" }, 400);
    }

    const { lat, lng, address } = location;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    
    if (!geminiApiKey) {
      console.log("GEMINI_API_KEY not configured, using fallback");
      return c.json(generateFallbackChat(address, messages));
    }

    // Build conversation history for Gemini
    const contents: any[] = [];
    
    // Add system context as the first user message
    contents.push({
      role: "user",
      parts: [{ text: `${SYSTEM_PROMPT}\n\nThe user is currently located at: ${address} (coordinates: ${lat}, ${lng}).` }]
    });
    contents.push({
      role: "model",
      parts: [{ text: '{"message": "Understood! I\'m GEOL, ready to explore this location with you.", "info": {}, "suggestedQuestions": []}' }]
    });

    // Add conversation history
    for (const msg of messages) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      });
    }

    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    };

    const llmResponse = await callGeminiWithFallback(geminiApiKey, requestBody);

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error("Gemini API error:", errorText);
      
      if (llmResponse.status === 429) {
        console.log("Rate limited, returning fallback chat data");
        return c.json(generateFallbackChat(address, messages));
      }
      
      return c.json({ error: "Failed to generate response", details: errorText }, 500);
    }

    const llmData = await llmResponse.json();
    
    if (!llmData.candidates || llmData.candidates.length === 0) {
      console.error("No candidates in Gemini response");
      return c.json(generateFallbackChat(address, messages));
    }

    const responseText = llmData.candidates[0].content.parts[0].text;
    console.log("Gemini chat response:", responseText.substring(0, 300));
    
    // Clean and parse
    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let content;
    try {
      content = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini chat response:", cleanedText.substring(0, 500));
      // Try to extract just a message if JSON parsing fails
      content = {
        message: cleanedText.length > 500 ? cleanedText.substring(0, 500) + "..." : cleanedText,
        info: {},
        suggestedQuestions: []
      };
    }

    return c.json(content);
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    return c.json({ 
      error: "Failed to process chat",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Image generation endpoint using Gemini's native image generation
app.post("/make-server-3c4885b3/generate-image", async (c) => {
  try {
    const { prompt, address } = await c.req.json();
    
    if (!prompt) {
      return c.json({ error: "Prompt is required" }, 400);
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    
    if (!geminiApiKey) {
      return c.json({ error: "Gemini API key not configured", image: null }, 200);
    }

    // Use Gemini's native image generation with gemini-2.0-flash-exp
    const imagePrompt = `Generate a highly detailed, photorealistic artistic rendering of: ${prompt}. 
Style: Vintage sepia-toned photograph from the 1920s era. Include period-accurate details like architecture, clothing, vehicles, and street scenes of that era.`;

    console.log("Generating image with prompt:", imagePrompt.substring(0, 200));

    // Try imagen-3.0-generate-002 first (Google's dedicated image model)
    const imagenModels = [
      "imagen-3.0-generate-002",
      "imagen-3.0-generate-001",
    ];

    for (const model of imagenModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${geminiApiKey}`;
        console.log(`Trying image model: ${model}`);
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: imagePrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "16:9",
              safetyFilterLevel: "BLOCK_MEDIUM_AND_ABOVE",
            }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.predictions && data.predictions.length > 0) {
            const imageData = data.predictions[0].bytesBase64Encoded;
            if (imageData) {
              console.log("Image generated successfully with", model);
              return c.json({ 
                image: `data:image/png;base64,${imageData}`,
                model 
              });
            }
          }
        } else {
          const errText = await response.text();
          console.log(`Image model ${model} failed:`, errText.substring(0, 200));
        }
      } catch (err) {
        console.log(`Image model ${model} error:`, err);
      }
    }

    // Fallback: try Gemini 2.0 Flash with image generation
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate an image: ${imagePrompt}` }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.candidates && data.candidates[0]?.content?.parts) {
          for (const part of data.candidates[0].content.parts) {
            if (part.inlineData) {
              console.log("Image generated with gemini-2.0-flash-exp");
              return c.json({ 
                image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                model: "gemini-2.0-flash-exp"
              });
            }
          }
        }
      } else {
        const errText = await response.text();
        console.log("gemini-2.0-flash-exp image gen failed:", errText.substring(0, 200));
      }
    } catch (err) {
      console.log("gemini-2.0-flash-exp error:", err);
    }

    console.log("All image generation models failed, returning null");
    return c.json({ image: null, error: "Image generation unavailable" });
  } catch (error) {
    console.error("Error generating image:", error);
    return c.json({ 
      error: "Failed to generate image",
      details: error instanceof Error ? error.message : String(error),
      image: null
    }, 200);
  }
});

// Keep the legacy query endpoint for backward compatibility
app.post("/make-server-3c4885b3/query", async (c) => {
  try {
    const { query, location } = await c.req.json();
    // Redirect to chat endpoint
    const chatMessages = [{ role: "user", content: query }];
    const { lat, lng, address } = location;
    
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return c.json(generateFallbackChat(address, chatMessages));
    }

    // Forward to chat logic
    const response = await fetch(
      new URL("/make-server-3c4885b3/chat", c.req.url).toString(),
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": c.req.header("Authorization") || "",
        },
        body: JSON.stringify({ messages: chatMessages, location }),
      }
    );
    
    const data = await response.json();
    // Map chat response to legacy format
    return c.json({
      response: data.message || data.response || "",
      info: {
        facts: data.info?.facts || [],
        historicalFacts: data.info?.historicalFacts || [],
        events: data.info?.events || [],
        realEstate: data.info?.realEstate || [],
        historicalImage: data.info?.historicalImagePrompt 
          ? { url: "", description: data.info.historicalImagePrompt }
          : null,
      }
    });
  } catch (error) {
    console.error("Error in legacy query:", error);
    return c.json({ error: "Failed to process query" }, 500);
  }
});

// Helper: fetch any image URL and return base64 + mimeType
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "GEOL-App/1.0" } });
    if (!resp.ok) return null;
    const ct = (resp.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!ct.startsWith("image/")) return null;
    const buf = await resp.arrayBuffer();
    const u8 = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return { base64: btoa(bin), mimeType: ct };
  } catch {
    return null;
  }
}

// Helper: search Wikipedia for a place and return { thumbnailUrl, title }
async function fetchWikipediaThumbnail(query: string): Promise<{ url: string; title: string } | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json`;
    const sr = await fetch(searchUrl);
    if (!sr.ok) return null;
    const sd = await sr.json();
    const title = sd.query?.search?.[0]?.title;
    if (!title) return null;

    const thumbUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=800&format=json`;
    const tr = await fetch(thumbUrl);
    if (!tr.ok) return null;
    const td = await tr.json();
    const pages = td.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0] as any;
    const src = page?.thumbnail?.source;
    return src ? { url: src, title } : null;
  } catch {
    return null;
  }
}

interface HistoricalPhoto {
  url: string;
  date: string;
  description?: string;
  source: string;
}

// Helper: collect ALL historical photos from a Wikipedia article (years 1850–1969)
async function findHistoricalPhotosInWikipedia(articleTitle: string): Promise<HistoricalPhoto[]> {
  const results: HistoricalPhoto[] = [];
  try {
    const listUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(articleTitle)}&prop=images&imlimit=50&format=json`;
    const lr = await fetch(listUrl);
    if (!lr.ok) return results;
    const ld = await lr.json();
    const pages = ld.query?.pages;
    if (!pages) return results;
    const page = Object.values(pages)[0] as any;
    const imageFiles: string[] = (page?.images || [])
      .map((i: any) => i.title as string)
      .filter((t: string) => t.match(/\.(jpg|jpeg|png)$/i) && !t.match(/icon|logo|flag|map|svg|seal|coat|arms|button|arrow/i));

    if (imageFiles.length === 0) return results;

    const chunks: string[][] = [];
    for (let i = 0; i < Math.min(imageFiles.length, 30); i += 10) chunks.push(imageFiles.slice(i, i + 10));

    for (const chunk of chunks) {
      try {
        const infoUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(chunk.join("|"))}&prop=imageinfo&iiprop=url|extmetadata&format=json`;
        const ir = await fetch(infoUrl);
        if (!ir.ok) continue;
        const id = await ir.json();
        const infoPages = id.query?.pages;
        if (!infoPages) continue;
        for (const p of Object.values(infoPages) as any[]) {
          const info = p.imageinfo?.[0];
          if (!info?.url) continue;
          const raw = info.extmetadata?.DateTimeOriginal?.value || info.extmetadata?.DateTime?.value || "";
          const m = raw.match(/\b(1[89]\d{2}|19[0-5]\d)\b/);
          if (m) {
            const rawDesc = info.extmetadata?.ImageDescription?.value || info.extmetadata?.ObjectName?.value || "";
            results.push({
              url: info.url,
              date: m[1],
              description: rawDesc.replace(/<[^>]*>/g, "").trim().substring(0, 150) || undefined,
              source: "Wikipedia",
            });
          }
        }
      } catch { /* skip */ }
    }
    // Sort oldest first
    results.sort((a, b) => parseInt(a.date) - parseInt(b.date));
  } catch { /* ignore */ }
  return results;
}

// Helper: search Wikimedia Commons for historical photos of a place
async function searchWikimediaCommons(placeName: string): Promise<HistoricalPhoto[]> {
  const results: HistoricalPhoto[] = [];
  try {
    const queries = [
      `${placeName} historical photograph`,
      `${placeName} old photograph`,
    ];
    const seen = new Set<string>();
    for (const q of queries) {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&format=json`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const d = await r.json();
      const pages = d.query?.pages;
      if (!pages) continue;
      for (const p of Object.values(pages) as any[]) {
        const info = p.imageinfo?.[0];
        if (!info?.url || seen.has(info.url)) continue;
        if (!info.url.match(/\.(jpg|jpeg|png)$/i)) continue;
        const raw = info.extmetadata?.DateTimeOriginal?.value || info.extmetadata?.DateTime?.value || "";
        const m = raw.match(/\b(1[89]\d{2}|19[0-5]\d)\b/);
        if (m) {
          seen.add(info.url);
          const rawDesc = info.extmetadata?.ImageDescription?.value || info.extmetadata?.ObjectName?.value || "";
          results.push({
            url: info.url,
            date: m[1],
            description: rawDesc.replace(/<[^>]*>/g, "").trim().substring(0, 150) || undefined,
            source: "Wikimedia Commons",
          });
        }
      }
    }
    results.sort((a, b) => parseInt(a.date) - parseInt(b.date));
  } catch { /* ignore */ }
  return results;
}

// Keep for backward compat (returns the oldest single photo)
async function findHistoricalPhotoInWikipedia(articleTitle: string): Promise<{ url: string; date: string; description?: string } | null> {
  const all = await findHistoricalPhotosInWikipedia(articleTitle);
  return all.length > 0 ? all[0] : null;
}


// Historical endpoint — searches for real historical photos first, then generates with Gemini
app.post("/make-server-3c4885b3/historical-streetview", async (c) => {
  try {
    const { lat, lng, address, heading = 0, photoName, placeName: placeNameParam } = await c.req.json();
    if (lat == null || lng == null) return c.json({ error: "lat/lng required" }, 400);

    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) return c.json({ error: "Gemini API key not configured", image: null }, 200);

    const locationName = address || `${lat}, ${lng}`;
    // Prefer the explicit place name passed from a pin click, else use first address segment
    const placeName = placeNameParam || locationName.split(",")[0].trim();

    // ── Step 0: If a Google Places photo name was passed (pin click), use it directly ──
    let placesPhotoBase64: string | null = null;
    let placesPhotoMime = "image/jpeg";
    let placesPhotoUrl: string | null = null;

    if (photoName && mapsKey) {
      const highResUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=640&maxHeightPx=480&key=${mapsKey}`;
      console.log(`Fetching Google Places photo for "${placeName}": ${highResUrl}`);
      const img = await fetchImageAsBase64(highResUrl);
      if (img) {
        placesPhotoBase64 = img.base64;
        placesPhotoMime = img.mimeType;
        placesPhotoUrl = highResUrl;
        console.log(`Got Places photo, size: ${img.base64.length}`);
      }
    }

    // ── Steps 1 & 2: Wikipedia thumbnail + all historical photos ────────────────
    let wikiThumb: { url: string; title: string } | null = null;
    let wikiImageBase64: string | null = null;
    let wikiImageMime = "image/jpeg";
    let allHistoricalPhotos: HistoricalPhoto[] = [];

    console.log(`Searching Wikipedia for: "${placeName}"`);
    wikiThumb = await fetchWikipediaThumbnail(placeName);
    if (wikiThumb) {
      console.log(`Wikipedia thumbnail found: ${wikiThumb.url}`);
      if (!placesPhotoBase64) {
        const img = await fetchImageAsBase64(wikiThumb.url);
        if (img) { wikiImageBase64 = img.base64; wikiImageMime = img.mimeType; }
      }
      // Collect all historical photos from the article + Wikimedia Commons in parallel
      const [wikiPhotos, commonsPhotos] = await Promise.all([
        findHistoricalPhotosInWikipedia(wikiThumb.title),
        searchWikimediaCommons(placeName),
      ]);
      // Merge, deduplicate by URL, sort oldest first, cap at 4 (leave slot for Gemini)
      const seen = new Set<string>();
      for (const p of [...wikiPhotos, ...commonsPhotos]) {
        if (!seen.has(p.url)) { seen.add(p.url); allHistoricalPhotos.push(p); }
      }
      allHistoricalPhotos.sort((a, b) => parseInt(a.date) - parseInt(b.date));
      allHistoricalPhotos = allHistoricalPhotos.slice(0, 4);
      console.log(`Found ${allHistoricalPhotos.length} historical photos total`);
    }

    // ── Step 3: Fallback current photo — Google Street View (only if no Places or Wiki photo) ──
    let streetViewBase64: string | null = null;
    if (!placesPhotoBase64 && !wikiImageBase64 && mapsKey) {
      try {
        const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&heading=${heading}&pitch=0&fov=90&key=${mapsKey}`;
        const svResp = await fetch(svUrl);
        if (svResp.ok) {
          const ct = svResp.headers.get("content-type") || "";
          if (ct.startsWith("image/")) {
            const buf = await svResp.arrayBuffer();
            const u8 = new Uint8Array(buf);
            let bin = "";
            for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
            streetViewBase64 = btoa(bin);
            console.log("Got Street View image, size:", buf.byteLength);
          }
        }
      } catch (err) { console.log("Street View fetch error:", err); }
    }

    // Best available "today" reference: Google Places photo > Wikipedia thumbnail > Street View
    const currentPhotoBase64 = placesPhotoBase64 || wikiImageBase64 || streetViewBase64;
    const currentPhotoMime = placesPhotoBase64 ? placesPhotoMime : wikiImageBase64 ? wikiImageMime : "image/jpeg";
    const currentPhotoUrl = placesPhotoUrl || wikiThumb?.url || (streetViewBase64 ? `data:image/jpeg;base64,${streetViewBase64}` : null);

    // Build a monument-focused prompt (not street-scene)
    const monumentPrompt = currentPhotoBase64
      ? `You are looking at a current photo of ${placeName} (${locationName}). Generate a photorealistic image showing this exact monument/building/place as it would have appeared approximately 100 years ago (1920s era). Keep the same viewing angle and composition. Transform: remove modern additions, restore period-accurate architecture, add people in 1920s attire nearby, period lighting and surroundings. Give it the warm sepia-toned quality of an authentic colorized historical photograph. Focus on the ${placeName} itself, not the surrounding street.`
      : `Create a detailed, photorealistic historical image of ${placeName} (${locationName}) as it appeared approximately 100 years ago (1920s era). Show the building/monument itself with period-accurate surroundings, people in 1920s attire, and the warm sepia-toned atmospheric quality of an authentic colorized historical photograph.`;

    // ── Helper: try Gemini image models, return data-URI or null ─────────────────
    const tryGeminiImage = async (): Promise<string | null> => {
      const models = [
        "gemini-2.0-flash-exp-image-generation",
        "gemini-2.0-flash-preview-image-generation",
        "gemini-2.0-flash-exp",
      ];
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
          console.log(`Trying image generation model: ${model}`);
          const parts: any[] = [];
          if (currentPhotoBase64) {
            parts.push({ inlineData: { mimeType: currentPhotoMime, data: currentPhotoBase64 } });
            parts.push({ text: monumentPrompt });
          } else {
            parts.push({ text: `Generate an image: ${monumentPrompt}` });
          }
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
            }),
          });
          if (response.ok) {
            const data = await response.json();
            for (const part of data.candidates?.[0]?.content?.parts ?? []) {
              if (part.inlineData) {
                console.log(`Image generated with ${model}`);
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              }
            }
          } else {
            console.log(`${model} failed:`, (await response.text()).substring(0, 200));
          }
        } catch (err) { console.log(`${model} error:`, err); }
      }
      return null;
    };

    // If we have real historical photos, download them AND run Gemini in parallel (to fill up to 5)
    if (allHistoricalPhotos.length > 0) {
      const [fetched, geminiDataUri] = await Promise.all([
        Promise.all(
          allHistoricalPhotos.map(async (p) => {
            const img = await fetchImageAsBase64(p.url);
            if (!img) return null;
            return {
              image: `data:${img.mimeType};base64,${img.base64}`,
              date: p.date,
              description: p.description || null,
              source: p.source,
            };
          })
        ),
        tryGeminiImage(), // run in parallel — adds AI rendering as final slide
      ]);

      const valid: Array<{ image: string; date: string; description: string | null; source: string }> =
        fetched.filter(Boolean) as any;

      // Append Gemini rendering if there's room
      if (geminiDataUri && valid.length < 5) {
        valid.push({
          image: geminiDataUri,
          date: "~1920s",
          description: "AI-generated historical rendering by Gemini",
          source: "gemini",
        });
      }

      if (valid.length > 0) {
        return c.json({
          historicalImage: valid[0]!.image,
          historicalImages: valid,
          currentStreetView: currentPhotoUrl,
          photoDate: valid[0]!.date,
          photoDescription: valid[0]!.description,
          articleTitle: wikiThumb?.title || null,
          source: "wikipedia",
          location: locationName,
        });
      }
    }

    // ── Step 4: No real photos — try Gemini image generation alone ───────────────
    const geminiDataUri = await tryGeminiImage();
    if (geminiDataUri) {
      return c.json({
        historicalImage: geminiDataUri,
        historicalImages: [{ image: geminiDataUri, date: "~1920s", description: "AI-generated historical rendering by Gemini", source: "gemini" }],
        currentStreetView: currentPhotoUrl,
        source: "gemini",
        location: locationName,
      });
    }

    // ── Step 5: Text description fallback (always succeeds) ──────────────────────
    console.log("All image models failed, falling back to text description");
    try {
      const textPrompt = `You are a historian and visual storyteller. Describe in vivid detail what ${placeName} (${locationName}) would have looked like approximately 100 years ago (around the 1920s).

Write 3-4 paragraphs covering: the monument/building's appearance and original surroundings, period-accurate details about people and activity around it, the atmosphere and character of the place, and any significant changes since that era.

Be historically accurate and specific to ${placeName}. Do not use markdown formatting.`;

      const descResp = await callGeminiWithFallback(geminiApiKey, {
        contents: [{ parts: [{ text: textPrompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
      });

      if (descResp.ok) {
        const dd = await descResp.json();
        const description = dd.candidates?.[0]?.content?.parts?.[0]?.text;
        if (description) {
          return c.json({
            historicalImage: null,
            currentStreetView: currentPhotoUrl,
            historicalDescription: description,
            source: "text",
            location: locationName,
          });
        }
      }
    } catch (err) { console.log("Text fallback error:", err); }

    return c.json({
      historicalImage: null,
      currentStreetView: currentPhotoUrl,
      error: "Historical rendering unavailable",
    });
  } catch (error) {
    console.error("Historical streetview error:", error);
    return c.json({
      error: "Failed to generate historical view",
      historicalImage: null,
      currentStreetView: null,
    }, 200);
  }
});

// Generate fallback chat response
function generateFallbackChat(address: string, messages: any[]) {
  const cityName = address.split(",")[0] || "this area";
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
  
  const isGreeting = lastMessage.includes("hello") || lastMessage.includes("hi") || lastMessage.includes("tell me about");
  const isHistory = lastMessage.includes("history") || lastMessage.includes("historical") || lastMessage.includes("past");
  const isEvents = lastMessage.includes("event") || lastMessage.includes("happening") || lastMessage.includes("festival");
  const isRealEstate = lastMessage.includes("real estate") || lastMessage.includes("house") || lastMessage.includes("property") || lastMessage.includes("buy");
  
  let message: string;
  const info: any = {};
  
  if (isHistory) {
    message = `Great question about the history of ${cityName}! This area has a fascinating past that stretches back centuries.`;
    info.historicalFacts = [
      `Indigenous peoples were the original inhabitants of the ${cityName} region for thousands of years.`,
      `The area saw significant development during the Industrial Revolution of the 19th century.`,
      `The railroad era brought major growth and economic opportunities in the late 1800s.`,
      `Post-war cultural shifts in the 1950s-60s shaped the modern identity of ${cityName}.`,
    ];
    info.historicalImagePrompt = `A detailed scene of ${cityName} as it would have appeared in the 1920s, with period-accurate architecture, horse-drawn carriages alongside early automobiles, pedestrians in era-appropriate clothing, and the distinctive character of the neighborhood.`;
  } else if (isEvents) {
    message = `Here's what's happening around ${cityName}! There are some great events coming up.`;
    info.events = [
      { title: "Community Arts Festival", date: "Summer 2026", description: `Annual celebration of local arts, music, and culture in ${cityName}.`, link: "https://www.eventbrite.com" },
      { title: "Farmers Market Season", date: "Spring-Fall 2026", description: "Weekly market featuring local produce, crafts, and artisan goods.", link: "https://www.eventbrite.com" },
      { title: "Heritage Days", date: "Fall 2026", description: `Celebration of ${cityName}'s history with guided tours and exhibits.`, link: "https://www.eventbrite.com" }
    ];
  } else if (isRealEstate) {
    message = `Let me give you a snapshot of the real estate market in ${cityName}!`;
    info.realEstate = [
      { address: `123 Main St, ${cityName}`, price: "$450,000", type: "Single Family 3BR/2BA", listingType: "buy", link: "https://www.zillow.com" },
      { address: `456 Oak Ave, ${cityName}`, price: "$325,000", type: "Townhouse 2BR/1.5BA", listingType: "buy", link: "https://www.zillow.com" },
      { address: `789 Park Blvd, ${cityName}`, price: "$2,800/mo", type: "Condo 2BR/1BA", listingType: "rent", link: "https://www.apartments.com" },
      { address: `321 Elm St, ${cityName}`, price: "$1,950/mo", type: "Studio", listingType: "rent", link: "https://www.apartments.com" }
    ];
  } else {
    // General/greeting
    message = `Welcome to ${cityName}! I'm GEOL, your geographic explorer. This area is full of interesting stories, history, and things to discover. What would you like to know about?`;
    info.facts = [
      `${cityName} has a rich cultural history shaped by diverse communities.`,
      `The local cuisine reflects a unique blend of regional traditions and modern innovation.`,
      `${cityName} is home to several parks and green spaces.`,
      `The architecture tells the story of growth from a small settlement to a thriving community.`,
    ];
    info.historicalFacts = [
      `Indigenous peoples inhabited the ${cityName} region for thousands of years before European contact.`,
      `The railroad era brought significant growth in the late 1800s.`,
    ];
    info.events = [
      { title: "Community Arts Festival", date: "Summer 2026", description: `Annual celebration of local arts and culture.`, link: "https://www.eventbrite.com" },
    ];
    info.realEstate = [
      { address: `123 Main St, ${cityName}`, price: "$450,000", type: "Single Family 3BR/2BA", listingType: "buy", link: "https://www.zillow.com" },
      { address: `456 Oak Ave, ${cityName}`, price: "$2,800/mo", type: "Condo 2BR/1BA", listingType: "rent", link: "https://www.apartments.com" },
    ];
    info.historicalImagePrompt = `A detailed scene of ${cityName} as it appeared around 1920, with tree-lined dirt roads, modest wooden homes, horse-drawn wagons, and a close-knit community going about their daily lives.`;
  }

  return {
    message,
    info,
    suggestedQuestions: [
      `What's the history of ${cityName}?`,
      `What events are happening nearby?`,
      `Show me what ${cityName} looked like 100 years ago`,
    ]
  };
}

// WebSocket TTS endpoint — proxies text → Gemini Live API → PCM audio stream back to client
// Client sends: { "text": "...", "voice": "Aoede" (optional) }
// Server streams back: { "audio": "<base64 PCM 24kHz>" } chunks, then { "done": true }
app.get("/make-server-3c4885b3/ws/tts", (c) => {
  const upgrade = c.req.header("upgrade");
  if (!upgrade || upgrade.toLowerCase() !== "websocket") {
    return c.json({ error: "WebSocket upgrade required" }, 426);
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    return c.json({ error: "Gemini API key not configured" }, 500);
  }

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(c.req.raw);

  clientSocket.onopen = () => {
    console.log("TTS WebSocket client connected");
  };

  clientSocket.onmessage = async (event) => {
    let text = "";
    let voiceName = "Aoede";

    try {
      const msg = JSON.parse(event.data);
      text = (msg.text || "").trim();
      voiceName = msg.voice || "Aoede";
    } catch {
      text = String(event.data).trim();
    }

    if (!text) return;

    // Open a connection to the Gemini Live API
    const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;
    let geminiSocket: WebSocket;

    try {
      geminiSocket = new WebSocket(geminiWsUrl);
    } catch (err) {
      console.error("Failed to open Gemini Live WebSocket:", err);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ error: "Failed to connect to Gemini Live API" }));
        clientSocket.send(JSON.stringify({ done: true }));
      }
      return;
    }

    let setupComplete = false;

    geminiSocket.onopen = () => {
      // Send setup message
      geminiSocket.send(JSON.stringify({
        setup: {
          model: "models/gemini-2.0-flash-live-001",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        },
      }));
    };

    geminiSocket.onmessage = (geminiEvent) => {
      try {
        const msg = JSON.parse(geminiEvent.data);

        // Wait for setup to complete before sending text
        if (msg.setupComplete !== undefined && !setupComplete) {
          setupComplete = true;
          // Now send the text turn
          geminiSocket.send(JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text }] }],
              turnComplete: true,
            },
          }));
          return;
        }

        // Forward audio chunks to client
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.data && clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(JSON.stringify({ audio: part.inlineData.data }));
            }
          }
        }

        // Signal turn complete
        if (msg.serverContent?.turnComplete) {
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ done: true }));
          }
          geminiSocket.close();
        }
      } catch (err) {
        console.error("Error parsing Gemini Live message:", err);
      }
    };

    geminiSocket.onerror = (err) => {
      console.error("Gemini Live WebSocket error:", err);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ error: "Gemini Live API error" }));
        clientSocket.send(JSON.stringify({ done: true }));
      }
    };

    geminiSocket.onclose = () => {
      console.log("Gemini Live WebSocket closed");
    };
  };

  clientSocket.onclose = () => {
    console.log("TTS WebSocket client disconnected");
  };

  clientSocket.onerror = (err) => {
    console.error("TTS WebSocket client error:", err);
  };

  return response;
});

Deno.serve(app.fetch);