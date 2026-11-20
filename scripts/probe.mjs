#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Probe of the real ČHMÚ open data, read-only, with the client and the parsers
// of the integration: what Gladys would show for a point.
//
//   node scripts/probe.mjs <latitude> <longitude> [--station <id>] [--district <name|code>]
//
// No account, no key: nothing sensitive is printed. Exit code 1 if a source
// fails.
// -----------------------------------------------------------------------------

import { createChmiClient, utcDay } from '../src/chmi/client.js';
import { districtAt, findDistrict } from '../src/chmi/districts.js';
import {
  findStation,
  latestCapFile,
  nearestStations,
  parseCap,
  parseObservation,
  parseStations,
  warningLevels,
} from '../src/chmi/model.js';
import { parseCoordinate } from '../src/config.js';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};
const lat = parseCoordinate(args[0], 90);
const lon = parseCoordinate(args[1], 180);
if (lat === null || lon === null) {
  console.error(
    'Usage: node scripts/probe.mjs <latitude> <longitude> [--station <id>] [--district <name|code>]',
  );
  process.exit(2);
}

const client = createChmiClient();
const now = Date.now();
let failed = false;

const metadata = await client
  .metadata(utcDay(now))
  .catch((err) =>
    err.status === 404 ? client.metadata(utcDay(now - 86400000)) : Promise.reject(err),
  );
const stations = parseStations(metadata.stations, metadata.elements);
console.log(`${stations.length} stations with 10-minute temperatures`);
const station = option('--station')
  ? findStation(stations, option('--station'))
  : nearestStations(stations, lat, lon, 1)[0];
console.log('Station:', station ? `${station.id} ${station.code} ${station.name}` : 'none');

if (station) {
  try {
    let answer;
    try {
      answer = await client.observations(station.id, utcDay(now));
    } catch (err) {
      if (err.status !== 404) throw err;
      answer = await client.observations(station.id, utcDay(now - 86400000));
    }
    const observation = parseObservation(answer.json);
    console.log(
      'Observation:',
      new Date(observation.time).toISOString(),
      `(${Math.round((now - observation.time) / 60000)} min old)`,
      observation.values,
    );
    const again = await client.observations(station.id, utcDay(now), answer.etag);
    console.log('Conditional request:', again.json === undefined ? '304 Not Modified' : '200');
  } catch (err) {
    failed = true;
    console.error('Observation failed:', err.message);
  }
}

const district = option('--district') ? findDistrict(option('--district')) : districtAt(lat, lon);
console.log('District:', district ? `${district.code} ${district.name}` : 'none');
if (district) {
  try {
    const latest = latestCapFile(await client.capListing());
    console.log('Latest CAP:', latest.name, new Date(latest.time).toISOString(), latest.size, 'B');
    const cap = parseCap(await client.capFile(latest.name), district.code);
    console.log(
      'Sent:',
      new Date(cap.sent).toISOString(),
      'levels:',
      warningLevels(cap.warnings, now),
    );
    for (const warning of cap.warnings) {
      console.log(
        ` - ${warning.type} level ${warning.level} ${new Date(warning.start).toISOString()} → ${warning.end ? new Date(warning.end).toISOString() : '…'}: ${warning.event} / ${warning.eventCs}`,
      );
    }
  } catch (err) {
    failed = true;
    console.error('Warnings failed:', err.message);
  }
}
process.exit(failed ? 1 : 0);
