import { useRef, useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  MapPin, Landmark, Calendar, Home, Image as ImageIcon,
  Loader2, Sparkles, ChevronDown, ChevronUp, User, Bot,
  Navigation, Keyboard, Mic, Clock, ArrowLeftRight, ChevronLeft, ChevronRight
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  info?: {
    facts?: string[];
    historicalFacts?: string[];
    events?: Array<{ title: string; date: string; description: string; link?: string }>;
    realEstate?: Array<{ address: string; price: string; type: string; listingType?: 'buy' | 'rent'; link: string }>;
    historicalImagePrompt?: string;
  };
  generatedImage?: string | null;
  imageLoading?: boolean;
  suggestedQuestions?: string[];
  timestamp: Date;
  locationPrompt?: boolean;
  locationConfirmed?: { address: string; lat: number; lng: number };
  historicalStreetView?: {
    currentImage: string | null;
    historicalImage: string | null;
    historicalImages?: Array<{ image: string; date: string; description?: string | null; source: string }> | null;
    location: string;
    historicalDescription?: string | null;
    photoDate?: string | null;
    photoDescription?: string | null;
    articleTitle?: string | null;
    source?: string | null;
  };
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSuggestedQuestion: (question: string) => void;
  onRequestLocation: () => void;
  onManualLocation: () => void;
  locationState: 'idle' | 'asking' | 'detecting' | 'ready';
  onHistoricalStreetView: () => void;
  currentLocation: { lat: number; lng: number; address: string } | null;
}

function InfoCards({ info }: { info: ChatMessage['info'] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!info) return null;

  const sections = [
    { key: 'facts', label: 'Fun Facts', icon: Sparkles, data: info.facts, color: 'bg-amber-100 text-amber-800' },
    { key: 'historicalFacts', label: 'History', icon: Landmark, data: info.historicalFacts, color: 'bg-blue-100 text-blue-800' },
    { key: 'events', label: 'Events', icon: Calendar, data: info.events, color: 'bg-green-100 text-green-800' },
    { key: 'realEstate', label: 'Real Estate', icon: Home, data: info.realEstate, color: 'bg-purple-100 text-purple-800' },
  ].filter(s => s.data && (Array.isArray(s.data) ? s.data.length > 0 : true));

  if (sections.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {sections.map(({ key, label, icon: Icon, data, color }) => (
        <div key={key} className="rounded-lg border bg-card overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === key ? null : key)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={`${color} text-xs`}>
                <Icon className="w-3 h-3 mr-1" />
                {label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {Array.isArray(data) ? `${data.length} items` : ''}
              </span>
            </div>
            {expanded === key ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          
          {expanded === key && (
            <div className="px-3 pb-3 space-y-2">
              <Separator />
              {key === 'facts' && (data as string[]).map((fact, i) => (
                <p key={i} className="text-sm pl-2 border-l-2 border-amber-300">{fact}</p>
              ))}
              {key === 'historicalFacts' && (data as string[]).map((fact, i) => (
                <p key={i} className="text-sm pl-2 border-l-2 border-blue-300">{fact}</p>
              ))}
              {key === 'events' && (data as Array<{ title: string; date: string; description: string; link?: string }>).map((event, i) => {
                const eventLink =
                  event.link && event.link !== '#'
                    ? event.link
                    : `https://www.google.com/search?q=${encodeURIComponent(event.title + ' ' + event.date)}`;
                return (
                  <div key={i} className="pl-2 border-l-2 border-green-300">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{event.title}</p>
                      <a
                        href={eventLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline shrink-0"
                      >
                        Details →
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                    <p className="text-sm mt-1">{event.description}</p>
                  </div>
                );
              })}
              {key === 'realEstate' && (data as Array<{ address: string; price: string; type: string; listingType?: string; link: string }>).map((listing, i) => {
                const isRent = listing.listingType === 'rent';
                const searchAddr = encodeURIComponent(listing.address);
                const realLink =
                  listing.link && listing.link !== '#'
                    ? listing.link
                    : isRent
                    ? `https://www.zillow.com/homes/for_rent/${searchAddr}_rb/`
                    : `https://www.zillow.com/homes/for_sale/${searchAddr}_rb/`;
                return (
                  <div key={i} className="pl-2 border-l-2 border-purple-300">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{listing.address}</p>
                        <p className="text-xs text-muted-foreground">{listing.type}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-sm font-bold text-primary">{listing.price}</p>
                          {listing.listingType && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              isRent ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {isRent ? 'For Rent' : 'For Sale'}
                            </span>
                          )}
                        </div>
                      </div>
                      <a
                        href={realLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline shrink-0"
                      >
                        View →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HistoricalImage({ message }: { message: ChatMessage }) {
  if (message.imageLoading) {
    return (
      <div className="mt-3 rounded-lg border bg-muted/30 p-6 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Generating historical rendering...</p>
      </div>
    );
  }

  // Historical Street View comparison
  if (message.historicalStreetView) {
    const { currentImage, historicalImage, historicalImages, location, historicalDescription, photoDate, photoDescription, articleTitle, source } = message.historicalStreetView;
    return (
      <HistoricalStreetViewComparison
        currentImage={currentImage}
        historicalImage={historicalImage}
        historicalImages={historicalImages}
        location={location}
        historicalDescription={historicalDescription}
        photoDate={photoDate}
        photoDescription={photoDescription}
        articleTitle={articleTitle}
        source={source}
      />
    );
  }

  if (message.generatedImage) {
    return (
      <div className="mt-3 rounded-lg overflow-hidden border">
        <img
          src={message.generatedImage}
          alt="Historical rendering"
          className="w-full rounded-t-lg"
        />
        <div className="p-2 bg-muted/30">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ImageIcon className="w-3 h-3" />
            <span>AI-generated historical rendering</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Side-by-side or toggle comparison of current street view vs. historical
function HistoricalStreetViewComparison({
  currentImage,
  historicalImage,
  historicalImages,
  location,
  historicalDescription,
  photoDate,
  photoDescription,
  source,
}: {
  currentImage: string | null;
  historicalImage: string | null;
  historicalImages?: Array<{ image: string; date: string; description?: string | null; source: string }> | null;
  location: string;
  historicalDescription?: string | null;
  photoDate?: string | null;
  photoDescription?: string | null;
  articleTitle?: string | null;
  source?: string | null;
}) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Cap gallery at 5 images
  const gallery = historicalImages && historicalImages.length > 0
    ? historicalImages.slice(0, 5)
    : null;

  const goNext = () => setSelectedIdx(i => gallery ? (i + 1) % gallery.length : i);
  const goPrev = () => setSelectedIdx(i => gallery ? (i - 1 + gallery.length) % gallery.length : i);

  const activeHistorical = gallery ? gallery[selectedIdx] : null;
  const displayHistorical = activeHistorical?.image || historicalImage;
  const displayDate = activeHistorical?.date || photoDate;
  const displayDesc = activeHistorical?.description || photoDescription;
  const displaySource = activeHistorical?.source || source;

  // Text-only fallback: no historical image but we have a Gemini-generated description
  if (!displayHistorical && historicalDescription) {
    return (
      <div className="mt-3 rounded-lg border overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b">
          <Clock className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-medium text-amber-800">Time Travel: {location}</span>
        </div>
        {currentImage && (
          <div className="relative">
            <img src={currentImage} alt="Current view" className="w-full" />
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="text-xs shadow-md bg-blue-100 text-blue-800">
                📍 Today
              </Badge>
            </div>
          </div>
        )}
        <div className="px-4 py-3 bg-gradient-to-b from-amber-50/50 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <Landmark className="w-4 h-4 text-amber-700" />
            <span className="text-sm font-semibold text-amber-900">~100 Years Ago</span>
          </div>
          <div className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${!descExpanded ? 'line-clamp-6' : ''}`}>
            {historicalDescription}
          </div>
          {historicalDescription.length > 300 && (
            <button
              onClick={() => setDescExpanded(!descExpanded)}
              className="mt-2 text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              {descExpanded ? (
                <><ChevronUp className="w-3 h-3" /> Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> Read full description</>
              )}
            </button>
          )}
        </div>
        <div className="px-3 py-2 bg-muted/30 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            <span>Gemini AI historical description</span>
          </div>
        </div>
      </div>
    );
  }

  if (!displayHistorical && !currentImage) return null;

  const hasBoth = !!currentImage && !!displayHistorical;
  const isSlideshow = gallery && gallery.length > 1;

  return (
    <div className="mt-3 rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-medium">
            {isSlideshow ? `Historical Photos (${gallery.length})` : 'Time Travel'}
          </span>
        </div>
        {hasBoth && (
          <button
            onClick={() => setShowCurrent(!showCurrent)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeftRight className="w-3 h-3" />
            {showCurrent ? 'Show historical' : 'Show today'}
          </button>
        )}
      </div>

      {/* Slideshow / Main image */}
      <div className="relative bg-black">
        {hasBoth && showCurrent ? (
          <>
            <img src={currentImage!} alt="Today" className="w-full object-contain max-h-72" />
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="text-xs shadow-md bg-blue-100 text-blue-800">📍 Today</Badge>
            </div>
          </>
        ) : displayHistorical ? (
          <>
            <img
              src={displayHistorical}
              alt={`Historical photo ${displayDate ?? ''}`}
              className="w-full object-contain max-h-72"
            />
            {/* Date badge */}
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="text-xs shadow-md bg-amber-100 text-amber-800">
                {displayDate ? `📷 ${displayDate}` : '🕰️ Historical'}
              </Badge>
            </div>
            {/* Today thumbnail */}
            {currentImage && !showCurrent && (
              <div className="absolute top-2 right-2">
                <img
                  src={currentImage}
                  alt="Today"
                  className="w-14 h-14 object-cover rounded border-2 border-white shadow-md cursor-pointer opacity-80 hover:opacity-100"
                  onClick={() => setShowCurrent(true)}
                  title="Click to see today"
                />
              </div>
            )}
            {/* Slideshow arrows */}
            {isSlideshow && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goPrev(); setShowCurrent(false); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goNext(); setShowCurrent(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                {/* Dot indicators */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {gallery.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setSelectedIdx(i); setShowCurrent(false); }}
                      className={`w-2 h-2 rounded-full transition-all ${i === selectedIdx ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : currentImage ? (
          <img src={currentImage} alt="Current" className="w-full object-contain max-h-72" />
        ) : null}
      </div>

      {/* Caption + footer */}
      <div className="px-3 py-2 bg-muted/30 border-t space-y-0.5">
        {displayDesc && (
          <p className="text-xs text-foreground/70 leading-snug">{displayDesc}</p>
        )}
        <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <ImageIcon className="w-3 h-3 shrink-0" />
            <span>
              {displaySource === 'wikipedia'
                ? `Wikipedia / Wikimedia Commons${displayDate ? ` · ${displayDate}` : ''}`
                : displaySource === 'gemini' || displaySource === 'imagen'
                ? 'AI-generated · Gemini'
                : 'Historical view'}
            </span>
          </div>
          {isSlideshow && (
            <span className="font-medium">{selectedIdx + 1} / {gallery.length}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Location prompt buttons
function LocationPromptCard({
  onDetect,
  onManual,
  isDetecting,
}: {
  onDetect: () => void;
  onManual: () => void;
  isDetecting: boolean;
}) {
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          onClick={onDetect}
          disabled={isDetecting}
          className="h-auto py-3 px-4 flex items-center gap-3 justify-start"
          variant="default"
        >
          {isDetecting ? (
            <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          ) : (
            <Navigation className="w-5 h-5 shrink-0" />
          )}
          <div className="text-left">
            <p className="font-medium text-sm">
              {isDetecting ? 'Detecting...' : 'Use my location'}
            </p>
            <p className="text-xs opacity-80">Auto-detect via GPS</p>
          </div>
        </Button>
        <Button
          onClick={onManual}
          disabled={isDetecting}
          className="h-auto py-3 px-4 flex items-center gap-3 justify-start"
          variant="outline"
        >
          <Keyboard className="w-5 h-5 shrink-0" />
          <div className="text-left">
            <p className="font-medium text-sm">Type a location</p>
            <p className="text-xs opacity-80">Search any place</p>
          </div>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Or just say or type a city name — I'll find it!
      </p>
    </div>
  );
}

function LocationConfirmedCard({ address }: { address: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
      <MapPin className="w-4 h-4 text-green-600 shrink-0" />
      <p className="text-sm text-green-800 dark:text-green-200">
        Locked in: <span className="font-medium">{address}</span>
      </p>
    </div>
  );
}

export function ChatPanel({
  messages,
  isLoading,
  onSuggestedQuestion,
  onRequestLocation,
  onManualLocation,
  locationState,
  onHistoricalStreetView,
  currentLocation,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-card rounded-xl border overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <MapPin className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">GEOL Assistant</h2>
              <p className="text-xs text-muted-foreground">Powered by Gemini AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Historical Street View button */}
            {locationState === 'ready' && currentLocation && (
              <Button
                variant="outline"
                size="sm"
                onClick={onHistoricalStreetView}
                className="text-xs gap-1.5 h-8"
                title="Generate historical street view"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Time Travel</span>
              </Button>
            )}
            <Badge variant="outline" className="text-xs gap-1 hidden sm:flex">
              <Mic className="w-3 h-3" />
              Voice
            </Badge>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          if (message.role === 'system') {
            return (
              <div key={message.id} className="flex justify-center">
                {message.locationConfirmed && (
                  <LocationConfirmedCard address={message.locationConfirmed.address} />
                )}
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}>
                {message.role === 'user' 
                  ? <User className="w-4 h-4" /> 
                  : <Bot className="w-4 h-4" />
                }
              </div>

              <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block text-left rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted/50 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* Location prompt */}
                {message.role === 'assistant' && message.locationPrompt && locationState !== 'ready' && (
                  <LocationPromptCard
                    onDetect={onRequestLocation}
                    onManual={onManualLocation}
                    isDetecting={locationState === 'detecting'}
                  />
                )}

                {/* Info Cards */}
                {message.role === 'assistant' && message.info && (
                  <InfoCards info={message.info} />
                )}

                {/* Historical Image / Street View */}
                {message.role === 'assistant' && (message.generatedImage || message.imageLoading || message.historicalStreetView) && (
                  <HistoricalImage message={message} />
                )}

                {/* Suggested Questions */}
                {message.role === 'assistant' && message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.suggestedQuestions.map((q, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto py-1.5 px-3 rounded-full"
                        onClick={() => onSuggestedQuestion(q)}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                )}

                <p className={`text-xs text-muted-foreground mt-1 ${
                  message.role === 'user' ? 'text-right' : ''
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}

        {/* Loading */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-sm text-muted-foreground ml-1">Exploring your area...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}