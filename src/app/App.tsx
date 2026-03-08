import { useState, useCallback, useEffect, useRef } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { VoiceAssistant } from './components/VoiceAssistant';
import { LocationMap, PlaceOfInterest } from './components/LocationMap';
import { ChatPanel, ChatMessage } from './components/ChatPanel';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { MapPin, Send, Globe } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3c4885b3`;

export default function App() {
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [apiKey, setApiKey] = useState<string>('');
  const [hasAutoQueried, setHasAutoQueried] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [places, setPlaces] = useState<PlaceOfInterest[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceOfInterest | null>(null);
  const [locationState, setLocationState] = useState<'idle' | 'asking' | 'detecting' | 'manual' | 'ready'>('idle');
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch(`${API_BASE}/maps-key`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (response.ok) {
          const data = await response.json();
          setApiKey(data.apiKey || 'ERROR');
        } else {
          setApiKey('ERROR');
        }
      } catch {
        setApiKey('ERROR');
      }
    };
    fetchApiKey();
  }, []);

  // Conversational onboarding — GEOL greets and asks for location
  useEffect(() => {
    const greeting: ChatMessage = {
      id: 'greeting-1',
      role: 'assistant',
      content:
        "Hey there! 👋 I'm GEOL — your AI-powered geographic companion. I can tell you fascinating facts, hidden history, upcoming events, and real estate insights about any place on Earth.\n\nTo get started, I need to know where you are. Want me to detect your location, or would you prefer to tell me?",
      locationPrompt: true,
      timestamp: new Date(),
    };
    setMessages([greeting]);
    setLocationState('asking');
  }, []);

  // When location is set, send the "location confirmed" system message + auto-query
  useEffect(() => {
    if (currentLocation && locationState === 'ready' && !hasAutoQueried && !isProcessing) {
      setHasAutoQueried(true);

      // Add a system message showing the confirmed location
      const confirmMsg: ChatMessage = {
        id: `loc-confirm-${Date.now()}`,
        role: 'system',
        content: '',
        locationConfirmed: {
          address: currentLocation.address,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
        },
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMsg]);

      // Now auto-query
      setTimeout(() => {
        sendMessage(
          `I'm at ${currentLocation.address}. Tell me about this area! Share fun facts, history, upcoming events, and real estate within 2 miles.`,
          true // isAutoQuery - don't show as user bubble
        );
      }, 300);
    }
  }, [currentLocation, locationState, hasAutoQueried]);

  const handleLocationChange = useCallback(
    (lat: number, lng: number, address: string) => {
      setCurrentLocation({ lat, lng, address });
      setSelectedPlace(null); // clear when navigating to a new location via search
      if (locationState !== 'ready') {
        setLocationState('ready');
      }
    },
    [locationState]
  );

  // User clicked "Use my location"
  const handleRequestLocation = () => {
    setLocationState('detecting');

    if (!navigator.geolocation) {
      addAssistantMessage(
        "It seems your browser doesn't support location detection. No worries — just type a city or address and I'll find it!",
      );
      setLocationState('manual');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;
        // Try reverse geocode — always fall back to raw coords so the map always shows
        try {
          const resp = await fetch(`${API_BASE}/geocode`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({ address: `${rawLat},${rawLng}` }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (typeof data.lat === 'number' && typeof data.lng === 'number') {
              // Use stable setters directly to avoid stale-closure issues with handleLocationChange
              setCurrentLocation({ lat: data.lat, lng: data.lng, address: data.address || 'Your location' });
              setSelectedPlace(null);
              setLocationState('ready');
              return;
            }
          }
        } catch {
          // fall through to raw coords fallback
        }
        // Fallback: raw GPS coords, no reverse geocode
        setCurrentLocation({ lat: rawLat, lng: rawLng, address: 'Your current location' });
        setSelectedPlace(null);
        setLocationState('ready');
      },
      (err) => {
        console.log('Geolocation error:', err.code, err.message);
        const msg =
          err.code === 1
            ? "Location permission was denied. Please type a city, address, or landmark to get started!"
            : "Couldn't get your location right now. Please type a city, address, or landmark instead!";
        addAssistantMessage(msg);
        setLocationState('manual');
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 }
    );
  };

  // User clicked "Type a location"
  const handleManualLocation = () => {
    setLocationState('manual');
    addAssistantMessage(
      "Sure! Just type any city, address, or landmark in the message box below. For example: \"San Francisco\", \"Times Square, New York\", or \"Eiffel Tower, Paris\"."
    );
  };

  const addAssistantMessage = (content: string, extras?: Partial<ChatMessage>) => {
    const msg: ChatMessage = {
      id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'assistant',
      content,
      timestamp: new Date(),
      ...extras,
    };
    setMessages((prev) => [...prev, msg]);
  };

  const generateHistoricalImage = async (messageId: string, prompt: string) => {
    try {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, imageLoading: true } : m))
      );

      const response = await fetch(`${API_BASE}/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          prompt,
          address: currentLocation?.address || '',
        }),
      });

      const data = await response.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, imageLoading: false, generatedImage: data.image || null }
            : m
        )
      );
    } catch (error) {
      console.error('Error generating image:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, imageLoading: false, generatedImage: null } : m
        )
      );
    }
  };

  // Try to geocode user input as a location when we're in manual/asking mode
  const tryGeocodeInput = async (text: string): Promise<boolean> => {
    try {
      const resp = await fetch(`${API_BASE}/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ address: text }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.lat && data.lng) {
          console.log('Geocode success:', data.address);
          handleLocationChange(data.lat, data.lng, data.address);
          return true;
        }
      } else {
        const errData = await resp.text();
        console.log('Geocode error:', errData);
      }
    } catch (e) {
      console.log('Geocode failed:', e);
    }
    return false;
  };

  const sendMessage = async (content: string, isAutoQuery = false) => {
    // If we don't have a location yet, try to interpret the message as a location
    if (!currentLocation && (locationState === 'manual' || locationState === 'asking')) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      const found = await tryGeocodeInput(content);
      if (found) {
        setIsProcessing(false);
        return;
      }

      // Not a location — tell them
      addAssistantMessage(
        `I couldn't find "${content}" as a location. Could you try a city name, address, or landmark? For example: "Tokyo", "221B Baker Street, London", or "Central Park".`
      );
      setIsProcessing(false);
      return;
    }

    if (!currentLocation || (isProcessing && !isAutoQuery)) return;

    // Normal message flow
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const updatedMessages = isAutoQuery
      ? messagesRef.current
      : [...messagesRef.current, userMessage];

    if (!isAutoQuery) {
      setMessages(updatedMessages);
    }
    setIsProcessing(true);
    setTextInput('');

    // Check if user wants to change location (broad set of natural voice phrases)
    const lowerContent = content.toLowerCase();
    const locationPrefixRe =
      /^(take me to|go to|navigate to|switch to|explore|show me|find|search for|what'?s? (?:in|near|at)|tell me about|what about|let'?s? (?:go to|visit))\s+/i;
    const isLocationChange = locationPrefixRe.test(lowerContent);

    if (isLocationChange) {
      const locationText = content.replace(locationPrefixRe, '').trim();

      if (locationText) {
        const found = await tryGeocodeInput(locationText);
        if (found) {
          setHasAutoQueried(false); // Allow re-query for new location
          setIsProcessing(false);
          return;
        }
      }
    }

    try {
      const chatHistory = updatedMessages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role,
          content:
            m.role === 'assistant'
              ? JSON.stringify({
                  message: m.content,
                  info: m.info,
                  suggestedQuestions: m.suggestedQuestions,
                })
              : m.content,
        }));

      // Add auto-query as user content if not shown
      if (isAutoQuery) {
        chatHistory.push({ role: 'user', content });
      }

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          messages: chatHistory,
          location: currentLocation,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chat API error:', errorText);
        throw new Error(errorText);
      }

      const data = await response.json();
      console.log('Chat response:', data);

      if (data.error && !data.message) throw new Error(data.error);

      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: data.message || data.response || 'I found some information about your area!',
        info: data.info || undefined,
        suggestedQuestions: data.suggestedQuestions || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setLastResponse(assistantMessage.content);

      if (data.info?.historicalImagePrompt) {
        generateHistoricalImage(assistantId, data.info.historicalImagePrompt);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addAssistantMessage(
        'Sorry, I had trouble processing that. Could you try asking again?',
        {
          suggestedQuestions: [
            'Tell me fun facts about this area',
            'What events are happening nearby?',
            'Show me the history of this place',
          ],
        }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // When a POI marker is clicked
  const handlePlaceClick = async (place: PlaceOfInterest) => {
    if (isProcessing) return;

    setSelectedPlace(place);
    handleLocationChange(place.lat, place.lng, place.address || place.name);

    const userMsg: ChatMessage = {
      id: `user-poi-${Date.now()}`,
      role: 'user',
      content: `Tell me about ${place.name}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    const assistantId = `assistant-poi-${Date.now()}`;

    // Add loading message immediately — show the Places photo as currentImage right away
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: `Loading info about ${place.name}...`,
        imageLoading: true,
        historicalStreetView: {
          currentImage: place.photoUrl || null,
          historicalImage: null,
          location: place.name,
        },
        timestamp: new Date(),
      } as ChatMessage,
    ]);

    try {
      // Fetch place info and historical photo in parallel
      const [infoResp, histResp] = await Promise.all([
        fetch(`${API_BASE}/place-info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            placeName: place.name,
            placeAddress: place.address,
            lat: place.lat,
            lng: place.lng,
            primaryType: place.primaryType,
          }),
        }),
        fetch(`${API_BASE}/historical-streetview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            lat: place.lat,
            lng: place.lng,
            address: place.address,
            placeName: place.name,
            ...(place.photoName && { photoName: place.photoName }),
          }),
        }),
      ]);

      const [infoData, histData] = await Promise.all([infoResp.json(), histResp.json()]);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                imageLoading: false,
                content: infoData.message || `${place.name} is a notable place in the area.`,
                info: {
                  facts: infoData.facts || [],
                  historicalFacts: infoData.historicalFact ? [infoData.historicalFact] : [],
                  events: infoData.events || [],
                  realEstate: infoData.realEstate || [],
                },
                historicalStreetView: {
                  currentImage: place.photoUrl || histData.currentStreetView || null,
                  historicalImage: histData.historicalImage || null,
                  historicalImages: histData.historicalImages || null,
                  location: place.name,
                  historicalDescription: histData.historicalDescription || null,
                  photoDate: histData.photoDate || null,
                  photoDescription: histData.photoDescription || null,
                  articleTitle: histData.articleTitle || null,
                  source: histData.source || null,
                },
                suggestedQuestions: [
                  `What events happen at ${place.name}?`,
                  `What's the history of ${place.name}?`,
                  `Are there similar places nearby?`,
                ],
              }
            : m
        )
      );
      setLastResponse(infoData.message || `${place.name} is a notable place in the area.`);
    } catch (error) {
      console.error('Error fetching place info:', error);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      addAssistantMessage(
        `I'd love to tell you about ${place.name}, but I had trouble fetching the details. Try asking me directly!`,
        { suggestedQuestions: [`Tell me about ${place.name}`] }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const sendMessageRef = useRef(sendMessage);
  useEffect(() => { sendMessageRef.current = sendMessage; });
  const handleTranscript = useCallback((text: string) => sendMessageRef.current(text), []);

  const handleTextSubmit = () => {
    if (textInput.trim() && !isProcessing) sendMessage(textInput.trim());
  };

  const handleSuggestedQuestion = (question: string) => {
    if (!isProcessing) sendMessage(question);
  };

  const handlePlacesLoaded = useCallback((newPlaces: PlaceOfInterest[]) => {
    setPlaces(newPlaces);
  }, []);

  // Historical Street View handler
  const handleHistoricalStreetView = async () => {
    if (!currentLocation || isProcessing) return;

    const targetName = selectedPlace?.name || currentLocation.address.split(',')[0];

    const userMsg: ChatMessage = {
      id: `user-hsv-${Date.now()}`,
      role: 'user',
      content: `Show me what ${targetName} looked like 100 years ago`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    const assistantId = `assistant-hsv-${Date.now()}`;

    const loadingMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: selectedPlace
        ? `Searching for historical images of ${selectedPlace.name}...`
        : `Searching for historical images of ${currentLocation.address.split(',')[0]}...`,
      imageLoading: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, loadingMsg]);

    try {
      const response = await fetch(`${API_BASE}/historical-streetview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          address: currentLocation.address,
          ...(selectedPlace?.photoName && { photoName: selectedPlace.photoName }),
          ...(selectedPlace?.name && { placeName: selectedPlace.name }),
        }),
      });

      const data = await response.json();
      const placeName = currentLocation.address.split(',')[0];

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                imageLoading: false,
                generatedImage: data.historicalImage || null,
                historicalStreetView: {
                  currentImage: data.currentStreetView || null,
                  historicalImage: data.historicalImage || null,
                  historicalImages: data.historicalImages || null,
                  location: data.location || currentLocation.address,
                  historicalDescription: data.historicalDescription || null,
                  photoDate: data.photoDate || null,
                  photoDescription: data.photoDescription || null,
                  articleTitle: data.articleTitle || null,
                  source: data.source || null,
                },
                content: data.historicalImage
                  ? data.source === 'wikipedia'
                    ? `Here's an actual historical photograph of ${placeName} from ${data.photoDate || 'the past'}, sourced from Wikipedia/Wikimedia Commons. Compare it with the current view below!`
                    : `Here's my AI-generated rendering of what ${placeName} would have looked like around the 1920s! The image was created by Gemini AI using a current reference photo of the monument.`
                  : data.historicalDescription
                  ? `I couldn't generate an image this time, but here's a vivid description of what ${placeName} looked like about 100 years ago.`
                  : `I wasn't able to generate a historical rendering right now. Try asking me about the history of ${placeName} directly!`,
                suggestedQuestions: [
                  `What did ${currentLocation.address.split(',')[0]} look like in the 1800s?`,
                  'Tell me about the architecture history here',
                  'What major historical events happened here?',
                ],
              }
            : m
        )
      );
    } catch (error) {
      console.error('Error generating historical street view:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                imageLoading: false,
                content: 'I had trouble generating the historical street view. Try asking me about the history of this area instead!',
                suggestedQuestions: ['What is the history of this area?'],
              }
            : m
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const inputPlaceholder =
    locationState === 'manual' || locationState === 'asking'
      ? 'Type a city, address, or landmark...'
      : "Ask me anything about this place...";

  const showMap = locationState === 'ready' && apiKey && apiKey !== 'ERROR';

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card shrink-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #4285F4 0%, #9B51E0 35%, #EA4335 60%, #FBBC05 80%, #34A853 100%)' }}>
                <Globe className="w-5 h-5 text-white drop-shadow" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">GEOL</h1>
                <p className="text-xs text-muted-foreground">
                  Conversational Geographic Agent • Google Hackathon
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {currentLocation && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium flex items-center gap-1 justify-end">
                    <MapPin className="w-3 h-3" />
                    {currentLocation.address.length > 35
                      ? currentLocation.address.substring(0, 35) + '...'
                      : currentLocation.address}
                  </p>
                  {places.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {places.length} places of interest nearby
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content — flex-1 min-h-0 gives it a hard upper bound from h-screen above.
          The inner container uses h-full (safe now that App is h-screen).
          Only the messages list inside ChatPanel scrolls; the outer page never does. */}
      <div className="flex-1 min-h-0">
        {apiKey && apiKey !== 'ERROR' ? (
          <APIProvider apiKey={apiKey}>
            <div className="h-full px-4 py-4 flex flex-row gap-4">
              {/* Map — left, 40% width */}
              <div className="h-full w-2/5 shrink-0">
                <Card className="h-full">
                  <CardContent className="p-0 h-full relative">
                    {/* Loading overlay — blocks map interaction while chat is processing */}
                    {isProcessing && (
                      <div className="absolute inset-0 z-[2000] rounded-xl flex flex-col items-center justify-center gap-3"
                        style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}>
                        <div className="flex gap-1.5">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="w-2.5 h-2.5 rounded-full bg-white"
                              style={{ animation: `bounce 0.9s ease-in-out ${i * 0.18}s infinite` }}
                            />
                          ))}
                        </div>
                        <p className="text-white text-xs font-medium tracking-wide">Thinking...</p>
                      </div>
                    )}
                    {showMap ? (
                      <LocationMap
                        onLocationChange={handleLocationChange}
                        onPlaceClick={handlePlaceClick}
                        places={places}
                        onPlacesLoaded={handlePlacesLoaded}
                        externalPosition={currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-xl">
                        <div className="text-center p-6">
                          <Globe className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">
                            Map will appear once you share your location
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            Use the chat to get started →
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Chat — right, remaining width */}
              <div className="h-full flex-1 min-w-0 flex flex-col">
                <ChatPanel
                  messages={messages}
                  isLoading={isProcessing}
                  onSuggestedQuestion={handleSuggestedQuestion}
                  onRequestLocation={handleRequestLocation}
                  onManualLocation={handleManualLocation}
                  locationState={locationState === 'manual' ? 'asking' : locationState === 'ready' ? 'ready' : locationState}
                  onHistoricalStreetView={handleHistoricalStreetView}
                  currentLocation={currentLocation}
                />
              </div>
            </div>
          </APIProvider>
        ) : apiKey === 'ERROR' ? (
          <div className="h-full px-4 py-4 flex flex-row gap-4">
            <div className="h-full w-2/5 shrink-0">
              <Card className="h-full">
                <CardContent className="p-0 h-full flex items-center justify-center">
                  <div className="text-center p-4">
                    <Globe className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-destructive font-semibold mb-2">Map Configuration Error</p>
                    <p className="text-sm text-muted-foreground">
                      Please ensure GOOGLE_MAPS_API_KEY is configured.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="h-full flex-1 min-w-0 flex flex-col">
              <ChatPanel
                messages={messages}
                isLoading={isProcessing}
                onSuggestedQuestion={handleSuggestedQuestion}
                onRequestLocation={handleRequestLocation}
                onManualLocation={handleManualLocation}
                locationState={locationState === 'manual' ? 'asking' : locationState === 'ready' ? 'ready' : locationState}
                onHistoricalStreetView={handleHistoricalStreetView}
                currentLocation={currentLocation}
              />
            </div>
          </div>
        ) : (
          <div className="h-full px-4 py-4 flex flex-row gap-4">
            <div className="h-full w-2/5 shrink-0">
              <Card className="h-full">
                <CardContent className="p-0 h-full flex items-center justify-center">
                  <p className="text-muted-foreground">Loading map...</p>
                </CardContent>
              </Card>
            </div>
            <div className="h-full flex-1 min-w-0 flex flex-col">
              <ChatPanel
                messages={messages}
                isLoading={isProcessing}
                onSuggestedQuestion={handleSuggestedQuestion}
                onRequestLocation={handleRequestLocation}
                onManualLocation={handleManualLocation}
                locationState={locationState === 'manual' ? 'asking' : locationState === 'ready' ? 'ready' : locationState}
                onHistoricalStreetView={handleHistoricalStreetView}
                currentLocation={currentLocation}
              />
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <footer className="border-t bg-card shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <VoiceAssistant
              onTranscript={handleTranscript}
              lastResponse={lastResponse}
              isProcessing={isProcessing}
            />

            <div className="flex-1 flex gap-2">
              <Input
                placeholder={inputPlaceholder}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                disabled={isProcessing}
                className="flex-1"
              />
              <Button
                onClick={handleTextSubmit}
                disabled={isProcessing || !textInput.trim()}
                size="icon"
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-1.5 max-w-3xl mx-auto">
            {locationState === 'ready'
              ? 'Type a question, say "take me to Paris", or tap 🎤 to speak'
              : 'Type a location or tap 🎤 to tell me where you are'}
          </p>
        </div>
      </footer>
    </div>
  );
}