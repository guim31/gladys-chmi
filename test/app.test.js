// -----------------------------------------------------------------------------
// The integration end to end: the SDK's fake Gladys, a simulated ČHMÚ server
// (recorded files), a controllable clock. Devices, states, the container's own
// refresh timer, the onPoll fallback, the "new warning" trigger, the actions,
// the logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MemoryStore } from '../src/store.js';
import { HEARTBEAT, WARNING_TRIGGER } from '../src/service.js';
import { NOW, issueCap } from './helpers/fakeChmi.js';
import { HOUSE, PRAGUE, createWorld, featureId } from './helpers/world.js';

const STATION = '0-203-0-11522'; // Neumětely, 12 km from HOUSE (Beroun)
const DISTRICT = '2102'; // Beroun
const HOUR = 3600 * 1000;
const MINUTE = 60 * 1000;

const stationFeature = (world, key) => featureId(world.gladys, 'station', STATION, key);
const districtFeature = (world, key) => featureId(world.gladys, 'district', DISTRICT, key);
const lastText = (world, featureExternalId) =>
  world.gladys.fake.states
    .filter((state) => state.device_feature_external_id === featureExternalId)
    .at(-1)?.text;

test('the house gives two devices: the nearest station, and the warnings of its district', async () => {
  const world = await createWorld();
  const devices = world.gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((device) => [device.name, device.external_id, device.model]),
    [
      ['ČHMÚ Neumětely', world.gladys.externalIds('station', STATION).device, 'Weather station'],
      ['ČHMÚ Beroun', world.gladys.externalIds('district', DISTRICT).device, 'Weather warnings'],
    ],
  );
  assert.ok(devices.every((device) => device.features.every((f) => f.read_only)));
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  // Nothing is published for devices not added to Gladys.
  assert.equal(world.gladys.fake.states.length, 0);
  await world.app.stop();
});

test('adding the devices publishes their states at once, from what was already read', async () => {
  const world = await createWorld();
  await world.createAll();
  const last = (key) => world.gladys.fake.lastState(key);
  assert.equal(last(stationFeature(world, 'temperature')), 6.5);
  assert.equal(last(stationFeature(world, 'humidity')), 90);
  assert.equal(last(stationFeature(world, 'wind_speed')), 16.2);
  assert.equal(last(stationFeature(world, 'wind_gust')), 26.6);
  // The wind warning of the recorded CAP file is in force (yellow).
  assert.equal(last(districtFeature(world, 'warning_level')), 1);
  assert.equal(last(districtFeature(world, 'upcoming_level')), 1);
  assert.equal(lastText(world, districtFeature(world, 'warnings')), 'Jaune · Vent → mer. 17:00');
  assert.ok(world.gladys.fake.widgetRefreshes.length > 0);
  await world.app.stop();
});

test('the states refresh on the container timer, without any onPoll from the core', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const world = await createWorld({ timers: true });
  await world.createAll();
  const before = world.chmi.count('observations');
  world.clock.now += 15 * MINUTE;
  t.mock.timers.tick(15 * MINUTE);
  await world.app.poller.idle;
  assert.equal(world.chmi.count('observations'), before + 1);
  const polls = world.gladys.fake.wsMessages.filter((message) => /poll/i.test(message.type));
  assert.equal(polls.length, 0, 'the core never polled');
  await world.app.stop();
});

test("the core's onPoll is a fallback: skipped after a recent refresh, used when the timer stalls", async () => {
  const world = await createWorld();
  await world.createAll();
  const [station] = world.gladys.fake.discoveredDevices;
  const before = world.chmi.count('observations');
  assert.deepEqual(await world.gladys.fake.poll(station), { success: true });
  assert.equal(world.chmi.count('observations'), before, 'refreshed recently: skipped');
  world.clock.now += 15 * MINUTE;
  await world.gladys.fake.poll(station);
  assert.equal(world.chmi.count('observations'), before + 1);
  await world.app.stop();
});

test('an unchanged observation file costs a 304; the CAP file is downloaded once per issue', async () => {
  const world = await createWorld();
  assert.equal(world.chmi.count('cap'), 1);
  await world.refresh(15);
  const conditional = world.chmi.requests.filter((r) => r.endpoint === 'observations').at(-1);
  assert.ok(conditional.headers['if-none-match'], 'If-None-Match sent');
  assert.equal(world.chmi.count('listing'), 2, 'the index is read every cycle');
  assert.equal(world.chmi.count('cap'), 1, 'the same CAP file is not downloaded again');
  issueCap(world.chmi, world.clock.now, []);
  await world.refresh(15);
  assert.equal(world.chmi.count('cap'), 2);
  await world.app.stop();
});

test('only the changes are published, and an unchanged value is re-sent every 6 hours', async (t) => {
  // The SDK dates its heartbeat with the system clock.
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const world = await createWorld();
  await world.createAll();
  const temperature = stationFeature(world, 'temperature');
  const count = () =>
    world.gladys.fake.states.filter((s) => s.device_feature_external_id === temperature).length;
  const first = count();
  await world.refresh(15);
  assert.equal(count(), first, 'same value: not re-sent');
  t.mock.timers.setTime(NOW + HEARTBEAT + HOUR);
  world.clock.now += HEARTBEAT;
  await world.refresh(1);
  assert.equal(count(), first + 1, 'heartbeat');
  await world.app.stop();
});

test('just after midnight UTC, the values come from yesterday’s file', async () => {
  const start = Date.parse('2026-11-18T00:20:00Z');
  const world = await createWorld({ connect: false, start });
  world.chmi.state.missingDays.add('20261118');
  await world.gladys.connect();
  await world.app.ready;
  await world.createAll();
  const days = world.chmi.requests
    .filter((r) => r.endpoint === 'observations')
    .map((r) => r.url.pathname.slice(-13, -5));
  assert.deepEqual(days, ['20261118', '20261117']);
  assert.equal(world.gladys.fake.lastState(stationFeature(world, 'temperature')), 6.5);
  // Today's metadata are missing too: yesterday's are used.
  assert.ok(world.chmi.requests.some((r) => /meta1-20261117/.test(r.url.pathname)));
  await world.app.stop();
});

test('a station silent for hours: its last values are not re-sent as current', async () => {
  const world = await createWorld();
  world.chmi.state.fail.observations = { status: 500 };
  world.clock.now += 4 * HOUR;
  await world.createAll();
  await world.refresh(15);
  assert.equal(world.gladys.fake.lastState(stationFeature(world, 'temperature')), undefined);
  await world.app.stop();
});

test('the first run only takes note of the warnings in force: no scene event', async () => {
  const world = await createWorld();
  assert.equal(world.gladys.fake.sceneEvents.length, 0);
  const saved = await world.store.load();
  assert.equal(saved.district, DISTRICT);
  assert.deepEqual(Object.keys(saved.seen), ['wind']);
  await world.app.stop();
});

test('a new warning fires once; extended or re-issued, it does not; a raised level fires again', async () => {
  const world = await createWorld();
  await world.createAll();
  const now = world.clock.now;
  // A thunderstorm warning is added to the wind warning.
  const wind = { type: 'wind', level: 1, start: now - 2 * HOUR, end: now + 25 * HOUR };
  const storm = { type: 'thunderstorm', level: 2, start: now + 3 * HOUR, end: now + 6 * HOUR };
  issueCap(world.chmi, now, [wind, storm]);
  await world.refresh(15);
  const events = world.gladys.fake.sceneEvents;
  assert.equal(events.length, 1);
  assert.equal(events[0].key, WARNING_TRIGGER);
  const data = events[0].data;
  assert.deepEqual(
    [data.warning_type, data.level, data.level_number, data.type_label, data.level_label],
    ['thunderstorm', 'orange', 2, 'Orages', 'Orange'],
  );
  assert.deepEqual([data.in_force, data.is_update, data.district], [false, false, 'Beroun']);
  assert.equal(data.event, 'Moderate thunderstorm warning');
  assert.equal(data.event_cs, 'Výstraha thunderstorm');
  assert.equal(data.description, 'Description & details');
  assert.equal(data.instruction, 'Stay inside.');
  assert.match(data.starts_at, /^\d\d:\d\d$/);
  assert.equal(world.gladys.fake.lastState(districtFeature(world, 'upcoming_level')), 2);
  assert.equal(world.gladys.fake.lastState(districtFeature(world, 'warning_level')), 1);

  // Re-issued with a later end: the same episode.
  issueCap(world.chmi, world.clock.now, [wind, { ...storm, end: now + 9 * HOUR }]);
  await world.refresh(15);
  assert.equal(world.gladys.fake.sceneEvents.length, 1);

  // Raised to red: fired again, as an update.
  issueCap(world.chmi, world.clock.now, [wind, { ...storm, level: 3, end: now + 9 * HOUR }]);
  await world.refresh(15);
  assert.equal(world.gladys.fake.sceneEvents.length, 2);
  const raised = world.gladys.fake.sceneEvents.at(-1).data;
  assert.deepEqual([raised.level, raised.is_update], ['red', true]);

  // Hours later it is in force.
  world.clock.now = now + 4 * HOUR;
  await world.refresh(1);
  assert.equal(world.gladys.fake.lastState(districtFeature(world, 'warning_level')), 3);

  // A new thunderstorm the next day, after a gap: a new episode.
  issueCap(world.chmi, world.clock.now, [
    wind,
    { type: 'thunderstorm', level: 1, start: now + 20 * HOUR, end: now + 22 * HOUR },
  ]);
  await world.refresh(15);
  assert.equal(world.gladys.fake.sceneEvents.length, 3);
  assert.deepEqual(
    [
      world.gladys.fake.sceneEvents.at(-1).data.level,
      world.gladys.fake.sceneEvents.at(-1).data.is_update,
    ],
    ['yellow', false],
  );
  await world.app.stop();
});

test('a restart does not fire again for the warnings already announced', async () => {
  const store = new MemoryStore();
  const first = await createWorld({ store });
  const now = first.clock.now;
  const storm = { type: 'thunderstorm', level: 1, start: now + HOUR, end: now + 3 * HOUR };
  issueCap(first.chmi, now, [storm]);
  await first.refresh(15);
  assert.equal(first.gladys.fake.sceneEvents.length, 1);
  await first.app.stop();

  const second = await createWorld({ store, connect: false, start: first.clock.now });
  issueCap(second.chmi, first.clock.now, [storm]);
  await second.gladys.connect();
  await second.app.ready;
  assert.equal(second.gladys.fake.sceneEvents.length, 0);
  await second.app.stop();
});

test('the trigger data match the filters and variables declared in the manifest', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
  );
  const [trigger] = manifest.scene_triggers;
  const world = await createWorld();
  const now = world.clock.now;
  issueCap(world.chmi, now, [
    { type: 'heat', level: 3, start: now, end: now + HOUR, districts: ['2102'] },
  ]);
  await world.refresh(15);
  const [event] = world.gladys.fake.sceneEvents;
  for (const field of trigger.fields) {
    const values = field.options.map((option) => option.value);
    assert.ok(values.includes(event.data[field.key]), `${field.key}: ${event.data[field.key]}`);
  }
  for (const variable of trigger.variables) {
    assert.ok(variable.key in event.data, `variable ${variable.key} missing`);
    const expected = variable.type === 'number' ? 'number' : variable.type;
    assert.equal(typeof event.data[variable.key], expected, variable.key);
  }
  await world.app.stop();
});

test('a normal refresh cycle writes nothing at info level, and never the home coordinates', async () => {
  const world = await createWorld();
  await world.createAll();
  const start = world.logs.lines.length;
  for (let i = 0; i < 4; i += 1) {
    await world.refresh(30);
  }
  issueCap(world.chmi, world.clock.now, []);
  await world.refresh(15);
  const cycle = world.logs.lines.slice(start);
  assert.ok(cycle.length > 0, 'the cycle logs at debug level');
  assert.deepEqual(
    cycle.filter((line) => line.level !== 'debug'),
    [],
  );
  for (const line of world.logs.lines) {
    for (const value of [String(HOUSE.latitude), String(HOUSE.longitude)]) {
      assert.ok(!line.text.includes(value), `"${line.text}" shows a coordinate`);
    }
  }
  await world.app.stop();
});

test('a ČHMÚ outage is logged once, its recovery once, and shown in the status', async () => {
  const world = await createWorld();
  const outage = new TypeError('fetch failed');
  world.chmi.state.fail = { observations: outage, listing: outage };
  await world.refresh(15);
  await world.refresh(15);
  await world.refresh(15);
  const warns = world.logs.at('warn');
  assert.equal(warns.length, 2, 'one line per source, not one per attempt');
  assert.ok(warns.every((line) => /unavailable \(.*fetch failed\)/.test(line.text)));
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.en, /does not answer/);
  assert.match(world.gladys.fake.connectionStatus.message.fr, /ne répond pas/);

  world.chmi.state.fail = {};
  await world.refresh(15);
  const infos = world.logs.at('info').filter((line) => /answers again/.test(line.text));
  assert.equal(infos.length, 2);
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  await world.app.stop();
});

test('ČHMÚ down at startup: retried at the next cycle, then the devices appear', async () => {
  const world = await createWorld({ connect: false });
  world.chmi.state.fail.metadata = { status: 503 };
  await world.gladys.connect();
  await world.app.ready;
  assert.equal(world.gladys.fake.discoveredDevices.length, 0);
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  world.chmi.state.fail = {};
  await world.refresh(15);
  assert.equal(world.gladys.fake.discoveredDevices.length, 2);
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  await world.app.stop();
});

test('configuration problems are reported in the status', async () => {
  const cases = [
    [{ houses: [] }, 'notConfigured'],
    [{ config: { latitude: '50,1', longitude: 'abc' } }, /latitude and longitude/],
    [{ config: { station_id: 'not a station!' } }, /0-20000-0-11518 or P1PRUZ01/],
    [{ config: { station_id: '0-20000-0-99999' } }, /not among the ČHMÚ stations/],
    [{ config: { district: 'Atlantis' } }, /206 Czech ORP districts/],
    [{ config: { house: 'gone' } }, /no longer exists/],
    [{ config: { latitude: '48.2082', longitude: '16.3738' } }, /outside Czechia/],
  ];
  for (const [options, expected] of cases) {
    const world = await createWorld(options);
    const status = world.gladys.fake.connectionStatus;
    assert.equal(status.connected, false, JSON.stringify(options));
    const pattern = typeof expected === 'string' ? /No location/ : expected;
    assert.match(status.message.en, pattern, JSON.stringify(options));
    assert.ok(status.message.de && status.message.es);
    await world.app.stop();
  }
});

test('a station or a district alone, without any house', async () => {
  const station = await createWorld({ houses: [], config: { station_id: 'P1PKLE01' } });
  assert.deepEqual(
    station.gladys.fake.discoveredDevices.map((d) => d.name),
    ['ČHMÚ Praha, Klementinum', 'ČHMÚ Hlavní město Praha'],
  );
  await station.app.stop();
  const district = await createWorld({ houses: [], config: { district: 'beroun' } });
  assert.deepEqual(
    district.gladys.fake.discoveredDevices.map((d) => d.name),
    ['ČHMÚ Beroun'],
  );
  assert.equal(district.chmi.count('metadata'), 0, 'no station list needed');
  await district.app.stop();
});

test('typed coordinates take precedence over the house; a chosen district over the location', async () => {
  const world = await createWorld({
    config: { latitude: '50,0875', longitude: '14,4213', district: '2102' },
  });
  assert.deepEqual(
    world.gladys.fake.discoveredDevices.map((d) => d.name),
    ['ČHMÚ Praha, Klementinum', 'ČHMÚ Beroun'],
  );
  await world.app.stop();
});

test('a configuration change re-reads everything for the new place', async () => {
  const world = await createWorld({ houses: [HOUSE, PRAGUE] });
  await world.gladys.fake.configUpdated({ house: 'praha' });
  await world.app.poller.idle;
  assert.ok(world.gladys.fake.discoveredDevices.some((d) => d.name === 'ČHMÚ Hlavní město Praha'));
  await world.app.stop();
});

test('a scan request publishes the devices again', async () => {
  const world = await createWorld();
  const before = world.gladys.fake.requests.length;
  await world.gladys.fake.scanRequest();
  assert.ok(world.gladys.fake.requests.length > before);
  await world.app.stop();
});

test('the "list the nearest stations" action: stations, distances and the district', async () => {
  const world = await createWorld({ houses: [HOUSE, PRAGUE], config: { house: 'praha' } });
  const ack = await world.gladys.fake.action('list_stations', {});
  assert.equal(ack.success, true);
  const lines = ack.data.message.fr.split('\n');
  assert.match(lines[0], /maison « Praha »/);
  assert.equal(lines[1], '0-203-0-11514 (P1PKLE01) Praha, Klementinum, 191 m — 0,3 km');
  assert.equal(lines.at(-2), 'District des alertes : Hlavní město Praha (1100).');
  assert.match(ack.data.message.de, /Kopiere eine ID/);
  await world.app.stop();

  // No location: a failure, in red, in every language.
  const nowhere = await createWorld({ houses: [] });
  const failed = await nowhere.gladys.fake.action('list_stations', {});
  assert.equal(failed.success, false);
  assert.match(failed.error.fr, /Aucun lieu/);
  assert.ok(failed.error.en && failed.error.de && failed.error.es);
  await nowhere.app.stop();
});

test('the "check the connection" action: green when every source answers, red otherwise', async () => {
  const world = await createWorld();
  const ack = await world.gladys.fake.action('check_connection', {});
  assert.equal(ack.success, true);
  assert.match(
    ack.data.message.en,
    /^ČHMÚ answers\. Neumětely: 6\.5 °C at \d\d:\d\d [AP]M\. 1 warning\(s\) in force or announced for Beroun\.$/,
  );
  assert.match(ack.data.message.fr, /6,5 °C/);

  world.chmi.state.fail.listing = { status: 500 };
  const failed = await world.gladys.fake.action('check_connection', {});
  assert.equal(failed.success, false);
  assert.match(failed.error.en, /Warnings failed: .*HTTP 500/);
  assert.match(failed.error.fr, /Alertes : échec/);

  const infos = world.logs.at('info').filter((line) => /Action: check/.test(line.text));
  assert.equal(infos.length, 2, 'one line per user action');
  await world.app.stop();

  const nowhere = await createWorld({ houses: [] });
  const none = await nowhere.gladys.fake.action('check_connection', {});
  assert.equal(none.success, false);
  assert.match(none.error.es, /Ningún lugar/);
  await nowhere.app.stop();
});

test('feature names follow the configured language', async () => {
  const world = await createWorld({ config: { language: 'de' } });
  const names = world.gladys.fake.discoveredDevices.flatMap((d) => d.features.map((f) => f.name));
  assert.ok(names.includes('Temperatur'));
  assert.ok(names.includes('Aktuelle Warnstufe'));
  await world.app.stop();
});

test('the test clock is fixed: nothing depends on the date of the day', () => {
  assert.equal(new Date(NOW).toISOString(), '2026-11-17T15:00:00.000Z');
});
