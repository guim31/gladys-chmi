// -----------------------------------------------------------------------------
// Integration configuration: defaults (mirroring the manifest `config_schema`)
// and normalization, so the rest of the code never deals with raw form values.
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, in the order of the manifest options. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** The refresh intervals offered, in minutes (option values are strings). */
export const REFRESH_CHOICES = ['15', '30', '60'];

// Defaults: they MUST stay equal to the `default` values of the manifest
// (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // Selector of a Gladys house (source "houses"); empty = the first located house.
  house: '',
  // Coordinates typed by hand: strings, so that a comma or a decimal point
  // both work (a Gladys number field refuses decimals on some cores).
  latitude: '',
  longitude: '',
  // Station id (WSI such as 0-20000-0-11518, or the short id P1PRUZ01); empty = the nearest.
  station_id: '',
  // ORP district of the warnings (4-digit code or name); empty = the one of the location.
  district: '',
  // ČHMÚ publishes the 10-minute observations once an hour.
  refresh_minutes: '15',
  language: 'fr',
};

/**
 * Parse a coordinate typed by a user: "50.08", "50,08", " 50.08 ".
 * @param {unknown} value
 * @param {number} limit 90 for a latitude, 180 for a longitude
 * @returns {number | null} null when empty or invalid
 */
export function parseCoordinate(value, limit) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const text = value.trim().replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  const number = Number(text);
  return Math.abs(number) <= limit ? number : null;
}

// WSI (WIGOS station identifier) or the short ČHMÚ id.
const STATION_ID = /^(\d-\d{1,5}-\d-[0-9A-Za-z]{1,16}|[A-Za-z0-9]{8})$/;

/**
 * Merge the user config with the defaults and type every value.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const merged = { ...DEFAULT_CONFIG, ...raw };
  const latitude = parseCoordinate(merged.latitude, 90);
  const longitude = parseCoordinate(merged.longitude, 180);
  const refresh = REFRESH_CHOICES.includes(String(merged.refresh_minutes))
    ? Number(merged.refresh_minutes)
    : Number(DEFAULT_CONFIG.refresh_minutes);
  const stationId = String(merged.station_id ?? '').trim();
  return {
    house: typeof merged.house === 'string' ? merged.house : '',
    // Both or neither: one coordinate alone is no location.
    latitude: latitude !== null && longitude !== null ? latitude : null,
    longitude: latitude !== null && longitude !== null ? longitude : null,
    // A coordinate typed but unreadable: said in the connection status.
    coordinatesInvalid:
      (String(merged.latitude ?? '').trim() !== '' ||
        String(merged.longitude ?? '').trim() !== '') &&
      (latitude === null || longitude === null),
    stationId: STATION_ID.test(stationId) ? stationId : '',
    stationIdInvalid: stationId !== '' && !STATION_ID.test(stationId),
    district: String(merged.district ?? '').trim(),
    refreshMs: refresh * 60 * 1000,
    language: LANGUAGES.includes(merged.language) ? merged.language : DEFAULT_CONFIG.language,
  };
}
