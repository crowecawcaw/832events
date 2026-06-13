import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeLocation,
  normalizeLocationKey,
  extractAddressFromVenuePrefix,
  extractFromGoogleMapsUrl,
  stripSuiteFloorSuffixes,
  lookupNeighborhoodCentroid,
  lookupLibraryBranchCoords,
  lookupVenueAreaFallback,
  lookupUniversityBuilding,
  lookupKnownVenue,
  lookupGeoCache,
  resolveEventCoords,
  type GeoCache,
} from './geocoder.js';


// Local reference-data probes — several describe blocks below exercise the
// city lookup tables in lib/geocoder.ts, which `npm run init-city` empties
// for template copies. Each block self-skips when its table is gone so the
// engine suite passes on any city's instance.
const HAS_NEIGHBORHOOD_DATA = lookupNeighborhoodCentroid('Capitol Hill, Houston') !== null;
const HAS_LIBRARY_DATA = lookupLibraryBranchCoords('Houston Public Library - Heights Branch') !== null;
const HAS_UNIVERSITY_DATA = lookupUniversityBuilding('Physics Seminar (PAT)') !== null;
const HAS_VENUE_DATA = lookupKnownVenue('space center houston') !== null;
const HAS_VENUE_AREA_DATA = lookupVenueAreaFallback('Theater District') !== null;

// We mock global fetch so geocodeLocation never makes real network calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('normalizeLocation', () => {
  it('unescapes ICS-escaped commas', () => {
    expect(normalizeLocation('2061 15th Ave. W.\\, Houston\\, TX 98119')).toBe('2061 15th Ave. W., Houston, TX 98119');
  });

  it('strips HTML tags', () => {
    expect(normalizeLocation('600 4th Ave.<br>Houston, TX')).toBe('600 4th Ave.');
  });

  it('strips HTML tags and takes only first line (br-separated)', () => {
    // When venue<br>address format is detected, extract the address line (starts with digit)
    expect(normalizeLocation('Council Chambers<br>600 4th Ave.\\, Floor 2<br>Houston\\, TX 98104')).toBe('600 4th Ave., Floor 2');
  });

  it('handles self-closing br tags', () => {
    expect(normalizeLocation('Line 1<br/>Line 2<br />Line 3')).toBe('Line 1');
  });

  it('strips other HTML tags like <b> and <p>', () => {
    expect(normalizeLocation('<b>Capitol Hill</b>, Houston TX')).toBe('Capitol Hill, Houston TX');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeLocation('  600   4th   Ave.  ')).toBe('600 4th Ave.');
  });

  it('trims outer whitespace', () => {
    expect(normalizeLocation('   123 Main St   ')).toBe('123 Main St');
  });

  it('handles newline-separated lines (takes first)', () => {
    expect(normalizeLocation('123 Main St\nHouston, TX 98101')).toBe('123 Main St');
  });

  it('passes through simple addresses unchanged', () => {
    expect(normalizeLocation('1515 12th Ave, Houston TX 98122')).toBe('1515 12th Ave, Houston TX 98122');
  });

  it('handles combined HTML and ICS escapes', () => {
    expect(normalizeLocation('NWFF: 1515 12th Ave\\, Houston TX 98122')).toBe('NWFF: 1515 12th Ave, Houston TX 98122');
  });
});

describe('normalizeLocationKey', () => {
  it('trims leading/trailing whitespace', () => {
    expect(normalizeLocationKey('  Houston  ')).toBe('houston');
  });

  it('lowercases the string', () => {
    expect(normalizeLocationKey('Capitol Hill, Houston')).toBe('capitol hill, houston');
  });

  it('handles already-normalized strings', () => {
    expect(normalizeLocationKey('2505 1st ave')).toBe('2505 1st ave');
  });

  it('trims and lowercases together', () => {
    expect(normalizeLocationKey('  The CROCODILE  ')).toBe('the crocodile');
  });

  it('normalizes ICS-escaped commas before keying', () => {
    const raw = 'NWFF: 1515 12th Ave\\, Houston TX 98122';
    const clean = 'nwff: 1515 12th ave, houston tx 98122';
    expect(normalizeLocationKey(raw)).toBe(clean);
  });

  it('produces same key for escaped and unescaped variants', () => {
    const escaped = 'NWFF: 1515 12th Ave\\, Houston TX 98122';
    const unescaped = 'nwff: 1515 12th ave, houston tx 98122';
    expect(normalizeLocationKey(escaped)).toBe(normalizeLocationKey(unescaped));
  });
});

describe('extractAddressFromVenuePrefix', () => {
  it('extracts address after colon-space prefix', () => {
    expect(extractAddressFromVenuePrefix('NWFF: 1515 12th Ave, Houston TX 98122')).toBe('1515 12th Ave, Houston TX 98122');
  });

  it('extracts address after venue-comma prefix', () => {
    expect(extractAddressFromVenuePrefix('Central Cinema, 1411 21st Ave., Houston, TX 98122')).toBe('1411 21st Ave., Houston, TX 98122');
  });

  it('returns null when no venue prefix detected', () => {
    expect(extractAddressFromVenuePrefix('1515 12th Ave, Houston TX 98122')).toBeNull();
  });

  it('returns null for plain venue name', () => {
    expect(extractAddressFromVenuePrefix('The Crocodile')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractAddressFromVenuePrefix('')).toBeNull();
  });
});

describe('lookupGeoCache', () => {
  const cache: GeoCache = {
    version: 1,
    entries: {
      'pike place market, houston': {
        lat: 47.6091,
        lng: -122.3416,
        geocodedAt: '2026-01-01',
        source: 'nominatim',
      },
      'some vague rooftop': {
        unresolvable: true,
        geocodedAt: '2026-01-01',
        source: 'nominatim',
      },
    },
  };

  it('returns coords on cache hit', () => {
    const result = lookupGeoCache(cache, 'Pike Place Market, Houston');
    expect(result).toEqual({ lat: 47.6091, lng: -122.3416 });
  });

  it('returns null on cache miss', () => {
    const result = lookupGeoCache(cache, 'Unknown Place, Houston');
    expect(result).toBeNull();
  });

  it('returns null for unresolvable entries', () => {
    const result = lookupGeoCache(cache, 'some vague rooftop');
    expect(result).toBeNull();
  });

  it('normalizes the key for lookup (case insensitive)', () => {
    const result = lookupGeoCache(cache, 'PIKE PLACE MARKET, HOUSTON');
    expect(result).toEqual({ lat: 47.6091, lng: -122.3416 });
  });
});

describe('resolveEventCoords', () => {
  let cache: GeoCache;

  beforeEach(() => {
    cache = {
      version: 1,
      entries: {
        'the crocodile, 2505 1st ave': {
          lat: 47.6146,
          lng: -122.3474,
          geocodedAt: '2026-01-01',
          source: 'nominatim',
        },
        'totally unresolvable place': {
          unresolvable: true,
          geocodedAt: '2026-01-01',
          source: 'nominatim',
        },
      },
    };
    mockFetch.mockReset();
  });

  it('returns none for undefined location', async () => {
    const result = await resolveEventCoords(cache, undefined, 'test-source');
    expect(result.coords).toBeNull();
    expect(result.geocodeSource).toBe('none');
    expect(result.cache).toBe(cache); // same reference — no change
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns none for empty location', async () => {
    const result = await resolveEventCoords(cache, '   ', 'test-source');
    expect(result.coords).toBeNull();
    expect(result.geocodeSource).toBe('none');
    expect(result.cache).toBe(cache); // same reference — no change
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns cached coords without network call on hit', async () => {
    const result = await resolveEventCoords(cache, 'The Crocodile, 2505 1st Ave', 'test-source');
    expect(result.coords).toEqual({ lat: 47.6146, lng: -122.3474 });
    expect(result.geocodeSource).toBe('cached');
    expect(result.cache).toBe(cache); // same reference — cache hit, no mutation
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns none without network call for unresolvable cache entry', async () => {
    const result = await resolveEventCoords(cache, 'totally unresolvable place', 'test-source');
    expect(result.coords).toBeNull();
    expect(result.geocodeSource).toBe('none');
    expect(result.cache).toBe(cache); // same reference — no change
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls geocodeLocation on cache miss and returns updated cache', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '47.6200', lon: '-122.3500' }],
    });

    const result = await resolveEventCoords(cache, 'New Venue, Houston', 'test-source');
    expect(result.coords).toEqual({ lat: 47.6200, lng: -122.3500 });
    expect(result.geocodeSource).toBe('ripper'); // fresh Nominatim result, not a cache hit
    expect(result.error).toBeUndefined();

    // Returns a new cache object (not the same reference)
    expect(result.cache).not.toBe(cache);

    // Original cache is unmodified
    expect(cache.entries['new venue, houston']).toBeUndefined();

    // New cache contains the entry
    const key = 'new venue, houston';
    expect(result.cache.entries[key]).toBeDefined();
    expect(result.cache.entries[key].lat).toBe(47.6200);
    expect(result.cache.entries[key].source).toBe('nominatim');
  });

  it('normalizes ICS-escaped commas before cache lookup', async () => {
    // Cache has the clean address
    const cacheWithClean: GeoCache = {
      version: 1,
      entries: {
        '2061 15th ave. w., houston, tx 98119': {
          lat: 47.6300,
          lng: -122.3600,
          geocodedAt: '2026-01-01',
          source: 'nominatim',
        },
      },
    };

    const result = await resolveEventCoords(
      cacheWithClean,
      '2061 15th Ave. W.\\, Houston\\, TX 98119',
      'test-source',
    );
    expect(result.coords).toEqual({ lat: 47.6300, lng: -122.3600 });
    expect(result.geocodeSource).toBe('cached');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('normalizes HTML tags before geocoding and cache lookup', async () => {
    // Location with HTML — normalized extracts address line starting with digit: "600 4th Ave., Floor 2"
    // Cache miss → Nominatim call
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '47.6050', lon: '-122.3295' }],
    });

    const result = await resolveEventCoords(
      cache,
      'Council Chambers<br>600 4th Ave.\\, Floor 2<br>Houston\\, TX 98104',
      'test-source',
    );
    expect(result.coords).toEqual({ lat: 47.6050, lng: -122.3295 });
    expect(result.geocodeSource).toBe('ripper');
    // The cache key should be the normalized version (address line extracted from HTML)
    expect(result.cache.entries['600 4th ave., floor 2']).toBeDefined();
  });

  it('falls back to address-only when venue prefix present', async () => {
    // First geocode call (full string) returns null, second (address-only) succeeds
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ lat: '47.6150', lon: '-122.3200' }] });

    const result = await resolveEventCoords(
      cache,
      'NWFF: 1515 12th Ave\\, Houston TX 98122',
      'test-source',
    );
    expect(result.coords).toEqual({ lat: 47.6150, lng: -122.3200 });
    expect(result.geocodeSource).toBe('ripper');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('marks as unresolvable and returns error when geocodeLocation fails', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await resolveEventCoords(cache, 'Nowhere Land', 'my-source');
    expect(result.coords).toBeNull();
    expect(result.geocodeSource).toBe('none');
    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('GeocodeError');
    expect(result.error?.location).toBe('Nowhere Land');
    expect(result.error?.source).toBe('my-source');

    // Returns a new cache object with the unresolvable entry
    expect(result.cache).not.toBe(cache);
    expect(result.cache.entries['nowhere land'].unresolvable).toBe(true);

    // Original cache is unmodified
    expect(cache.entries['nowhere land']).toBeUndefined();
  });
});

describe('extractFromGoogleMapsUrl', () => {
  it('extracts query from a Google Maps search URL', async () => {
    const url = 'https://www.google.com/maps/search/?api=1&query=Houston%20City%20Hall%2C%20600%204th%20Ave%2C%20Houston%2C%20TX%2098104';
    expect(await extractFromGoogleMapsUrl(url)).toBe('Houston City Hall, 600 4th Ave, Houston, TX 98104');
  });

  it('extracts query when query param comes first', async () => {
    const url = 'https://www.google.com/maps/search/?query=1000+Aloha+St+Houston+TX&api=1';
    expect(await extractFromGoogleMapsUrl(url)).toBe('1000 Aloha St Houston TX');
  });

  it('returns null for a plain address (not a URL)', async () => {
    expect(await extractFromGoogleMapsUrl('600 4th Ave, Houston, TX 98104')).toBeNull();
  });

  it('returns null for a non-maps Google URL', async () => {
    expect(await extractFromGoogleMapsUrl('https://www.google.com/search?q=houston')).toBeNull();
  });

  it('returns null for empty string', async () => {
    expect(await extractFromGoogleMapsUrl('')).toBeNull();
  });

  it('handles URL without query parameter', async () => {
    expect(await extractFromGoogleMapsUrl('https://www.google.com/maps/search/?api=1')).toBeNull();
  });

  it('handles http (non-https) Maps URLs', async () => {
    const url = 'http://www.google.com/maps/search/?api=1&query=Fremont+Brewing%2C+Houston';
    expect(await extractFromGoogleMapsUrl(url)).toBe('Fremont Brewing, Houston');
  });

  it('returns null for Google Maps short URLs (maps.app.goo.gl)', async () => {
    const url = 'https://maps.app.goo.gl/JKdvwN7V5BEi5VrZ8';
    expect(await extractFromGoogleMapsUrl(url)).toBeNull();
  });
});

describe('stripSuiteFloorSuffixes', () => {
  it('strips Suite NNN', () => {
    const result = stripSuiteFloorSuffixes('123 Main St, Suite 200, Houston, TX');
    expect(result).toBe('123 Main St, Houston, TX');
  });

  it('strips Ste NNN', () => {
    const result = stripSuiteFloorSuffixes('500 Yale Ave N, Ste 300, Houston, TX');
    expect(result).toBe('500 Yale Ave N, Houston, TX');
  });

  it('strips #NNN', () => {
    const result = stripSuiteFloorSuffixes('1234 5th Ave #100, Houston, TX');
    expect(result).toBe('1234 5th Ave, Houston, TX');
  });

  it('strips Floor N', () => {
    const result = stripSuiteFloorSuffixes('600 4th Ave, Floor 2, Houston, TX');
    expect(result).toBe('600 4th Ave, Houston, TX');
  });

  it('strips Room NNN', () => {
    const result = stripSuiteFloorSuffixes('100 Raitt Hall, Room 121, University of Houston');
    expect(result).toBe('100 Raitt Hall, University of Houston');
  });

  it('strips Level N', () => {
    const result = stripSuiteFloorSuffixes('2100 24th Ave E, Level 3, Houston, TX');
    expect(result).toBe('2100 24th Ave E, Houston, TX');
  });

  it('strips trailing ", United States"', () => {
    const result = stripSuiteFloorSuffixes('600 4th Ave, Houston, TX 98104, United States');
    expect(result).toBe('600 4th Ave, Houston, TX 98104');
  });

  it('strips trailing ", USA"', () => {
    const result = stripSuiteFloorSuffixes('600 4th Ave, Houston, TX 98104, USA');
    expect(result).toBe('600 4th Ave, Houston, TX 98104');
  });

  it('collapses double commas', () => {
    const result = stripSuiteFloorSuffixes('123 Main St,, Houston, TX');
    expect(result).toBe('123 Main St, Houston, TX');
  });

  it('returns null when nothing to strip', () => {
    const result = stripSuiteFloorSuffixes('123 Main St, Houston, TX');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(stripSuiteFloorSuffixes('')).toBeNull();
  });
});

describe.skipIf(!HAS_NEIGHBORHOOD_DATA)('lookupNeighborhoodCentroid', () => {
  it('matches "<neighborhood>, houston"', () => {
    const result = lookupNeighborhoodCentroid('Capitol Hill, Houston');
    expect(result).toEqual({ lat: 47.6253, lng: -122.3222 });
  });

  it('matches "<neighborhood> neighborhood, houston"', () => {
    const result = lookupNeighborhoodCentroid('Fremont neighborhood, Houston');
    expect(result).toEqual({ lat: 47.6512, lng: -122.3501 });
  });

  it('matches case-insensitively', () => {
    const result = lookupNeighborhoodCentroid('BALLARD, HOUSTON');
    expect(result).toEqual({ lat: 47.6677, lng: -122.3829 });
  });

  it('matches with ", TX" suffix', () => {
    const result = lookupNeighborhoodCentroid('Beacon Hill, Houston, TX');
    expect(result).toEqual({ lat: 47.5674, lng: -122.3076 });
  });

  it('matches bare neighborhood name', () => {
    const result = lookupNeighborhoodCentroid('South Lake Union');
    expect(result).toEqual({ lat: 47.6275, lng: -122.3362 });
  });

  it('returns null for non-neighborhood string', () => {
    expect(lookupNeighborhoodCentroid('1234 Main St, Houston')).toBeNull();
  });

  it('returns null for unknown neighborhood', () => {
    expect(lookupNeighborhoodCentroid('Montlake, Houston')).toBeNull();
  });

  it('returns correct coords for West Houston', () => {
    const result = lookupNeighborhoodCentroid('West Houston, Houston');
    expect(result).toEqual({ lat: 47.5629, lng: -122.3862 });
  });
});

describe.skipIf(!HAS_LIBRARY_DATA)('lookupLibraryBranchCoords', () => {
  it('matches "ballard branch" substring', () => {
    const result = lookupLibraryBranchCoords('Houston Public Library - Ballard Branch');
    expect(result).toEqual({ lat: 47.6671, lng: -122.3836 });
  });

  it('matches "central library" substring', () => {
    const result = lookupLibraryBranchCoords('Houston Public Library Central Library');
    expect(result).toEqual({ lat: 47.6064, lng: -122.3328 });
  });

  it('matches "capitol hill branch"', () => {
    const result = lookupLibraryBranchCoords('SPL Capitol Hill Branch, 425 Harvard Ave E');
    expect(result).toEqual({ lat: 47.6234, lng: -122.3196 });
  });

  it('matches case-insensitively', () => {
    const result = lookupLibraryBranchCoords('HOUSTON PUBLIC LIBRARY - FREMONT BRANCH');
    expect(result).toEqual({ lat: 47.6519, lng: -122.3502 });
  });

  it('returns null for non-SPL string', () => {
    expect(lookupLibraryBranchCoords('123 Main St, Houston')).toBeNull();
  });

  it('returns null for SPL with no recognized branch', () => {
    expect(lookupLibraryBranchCoords('Houston Public Library')).toBeNull();
  });

  it('does not match non-SPL strings containing branch neighborhood names', () => {
    // "Fremont Brewing" should not match "fremont branch"
    expect(lookupLibraryBranchCoords('Fremont Brewing, 1050 N 34th St, Houston, TX')).toBeNull();
    // "Ballard Beer Company" should not match "ballard branch"
    expect(lookupLibraryBranchCoords('Ballard Beer Company, Houston, TX')).toBeNull();
  });

  it('does not match strings where "spl" appears as part of another word', () => {
    // "Splendor Event Hall" should not match
    expect(lookupLibraryBranchCoords('Splendor Event Hall, Houston')).toBeNull();
  });

  it('matches douglass-truth branch', () => {
    const result = lookupLibraryBranchCoords('Houston Public Library - Douglass-Truth Branch');
    expect(result).toEqual({ lat: 47.6097, lng: -122.3000 });
  });
});

describe('resolveEventCoords - new strategies', () => {
  let cache: GeoCache;

  beforeEach(() => {
    cache = { version: 1, entries: {} };
    mockFetch.mockReset();
  });

  it('extracts address from Google Maps URL before geocoding', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '47.6050', lon: '-122.3295' }],
    });

    const url = 'https://www.google.com/maps/search/?api=1&query=600%204th%20Ave%2C%20Houston%2C%20TX%2098104';
    const result = await resolveEventCoords(cache, url, 'test-source');
    expect(result.coords).toEqual({ lat: 47.6050, lng: -122.3295 });
    expect(result.geocodeSource).toBe('ripper');
    // The cache key should be the decoded address
    expect(result.cache.entries['600 4th ave, houston, tx 98104']).toBeDefined();
  });

  it.skipIf(!HAS_NEIGHBORHOOD_DATA)('returns neighborhood centroid when Nominatim fails', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await resolveEventCoords(cache, 'Capitol Hill, Houston', 'test-source');
    expect(result.coords).toEqual({ lat: 47.6253, lng: -122.3222 });
    expect(result.geocodeSource).toBe('ripper');
    expect(result.error).toBeUndefined();
    expect(result.cache.entries['capitol hill, houston']).toBeDefined();
    expect(result.cache.entries['capitol hill, houston'].unresolvable).toBeUndefined();
  });

  it.skipIf(!HAS_LIBRARY_DATA)('returns SPL branch coords when Nominatim fails', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await resolveEventCoords(cache, 'Houston Public Library - Ballard Branch', 'test-source');
    expect(result.coords).toEqual({ lat: 47.6671, lng: -122.3836 });
    expect(result.geocodeSource).toBe('ripper');
    expect(result.error).toBeUndefined();
  });

  it.skipIf(!HAS_LIBRARY_DATA)('resolves Central Library room-level locations without SPL prefix', async () => {
    // SPL ripper emits "Central Library, Level 8 - Gallery" — no "SPL" or "Houston Public Library" prefix
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await resolveEventCoords(cache, 'Central Library, Level 8 - Gallery', 'spl');
    expect(result.coords).toEqual({ lat: 47.6064, lng: -122.3328 });
    expect(result.geocodeSource).toBe('ripper');
    expect(result.error).toBeUndefined();
  });

  it.skipIf(!HAS_LIBRARY_DATA)('resolves SPL branch room-level locations without explicit SPL prefix', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await resolveEventCoords(cache, 'Ballard Branch, Study Room', 'spl');
    expect(result.coords).toEqual({ lat: 47.6671, lng: -122.3836 });
    expect(result.geocodeSource).toBe('ripper');
    expect(result.error).toBeUndefined();
  });

  it('retries with stripped suite suffix when Nominatim fails', async () => {
    // First call (full string) → empty, second call (stripped) → success
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ lat: '47.6100', lon: '-122.3400' }] });

    const result = await resolveEventCoords(cache, '500 Yale Ave N, Suite 300, Houston, TX', 'test-source');
    expect(result.coords).toEqual({ lat: 47.6100, lng: -122.3400 });
    expect(result.geocodeSource).toBe('ripper');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('uses cached result for Google Maps URL after first resolution', async () => {
    // Pre-populate cache with the decoded address
    const primed: GeoCache = {
      version: 1,
      entries: {
        '600 4th ave, houston, tx 98104': {
          lat: 47.6050,
          lng: -122.3295,
          geocodedAt: '2026-01-01',
          source: 'nominatim',
        },
      },
    };

    const url = 'https://www.google.com/maps/search/?api=1&query=600%204th%20Ave%2C%20Houston%2C%20TX%2098104';
    const result = await resolveEventCoords(primed, url, 'test-source');
    expect(result.coords).toEqual({ lat: 47.6050, lng: -122.3295 });
    expect(result.geocodeSource).toBe('cached');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('stripSuiteFloorSuffixes - meeting room variants', () => {
  it('strips ", meeting room" suffix', () => {
    expect(stripSuiteFloorSuffixes('Capitol Hill Branch, Meeting Room')).toBe('Capitol Hill Branch');
  });

  it('strips ", meeting room N" suffix', () => {
    expect(stripSuiteFloorSuffixes('Northgate Branch, Meeting Room 1')).toBe('Northgate Branch');
  });

  it('strips "- meeting room" separator variant', () => {
    expect(stripSuiteFloorSuffixes('Community Center - Meeting Room')).toBe('Community Center');
  });

  it('strips ", meeting room / <multilingual>" suffix', () => {
    expect(stripSuiteFloorSuffixes('Library, Meeting Room / 会议室 / 회의실')).toBe('Library');
  });

  it("strips \", children's area\" suffix", () => {
    expect(stripSuiteFloorSuffixes("Some Library, Children's Area")).toBe('Some Library');
  });

  it('strips ", lobby" suffix', () => {
    expect(stripSuiteFloorSuffixes('Event Center, Lobby')).toBe('Event Center');
  });

  it('strips ", level N - room N" pattern', () => {
    expect(stripSuiteFloorSuffixes('Building A, Level 2 - Room 201')).toBe('Building A');
  });

  it('does not modify strings without sub-room qualifiers', () => {
    expect(stripSuiteFloorSuffixes('Capitol Hill Branch, Houston, TX')).toBeNull();
  });

  it('handles mixed case in meeting room', () => {
    expect(stripSuiteFloorSuffixes('Fremont Branch, MEETING ROOM')).toBe('Fremont Branch');
  });
});

describe.skipIf(!HAS_VENUE_AREA_DATA)('lookupVenueAreaFallback', () => {
  it('returns Houston Center centroid for "Leo K. Theater, Houston Center"', () => {
    const result = lookupVenueAreaFallback('Leo K. Theater, Houston Center');
    expect(result).toEqual({ lat: 47.6205, lng: -122.3493 });
  });

  it('returns Houston Center centroid for "Bagley Wright Theater, Houston Center"', () => {
    const result = lookupVenueAreaFallback('Bagley Wright Theater, Houston Center');
    expect(result).toEqual({ lat: 47.6205, lng: -122.3493 });
  });

  it('returns Houston Center centroid for exact "Houston Center"', () => {
    const result = lookupVenueAreaFallback('Houston Center');
    expect(result).toEqual({ lat: 47.6205, lng: -122.3493 });
  });

  it('returns SLU centroid for "<venue>, South Lake Union, Houston, TX"', () => {
    const result = lookupVenueAreaFallback('Amazon HQ, South Lake Union, Houston, TX');
    expect(result).toEqual({ lat: 47.6275, lng: -122.3362 });
  });

  it('returns SLU centroid for "<venue>, South Lake Union, Houston"', () => {
    const result = lookupVenueAreaFallback('Tech Hub, South Lake Union, Houston');
    expect(result).toEqual({ lat: 47.6275, lng: -122.3362 });
  });

  it('matches case-insensitively', () => {
    const result = lookupVenueAreaFallback('MCCAW HALL, HOUSTON CENTER');
    expect(result).toEqual({ lat: 47.6205, lng: -122.3493 });
  });

  it('returns null for unrecognized area', () => {
    expect(lookupVenueAreaFallback('Some Venue, Katy')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(lookupVenueAreaFallback('')).toBeNull();
  });
});

describe.skipIf(!HAS_VENUE_AREA_DATA)('resolveEventCoords - venue area fallback', () => {
  let cache: GeoCache;

  beforeEach(() => {
    cache = { version: 1, entries: {} };
    mockFetch.mockReset();
  });

  it('returns Houston Center centroid when Nominatim fails on Houston Center venue', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    const result = await resolveEventCoords(cache, 'Leo K. Theater, Houston Center', 'test-source');
    expect(result.coords).toEqual({ lat: 47.6205, lng: -122.3493 });
    expect(result.geocodeSource).toBe('ripper');
    expect(result.error).toBeUndefined();
    const key = 'leo k. theater, houston center';
    expect(result.cache.entries[key]).toBeDefined();
    expect(result.cache.entries[key].unresolvable).toBeUndefined();
  });

  it('returns SLU centroid when Nominatim fails on South Lake Union venue', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    const result = await resolveEventCoords(cache, 'Some Venue, South Lake Union, Houston, TX', 'test-source');
    expect(result.coords).toEqual({ lat: 47.6275, lng: -122.3362 });
    expect(result.geocodeSource).toBe('ripper');
    expect(result.error).toBeUndefined();
  });
});

describe.skipIf(!HAS_UNIVERSITY_DATA)('lookupUniversityBuilding', () => {
  it('matches HUB building code in parens at end of string', () => {
    const result = lookupUniversityBuilding('Some Event, University of Houston (HUB)');
    expect(result).toEqual({ lat: 47.6557, lng: -122.3050 });
  });

  it('matches PAT building code', () => {
    const result = lookupUniversityBuilding('Physics Seminar (PAT)');
    expect(result).toEqual({ lat: 47.6532, lng: -122.3115 });
  });

  it('matches KNE building code', () => {
    const result = lookupUniversityBuilding('Lecture (KNE)');
    expect(result).toEqual({ lat: 47.6561, lng: -122.3088 });
  });

  it('matches SFCO (multi-letter code)', () => {
    const result = lookupUniversityBuilding('Admin Meeting (SFCO)');
    expect(result).toEqual({ lat: 47.6610, lng: -122.3145 });
  });

  it('matches case-insensitively', () => {
    const result = lookupUniversityBuilding('Event (hub)');
    expect(result).toEqual({ lat: 47.6557, lng: -122.3050 });
  });

  it('matches BRK (Burke Museum)', () => {
    const result = lookupUniversityBuilding('Art Opening (BRK)');
    expect(result).toEqual({ lat: 47.6601, lng: -122.3131 });
  });

  it('returns null for unknown building code', () => {
    expect(lookupUniversityBuilding('Event (XYZ)')).toBeNull();
  });

  it('returns null for non-UW string', () => {
    expect(lookupUniversityBuilding('Pike Place Market, Houston')).toBeNull();
  });

  it('matches named location "anderson hall courtyard"', () => {
    const result = lookupUniversityBuilding('Anderson Hall Courtyard');
    expect(result).toEqual({ lat: 47.6553, lng: -122.3035 });
  });

  it('matches named location "uw botanic gardens"', () => {
    const result = lookupUniversityBuilding('UW Botanic Gardens');
    expect(result).toEqual({ lat: 47.6601, lng: -122.2898 });
  });

  it('matches named location "center for urban horticulture"', () => {
    const result = lookupUniversityBuilding('Center for Urban Horticulture');
    expect(result).toEqual({ lat: 47.6601, lng: -122.2898 });
  });
});

describe.skipIf(!HAS_VENUE_DATA)('lookupKnownVenue', () => {
  it('matches exact venue name', () => {
    const result = lookupKnownVenue('museum of flight');
    expect(result).toEqual({ lat: 47.5186, lng: -122.2967 });
  });

  it('matches case-insensitively', () => {
    const result = lookupKnownVenue('Museum of Flight');
    expect(result).toEqual({ lat: 47.5186, lng: -122.2967 });
  });

  it('matches "the museum of flight"', () => {
    const result = lookupKnownVenue('The Museum of Flight');
    expect(result).toEqual({ lat: 47.5186, lng: -122.2967 });
  });

  it('matches venue with trailing room info', () => {
    const result = lookupKnownVenue('Neumos, Main Stage');
    expect(result).toEqual({ lat: 47.6134, lng: -122.3203 });
  });

  it('matches venue with trailing dash separator', () => {
    const result = lookupKnownVenue('Neumos - Balcony');
    expect(result).toEqual({ lat: 47.6134, lng: -122.3203 });
  });

  it('matches "gorge amphitheatre"', () => {
    const result = lookupKnownVenue('Gorge Amphitheatre');
    expect(result).toEqual({ lat: 47.0801, lng: -119.9947 });
  });

  it('matches "the gorge amphitheatre"', () => {
    const result = lookupKnownVenue('The Gorge Amphitheatre');
    expect(result).toEqual({ lat: 47.0801, lng: -119.9947 });
  });

  it('matches langston hughes', () => {
    const result = lookupKnownVenue('Langston Hughes Performing Arts Institute');
    expect(result).toEqual({ lat: 47.5969, lng: -122.3165 });
  });

  it('returns null for unknown venue', () => {
    expect(lookupKnownVenue('Some Random Bar')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(lookupKnownVenue('')).toBeNull();
  });

  it('does not prefix-match when next char is not a separator', () => {
    // "neumos" should not match "neumos & barboza" prefix for a string like "neumosbakery"
    expect(lookupKnownVenue('neumosbakery')).toBeNull();
  });
});

describe.skipIf(!HAS_UNIVERSITY_DATA || !HAS_VENUE_DATA)('resolveEventCoords - UW building and known venue', () => {
  let cache: GeoCache;

  beforeEach(() => {
    cache = { version: 1, entries: {} };
    mockFetch.mockReset();
  });

  it('resolves UW building code when Nominatim fails', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    const result = await resolveEventCoords(cache, 'Seminar in Kane Hall (KNE)', 'test-source');
    expect(result.coords).toEqual({ lat: 47.6561, lng: -122.3088 });
    expect(result.geocodeSource).toBe('ripper');
    expect(result.error).toBeUndefined();
    const key = 'seminar in kane hall (kne)';
    expect(result.cache.entries[key]).toBeDefined();
    expect(result.cache.entries[key].unresolvable).toBeUndefined();
  });

  it('resolves known venue when Nominatim fails', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    const result = await resolveEventCoords(cache, 'Museum of Flight', 'test-source');
    expect(result.coords).toEqual({ lat: 47.5186, lng: -122.2967 });
    expect(result.geocodeSource).toBe('ripper');
    expect(result.error).toBeUndefined();
    expect(result.cache.entries['museum of flight']).toBeDefined();
    expect(result.cache.entries['museum of flight'].unresolvable).toBeUndefined();
  });

  it('resolves known venue with trailing room info', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    const result = await resolveEventCoords(cache, 'Neumos, Main Floor', 'test-source');
    expect(result.coords).toEqual({ lat: 47.6134, lng: -122.3203 });
    expect(result.geocodeSource).toBe('ripper');
    expect(result.error).toBeUndefined();
  });

  it('uses Nominatim result if available (UW lookup is fallback only)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '47.6560', lon: '-122.3090' }],
    });

    const result = await resolveEventCoords(cache, 'Seminar in Kane Hall (KNE)', 'test-source');
    // Should use Nominatim coords, not the hardcoded UW ones
    expect(result.coords).toEqual({ lat: 47.6560, lng: -122.3090 });
  });
});

describe('resolveEventCoords - firstSeen timestamps', () => {
  let cache: GeoCache;

  beforeEach(() => {
    cache = { version: 1, entries: {} };
    mockFetch.mockReset();
  });

  it('sets firstSeen on a newly resolved entry', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '47.6200', lon: '-122.3500' }],
    });

    const today = new Date().toISOString().slice(0, 10);
    const result = await resolveEventCoords(cache, 'New Venue, Houston', 'test-source');
    expect(result.geocodeSource).toBe('ripper');
    const entry = result.cache.entries['new venue, houston'];
    expect(entry).toBeDefined();
    expect(entry.firstSeen).toBe(today);
  });

  it('sets firstSeen on a newly unresolvable entry', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const today = new Date().toISOString().slice(0, 10);
    const result = await resolveEventCoords(cache, 'Totally Unknown Place XYZ', 'test-source');
    expect(result.geocodeSource).toBe('none');
    const entry = result.cache.entries['totally unknown place xyz'];
    expect(entry).toBeDefined();
    expect(entry.firstSeen).toBe(today);
  });

  it('does not overwrite firstSeen on a cache hit (entry written twice)', async () => {
    // Pre-populate cache with an existing entry that has a past firstSeen
    const pastDate = '2025-01-15';
    const primed: GeoCache = {
      version: 1,
      entries: {
        'existing venue, houston': {
          lat: 47.62,
          lng: -122.35,
          geocodedAt: pastDate,
          source: 'nominatim',
          firstSeen: pastDate,
        },
      },
    };

    // Second call — should be a cache hit, no mutation
    const result = await resolveEventCoords(primed, 'Existing Venue, Houston', 'test-source');
    expect(result.geocodeSource).toBe('cached');
    expect(result.cache).toBe(primed); // same reference — no new entry written
    expect(result.cache.entries['existing venue, houston'].firstSeen).toBe(pastDate);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
