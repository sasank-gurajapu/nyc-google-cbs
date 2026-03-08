# Voice-Powered Maps Exploration Agent
## NYC Build With AI Hackathon - Live Agents Category

## Project Overview

A **real-time conversational AI agent** that transforms qualitative, subjective user preferences into precise map searches and location recommendations through natural voice interaction. Built for the "Live Agents" category, this agent can be talked to naturally, interrupted mid-response, and uses multimodal inputs (voice + visual results) to move beyond the "text box" paradigm.

The system uses Google AI (Gemini Live API or Multimodal Live API) to interpret vague, spoken queries like "I want somewhere calm and cozy to work" in real-time, analyzes Google Maps data semantically, and provides conversational recommendations.

**Hackathon Requirements Met**:
- ✅ Live Agents category - Real-time voice interaction
- ✅ Multimodal: Audio input (voice) + Visual output (map results)
- ✅ Natural interruption handling via Gemini Live API
- ✅ Hosted on Google Cloud Platform
- ✅ Uses Google GenAI SDK/Agent Development Kit
- ✅ Beyond "text-in, text-out" - Voice-driven exploration

**Constraints**: 8-10 hour build time, no user accounts, general demo

---

## Quick Start (TL;DR for Hackathon)

**Category**: Live Agents - Real-time voice interaction with natural interruption

**Goal**: User speaks naturally → Gemini Live processes in real-time → Analyzes reviews → Conversational recommendations → Visual results + navigation

**Stack**: 
- Frontend: Web app with Gemini Live API (real-time audio streaming)
- Backend: Node.js + Express on Cloud Run (or using ADK)
- Google APIs: **Gemini Multimodal Live API** (primary), Vertex AI, Places API

**Live Agent Flow**:
1. User speaks naturally: "Hey, I'm looking for somewhere cozy to work, you know, quiet atmosphere..."
2. Agent responds in real-time: "Got it! Looking for a cozy, quiet workspace. Where are you located?"
3. User: "I'm in downtown Boston"
4. Agent (while processing): "Perfect, searching for calm workspaces in downtown Boston..."
5. Agent analyzes reviews via Gemini and speaks results: "I found three great options. Blue Bottle Coffee on Main Street has reviews calling it 'peaceful' and 'laptop-friendly'..."
6. User can interrupt: "Wait, what about the second one?"
7. Visual display updates with map cards + "Navigate" buttons

**Why This Fits "Live Agents"**:
- ✅ Real-time audio conversation (not text chat)
- ✅ Natural interruption support via Gemini Live API
- ✅ Multimodal: Voice input + Voice output + Visual results
- ✅ Moves beyond text box - feels like talking to a local guide

**Time Allocation**:
- Hours 0-1: Setup GCP, Gemini Live API, basic project
- Hours 1-3: Gemini Live audio streaming working (echo test)
- Hours 3-5: Add conversation logic + intent extraction
- Hours 5-7: Places API + review analysis integration
- Hours 7-9: Visual results UI + navigation handoff
- Hours 9-10: Polish conversation flow + test interruptions

---

---

## Core Concept

**Problem Statement**: Traditional map searches require users to know exactly what they're looking for and rely heavily on keyword matching. Users often have subjective preferences ("cozy," "authentic," "hidden gem") that don't translate well to traditional search.

**Solution**: A voice-first agent that:
- Understands qualitative descriptions
- Asks clarifying questions naturally
- Analyzes reviews and metadata to match subjective criteria
- Presents curated recommendations
- Seamlessly triggers navigation

---

## Hackathon Demo Flow

### Live Agent User Journey (Conversational)

**User speaks**: "I'm looking for a cafe which is calm and cozy to sit and work at"

**Agent responds in real-time (audio)**:
1. **Immediate Acknowledgment**: "Absolutely! Looking for a calm, cozy workspace. Where are you located?"

2. **User responds**: "Downtown Boston"

3. **Agent Processing (spoken while working)**:
   - "Perfect! Searching for quiet cafes in downtown Boston..."
   - Gemini Live API processes intent: cafe, calm, cozy, work-friendly
   - Places API searches: "cafe in downtown Boston"
   - Reviews analyzed via Gemini for qualitative match
   
4. **Agent Presents Results (conversationally)**:
   - "Great! I found three spots that match what you're looking for."
   - "First up is Thinking Cup on Tremont Street. Reviews say it's 'quiet with plenty of workspace' and 'cozy atmosphere.' About a 5-minute walk."
   - Visual card appears simultaneously with photo, rating, address
   - "Would you like to hear about the other options or navigate there?"

5. **User can interrupt**: "Wait, tell me more about that one"

6. **Agent adapts**:
   - "Sure! Thinking Cup has 4.5 stars. People specifically mention the comfortable seating and reliable WiFi. It's a local favorite for remote work."
   - "Want directions there, or should I tell you about the other cafes?"

7. **Navigation**:
   - User: "Yes, navigate there"
   - Visual "Navigate" button appears + Google Maps opens

### Key Multimodal Elements
- **Audio In**: Natural speech, can be interrupted
- **Audio Out**: Real-time voice responses
- **Visual Out**: Cards with photos, maps, ratings appear as agent speaks
- **Interaction**: Can interrupt, ask follow-ups, natural conversation flow

---

## Technical Architecture (Live Agent Stack)

### Simplified System Flow (8-10 Hours)

```
User (Web Browser)
    ↓ (speaks naturally)
WebRTC/Audio Stream
    ↓
Gemini Multimodal Live API (Real-time)
    ↓ (extracts intent, responds conversationally)
Places API Integration (backend)
    ↓ (fetches places + reviews)
Gemini processes reviews
    ↓ (scores matches)
Response Stream (audio + structured data)
    ↓
Frontend (updates visual cards as agent speaks)
    ↓
Google Maps Navigation
```

### Google Cloud Services Used

#### 1. **Gemini Multimodal Live API** (Primary - NEW!)
- **Real-time bidirectional audio streaming**
- Handles voice input AND voice output simultaneously
- Natural interruption support
- Can include function calling for structured data extraction
- **Usage**: 
  - User speaks naturally
  - Agent responds in real-time while processing
  - Extracts intent: `{place_type, qualitative_attributes, location}`
  - Streams conversational responses

#### 2. **Vertex AI Gemini API** (Supporting)
- **Model**: gemini-1.5-flash for review analysis
- **Function Calling** for review scoring:
  ```javascript
  {
    score: 85,
    reasoning: "Multiple reviews mention quiet, cozy atmosphere",
    match_quotes: ["peaceful workspace", "cozy corners"]
  }
  ```

#### 3. **Google Maps Platform**
- **Places API (New)**:
  - Text Search with location bias
  - Place Details for reviews (5 reviews per place)
  - Fields: name, reviews, rating, address, photos, opening_hours

#### 4. **Cloud Run** (Backend Hosting)
- Serverless Node.js backend
- WebSocket support for Gemini Live API streaming
- REST endpoint for Places API integration
- `/api/search-places` - Triggered by Gemini function call

### Data Flow (Live Agent)

1. **Audio Stream**: User speaks → WebRTC → Gemini Live API
2. **Real-time Processing**: Gemini extracts intent while user is still speaking
3. **Agent Response**: "Got it! Where are you located?" (spoken)
4. **User Responds**: "Downtown Boston" (audio)
5. **Function Calling**: Gemini triggers backend `/search-places` with extracted params
6. **Backend**: Places API → Get places → Analyze reviews with Gemini Flash
7. **Response Stream**: Agent speaks results while frontend displays visual cards
8. **Interaction**: User can interrupt at any time, agent adapts conversation

**Key Innovation**: Agent talks while processing, creating natural conversation flow instead of "loading" silence

---

## Google AI Features Showcase

### Gemini Live API (Real-time Streaming)
```javascript
// WebSocket connection to Gemini Live API
const session = await ai.languageModel.create({
  systemPrompt: `You are a local guide helping people find places based on qualitative descriptions.
  When user describes what they want, ask for location if not provided.
  Use search_places function to find results.
  Speak results conversationally, highlighting why each place matches their criteria.`,
  tools: [searchPlacesTool]
});

// Bidirectional audio streaming
session.streamAudio(userMicStream);
session.onAudioOutput = (audioChunk) => {
  playAudioToSpeaker(audioChunk);
};

// Function calling for Places API
const searchPlacesTool = {
  name: "search_places",
  description: "Search for places based on user criteria and location",
  parameters: {
    place_type: "string",
    qualitative_attributes: ["string"],
    location: "string"
  }
};
```

### Review Semantic Analysis (Gemini Flash)
```javascript
const prompt = `
Analyze these reviews for ${place.name}:
${reviews.map(r => r.text).join('\n')}

User wants: ${qualitative_attributes.join(', ')}

Score 0-100 how well this matches. Return JSON:
{
  "score": 85,
  "reasoning": "why it matches",
  "key_quotes": ["relevant quote 1", "quote 2"]
}
`;

const analysis = await gemini.generateContent(prompt);
```

### Interruption Handling
Gemini Live API natively supports interruptions:
- User can speak while agent is responding
- Agent pauses and listens
- Resumes context-aware conversation
- No complex state management needed!

---

## Hackathon MVP Features (8-10 Hours)

### Must Complete (Live Agent Core)
- [ ] **Gemini Live API integration** - Real-time bidirectional audio
- [ ] **Voice conversation** - User speaks, agent responds naturally
- [ ] **Interruption support** - User can interrupt agent mid-response
- [ ] **Intent extraction** - Gemini extracts place type + qualitative attributes from speech
- [ ] **Function calling** - Agent triggers Places API search
- [ ] **Review analysis** - Gemini scores places based on review sentiment
- [ ] **Conversational results** - Agent speaks recommendations naturally
- [ ] **Visual display** - Cards appear as agent speaks (multimodal output)
- [ ] **Navigation handoff** - Google Maps link

### Nice to Have (If Time Permits)
- [ ] Voice synthesis quality tuning
- [ ] Show review quotes that matched
- [ ] Handle "tell me more about option 2" follow-ups
- [ ] Loading indicators while processing
- [ ] Multiple qualitative attributes

### Explicitly Out of Scope
- ~~Text-based chat interface~~ (would violate Live Agent category)
- ~~User accounts/login~~
- ~~GPS/geolocation~~
- ~~Search history~~
- ~~Caching~~
- ~~Price range selection UI~~ (agent asks verbally if needed)
- ~~Embedded map display~~

### Why This Fits Judging Criteria

**Innovation & UX (40%)**:
- ✅ Breaks text box paradigm - pure voice interaction
- ✅ Natural conversation flow with interruptions
- ✅ Multimodal: Audio in/out + Visual results

**Technical Implementation (30%)**:
- ✅ Gemini Live API (cutting edge)
- ✅ Function calling for structured workflows
- ✅ Cloud Run backend
- ✅ Real-time audio streaming

**Demo & Presentation (30%)**:
- ✅ Clear problem: Maps searches don't understand "cozy" or "romantic"
- ✅ Clear solution: Talk naturally to find places
- ✅ Live demonstration of conversation

---

## Qualitative → Quantitative Mapping

### Ambiance Translation

| User Says | Agent Looks For |
|-----------|-----------------|
| "Cozy" | Small seating areas, warm lighting, intimate reviews, low noise mentions |
| "Calm/Quiet" | Low decibel mentions, "peaceful" in reviews, fewer crowds, away from main street |
| "Authentic" | Local ownership, traditional mentions, "tourist trap" absence, local reviewer preference |
| "Hidden gem" | Lower review count but high rating, local reviewer concentration, not chain |
| "Instagram-worthy" | Photo count, aesthetic mentions, "beautiful" frequency, natural lighting |
| "Romantic" | Dim lighting, intimate seating, date night mentions, wine/cocktail focus |
| "Family-friendly" | High chairs mentioned, kids menu, "loud okay" tolerance, play area |
| "Professional" | Business mentions, meeting-appropriate, WiFi, quiet, outlet availability |

### Contextual Filters

**Time of Day**:
- Morning (6am-11am): Breakfast availability, coffee quality, quick service
- Lunch (11am-2pm): Lunch menu, fast turnover, work-lunch appropriate
- Afternoon (2pm-5pm): Coffee/tea, work-friendly, stays welcome
- Evening (5pm-10pm): Dinner menu, ambiance, drink options
- Late night (10pm+): Still serving, bar scene, late-night menu

**User Intent**:
- Working: WiFi, outlets, noise level, seating comfort, long-stay welcome
- Dating: Ambiance, intimacy, noise level, menu quality, price appropriate
- Family: Space, kid-friendly, casual atmosphere, quick service
- Tourist: Authentic, local favorite, unique, photo-worthy
- Quick bite: Speed, convenience, parking/accessibility

---

## Conversation Design Principles

### Natural Dialog Patterns

**Good**:
- "I found 4 cafes nearby that match what you're looking for. Blue Bottle on Main Street is known for being quiet with great natural light - perfect for working. Want to hear the others?"
  
**Avoid**:
- "Here are the search results: 1) Blue Bottle Coffee, Rating: 4.5, Distance: 0.3mi, Price: $$, Open until 6pm..."

### Progressive Disclosure
- Start with top recommendation and why
- Offer alternatives if user wants more
- Only provide details when relevant or requested

### Handling Ambiguity
- **Graceful Clarification**: "By 'nearby,' do you mean walking distance or are you driving?"
- **Offer Options**: "I can show you the closest ones, or the highest-rated ones - what matters more?"
- **Learn from Context**: If user is asking at 7am on a weekday, assume work context

### Error Recovery
- **No Results**: "I couldn't find calm cafes in that area, but there are some nice quiet spots about 10 minutes away. Want to expand the search?"
- **Too Many Results**: "There are 20+ cafes that could work. Let me narrow it down - are you looking for something more upscale or casual?"
- **Misunderstanding**: "Sorry, did you say 'cafe' or 'bakery'? Just want to make sure I find the right spot."

---

## Privacy & Data Considerations

### User Data Handling
- **Location**: Only access when needed, request permission explicitly
- **Voice Data**: Process in real-time, option to not store recordings
- **Search History**: Opt-in for personalization, easy to delete
- **Preferences**: Stored locally by default, server sync optional

### Transparency
- Explain why certain questions are asked
- Show how results are ranked
- Allow users to see/edit their preference profile

---

## Success Metrics

### User Satisfaction
- Task completion rate (found a place and navigated)
- Average interaction length (should decrease with learning)
- Return usage rate
- User satisfaction score

### Technical Performance
- Response latency (<500ms for voice)
- Match accuracy (user rates recommendation quality)
- Question efficiency (minimum questions to get good results)
- Review analysis accuracy

### Business Metrics
- Daily active users
- Searches per user
- Navigation handoff conversion
- Feature adoption rates

---

## Hackathon Development Timeline (8-10 Hours)

### Hour 0-1: Setup & Live API Testing
- [ ] Run hackathon init script: `./init.sh`
- [ ] Enable APIs: Vertex AI, Places API, Gemini Live API
- [ ] Test Gemini Live API connection (echo test)
- [ ] Set up basic HTML page with mic button
- [ ] Verify audio streaming works

### Hour 1-3: Live Conversation Basics
- [ ] Implement Gemini Live API bidirectional audio
- [ ] Test basic conversation: user speaks → agent responds
- [ ] Test interruption: can user interrupt agent?
- [ ] Add system prompt for local guide persona
- [ ] Test intent extraction from natural speech

### Hour 3-5: Function Calling Integration
- [ ] Define `search_places` function for Gemini
- [ ] Backend endpoint: `/api/search-places`
- [ ] Connect to Places API
- [ ] Test: agent asks for location → searches → returns results
- [ ] Verify function is called correctly by agent

### Hour 5-7: Review Analysis & Scoring
- [ ] Fetch place reviews from Places API (5 per place)
- [ ] Use Gemini Flash to score each place
- [ ] Return structured data: `{name, score, reasoning, quotes}`
- [ ] Agent speaks results conversationally
- [ ] Test with "cozy cafe" query

### Hour 7-9: Visual Interface
- [ ] Create result cards (appear as agent speaks)
- [ ] Show: photo, name, rating, match reasoning
- [ ] Add "Navigate" button → Google Maps URL
- [ ] Sync visual updates with audio responses
- [ ] Basic styling (clean, mobile-friendly)

### Hour 9-10: Polish & Integration Test
- [ ] End-to-end test: full conversation → results → navigation
- [ ] Test interruptions work smoothly
- [ ] Practice demo conversation flow
- [ ] Deploy to Cloud Run
- [ ] Prepare 2-minute demo walkthrough

### Critical Path (If Behind Schedule)
**Priority 1**: Live audio conversation working
**Priority 2**: Function calling → Places API
**Priority 3**: Visual results display
**Cut if needed**: Review analysis (just use rating), polish/styling

---

## Google Cloud Tech Stack (Live Agent)

### Backend
- **Runtime**: Cloud Run with Node.js (WebSocket support needed)
- **AI/ML**: 
  - **Gemini Multimodal Live API** (primary for conversation)
  - Vertex AI Gemini 1.5 Flash (supporting for review analysis)
- **APIs**: 
  - Google Maps Platform - Places API
- **No Database, No Caching** - stateless for simplicity

### Frontend
- **Framework**: Vanilla JavaScript or React
- **Audio**: WebRTC or MediaStream API for mic access
- **Gemini Live SDK**: Google's client library for Live API
- **Styling**: Tailwind CSS (via CDN)
- **Hosting**: Firebase Hosting or Cloud Storage

### Development Approach
- **Option 1**: Use Agent Development Kit (ADK) - faster setup
- **Option 2**: Direct Gemini Live API integration - more control

### API Authentication
- **Service Account**: For backend function calling
- **API Key**: For Places API
- **Gemini Live**: OAuth or API key (check latest docs)

---

## Example Interactions

### Scenario 1: Quick Coffee
**User**: "I need coffee, somewhere quiet"
**Agent**: "Looking for a quiet cafe nearby. Are you driving or walking?"
**User**: "Walking"
**Agent**: "Got it. Found Voyager Coffee - 5 minute walk. It's known for being peaceful and has great outdoor seating. Navigate there?"
**User**: "Yes"
**Agent**: *Opens navigation*

### Scenario 2: Date Night
**User**: "I want to take someone to a nice romantic dinner tonight"
**Agent**: "Great! What kind of cuisine are you thinking? And what's your budget?"
**User**: "Italian, not too expensive but nice"
**Agent**: "Perfect. I found Trattoria Marco - it's intimate with candlelit tables, authentic Northern Italian food. Around $40-60 per person. They have an opening at 7:30. Want me to show you that?"
**User**: "What else do you have?"
**Agent**: "Osteria Luca is slightly more upscale, beautiful patio with string lights, runs about $70-90 per person..."

### Scenario 3: Work Session
**User**: "Where can I work for a few hours this afternoon?"
**Agent**: "Looking for a place with WiFi and good for working. Coffee shop, library, or co-working space?"
**User**: "Coffee shop"
**Agent**: "Do you need it to be very quiet or is some background noise okay?"
**User**: "Some noise is fine"
**Agent**: "Found three good options. Philz Coffee has great WiFi, lots of outlets, and people regularly work there for hours. 10 minute drive. Want this one?"

---

## Demo Script (2 Minutes) - Live Agent Category

### Opening (20 seconds)
"When you're looking for a place on Google Maps, you have to use exact keywords. But what if you want somewhere 'cozy'? Or 'romantic'? Our Live Agent understands these qualitative descriptions through natural voice conversation—and you can interrupt it anytime, just like talking to a friend."

### Live Demo (80 seconds)
**Setup**: Click "Start Conversation" button

1. **User speaks naturally**: "Hey, I'm looking for a cafe that's calm and cozy, somewhere I can work"

2. **Agent responds immediately** (audio):
   - "Got it! A quiet, cozy workspace. Where are you located?"

3. **User**: "I'm in downtown Boston"

4. **Agent** (conversational tone):
   - "Perfect! Let me find some calm workspaces in downtown Boston..."
   - *[Visual cards start appearing as agent speaks]*
   - "I found three great options. Thinking Cup on Tremont has several reviews calling it 'peaceful' and 'perfect for laptops'..."

5. **Demonstrate interruption**:
   - **User interrupts mid-sentence**: "Wait, what about the second one?"
   - **Agent stops and pivots**: "Sure! The second option is Flour Bakery. People say it's..."

6. **Navigation**:
   - User: "Let's go with the first one"
   - Agent: "Great choice! Opening navigation to Thinking Cup."
   - *[Google Maps link activates]*

### Technical Highlight (20 seconds)
"This is powered by Gemini Multimodal Live API for real-time conversation with natural interruptions. It analyzes Google Maps reviews semantically—not just keyword matching—and runs entirely on Google Cloud."

### Key Demo Moments
✅ Show agent speaking while results load (natural flow)
✅ Actually interrupt the agent (prove it's live)
✅ Show visual cards synced with audio
✅ End-to-end: voice → conversation → navigation

### Backup Plan
- Have recorded demo video ready
- Pre-tested queries that work: "cozy cafe Boston", "romantic restaurant NYC"
- Screenshot of working results

---

## Code Structure (Live Agent)

```
/voice-maps-agent
├── backend/
│   ├── index.js (WebSocket server for Live API)
│   ├── places-service.js (Places API integration)
│   ├── package.json
│   └── .env (API keys)
├── frontend/
│   ├── index.html (mic button, result cards)
│   ├── live-agent.js (Gemini Live SDK integration)
│   ├── ui-controller.js (visual display sync)
│   └── styles.css
├── Dockerfile (for Cloud Run with WebSocket support)
└── README.md
```

**Key files**:
- `live-agent.js`: Handles bidirectional audio streaming
- `places-service.js`: Function called by Gemini to search places
- `ui-controller.js`: Syncs visual cards with audio responses

---

## Avoiding Prohibited Categories

**Hackathon explicitly prohibits**:
- ❌ Basic RAG apps ("Chat with my PDF")
- ❌ Basic Image Analyzers  
- ❌ Standard Education Chatbots
- ❌ Anything that is "Text-In, Text-Out" only

**How our project avoids these**:
- ✅ **NOT text-in/text-out**: Pure voice conversation with audio responses
- ✅ **NOT basic chatbot**: Specialized agent with function calling for real data
- ✅ **NOT standard RAG**: Semantic review analysis + real-time Places API
- ✅ **Multimodal**: Audio I/O + Visual display + Map integration

**We fit "Live Agents" category**:
- ✅ Real-time bidirectional audio (Gemini Live API)
- ✅ Natural interruption support
- ✅ Specialized function (qualitative location discovery)
- ✅ Breaks the "text box" paradigm completely

---

## Key API Implementation

### Gemini Live API Setup
```javascript
import { LiveAPIClient } from '@google/generative-ai';

const client = new LiveAPIClient({
  apiKey: process.env.GEMINI_API_KEY
});

// System instruction for the agent
const systemInstruction = `You are a friendly local guide helping people find places.
When someone describes what they're looking for (like "cozy cafe" or "romantic restaurant"),
ask for their location if they haven't provided it.
Then use the search_places function to find matching locations.
Speak naturally and conversationally about the results, explaining WHY each place matches.`;

// Define function for Places search
const tools = [{
  functionDeclarations: [{
    name: "search_places",
    description: "Search for places based on qualitative criteria",
    parameters: {
      type: "object",
      properties: {
        place_type: { type: "string", description: "Type of place (cafe, restaurant, etc)" },
        qualitative_attributes: { 
          type: "array", 
          items: { type: "string" },
          description: "Subjective qualities like 'cozy', 'romantic', 'quiet'"
        },
        location: { type: "string", description: "City or neighborhood" }
      },
      required: ["place_type", "location"]
    }
  }]
}];

// Start session
const session = await client.connect({
  model: "gemini-2.0-flash-exp",
  systemInstruction,
  tools
});
```

### Handling Function Calls
```javascript
session.on('functionCall', async (call) => {
  if (call.name === 'search_places') {
    const { place_type, qualitative_attributes, location } = call.args;
    
    // Search Places API
    const places = await searchPlaces(place_type, location);
    
    // Analyze reviews with Gemini
    const scoredPlaces = await Promise.all(
      places.map(p => analyzePlace(p, qualitative_attributes))
    );
    
    // Return to Live API
    session.sendFunctionResponse({
      id: call.id,
      response: scoredPlaces.slice(0, 3) // Top 3
    });
  }
});
```

### Places API Integration
```javascript
async function searchPlaces(type, location) {
  const response = await fetch(
    `https://places.googleapis.com/v1/places:searchText`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.PLACES_API_KEY
      },
      body: JSON.stringify({
        textQuery: `${type} in ${location}`,
        maxResultCount: 10,
        openNow: true
      })
    }
  );
  return response.json();
}
```

### Review Analysis (Simplified)
```python
# Combine all reviews for one place
reviews_text = "\n".join([r['text'] for r in place['reviews'][:5]])

prompt = f"""
User wants: {qualitative_attributes}
Reviews: {reviews_text}

Does this place match? Score 0-100 and explain briefly.
Return JSON: {{"score": 85, "reason": "Multiple reviews mention quiet atmosphere"}}
"""

response = model.generate_content(prompt)
# Parse JSON response
```

---

## Judging Criteria Alignment

### Innovation (25%)
- **Novel approach**: Converting qualitative descriptions to quantifiable searches
- **AI showcase**: Gemini for semantic understanding, not just keyword matching

### Technical Implementation (25%)
- **Google Cloud integration**: 5+ GCP services working together
- **Clean architecture**: Modular, testable, deployable

### Design & UX (20%)
- **Simplicity**: Voice-first, minimal clicks to navigate
- **Feedback**: Clear loading states, match reasoning shown

### Completeness (15%)
- **End-to-end**: Voice input → Results → Navigation all working
- **Error handling**: Graceful failures, no crashes

### Presentation (15%)
- **Clear demo**: Shows problem → solution → results
- **Technical depth**: Can explain Gemini prompts, scoring algorithm

---

## Troubleshooting Tips

### Common Live API Issues
1. **Audio not streaming**: Check browser mic permissions, use HTTPS
2. **WebSocket connection fails**: Ensure Cloud Run supports WebSockets
3. **Agent doesn't respond**: Verify API key, check system prompt format
4. **Interruptions not working**: Use latest Gemini Live SDK version
5. **Function not called**: Check function declaration schema matches exactly

### Pre-Demo Checklist
- [ ] Test on demo WiFi (WebSocket connectivity)
- [ ] Have 3 working queries ready: "cozy cafe in Boston", "romantic restaurant NYC", "quiet workspace SF"
- [ ] Test interruption: interrupt mid-sentence and verify agent stops
- [ ] Verify audio output is audible in demo room
- [ ] Charge laptop + have charger
- [ ] Close all other browser tabs (save memory)
- [ ] Have backup: video recording of working demo

### Time-Saving Shortcuts
- Use Agent Development Kit (ADK) if available - faster than raw API
- Hardcode Boston as fallback location
- Skip advanced error handling - focus on happy path
- Mock review analysis if Gemini quota runs out (return static scores)

---

## Success Metrics (8-10 Hour Hackathon)

### Demo Success (Most Important)
- [ ] Voice input captures query correctly
- [ ] Gemini extracts intent (place type + 1-2 attributes)
- [ ] Places API returns results for given location
- [ ] At least 1/3 results actually match the qualitative criteria
- [ ] Navigation link works
- [ ] No crashes during 2-minute demo

### Technical Achievement
- [ ] 3 Google Cloud services working together
- [ ] End-to-end flow completes in < 10 seconds
- [ ] Gemini review analysis provides some reasoning
- [ ] Code is readable (judges might ask to see it)

### Nice to Have
- [ ] UI looks clean and professional
- [ ] Works on mobile browser
- [ ] Multiple test queries work reliably

### Doesn't Matter for Hackathon
- ~~Perfect accuracy~~
- ~~Edge case handling~~
- ~~Production-ready code~~
- ~~Comprehensive error messages~~

---

## Next Steps After Hackathon

If pursuing further:
1. **User Testing**: Get 20-30 people to try it, gather feedback
2. **Prompt Tuning**: Improve Gemini prompts based on edge cases
3. **Expand Attributes**: Add more qualitative mappings (authentic, trendy, etc.)
4. **Multi-turn Conversation**: Better context handling across turns
5. **Personalization**: Remember user preferences over time

---

## Hackathon Submission Checklist

### Before Submitting
- [ ] Repository README lists all team members
- [ ] Code is pushed to GitHub
- [ ] Working demo is deployed and accessible
- [ ] 2-minute presentation is rehearsed
- [ ] Project fits "Live Agents" category clearly

### Submission Requirements
- Team name
- Project name
- Git repository URL
- README.md with team members listed