import { readFile, writeFile } from 'fs/promises';
import type { GeocodeError } from './config/schema.js';
import { CITY } from './config/city.js';

export type OsmType = 'node' | 'way' | 'relation';

export interface GeoCoords {
  lat: number;
  lng: number;
  osmId?: number;
  osmType?: OsmType;
}

export interface GeoCacheEntry {
  lat?: number;
  lng?: number;
  osmId?: number;
  osmType?: OsmType;
  unresolvable?: boolean;
  geocodedAt: string;
  source: 'nominatim' | 'manual';
  firstSeen?: string;
}

export interface GeoCache {
  version: number;
  entries: Record<string, GeoCacheEntry>;
}

/**
 * Check if a location string represents a vague/unresolvable location
 * like "Offsite" or "TBA" that should not be sent to Nominatim.
 */
export function isVagueLocation(location: string): boolean {
  const lower = location.toLowerCase().trim();
  // Match vague location patterns that won't geocode meaningfully
  const vaguePatterns = [
    /^offsite\b/i,             // "Offsite, Katy, TX" etc
    /^tba\b/i,                 // "TBA", "TBA - location TBD"
    /^tbd\b/i,                 // "TBD"
    /^various locations?\b/i,   // "Various locations"
    /^multiple locations?\b/i, // "Multiple locations"
    /^to be announced\b/i,      // "To be announced"
    /^to be determined\b/i,    // "To be determined"
    /^coming soon\b/i,         // "Coming soon"
    /^check back\b/i,          // "Check back for location"
    /^zoom\b/i,                // Zoom meetings
    /^virtual\b/i,             // Virtual events
    /^online\b/i,              // Online events
    /^webinar\b/i,             // Webinars
  ];
  return vaguePatterns.some(pattern => pattern.test(lower));
}

/**
 * Normalize a raw location string from an ICS feed or scraper:
 * 1. Unescape ICS-escaped commas (\\, → ,)
 * 2. Strip HTML tags
 * 3. Split on <br>, newlines, or semicolons and take only the first segment
 *    OR intelligently extract address from HTML-bridge format (venue<br>address)
 * 4. Collapse internal whitespace and trim
 */
export function normalizeLocation(location: string): string {
  // Step 1: Unescape ICS-escaped commas (\\, → ,)
  let normalized = location.replace(/\\,/g, ',');

  // Step 2: Check for HTML <br> format with venue on first line and address on second
  // e.g. "A Resting Place<br>1001 Bissonnet St<br>Houston, TX 77005"
  // We want to extract the address line (starts with a digit)
  const brSegments = normalized.split(/<br\s*\/?>/i);
  if (brSegments.length >= 2) {
    // Look for a segment that starts with a digit (likely an address)
    const addressSegment = brSegments.find(seg => /^\s*\d/.test(seg));
    if (addressSegment) {
      // Use the address segment (strip any trailing <br> content)
      normalized = addressSegment.split(/<br\s*\/?>/i)[0];
    } else {
      // No address found, fall back to first segment
      normalized = brSegments[0];
    }
  }

  // Step 3: Strip all remaining HTML tags (closed tags like <a href="...">)
  const stripped = normalized.replace(/<[^>]*>/g, '');

  // Step 3b: Strip unclosed/malformed HTML tags (e.g. truncated "<a href=..." without closing >)
  const noUnclosedTags = stripped.replace(/<[^>]*$/, '').trim();

  // Step 4: Split on newlines and semicolons, take the first non-empty part
  const lines = noUnclosedTags.split(/[\n\r;]+/);
  const firstLine = lines.find(l => l.trim().length > 0) ?? noUnclosedTags;

  // Step 5: Collapse internal whitespace and trim
  const result = firstLine.replace(/\s+/g, ' ').trim();

  // Step 6: If the result is just a label like "Meeting:" with no address, treat as empty
  if (/^meeting:\s*$/i.test(result)) {
    return '';
  }

  return result;
}

export function normalizeLocationKey(location: string): string {
  return normalizeLocation(location).toLowerCase();
}

/**
 * If the location looks like "Venue Name: 1234 Street..." or "Venue Name, 1234 Street..."
 * (i.e. a venue prefix followed by a street address starting with a digit),
 * return the address-only portion.  Returns null if no venue prefix is detected.
 *
 * Only `:` or `,` are treated as venue-prefix separators; plain spaces are not,
 * to avoid false positives on bare addresses like "1515 Main St, Houston TX".
 */
export function extractAddressFromVenuePrefix(location: string): string | null {
  // Match "Some Venue Name: 1234 Street..." or "Some Venue Name, 1234 Street..."
  // The venue part must contain at least one non-digit character (so pure addresses
  // like "1515 12th Ave" don't accidentally match).
  const match = location.match(/^([^:,]*[A-Za-z][^:,]*)[:,]\s*(\d.+)$/);
  if (match) {
    return match[2].trim();
  }
  return null;
}

/**
 * If the location string is a Google Maps search URL of the form:
 *   https://www.google.com/maps/search/?api=1&query=<url-encoded-address>
 * extract and return the decoded query parameter as the location string.
 * Also handles Google Maps short URLs (maps.app.goo.gl) by attempting to resolve them.
 * Returns null if not a Google Maps search URL.
 */
export async function extractFromGoogleMapsUrl(location: string): Promise<string | null> {
  const trimmed = location.trim();
  
  // Handle Google Maps short URLs (maps.app.goo.gl)
  // These URLs redirect to the actual Google Maps URL
  const shortUrlMatch = trimmed.match(/^https?:\/\/maps\.app\.goo\.gl\/\S+/i);
  if (shortUrlMatch) {
    // Short URLs can't be resolved synchronously - return null
    // The geocoder will mark these as unresolvable
    return null;
  }
  
  // Match Google Maps search URLs
  const match = trimmed.match(/^https?:\/\/(?:www\.)?google\.com\/maps\/search\/\?/i);
  if (!match) return null;

  try {
    const url = new URL(trimmed);
    const query = url.searchParams.get('query');
    if (query != null && query.trim().length > 0) {
      return query.trim();
    }
    return null;
  } catch {
    // If URL parsing fails, try regex fallback
    const queryMatch = trimmed.match(/[?&]query=([^&]+)/i);
    if (queryMatch != null && queryMatch[1] != null) {
      try {
        const decoded = decodeURIComponent(queryMatch[1].replace(/\+/g, ' ')).trim();
        return decoded.length > 0 ? decoded : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Strip suite/floor/room/level suffixes from a location string that may cause
 * Nominatim lookup failures. Also collapses double commas and strips trailing
 * ", United States" or ", USA".
 *
 * Returns the stripped string, or null if no stripping was done (i.e. the
 * string is the same as the input after stripping).
 */
export function stripSuiteFloorSuffixes(location: string): string | null {
  let result = location;

  // Strip sub-room qualifiers FIRST (before individual suite/floor/room/level strippers)
  // to avoid compound patterns being partially matched by the generic strippers.
  // Match both ", " and " - " separators, and handle optional room numbers /
  // multilingual suffixes after " / ".
  // e.g. "Capitol Hill Branch, Meeting Room" → "Capitol Hill Branch"
  // e.g. "Library, Meeting Room 1 / 会议室" → "Library"
  // e.g. "Community Center - Meeting Room / Sala de reuniones" → "Community Center"
  // "Level N - Room N" patterns (e.g. ", Level 2 - Room 201")
  result = result.replace(/[,\s]*,\s*level\s+[\w-]+\s*[-–]\s*room\s+[\w-]+(\s*\/.*)?$/i, '');
  result = result.replace(/[,\s]*[-–]\s*meeting room(\s+[\w-]+)?(\s*\/.*)?$/i, '');
  result = result.replace(/[,\s]*,\s*meeting room(\s+[\w-]+)?(\s*\/.*)?$/i, '');
  result = result.replace(/[,\s]*,\s*children'?s?\s+area(\s*\/.*)?$/i, '');
  result = result.replace(/[,\s]*,\s*lobby(\s*\/.*)?$/i, '');
  // Strip any trailing " / <multilingual text>" that looks like a translation duplicate
  // but only when it appears after a sub-room keyword has already been stripped above,
  // or standalone at the very end of a string after a known room-like prefix.
  // (Standalone " / X" is NOT stripped to avoid false positives on "Venue A / Venue B")

  // Strip #NNN (including alphanumeric and hyphenated suite numbers like #100A, #3-B)
  // Suite NNN, Ste NNN, Floor N, Flr N, Room NNN, Level N
  // These may appear anywhere in the string (with a preceding comma/space separator)
  // Use [\w-]+ to match suite numbers with hyphens (e.g. Suite 200-A)
  result = result.replace(/[,\s]*#\s*[\w-]+/g, '');
  result = result.replace(/[,\s]*\bSuite\s+[\w-]+/gi, '');
  result = result.replace(/[,\s]*\bSte\.?\s+[\w-]+/gi, '');
  result = result.replace(/[,\s]*\bFloor\s+[\w-]+/gi, '');
  result = result.replace(/[,\s]*\bFlr\.?\s+[\w-]+/gi, '');
  result = result.replace(/[,\s]*\bRoom\s+[\w-]+/gi, '');
  result = result.replace(/[,\s]*\bLevel\s+[\w-]+/gi, '');

  // Collapse double commas
  result = result.replace(/,\s*,+/g, ',');

  // Strip trailing ", United States" or ", USA"
  result = result.replace(/,\s*United States\s*$/i, '');
  result = result.replace(/,\s*USA\s*$/i, '');

  // Trim
  result = result.trim().replace(/,\s*$/, '').trim();

  if (result === location || result === '') return null;
  return result;
}

// ---------------------------------------------------------------------------
// Local reference content. The lookup tables below (neighborhood centroids,
// library branches, university buildings, KNOWN_VENUE_COORDS) are city CONTENT,
// not engine logic: their keys never match locations from another city, so they
// are harmless for template copies and are stripped/regrown by the Phase 2
// init-city script. See docs/city-template.md.
// ---------------------------------------------------------------------------

/**
 * Neighborhood centroid table. Used as a fallback when Nominatim
 * fails for neighborhood-level location strings.
 */
const NEIGHBORHOOD_CENTROIDS: Record<string, GeoCoords> = {
};

/**
 * Look up neighborhood centroid coords from a normalized location string.
 * Matches "<neighborhood> neighborhood, houston" or "<neighborhood>, houston"
 * (case-insensitive). Returns null if no match.
 */
export function lookupNeighborhoodCentroid(location: string): GeoCoords | null {
  const lower = location.toLowerCase().trim();

  for (const [neighborhood, coords] of Object.entries(NEIGHBORHOOD_CENTROIDS)) {
    // Match "<neighborhood> neighborhood, houston" or "<neighborhood>, houston"
    // or just "<neighborhood>" alone
    if (
      lower === neighborhood ||
      lower === `${neighborhood} neighborhood, houston` ||
      lower === `${neighborhood}, houston` ||
      lower === `${neighborhood} neighborhood, houston, tx` ||
      lower === `${neighborhood}, houston, tx`
    ) {
      return coords;
    }
  }

  return null;
}

/**
 * Public library branch coordinates.
 */
const LIBRARY_BRANCH_COORDS: Record<string, GeoCoords> = {
};

/**
 * Look up public library branch coordinates from a normalized location string.
 * Only applies to strings that explicitly mention "houston public library" or "hpl".
 * Searches for a branch name substring within the location string (case-insensitive).
 * Returns null if no match.
 */
export function lookupLibraryBranchCoords(location: string): GeoCoords | null {
  const lower = location.toLowerCase();

  // Only apply to strings that explicitly reference Houston Public Library or HPL,
  // or that directly name a known branch/central library location.
  // Avoids false positives (e.g. "Heights Brewing" → "heights branch") by requiring
  // either an explicit HPL reference or a match against a known branch name.
  const isLibraryString =
    lower.includes('houston public library') ||
    lower.includes('central library') ||
    // Match "hpl" as a whole word or common HPL prefix patterns (avoid partial matches)
    /\bhpl\b/.test(lower) ||
    // Match "<branch name> branch" patterns from the LIBRARY_BRANCH_COORDS table
    Object.keys(LIBRARY_BRANCH_COORDS).some(branch => branch.endsWith(' branch') && lower.includes(branch));

  if (!isLibraryString) return null;

  for (const [branch, coords] of Object.entries(LIBRARY_BRANCH_COORDS)) {
    if (lower.includes(branch)) {
      return coords;
    }
  }

  return null;
}

/**
 * University building code → coordinates table.
 * Keys are uppercase building codes (e.g. "AH", "SEC").
 */
const UNIVERSITY_BUILDING_COORDS: Record<string, GeoCoords> = {
};

/**
 * University named-location fallback (no building code in string).
 * Keys are lowercased location strings.
 */
const UNIVERSITY_NAMED_LOCATIONS: Record<string, GeoCoords> = {
};

/**
 * Look up university building coordinates from a location string.
 *
 * Matches:
 * 1. Named university locations like "cullen performance hall" or "uh botanic gardens"
 * 2. Building code in parens: "(SEC)" at end of string or after a comma/space
 *
 * Returns null if no match.
 */
export function lookupUniversityBuilding(location: string): GeoCoords | null {
  const lower = location.toLowerCase().trim();

  // Check named locations first
  for (const [name, coords] of Object.entries(UNIVERSITY_NAMED_LOCATIONS)) {
    if (lower === name) {
      return coords;
    }
  }

  // Look for "(CODE)" pattern — code is 2-5 uppercase letters/digits
  const match = lower.match(/\(([a-z0-9]{2,5})\)\s*$/i) ??
    lower.match(/,\s*\(([a-z0-9]{2,5})\)/i);
  if (match) {
    const code = match[1].toUpperCase();
    if (code in UNIVERSITY_BUILDING_COORDS) {
      return UNIVERSITY_BUILDING_COORDS[code];
    }
  }

  return null;
}

/**
 * Well-known local venue coordinates table.
 * Keys are lowercased venue names.
 */
const KNOWN_VENUE_COORDS: Record<string, GeoCoords> = {
};

/**
 * Look up a well-known local venue by normalized (lowercased, trimmed) location string.
 * If the location *starts with* a known venue name, return that venue's coords
 * even if there's trailing room/floor info after the venue name.
 *
 * Returns null if no match.
 */
export function lookupKnownVenue(location: string): GeoCoords | null {
  const lower = location.toLowerCase().trim();

  // Exact match first
  if (lower in KNOWN_VENUE_COORDS) {
    return KNOWN_VENUE_COORDS[lower];
  }

  // Prefix match: location starts with a known venue name followed by a separator
  for (const [name, coords] of Object.entries(KNOWN_VENUE_COORDS)) {
    if (lower.startsWith(name) && lower.length > name.length) {
      const nextChar = lower[name.length];
      // Only match if followed by a separator (, - : space)
      if (nextChar === ',' || nextChar === ' ' || nextChar === '-' || nextChar === ':') {
        return coords;
      }
    }
  }

  return null;
}

/**
 * Known venue-area suffix patterns that map to a centroid.
 * Used as a last-resort fallback when Nominatim fails and the location string
 * contains a recognizable area suffix like ", theater district" or ", midtown".
 *
 * Keys are lowercase area suffixes; values are centroids. City CONTENT — empty
 * on a fresh template copy and regrown for the local metro.
 */
const VENUE_AREA_SUFFIX_COORDS: Record<string, GeoCoords> = {
};

/**
 * Check if the location ends with a known venue-area suffix (e.g. ", theater district"
 * or ", midtown, houston, tx"). Returns the centroid if matched, null otherwise.
 *
 * Matches case-insensitively. The area suffix must appear after a comma or space.
 */
export function lookupVenueAreaFallback(location: string): GeoCoords | null {
  const lower = location.toLowerCase().trim();

  for (const [suffix, coords] of Object.entries(VENUE_AREA_SUFFIX_COORDS)) {
    // Match exactly equal, or ending with ", <suffix>"
    if (
      lower === suffix ||
      lower.endsWith(`, ${suffix}`) ||
      lower.endsWith(` ${suffix}`)
    ) {
      return coords;
    }
  }

  return null;
}

export async function loadGeoCache(filePath: string): Promise<GeoCache> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    // Validate the basic shape before trusting it; fall back to empty cache on corruption.
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.version === 'number' &&
      typeof parsed.entries === 'object' &&
      parsed.entries !== null
    ) {
      return parsed as GeoCache;
    }
    console.warn(`geo-cache.json has unexpected shape, starting with empty cache`);
    return { version: 1, entries: {} };
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return { version: 1, entries: {} };
    }
    if (err instanceof SyntaxError) {
      // Corrupted JSON (e.g. incomplete write on previous crash) — start fresh
      console.warn(`geo-cache.json is not valid JSON, starting with empty cache: ${err.message}`);
      return { version: 1, entries: {} };
    }
    throw err;
  }
}

export async function saveGeoCache(cache: GeoCache, filePath: string): Promise<void> {
  await writeFile(filePath, JSON.stringify(cache, null, 2), 'utf-8');
}

export function lookupGeoCache(cache: Readonly<GeoCache>, location: string): GeoCoords | null {
  const key = normalizeLocationKey(location);
  const entry = cache.entries[key];
  if (!entry) return null;
  if (entry.unresolvable) return null;
  if (entry.lat !== undefined && entry.lng !== undefined) {
    return {
      lat: entry.lat,
      lng: entry.lng,
      ...(entry.osmId !== undefined && entry.osmType !== undefined
        ? { osmId: entry.osmId, osmType: entry.osmType }
        : {}),
    };
  }
  return null;
}

// Rate limit state for Nominatim API (1 req/sec required by usage policy).
//
// Safety note: geocodeLocation is called only from resolveEventCoords, which is
// called sequentially in calendar_ripper.ts — each call is `await`ed before the
// next begins (no Promise.all or concurrent fan-out). This makes lastNominatimCallTime
// effectively single-threaded: only one call can be in-flight at a time, so reads
// and writes to this variable are race-free. If the calling code is ever parallelized,
// this variable must be replaced with a proper serialization queue.
let lastNominatimCallTime = 0

export async function geocodeLocation(location: string): Promise<GeoCoords | null> {
  // Rate limit: enforce 1 req/sec before making the Nominatim call.
  // Capture a single timestamp snapshot, compute the required delay, then
  // record (now + delay) as the next allowed call time before awaiting — this
  // means lastNominatimCallTime always reflects the scheduled fire time, not
  // the time we started waiting, and never requires a second Date.now() call.
  const now = Date.now()
  const elapsed = now - lastNominatimCallTime
  const delay = lastNominatimCallTime > 0 ? Math.max(0, 1000 - elapsed) : 0
  lastNominatimCallTime = now + delay
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  const encoded = encodeURIComponent(location);
  const vb = CITY.geocoder.nominatimViewbox;
  const viewbox = `${vb.west},${vb.south},${vb.east},${vb.north}`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=us&viewbox=${viewbox}&bounded=1`;

  // Build a 10-second abort signal. Guard the AbortSignal.timeout() call in case
  // the runtime environment doesn't support it (graceful degradation).
  const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(10_000)
    : undefined

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': CITY.geocoder.nominatimUserAgent,
      },
      ...(signal ? { signal } : {}),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json() as Array<{
      lat: string;
      lon: string;
      osm_id?: number;
      osm_type?: string;
    }>;
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const first = data[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (isNaN(lat) || isNaN(lng)) return null;

    const osmType = normalizeOsmType(first.osm_type);
    const osmId = typeof first.osm_id === 'number' && Number.isInteger(first.osm_id) && first.osm_id > 0
      ? first.osm_id
      : undefined;

    return {
      lat,
      lng,
      ...(osmType && osmId !== undefined ? { osmId, osmType } : {}),
    };
  } catch {
    return null;
  }
}

function normalizeOsmType(value: unknown): OsmType | undefined {
  if (value === 'node' || value === 'way' || value === 'relation') return value;
  return undefined;
}

export interface ResolveEventCoordsResult {
  coords: GeoCoords | null;
  geocodeSource: 'ripper' | 'cached' | 'none';
  error?: GeocodeError;
  /** Updated cache — new object if a new entry was added, same reference if unchanged. */
  cache: GeoCache;
}

/**
 * Pure-function geocode resolver. Takes an immutable cache snapshot and returns
 * a new cache object (with the new entry merged in) alongside the result.
 * No shared mutable state is modified — the caller is responsible for storing
 * the returned cache and persisting it to disk.
 *
 * Resolution order:
 * 0. Check for vague locations (TBA, Offsite, etc.) - mark as unresolvable
 * 1. Google Maps URL extraction (before normalization)
 * 2. normalizeLocation()
 * 3. Cache lookup
 * 4. Nominatim geocoding (with venue-prefix fallback)
 * 5. Neighborhood centroid lookup (if Nominatim fails)
 * 6. Library branch lookup (if Nominatim fails and location mentions a branch)
 * 7. Known venue-area centroid fallback (theater district, midtown, etc.)
 * 8. Suite/floor stripping retry (if first Nominatim attempt fails)
 * 9. University building lookup (building code in parens, or named campus location)
 * 10. Known venue lookup (well-known local venues that Nominatim misses)
 */
export async function resolveEventCoords(
  cache: Readonly<GeoCache>,
  location: string | undefined,
  sourceName: string,
): Promise<ResolveEventCoordsResult> {
  if (!location || location.trim() === '') {
    return { coords: null, geocodeSource: 'none', cache };
  }

  // Step 0: Check for vague/unresolvable locations (Offsite, TBA, etc.)
  if (isVagueLocation(location)) {
    const key = normalizeLocationKey(location);
    const newEntry: GeoCacheEntry = {
      unresolvable: true,
      geocodedAt: new Date().toISOString().slice(0, 10),
      source: 'nominatim',
      firstSeen: new Date().toISOString().slice(0, 10),
    };
    const updatedCache: GeoCache = {
      ...cache,
      entries: { ...cache.entries, [key]: newEntry },
    };
    const error: GeocodeError = {
      type: 'GeocodeError',
      location,
      source: sourceName,
      reason: 'Vague/unresolvable location',
    };
    return { coords: null, geocodeSource: 'none', error, cache: updatedCache };
  }

  // Step 1: Google Maps URL extraction — do this BEFORE normalization
  const googleMapsExtracted = await extractFromGoogleMapsUrl(location);
  const rawLocation = googleMapsExtracted ?? location;

  // Step 2: Normalize the raw location string before any cache lookup or geocoding.
  // This ensures HTML tags, ICS-escaped commas, and extra whitespace don't
  // cause spurious cache misses or Nominatim failures.
  const normalized = normalizeLocation(rawLocation);

  if (normalized === '') {
    return { coords: null, geocodeSource: 'none', cache };
  }

  const cached = lookupGeoCache(cache, normalized);
  if (cached !== null) {
    return { coords: cached, geocodeSource: 'cached', cache };
  }

  const key = normalizeLocationKey(normalized);

  // Check KNOWN_VENUE_COORDS before the unresolvable cache short-circuit so that
  // adding a hardcoded entry overrides a stale unresolvable marker in the geo-cache.
  const knownVenueCoords = lookupKnownVenue(normalized);
  if (knownVenueCoords !== null) {
    const knownEntry: GeoCacheEntry = {
      lat: knownVenueCoords.lat,
      lng: knownVenueCoords.lng,
      geocodedAt: new Date().toISOString().slice(0, 10),
      source: 'nominatim',
      firstSeen: new Date().toISOString().slice(0, 10),
    };
    return { coords: knownVenueCoords, geocodeSource: 'ripper', cache: { ...cache, entries: { ...cache.entries, [key]: knownEntry } } };
  }

  // Already known unresolvable — no network call needed
  const entry = cache.entries[key];
  if (entry?.unresolvable) {
    return { coords: null, geocodeSource: 'none', cache };
  }

  // Try geocoding the normalized string first.
  // If it looks like "Venue: 1234 Street..." also try the address-only part.
  const addressOnly = extractAddressFromVenuePrefix(normalized);
  const candidates = addressOnly ? [normalized, addressOnly] : [normalized];

  let coords: GeoCoords | null = null;
  for (const candidate of candidates) {
    coords = await geocodeLocation(candidate);
    if (coords !== null) break;
  }

  // Step 3: Neighborhood centroid lookup (if Nominatim failed)
  if (coords === null) {
    coords = lookupNeighborhoodCentroid(normalized);
  }

  // Step 4: Library branch lookup (if Nominatim and neighborhood failed)
  if (coords === null) {
    coords = lookupLibraryBranchCoords(normalized);
  }

  // Step 5: Known venue-area centroid fallback (theater district, midtown, etc.)
  if (coords === null) {
    coords = lookupVenueAreaFallback(normalized);
  }

  // Step 9: University building lookup (building code in parens, or named campus location)
  if (coords === null) {
    coords = lookupUniversityBuilding(normalized);
  }

  // Step 6: Suite/floor stripping retry (if still no coords)
  if (coords === null) {
    const stripped = stripSuiteFloorSuffixes(normalized);
    if (stripped !== null) {
      // Also try extracting address from venue prefix of stripped string
      const strippedAddressOnly = extractAddressFromVenuePrefix(stripped);
      const strippedCandidates = strippedAddressOnly ? [stripped, strippedAddressOnly] : [stripped];
      for (const candidate of strippedCandidates) {
        coords = await geocodeLocation(candidate);
        if (coords !== null) break;
      }
    }
  }

  if (coords !== null) {
    const newEntry: GeoCacheEntry = {
      lat: coords.lat,
      lng: coords.lng,
      ...(coords.osmId !== undefined && coords.osmType !== undefined
        ? { osmId: coords.osmId, osmType: coords.osmType }
        : {}),
      geocodedAt: new Date().toISOString().slice(0, 10),
      source: 'nominatim',
      firstSeen: new Date().toISOString().slice(0, 10),
    };
    const updatedCache: GeoCache = {
      ...cache,
      entries: { ...cache.entries, [key]: newEntry },
    };
    return { coords, geocodeSource: 'ripper', cache: updatedCache };
  } else {
    const newEntry: GeoCacheEntry = {
      unresolvable: true,
      geocodedAt: new Date().toISOString().slice(0, 10),
      source: 'nominatim',
      firstSeen: new Date().toISOString().slice(0, 10),
    };
    const updatedCache: GeoCache = {
      ...cache,
      entries: { ...cache.entries, [key]: newEntry },
    };
    const error: GeocodeError = {
      type: 'GeocodeError',
      location,
      source: sourceName,
      reason: 'Nominatim returned no results',
    };
    return { coords: null, geocodeSource: 'none', error, cache: updatedCache };
  }
}
