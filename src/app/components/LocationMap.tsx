import { useEffect, useState, useRef, useCallback } from 'react';
import { Map, AdvancedMarker, useMap, InfoWindow, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Search, Loader2, X, Star, Navigation } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3c4885b3`;

export interface PlaceOfInterest {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  primaryType: string;
  rating: number | null;
  photoUrl: string;
  photoName: string;
  summary: string;
}

interface LocationMapProps {
  onLocationChange: (lat: number, lng: number, address: string) => void;
  onPlaceClick: (place: PlaceOfInterest) => void;
  places: PlaceOfInterest[];
  onPlacesLoaded: (places: PlaceOfInterest[]) => void;
  externalPosition?: { lat: number; lng: number } | null;
}

// Pans the map smoothly when position changes
function MapPanner({ position }: { position: { lat: number; lng: number } }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !position) return;
    map.panTo(position);
  }, [map, position?.lat, position?.lng]);

  return null;
}

// 5-mile radius circle overlay
function RadiusCircle({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !center) return;

    const circle = new google.maps.Circle({
      map,
      center,
      radius: 2 * 1609.34,
      fillColor: '#3b82f6',
      fillOpacity: 0.06,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.3,
      strokeWeight: 2,
    });

    return () => {
      circle.setMap(null);
    };
  }, [map, center?.lat, center?.lng]);

  return null;
}

function PlaceMarker({
  place,
  isSelected,
  onClick,
}: {
  place: PlaceOfInterest;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <AdvancedMarker
      position={{ lat: place.lat, lng: place.lng }}
      onClick={onClick}
      zIndex={isSelected ? 100 : 10}
    >
      <div
        className={`flex flex-col items-center cursor-pointer transition-transform duration-200 ${
          isSelected ? 'scale-125' : 'hover:scale-110'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-full overflow-hidden border-2 shadow-lg ${
            isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-white'
          }`}
        >
          {place.photoUrl ? (
            <img
              src={place.photoUrl}
              alt={place.name}
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-blue-100 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
          )}
        </div>
        <div
          className={`w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent -mt-[1px] ${
            isSelected ? 'border-t-blue-500' : 'border-t-white'
          }`}
        />
      </div>
    </AdvancedMarker>
  );
}

export function LocationMap({
  onLocationChange,
  onPlaceClick,
  places,
  onPlacesLoaded,
  externalPosition,
}: LocationMapProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [infoPlace, setInfoPlace] = useState<PlaceOfInterest | null>(null);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const lastFetchedPos = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const placesLib = useMapsLibrary('places');
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);

  // Init AutocompleteService once Places library is loaded (use ref to avoid re-render)
  useEffect(() => {
    if (!placesLib) return;
    autocompleteServiceRef.current = new placesLib.AutocompleteService();
  }, [placesLib]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || !autocompleteServiceRef.current) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await autocompleteServiceRef.current!.getPlacePredictions({
          input: value,
          types: ['geocode', 'establishment'],
        });
        setSuggestions(result.predictions || []);
        setShowSuggestions((result.predictions || []).length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 280);
  }, []);

  const handleSuggestionClick = useCallback((suggestion: google.maps.places.AutocompletePrediction) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSearchQuery('');
    setError('');
    setIsSearching(true);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ placeId: suggestion.place_id }, (results, status) => {
      setIsSearching(false);
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location;
        const newPos = { lat: loc.lat(), lng: loc.lng() };
        setPosition(newPos);
        onLocationChange(newPos.lat, newPos.lng, results[0].formatted_address);
      } else {
        setError('Could not find location.');
      }
    });
  }, [onLocationChange]);

  // Sync with external position from App (e.g. user typed "Paris" in chat)
  useEffect(() => {
    if (externalPosition) {
      setPosition(externalPosition);
      setInfoPlace(null);
      setSelectedPlaceId(null);
    }
  }, [externalPosition?.lat, externalPosition?.lng]);

  // Initialize map position from geolocation on mount
  useEffect(() => {
    if (externalPosition) return; // Parent already provided position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(p);
        },
        () => {
          // Default to SF if we can't get location
          setPosition({ lat: 37.7749, lng: -122.4194 });
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    } else {
      setPosition({ lat: 37.7749, lng: -122.4194 });
    }
  }, []);

  // Fetch nearby places when position changes
  useEffect(() => {
    if (!position) return;
    const key = `${position.lat.toFixed(4)},${position.lng.toFixed(4)}`;
    if (key === lastFetchedPos.current) return;
    lastFetchedPos.current = key;
    fetchNearbyPlaces(position.lat, position.lng);
  }, [position?.lat, position?.lng]);

  const fetchNearbyPlaces = async (lat: number, lng: number) => {
    setIsLoadingPlaces(true);
    try {
      const resp = await fetch(`${API_BASE}/nearby-places`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ lat, lng, radiusMiles: 2 }),
      });

      if (resp.ok) {
        const data = await resp.json();
        onPlacesLoaded(data.places || []);
      } else {
        console.error('Failed to fetch nearby places:', await resp.text());
      }
    } catch (err) {
      console.error('Error fetching nearby places:', err);
    } finally {
      setIsLoadingPlaces(false);
    }
  };

  // Search handler
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError('');

    try {
      const resp = await fetch(`${API_BASE}/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ address: searchQuery }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const newPos = { lat: data.lat, lng: data.lng };
        setPosition(newPos);
        setSearchQuery('');
        onLocationChange(data.lat, data.lng, data.address);
      } else {
        setError('Location not found.');
      }
    } catch {
      setError('Search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlaceMarkerClick = (place: PlaceOfInterest) => {
    setSelectedPlaceId(place.id);
    setInfoPlace(place);
    onPlaceClick(place);
  };

  const handleRecenter = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(newPos);
        // Reverse geocode via server (uses Gemini AI)
        try {
          const resp = await fetch(`${API_BASE}/geocode`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({ address: `${newPos.lat},${newPos.lng}` }),
          });
          if (resp.ok) {
            const data = await resp.json();
            onLocationChange(data.lat, data.lng, data.address);
          }
        } catch {}
      },
      () => setError('Could not re-center.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!position) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Search bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-auto">
        <div className="flex gap-2">
          <div className="flex-1 relative" ref={searchWrapperRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder="Search a location..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { setShowSuggestions(false); handleSearch(); }
                if (e.key === 'Escape') setShowSuggestions(false);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="pl-9 pr-8 shadow-lg border-0 h-10 text-sm"
              style={{ background: 'white', color: '#111827' }}
              onClick={(e) => e.stopPropagation()}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSuggestions([]); setShowSuggestions(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={s.place_id}
                    onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s); }}
                    className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-muted/60 transition-colors ${i > 0 ? 'border-t border-border/40' : ''}`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground block truncate">
                        {s.structured_formatting.main_text}
                      </span>
                      <span className="text-xs text-muted-foreground block truncate">
                        {s.structured_formatting.secondary_text}
                      </span>
                    </div>
                  </button>
                ))}
                <div className="px-3 py-1.5 bg-muted/30 border-t flex items-center justify-end gap-1">
                  <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" className="h-3.5 opacity-70" />
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => { setShowSuggestions(false); handleSearch(); }}
            disabled={isSearching || !searchQuery.trim()}
            className="h-10 w-10 rounded-md shadow-lg shrink-0 flex items-center justify-center hover:bg-gray-50 disabled:cursor-not-allowed"
            style={{ background: 'white' }}
          >
            {isSearching
              ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#111827' }} />
              : <Search className="w-4 h-4" style={{ color: searchQuery.trim() ? '#111827' : '#9ca3af' }} />}
          </button>
          <button
            onClick={handleRecenter}
            className="h-10 w-10 rounded-md shadow-lg shrink-0 flex items-center justify-center bg-white text-gray-700 hover:bg-gray-50"
            title="Re-center on your location"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status badges */}
      {isLoadingPlaces && (
        <div className="absolute bottom-3 left-3 z-[1000]">
          <Badge variant="secondary" className="bg-white shadow-md gap-1.5 py-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Finding places...
          </Badge>
        </div>
      )}
      {!isLoadingPlaces && places.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[1000]">
          <Badge variant="secondary" className="bg-white shadow-md py-1">
            <MapPin className="w-3 h-3 mr-1" />
            {places.length} places within 2 mi
          </Badge>
        </div>
      )}

      {error && (
        <div className="absolute top-16 left-3 right-3 z-[1000]">
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-3 py-2 rounded-lg text-xs shadow-lg">
            {error}
          </div>
        </div>
      )}

      <Map
        defaultCenter={position}
        defaultZoom={12}
        mapId="geol-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="w-full h-full"
        mapTypeControl={false}
        streetViewControl={true}
      >
        <MapPanner position={position} />
        <RadiusCircle center={position} />

        {/* User location marker */}
        <AdvancedMarker position={position} zIndex={200}>
          <div className="relative">
            <div className="w-5 h-5 rounded-full bg-blue-500 border-[3px] border-white shadow-lg" />
            <div className="absolute -inset-2 rounded-full bg-blue-500 opacity-20 animate-ping" />
          </div>
        </AdvancedMarker>

        {/* POI markers */}
        {places.map((place) => (
          <PlaceMarker
            key={place.id}
            place={place}
            isSelected={selectedPlaceId === place.id}
            onClick={() => handlePlaceMarkerClick(place)}
          />
        ))}

        {infoPlace && (
          <InfoWindow
            position={{ lat: infoPlace.lat, lng: infoPlace.lng }}
            onCloseClick={() => {
              setInfoPlace(null);
              setSelectedPlaceId(null);
            }}
            pixelOffset={[0, -50]}
          >
            <div className="max-w-[220px] p-1">
              {infoPlace.photoUrl && (
                <img
                  src={infoPlace.photoUrl}
                  alt={infoPlace.name}
                  className="w-full h-28 object-cover rounded-md mb-2"
                  referrerPolicy="no-referrer"
                />
              )}
              <h3 className="font-semibold text-sm text-gray-900 mb-1">{infoPlace.name}</h3>
              {infoPlace.rating && (
                <div className="flex items-center gap-1 mb-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs text-gray-600">{infoPlace.rating}</span>
                </div>
              )}
              {infoPlace.summary && (
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">{infoPlace.summary}</p>
              )}
              <p className="text-xs text-blue-600 font-medium">Click for details in chat →</p>
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}