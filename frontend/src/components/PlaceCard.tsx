interface Place {
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  currentOpeningHours?: { openNow?: boolean };
  editorialSummary?: { text: string };
  location?: { latitude: number; longitude: number };
}

interface PlaceCardProps {
  place: Place;
}

function PriceLevel({ level }: { level?: string }) {
  if (!level) return null;
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return (
    <span className="text-green-600 dark:text-green-400 font-medium">
      {map[level] || level}
    </span>
  );
}

export default function PlaceCard({ place }: PlaceCardProps) {
  const isOpen = place.currentOpeningHours?.openNow;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
          {place.displayName?.text || "Unknown Place"}
        </h3>
        {isOpen !== undefined && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
              isOpen
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            }`}
          >
            {isOpen ? "Open" : "Closed"}
          </span>
        )}
      </div>

      {place.formattedAddress && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {place.formattedAddress}
        </p>
      )}

      <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600 dark:text-zinc-300">
        {place.rating && (
          <span className="flex items-center gap-1">
            <span className="text-yellow-500">★</span>
            {place.rating}
            {place.userRatingCount && (
              <span className="text-zinc-400">({place.userRatingCount})</span>
            )}
          </span>
        )}
        <PriceLevel level={place.priceLevel} />
      </div>

      {place.editorialSummary?.text && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2">
          {place.editorialSummary.text}
        </p>
      )}

      <div className="flex items-center gap-2 mt-3">
        {place.websiteUri && (
          <a
            href={place.websiteUri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Website
          </a>
        )}
        {place.nationalPhoneNumber && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {place.nationalPhoneNumber}
          </span>
        )}
      </div>
    </div>
  );
}
