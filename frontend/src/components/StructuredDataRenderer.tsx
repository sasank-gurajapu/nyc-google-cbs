import { StructuredDataItem } from "@/lib/api";
import PlaceCard from "./PlaceCard";
import RouteDetails from "./RouteDetails";
import MapView, { extractMarkers } from "./MapView";

interface StructuredDataRendererProps {
  data: StructuredDataItem[];
}

export default function StructuredDataRenderer({
  data,
}: StructuredDataRendererProps) {
  if (!data || data.length === 0) return null;

  // Extract all markers from all structured data items for the map
  const allMarkers = extractMarkers(data);

  return (
    <div className="mt-3 space-y-4">
      {/* Map — shown if there are any markers */}
      {allMarkers.length > 0 && (
        <MapView markers={allMarkers} />
      )}

      {data.map((item, idx) => {
        const result = item.result as Record<string, unknown>;

        // Render places (text_search, nearby_search)
        if (
          (item.tool === "text_search" || item.tool === "nearby_search") &&
          result.places
        ) {
          const places = result.places as Array<Record<string, unknown>>;
          return (
            <div key={idx}>
              <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wide">
                📍 Places Found ({places.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {places.map((place, pIdx) => (
                  <PlaceCard key={pIdx} place={place as never} />
                ))}
              </div>
            </div>
          );
        }

        // Render routes
        if (item.tool === "compute_routes" && result.routes) {
          const routes = result.routes as Array<Record<string, unknown>>;
          return (
            <div key={idx}>
              <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wide">
                🗺️ Routes
              </p>
              <RouteDetails routes={routes as never} />
            </div>
          );
        }

        // Render place_details
        if (item.tool === "place_details" && result.displayName) {
          return (
            <div key={idx}>
              <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wide">
                📋 Place Details
              </p>
              <PlaceCard place={result as never} />
            </div>
          );
        }

        // Render aggregate
        if (item.tool === "aggregate_places") {
          return (
            <div key={idx}>
              <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wide">
                📊 Aggregate Data
              </p>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
                <pre className="text-xs text-zinc-600 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
