// -----------------------------------------------------------------------------
// The parsers, on real ČHMÚ files (test/fixtures, see its README): station
// metadata, 10-minute observations, the CAP directory index, CAP warnings,
// and the ORP districts.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS, districtAt, findDistrict } from '../src/chmi/districts.js';
import {
  findStation,
  latestCapFile,
  nearestStations,
  parseCap,
  parseObservation,
  parseStations,
  stationFeatureKeys,
  warningLevels,
  warningsAhead,
} from '../src/chmi/model.js';
import { FIXTURES, makeCap } from './helpers/fakeChmi.js';

const stations = parseStations(FIXTURES.meta1, FIXTURES.meta2);
const HOUR = 3600 * 1000;

test('stations: only Czech stations with 10-minute temperatures, once each', () => {
  assert.ok(stations.length > 10);
  assert.equal(new Set(stations.map((s) => s.id)).size, stations.length);
  assert.ok(!stations.some((s) => s.name === 'Reykjavik'), 'foreign stations are left out');
  const ruzyne = findStation(stations, '0-20000-0-11518');
  assert.deepEqual(
    { ...ruzyne, elements: undefined },
    {
      id: '0-20000-0-11518',
      code: 'P1PRUZ01',
      name: 'Praha, Ruzyně',
      lat: 50.100278,
      lon: 14.255556,
      altitude: 364,
      elements: undefined,
    },
  );
  assert.equal(findStation(stations, 'p1pruz01'), ruzyne, 'the short id, any case');
  assert.equal(findStation(stations, '0-20000-0-99999'), null);
});

test('nearest stations: the ones measuring temperature, humidity and wind', () => {
  // Klementinum has two ids: 11515 measures the temperature only.
  const near = nearestStations(stations, 50.0875, 14.4213, 3);
  assert.deepEqual(
    near.map((s) => [s.id, s.name, Math.round(s.distance * 10) / 10]),
    [
      ['0-203-0-11514', 'Praha, Klementinum', 0.3],
      ['0-20000-0-11519', 'Praha, Karlov', 2.1],
      ['0-203-0-11201020001', 'Praha, Vinohrady - Flora', 3.2],
    ],
  );
});

test('a station only gets the features of the elements it measures', () => {
  assert.deepEqual(stationFeatureKeys(findStation(stations, '0-20000-0-11518')), [
    'temperature',
    'humidity',
    'pressure',
    'wind_speed',
    'wind_gust',
    'wind_direction',
    'rain_rate',
    'sunshine',
  ]);
  // Dobřichovice has no barometer and no sunshine recorder.
  assert.deepEqual(stationFeatureKeys(findStation(stations, '0-203-0-11521')), [
    'temperature',
    'humidity',
    'wind_speed',
    'wind_gust',
    'wind_direction',
    'rain_rate',
  ]);
});

test('an observation: the latest time step, converted (m/s to km/h, rain per hour)', () => {
  const observation = parseObservation(FIXTURES.observations['11514']);
  assert.equal(new Date(observation.time).toISOString(), '2026-11-20T20:50:00.000Z');
  assert.deepEqual(observation.values, {
    temperature: 9,
    humidity: 80,
    pressure: 981.2,
    wind_speed: 9.7,
    wind_gust: 18.7,
    wind_direction: 242,
    rain_rate: 0,
  });
});

test('an observation skips missing and poor values, and never mixes time steps', () => {
  const file = structuredClone(FIXTURES.observations['11514']);
  const rows = file.data.data.values;
  // The last temperature is flagged missing (quality 4): the step before wins.
  const lastT = rows.filter((row) => row[1] === 'T').at(-1);
  lastT[5] = 4;
  const observation = parseObservation(file);
  assert.equal(new Date(observation.time).toISOString(), '2026-11-20T20:40:00.000Z');
  const previous = rows.filter((row) => row[1] === 'T').at(-2);
  assert.equal(observation.values.temperature, previous[3]);
  const humidity = rows.find((row) => row[1] === 'H' && row[2] === '2026-11-20T20:40:00Z');
  assert.equal(observation.values.humidity, humidity[3]);
});

test('the CAP index: the newest meteorological file by date, never the drought bulletin', () => {
  // Names hold the day of the month only and are reused: the date decides.
  assert.deepEqual(latestCapFile(FIXTURES.listing), {
    name: 'alert_cap_50_200905.xml',
    time: Date.parse('2026-11-20T09:05:00Z'),
    size: 1641659,
  });
  assert.equal(latestCapFile('<html>empty</html>'), null);
});

test('a real CAP file: the wind warning of Beroun, nothing for Prague', () => {
  const beroun = parseCap(FIXTURES.capWind, '2102');
  assert.equal(new Date(beroun.sent).toISOString(), '2026-11-17T10:02:49.000Z');
  assert.equal(beroun.warnings.length, 1);
  const [wind] = beroun.warnings;
  assert.deepEqual(
    {
      type: wind.type,
      level: wind.level,
      code: wind.code,
      start: new Date(wind.start).toISOString(),
      end: new Date(wind.end).toISOString(),
      event: wind.event,
      eventCs: wind.eventCs,
    },
    {
      type: 'wind',
      level: 1,
      code: 'V.1',
      start: '2026-11-17T13:00:00.000Z',
      end: '2026-11-18T16:00:00.000Z',
      event: 'Moderate Wind Related Impact',
      eventCs: 'Silný vítr',
    },
  );
  assert.match(wind.description, /gusts between 15 and 20 m\/s/);
  assert.match(wind.instruction, /Secure windows/);
  // The "no warning" blocks of every other hazard are not warnings.
  assert.deepEqual(parseCap(FIXTURES.capWind, '1100').warnings, []);
});

test('a real summer CAP file: heat (yellow then orange) and fire risk, no outlook', () => {
  const prague = parseCap(FIXTURES.capHeat, '1100');
  assert.deepEqual(
    prague.warnings.map((w) => [w.type, w.level, w.event]),
    [
      ['forest_fire', 1, 'Danger of Fires'],
      ['heat', 1, 'High Temperatures'],
      ['forest_fire', 1, 'Danger of Fires'],
      ['heat', 2, 'Very High Temperatures'],
    ],
  );
  assert.ok(!prague.warnings.some((w) => w.code === 'OUTLOOK'));
  assert.equal(prague.warnings[3].eventCs, 'Velmi vysoké teploty');
});

test('levels: the highest in force now, and the highest announced', () => {
  const { warnings } = parseCap(FIXTURES.capHeat, '1100');
  const at = (iso) => warningLevels(warnings, Date.parse(iso));
  assert.deepEqual(at('2025-07-01T09:00:00Z'), { now: 1, ahead: 2 });
  assert.deepEqual(at('2025-07-02T10:00:00Z'), { now: 2, ahead: 2 });
  assert.deepEqual(at('2025-07-03T10:00:00Z'), { now: 0, ahead: 0 });
  const ahead = warningsAhead(warnings, Date.parse('2025-07-01T09:00:00Z'));
  assert.equal(ahead[0].type, 'forest_fire', 'in force first');
});

test('a CAP file with entities and a red level', () => {
  const now = Date.parse('2026-11-17T15:00:00Z');
  const xml = makeCap({
    sent: now,
    warnings: [{ type: 'snow_ice', level: 3, start: now, end: now + 6 * HOUR }],
  });
  const [warning] = parseCap(xml, '2102').warnings;
  assert.deepEqual(
    [warning.type, warning.level, warning.description],
    ['snow_ice', 3, 'Description & details'],
  );
  assert.throws(() => parseCap('<html>404</html>', '2102'), /Not a CAP file/);
  // Without its English block, a warning is kept with its Czech name.
  const czechOnly = xml.replace(/<info>(?:(?!<\/info>)[\s\S])*?en-GB[\s\S]*?<\/info>/, '');
  const [kept] = parseCap(czechOnly, '2102').warnings;
  assert.deepEqual(
    [kept.type, kept.level, kept.event, kept.eventCs],
    ['snow_ice', 3, '', 'Výstraha snow_ice'],
  );
});

test('districts: 206 ORP, found from a point, a code or a name', () => {
  assert.equal(DISTRICTS.length, 206);
  assert.deepEqual(districtAt(50.0875, 14.4213), { code: '1100', name: 'Hlavní město Praha' });
  assert.deepEqual(districtAt(49.9638, 14.072), { code: '2102', name: 'Beroun' });
  assert.deepEqual(districtAt(49.1951, 16.6068), { code: '6203', name: 'Brno' });
  assert.equal(districtAt(48.2082, 16.3738), null, 'Vienna is not in Czechia');
  assert.deepEqual(findDistrict('ceske budejovice'), {
    code: '3102',
    name: 'České Budějovice',
  });
  assert.deepEqual(findDistrict(' 2102 '), { code: '2102', name: 'Beroun' });
  assert.equal(findDistrict('Praha').code, '1100');
  assert.equal(findDistrict('Atlantis'), null);
});
