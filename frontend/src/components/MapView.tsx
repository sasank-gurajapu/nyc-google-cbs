"use client";

import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { useState, useMemo } from "react";

interface MapMarker {
  lat: number;
  lng: number;
  title: string;
  address?: string;
  rating?: number;
}

interface MapViewProps {
  markers?: MapMarker[];
  encodedPolyline?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// NYC default center
const NYC_CENTER = { lat: 40.7128, lng: -74.006 };

export default function MapView({
  markers = [],
  center,
  zoom = 13,
}: MapViewProps) {
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);

  // Calculate map center from markers if not provided
  const mapCenter = useMemo(() => {
    if (center) return center;
    if (markers.length === 0) return NYC_CENTER;
    const avgLat =
      markers.reduce((sum, m) => sum + m.lat, 0) / markers.length;
    const avgLng =
      markers.reduce((sum, m) => sum + m.lng, 0) / markers.length;
    return { lat: avgLat, lng: avgLng };
  }, [center, markers]);

  if (!API_KEY) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-4 text-center text-xs text-zinc-500">
        Map unavailable — Google Maps API key not configured.
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm">
      <APIProvider apiKey={API_KEY}>
        <Map
          style={{ width: "100%", height: "350px" }}
          defaultCenter={mapCenter}
          defaultZoom={zoom}
          mapId="nyc-explorer-map"
          gestureHandling="cooperative"
          disableDefaultUI={false}
          zoomControl={true}
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={true}
        >
          {markers.map((marker, idx) => (
            <AdvancedMarker
              key={idx}
              position={{ lat: marker.lat, lng: marker.lng }}
              title={marker.title}
              onClick={() => setSelectedMarker(idx)}
            >
              <Pin
                background={idx === 0 ? "#3b82f6" : "#ef4444"}
                borderColor={idx === 0 ? "#1d4ed8" : "#b91c1c"}
                glyphColor="white"
                glyph={String(idx + 1)}
              />
            </AdvancedMarker>
          ))}

          {selectedMarker !== null && markers[selectedMarker] && (
            <InfoWindow
              position={{
                lat: markers[selectedMarker].lat,
                lng: markers[selectedMarker].lng,
              }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-1 max-w-[200px]">
                <p className="font-semibold text-sm text-zinc-900">
                  {markers[selectedMarker].title}
                </p>
                {markers[selectedMarker].address && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {markers[selectedMarker].address}
                  </p>
                )}
                {markers[selectedMarker].rating && (
                  <p className="text-xs text-zinc-600 mt-0.5">
                    ★ {markers[selectedMarker].rating}
                  </p>
                )}
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}

// Helper to extract markers from structured data
export function extractMarkers(
  structuredData: Array<{
    tool: string;
    result: Record<string, unknown>;
  }>
): MapMarker[] {
  const markers: MapMarker[] = [];

  for (const item of structuredData) {
    const result = item.result;

    // Places from text_search / nearby_search
    if (
      (item.tool === "text_search" || item.tool === "nearby_search") &&
      result.places
    ) {
      const places = result.places as Array<Record<string, unknown>>;
      for (const place of places) {
        const location = place.location as
          | { latitude: number; longitude: number }
          | undefined;
        const displayName = place.displayName as
          | { text: string }
          | undefined;
        if (location) {
          markers.push({
            lat: location.latitude,
            lng: location.longitude,
            title: displayName?.text || "Unknown",
            address: place.formattedAddress as string | undefined,
            rating: place.rating as number | undefined,
          });
        }
      }
    }

    // Place details
    if (item.tool === "place_details" && result.location) {
      const location = result.location as {
        latitude: number;
        longitude: number;
      };
      const displayName = result.displayName as
        | { text: string }
        | undefined;
      markers.push({
        lat: location.latitude,
        lng: location.longitude,
        title: displayName?.text || "Unknown",
        address: result.formattedAddress as string | undefined,
        rating: result.rating as number | undefined,
      });
    }

    // Geocoding results
    if (item.tool === "geocode" && result.results) {
      const results = result.results as Array<Record<string, unknown>>;
      for (const r of results.slice(0, 1)) {
        const geo = r.geometry as
          | { location: { lat: number; lng: number } }
          | undefined;
        if (geo?.location) {
          markers.push({
            lat: geo.location.lat,
            lng: geo.location.lng,
            title: r.formatted_address as string || "Location",
          });
        }
      }
    }

    // Route endpoints
    if (item.tool === "compute_routes" && result.routes) {
      const routes = result.routes as Array<Record<string, unknown>>;
      if (routes.length > 0 && routes[0].legs) {
        const legs = routes[0].legs as Array<Record<string, unknown>>;
        if (legs.length > 0) {
          const startLoc = (legs[0].startLocation as Record<string, unknown>)
            ?.latLng as { latitude: number; longitude: number } | undefined;
          const endLoc = (legs[0].endLocation as Record<string, unknown>)
            ?.latLng as { latitude: number; longitude: number } | undefined;
          if (startLoc) {
            markers.push({
              lat: startLoc.latitude,
              lng: startLoc.longitude,
              title: "Start",
            });
          }
          if (endLoc) {
            markers.push({
              lat: endLoc.latitude,
              lng: endLoc.longitude,
              title: "Destination",
            });
          }
        }
      }
    }
  }

  return markers;
}
