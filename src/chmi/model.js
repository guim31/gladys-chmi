// -----------------------------------------------------------------------------
// Pure parsing of the ČHMÚ files: station metadata, 10-minute observations,
// the CAP directory index and the CAP warning files. No I/O, no clock read:
// every function takes the time it needs.
// -----------------------------------------------------------------------------

const HOUR = 3600 * 1000;

/** A rough box around Czechia: meta1 also lists foreign stations (Reykjavik...). */
const CZECHIA = { south: 48.4, north: 51.2, west: 11.9, east: 19.1 };

/** The elements a station needs to be picked as "the nearest" automatically. */
const CORE_ELEMENTS = ['T', 'H', 'F'];

/** Rows of a ČHMÚ "DataCollection" file, as objects keyed by the header. */
export function rowsOf(file) {
  const data = file?.data?.data;
  if (!data || typeof data.header !== 'string' || !Array.isArray(data.values)) {
    throw new Error('Unexpected ČHMÚ file layout');
  }
  const keys = data.header.split(',');
  return data.values.map((row) => Object.fromEntries(keys.map((key, i) => [key, row[i]])));
}

/**
 * Stations that publish 10-minute temperatures, in Czechia.
 * @param {object} meta1 station list (WSI, GH_ID, FULL_NAME, GEOGR1 = lon, GEOGR2 = lat, ELEVATION)
 * @param {object} meta2 elements of each station (OBS_TYPE, WSI, EG_EL_ABBREVIATION...)
 */
export function parseStations(meta1, meta2) {
  const elements = new Map();
  for (const row of rowsOf(meta2)) {
    if (row.OBS_TYPE === '10M') {
      if (!elements.has(row.WSI)) elements.set(row.WSI, new Set());
      elements.get(row.WSI).add(row.EG_EL_ABBREVIATION);
    }
  }
  const stations = new Map();
  for (const row of rowsOf(meta1)) {
    const lat = Number(row.GEOGR2);
    const lon = Number(row.GEOGR1);
    const measured = elements.get(row.WSI);
    if (
      stations.has(row.WSI) ||
      !measured?.has('T') ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < CZECHIA.south ||
      lat > CZECHIA.north ||
      lon < CZECHIA.west ||
      lon > CZECHIA.east
    ) {
      continue;
    }
    stations.set(row.WSI, {
      id: row.WSI,
      code: String(row.GH_ID ?? ''),
      name: String(row.FULL_NAME ?? row.WSI),
      lat,
      lon,
      altitude: Number.isFinite(Number(row.ELEVATION)) ? Number(row.ELEVATION) : null,
      elements: [...measured].sort(),
    });
  }
  return [...stations.values()];
}

/** Great-circle distance in km. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * The `count` nearest stations measuring temperature, humidity and wind
 * (a few stations only measure the temperature).
 */
export function nearestStations(stations, lat, lon, count) {
  return stations
    .filter((station) => CORE_ELEMENTS.every((element) => station.elements.includes(element)))
    .map((station) => ({ ...station, distance: distanceKm(lat, lon, station.lat, station.lon) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

/** A station by WSI or short id (case-insensitive). */
export function findStation(stations, id) {
  const wanted = id.toUpperCase();
  return (
    stations.find(
      (station) => station.id.toUpperCase() === wanted || station.code.toUpperCase() === wanted,
    ) ?? null
  );
}

/**
 * The ČHMÚ elements read, and how each becomes a feature value.
 * The first element present wins (F is the 10-minute mean wind, Fprum the
 * same mean on a few stations).
 */
export const OBSERVATION_ELEMENTS = {
  temperature: { elements: ['T'], convert: (v) => v },
  humidity: { elements: ['H'], convert: (v) => v },
  // Pressure at the station, not reduced to sea level.
  pressure: { elements: ['P'], convert: (v) => v },
  wind_speed: { elements: ['F', 'Fprum'], convert: (v) => Math.round(v * 36) / 10 },
  wind_gust: { elements: ['Fmax'], convert: (v) => Math.round(v * 36) / 10 },
  wind_direction: { elements: ['D', 'Dprum'], convert: (v) => Math.round(v) },
  // Rain of the last 10 minutes, as an hourly rate.
  rain_rate: { elements: ['SRA10M'], convert: (v) => Math.round(v * 60) / 10 },
  // Seconds of sunshine in the last 10 minutes, in minutes.
  sunshine: { elements: ['SSV10M'], convert: (v) => Math.round(v / 6) / 10 },
};

/** The feature keys a station can fill, from its list of elements. */
export function stationFeatureKeys(station) {
  return Object.entries(OBSERVATION_ELEMENTS)
    .filter(([, definition]) =>
      definition.elements.some((element) => station.elements.includes(element)),
    )
    .map(([key]) => key);
}

// Quality flags of meta4: 2 = poor, do not use; 4 = missing.
const UNUSABLE_QUALITY = new Set([2, 4]);

/**
 * The values of the latest time step of an observation file.
 * @param {object} file the 10-minute file of one station and one day
 * @returns {{ time: number | null, values: Record<string, number> }}
 */
export function parseObservation(file) {
  // element -> time -> value
  const series = new Map();
  for (const row of rowsOf(file)) {
    const value = row.VAL;
    const time = Date.parse(row.DT);
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      Number.isNaN(time) ||
      UNUSABLE_QUALITY.has(Number(row.QUALITY))
    ) {
      continue;
    }
    if (!series.has(row.ELEMENT)) series.set(row.ELEMENT, new Map());
    series.get(row.ELEMENT).set(time, value);
  }
  // The values of one time step: the newest one at which the temperature (or
  // anything, failing that) was measured. Values of other steps are not mixed in.
  const newest = (element) => Math.max(0, ...(series.get(element)?.keys() ?? []));
  const reference = series.has('T') ? newest('T') : Math.max(0, ...[...series.keys()].map(newest));
  const values = {};
  for (const [key, definition] of Object.entries(OBSERVATION_ELEMENTS)) {
    const element = definition.elements.find((name) => series.get(name)?.has(reference));
    if (element) {
      values[key] = definition.convert(series.get(element).get(reference));
    }
  }
  return { time: reference > 0 ? reference : null, values };
}

const MONTHS = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

/**
 * The newest meteorological CAP file of the directory index (`alert_cap_50_*`;
 * the `_70_` files are the weekly drought bulletin). The names hold only the
 * day of the month and are reused every month: the date of the index (UTC)
 * decides.
 * @returns {{ name: string, time: number, size: number } | null}
 */
export function latestCapFile(html) {
  let latest = null;
  const pattern =
    /href="(alert_cap_50_\d{6}\.xml)"[^\n]*?(\d{2})-(\w{3})-(\d{4}) (\d{2}):(\d{2})\s+(\d+)/g;
  for (const match of html.matchAll(pattern)) {
    const [, name, day, month, year, hour, minute, size] = match;
    if (!(month in MONTHS)) continue;
    const time = Date.UTC(Number(year), MONTHS[month], Number(day), Number(hour), Number(minute));
    if (!latest || time > latest.time || (time === latest.time && name > latest.name)) {
      latest = { name, time, size: Number(size) };
    }
  }
  return latest;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (text) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, name) => {
      if (name[0] === '#') {
        const code = name[1] === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return String.fromCodePoint(code);
      }
      return ENTITIES[name.toLowerCase()];
    })
    .trim();

const tag = (xml, name) => {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decode(match[1]) : '';
};

const pairs = (xml, name) =>
  [
    ...xml.matchAll(
      new RegExp(
        `<${name}>\\s*<valueName>([^<]*)</valueName>\\s*<value>([\\s\\S]*?)</value>\\s*</${name}>`,
        'g',
      ),
    ),
  ].map(([, key, value]) => [decode(key), decode(value)]);

/**
 * MeteoAlarm awareness types (CAP parameter `awareness_type`, "1; Wind") to the
 * keys of the integration. Keys are forever: scene filters store them.
 */
export const AWARENESS_TYPES = {
  1: 'wind',
  2: 'snow_ice',
  3: 'thunderstorm',
  4: 'fog',
  5: 'heat',
  6: 'cold',
  8: 'forest_fire',
  10: 'rain',
  12: 'flood',
  13: 'flood',
};
export const WARNING_TYPE_KEYS = [
  'wind',
  'snow_ice',
  'thunderstorm',
  'fog',
  'heat',
  'cold',
  'forest_fire',
  'rain',
  'flood',
  'other',
];

/** Levels 1 to 3 (yellow, orange, red): the awareness level 2 to 4 of MeteoAlarm. */
export const WARNING_LEVEL_KEYS = ['yellow', 'orange', 'red'];
const LEVEL_OF_SEVERITY = { Moderate: 1, Severe: 2, Extreme: 3 };

function parseTime(text) {
  const time = Date.parse(text);
  return Number.isNaN(time) ? null : time;
}

/**
 * The warnings of a CAP file for one ORP district.
 *
 * A file is the full picture at the time it was issued: every hazard, for
 * every district, including "no warning" blocks (responseType None, severity
 * Minor) and the hazard outlook (SIVS code OUTLOOK). Only real warnings are
 * kept. Each warning comes twice, in Czech then in English: the English block
 * gives the texts, the Czech one its name.
 *
 * @param {string} xml
 * @param {string} district CISORP code of the district (e.g. "1100")
 * @returns {{ sent: number | null, warnings: Array<object> }}
 */
export function parseCap(xml, district) {
  if (!/<alert[\s>]/.test(xml)) {
    throw new Error('Not a CAP file');
  }
  const header = xml.slice(0, xml.indexOf('<info>') >>> 0);
  const sent = parseTime(tag(header, 'sent'));
  const czechNames = new Map();
  const english = [];
  for (const block of xml.split('<info>').slice(1)) {
    const info = block.slice(0, block.indexOf('</info>') >>> 0);
    const codes = new Set(
      [...info.matchAll(/<valueName>CISORP<\/valueName>\s*<value>(\d+)<\/value>/g)].map(
        (m) => m[1],
      ),
    );
    if (!codes.has(district)) continue;
    const eventCodes = Object.fromEntries(pairs(info, 'eventCode'));
    const parameters = Object.fromEntries(pairs(info, 'parameter'));
    const sivs = eventCodes.SIVS ?? eventCodes.HAMR;
    const severity = tag(info, 'severity');
    const awareness = Number.parseInt(parameters.awareness_level ?? '', 10);
    const level = Number.isFinite(awareness) ? awareness - 1 : (LEVEL_OF_SEVERITY[severity] ?? 0);
    if (!sivs || sivs === 'OUTLOOK' || !LEVEL_OF_SEVERITY[severity] || level < 1) {
      continue;
    }
    const start = parseTime(tag(info, 'onset')) ?? parseTime(tag(info, 'effective')) ?? sent;
    const end = parseTime(tag(info, 'expires')) ?? parseTime(parameters.eventEndingTime ?? '');
    const key = `${sivs}|${start}|${end}`;
    const language = tag(info, 'language');
    if (language === 'cs') {
      czechNames.set(key, tag(info, 'event'));
      continue;
    }
    if (!language.startsWith('en')) continue;
    english.push({
      key,
      code: sivs,
      type: AWARENESS_TYPES[Number.parseInt(parameters.awareness_type ?? '', 10)] ?? 'other',
      level: Math.min(level, 3),
      start,
      end,
      event: tag(info, 'event'),
      description: tag(info, 'description'),
      instruction: tag(info, 'instruction'),
    });
  }
  const warnings = english
    .map(({ key, ...warning }) => ({ ...warning, eventCs: czechNames.get(key) ?? '' }))
    .sort((a, b) => a.start - b.start || b.level - a.level);
  return { sent, warnings };
}

/** The warnings not over yet, the ones in force first, then by start. */
export function warningsAhead(warnings, now) {
  return warnings
    .filter((warning) => warning.end === null || warning.end > now)
    .sort((a, b) => {
      const aNow = a.start <= now;
      const bNow = b.start <= now;
      if (aNow !== bNow) return aNow ? -1 : 1;
      return a.start - b.start || b.level - a.level;
    });
}

/**
 * The highest level in force now, and the highest of the warnings not over
 * (announced ones included), 0 when none.
 */
export function warningLevels(warnings, now) {
  const ahead = warningsAhead(warnings, now);
  const max = (list) => list.reduce((level, warning) => Math.max(level, warning.level), 0);
  return { now: max(ahead.filter((warning) => warning.start <= now)), ahead: max(ahead) };
}

/** Warnings of one type closer than this are one episode (a warning extended or re-issued). */
export const EPISODE_GAP = HOUR;
