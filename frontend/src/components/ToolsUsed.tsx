interface ToolUsedProps {
  tools: { name: string; args: Record<string, unknown> }[];
}

const TOOL_LABELS: Record<string, { icon: string; label: string }> = {
  text_search: { icon: "🔍", label: "Places Search" },
  nearby_search: { icon: "📍", label: "Nearby Search" },
  place_details: { icon: "📋", label: "Place Details" },
  geocode: { icon: "🌐", label: "Geocoding" },
  reverse_geocode: { icon: "🌐", label: "Reverse Geocoding" },
  compute_routes: { icon: "🗺️", label: "Directions" },
  aggregate_places: { icon: "📊", label: "Place Stats" },
};

export default function ToolsUsed({ tools }: ToolUsedProps) {
  if (!tools || tools.length === 0) return null;

  return (
    <details className="mb-3 ml-0">
      <summary className="text-xs text-zinc-400 dark:text-zinc-500 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 select-none flex items-center gap-1">
        <span>⚙️ Used {tools.length} tool{tools.length > 1 ? "s" : ""}</span>
      </summary>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {tools.map((tool, idx) => {
          const info = TOOL_LABELS[tool.name] || {
            icon: "🔧",
            label: tool.name,
          };
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
              title={JSON.stringify(tool.args, null, 2)}
            >
              {info.icon} {info.label}
            </span>
          );
        })}
      </div>
    </details>
  );
}
