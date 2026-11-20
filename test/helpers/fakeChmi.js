// -----------------------------------------------------------------------------
// A simulated opendata.chmi.cz: a `fetch` that answers the files the
// integration reads with the recorded fixtures of test/fixtures. No network.
//
// The observations (recorded on 2026-11-20) are re-dated so that their last
// time step is the last complete hour before the test clock, as ČHMÚ
// publishes them. The CAP files are served as recorded, under the names and
// dates of `caps`.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const text = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
const json = (name) => JSON.parse(text(name));

export const FIXTURES = {
  meta1: json('meta1.json'),
  meta2: json('meta2.json'),
  observations: { 11514: json('obs-11514.json'), 11522: json('obs-11522.json') },
  capWind: text('cap-wind-20261117.xml'),
  capHeat: text('cap-heat-20250701.xml'),
  listing: text('cap-listing.html'),
};

/** Test clock: Tuesday 17 November 2026, 16:00 in Prague (15:00 UTC). */
export const NOW = Date.parse('2026-11-17T15:00:00Z');
export const TIME_ZONE = 'Europe/Prague';

/** The CAP file of the wind warning (issued 2026-11-17 10:02 UTC). */
export const WIND_CAP = {
  name: 'alert_cap_50_171002.xml',
  time: Date.parse('2026-11-17T10:03:00Z'),
  xml: FIXTURES.capWind,
};

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const indexDate = (time) => {
  const d = new Date(time);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/** An nginx index of the CAP directory listing `caps` and the drought bulletin. */
export function listingOf(caps) {
  const rows = [
    { name: 'alert_cap_70_271200.xml', time: Date.parse('2026-10-27T16:41:00Z'), size: 60600 },
    ...caps.map((cap) => ({ ...cap, size: cap.xml.length })),
  ].map(
    (row) =>
      `<a href="${row.name}">${row.name}</a>                            ${indexDate(row.time)}             ${row.size}`,
  );
  return `<html>\n<head><title>Index of /meteorology/weather/alerts/cap/</title></head>\n<body>\n<h1>Index of /meteorology/weather/alerts/cap/</h1><hr><pre><a href="../">../</a>\n${rows.join('\n')}\n</pre><hr></body>\n</html>\n`;
}

const STEP = 10 * 60 * 1000;
const HOUR = 6 * STEP;

/** An observation file re-dated so that its last step is `last`. */
export function redated(file, last) {
  const answer = structuredClone(file);
  const values = answer.data.data.values;
  const recordedLast = Math.max(...values.map((row) => Date.parse(row[2])));
  for (const row of values) {
    row[2] = new Date(Date.parse(row[2]) - recordedLast + last).toISOString().replace('.000', '');
  }
  return answer;
}

/**
 * @param {object} [options]
 * @param {() => number} [options.now]
 */
export function createFakeChmi({ now = () => NOW } = {}) {
  const requests = [];
  const state = {
    caps: [WIND_CAP],
    // Overrides by endpoint: an Error (network failure) or { status }.
    fail: {},
    // Days (YYYYMMDD) whose files do not exist yet.
    missingDays: new Set(),
  };

  const endpointOf = (url) => {
    const path = url.pathname;
    if (path.includes('/climate/now/metadata/')) return 'metadata';
    if (path.includes('/climate/now/data/')) return 'observations';
    if (path.endsWith('/alerts/cap/')) return 'listing';
    if (path.includes('/alerts/cap/')) return 'cap';
    return null;
  };

  const etagOf = (body) => `"${createHash('sha1').update(body).digest('hex').slice(0, 12)}"`;

  function answer(endpoint, url) {
    const name = url.pathname.split('/').pop();
    const day = name.match(/(\d{8})\.json$/)?.[1];
    if (day && state.missingDays.has(day)) return null;
    switch (endpoint) {
      case 'metadata':
        return JSON.stringify(name.startsWith('meta1-') ? FIXTURES.meta1 : FIXTURES.meta2);
      case 'observations': {
        const station = name.match(/^10m-\d-\d+-\d-(\d+)-\d{8}\.json$/)?.[1];
        const file = FIXTURES.observations[station];
        if (!file) return null;
        // ČHMÚ rewrites the file at :01 with the values up to :50.
        const last = Math.floor(now() / HOUR) * HOUR - STEP;
        return JSON.stringify(redated(file, last));
      }
      case 'listing':
        return listingOf(state.caps);
      case 'cap':
        return state.caps.find((cap) => cap.name === name)?.xml ?? null;
      default:
        return null;
    }
  }

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const endpoint = endpointOf(url);
    requests.push({ endpoint, url, headers: init.headers ?? {} });
    const failure = state.fail[endpoint];
    if (failure instanceof Error) throw failure;
    if (failure?.status) return new Response('error', { status: failure.status });
    const body = answer(endpoint, url);
    if (body === null) return new Response('not found', { status: 404 });
    const etag = etagOf(body);
    if (init.headers?.['if-none-match'] === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }
    return new Response(body, { status: 200, headers: { etag } });
  }

  return {
    fetch,
    requests,
    state,
    /** Requests per endpoint. */
    count: (endpoint) => requests.filter((request) => request.endpoint === endpoint).length,
  };
}

const AWARENESS = {
  wind: '1; Wind',
  snow_ice: '2; snow-ice',
  thunderstorm: '3; Thunderstorm',
  heat: '5; high-temperature',
  rain: '10; Rain',
};
const LEVELS = ['', '2; yellow; Moderate', '3; orange; Severe', '4; red; Extreme'];
const SEVERITY = ['', 'Moderate', 'Severe', 'Extreme'];
const cet = (time) => new Date(time + HOUR).toISOString().replace('.000Z', '+01:00');

/**
 * A CAP file in the layout of ČHMÚ (Czech block, then English block, per
 * warning), for the scenarios the recorded files do not cover.
 * @param {object} options
 * @param {number} options.sent
 * @param {Array<{ type: string, level: number, start: number, end: number, districts?: string[] }>} options.warnings
 */
export function makeCap({ sent, warnings }) {
  const info = (warning, language) => {
    const geocodes = (warning.districts ?? ['2102'])
      .map(
        (code) =>
          `<geocode><valueName>CISORP</valueName><value>${code}</value></geocode><geocode><valueName>EMMA_ID</valueName><value>CZ0${code}</value></geocode>`,
      )
      .join('');
    const name =
      language === 'cs' ? `Výstraha ${warning.type}` : `Moderate ${warning.type} warning`;
    return `<info>
    <language>${language}</language><category>Met</category><event>${name}</event>
    <responseType>Prepare</responseType><urgency>Future</urgency>
    <severity>${SEVERITY[warning.level]}</severity><certainty>Likely</certainty>
    <onset>${cet(warning.start)}</onset><expires>${cet(warning.end)}</expires>
    <senderName>ČHMÚ</senderName>
    <description>${language === 'cs' ? 'Popis' : 'Description &amp; details'}</description>
    <instruction>${language === 'cs' ? 'Pokyny' : 'Stay inside.'}</instruction>
    <eventCode><valueName>SIVS</valueName><value>X.${warning.level}</value></eventCode>
    <parameter><valueName>awareness_level</valueName><value>${LEVELS[warning.level]}</value></parameter>
    <parameter><valueName>awareness_type</valueName><value>${AWARENESS[warning.type]}</value></parameter>
    <area><areaDesc>Kraj</areaDesc>${geocodes}</area>
  </info>`;
  };
  const infos = warnings.flatMap((warning) => [info(warning, 'cs'), info(warning, 'en-GB')]);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>2.49.0.0.203.0.CZ.test</identifier><sender>chmi@chmi.cz</sender>
  <sent>${cet(sent)}</sent><status>Actual</status><msgType>Alert</msgType><scope>Public</scope>
  ${infos.join('\n  ')}
</alert>
`;
}

let issued = 0;
/** Publish a new CAP file in the fake directory, as ČHMÚ does at each issue. */
export function issueCap(fake, now, warnings) {
  issued += 1;
  const name = `alert_cap_50_${String(issued).padStart(6, '0')}.xml`;
  fake.state.caps.push({ name, time: now, xml: makeCap({ sent: now, warnings }) });
}
