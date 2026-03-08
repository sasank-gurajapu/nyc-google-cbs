interface RouteLeg {
  startLocation?: { latLng?: { latitude: number; longitude: number } };
  endLocation?: { latLng?: { latitude: number; longitude: number } };
  distanceMeters?: number;
  duration?: string;
  steps?: RouteStep[];
}

interface RouteStep {
  distanceMeters?: number;
  staticDuration?: string;
  navigationInstruction?: {
    instructions?: string;
    maneuver?: string;
  };
}

interface Route {
  distanceMeters?: number;
  duration?: string;
  polyline?: { encodedPolyline?: string };
  legs?: RouteLeg[];
  routeLabels?: string[];
}

interface RouteDetailsProps {
  routes: Route[];
}

function formatDuration(duration?: string): string {
  if (!duration) return "N/A";
  // duration comes as "1234s"
  const seconds = parseInt(duration.replace("s", ""), 10);
  if (isNaN(seconds)) return duration;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} min`;
}

function formatDistance(meters?: number): string {
  if (!meters) return "N/A";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

export default function RouteDetails({ routes }: RouteDetailsProps) {
  if (!routes || routes.length === 0) return null;

  return (
    <div className="space-y-3">
      {routes.map((route, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
              Route {idx + 1}
              {route.routeLabels?.includes("DEFAULT_ROUTE") && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-normal">
                  (Recommended)
                </span>
              )}
            </h3>
          </div>

          <div className="flex items-center gap-4 mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="flex items-center gap-1">
              🕐 {formatDuration(route.duration)}
            </span>
            <span className="flex items-center gap-1">
              📏 {formatDistance(route.distanceMeters)}
            </span>
          </div>

          {route.legs && route.legs.length > 0 && route.legs[0].steps && (
            <details className="mt-3">
              <summary className="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200">
                Step-by-step directions ({route.legs[0].steps.length} steps)
              </summary>
              <ol className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300 list-decimal list-inside">
                {route.legs[0].steps.map((step, sIdx) => (
                  <li key={sIdx}>
                    {step.navigationInstruction?.instructions || "Continue"}{" "}
                    <span className="text-zinc-400">
                      ({formatDistance(step.distanceMeters)})
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
