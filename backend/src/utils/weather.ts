// backend/src/utils/weather.ts
// Free, no-key real-time weather via Open-Meteo (geocoding + forecast).

export function isWeatherQuery(message: string): boolean {
  return /\bweather\b|\btemperature\b|\bforecast\b|\bhumidity\b|\bhow\s+(hot|cold)\b|\bis\s+it\s+raining\b|\bchance\s+of\s+rain\b/i.test(message);
}

const TRAILING_WORDS =
  /\b(today|tonight|tomorrow|right\s+now|currently|now|outside|please|tell\s+me|give\s+me|show\s+me)\b/gi;

/**
 * Extract "Delhi" from "weather in Delhi", "temperature in New York today", etc.
 * Returns null when no location can be detected (caller should ask user for city).
 */
export function extractLocation(message: string): string | null {
  const patterns = [
    /\bweather\s+(?:in|at|for|of)\s+([a-zA-Z][a-zA-Z\s,\-']*)/i,
    /\btemperature\s+(?:in|at|for|of)\s+([a-zA-Z][a-zA-Z\s,\-']*)/i,
    /\bforecast\s+(?:for|in|at|of)\s+([a-zA-Z][a-zA-Z\s,\-']*)/i,
    /\b(?:in|at|for)\s+([A-Z][a-zA-Z\s\-']+)/,
  ];

  for (const re of patterns) {
    const m = message.match(re);
    if (m?.[1]) {
      let loc = m[1].trim();
      // Cut off at ? . ! and strip trailing filler words ("today", "now", ...)
      loc = loc.split(/[?.!]/)[0].trim();
      loc = loc.replace(TRAILING_WORDS, "").replace(/\s{2,}/g, " ").trim();
      loc = loc.replace(/^(the\s+)/i, "").trim();
      if (loc.length >= 2 && loc.length <= 80) return loc;
    }
  }
  return null;
}

interface GeocodeHit {
  latitude: number;
  longitude: number;
  name: string;
  country?: string;
  admin1?: string;
}

async function geocodeLocation(location: string): Promise<GeocodeHit> {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}` +
    `&count=1&language=en&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { results?: GeocodeHit[] };
  if (!data.results?.length) throw new Error(`Location not found: ${location}`);
  return data.results[0];
}

export function weatherCodeToText(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with hail";
  return "Unknown";
}

/**
 * Fetch live weather. Throws on failure — caller must catch and fall back.
 * Returns a ready-to-inject LLM context block.
 */
export async function getWeatherContext(rawMessage: string): Promise<string | null> {
  const location = extractLocation(rawMessage);
  if (!location) return null;

  const geo = await geocodeLocation(location);

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=1`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  const data = (await res.json()) as any;
  const c = data.current;
  if (!c) throw new Error("Weather API returned no current data");

  const place = [geo.name, geo.admin1, geo.country].filter(Boolean).join(", ");
  const fetchedAt = new Date().toISOString();

  return (
    `LIVE WEATHER DATA (source: Open-Meteo, fetched at ${fetchedAt}). ` +
    `Use ONLY these values for the user's weather question — do not use training-data guesses.\n` +
    `Location: ${place} (${geo.latitude.toFixed(2)}, ${geo.longitude.toFixed(2)})\n` +
    `Condition: ${weatherCodeToText(c.weather_code)} (WMO code ${c.weather_code})\n` +
    `Temperature: ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C)\n` +
    `Today high/low: ${data.daily?.temperature_2m_max?.[0] ?? "?"}°C / ${data.daily?.temperature_2m_min?.[0] ?? "?"}°C\n` +
    `Humidity: ${c.relative_humidity_2m}% | Cloud cover: ${c.cloud_cover}%\n` +
    `Precipitation: ${c.precipitation} mm (max probability today ${data.daily?.precipitation_probability_max?.[0] ?? "?"}%)\n` +
    `Wind: ${c.wind_speed_10m} km/h | Daytime: ${c.is_day ? "yes" : "no"}\n` +
    `Timezone: ${data.timezone ?? "local"} | Observed: ${c.time}`
  );
}
