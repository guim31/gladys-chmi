// The "ČHMÚ weather" widget: within the core budget (the SDK's own validator),
// localized, in metric and US units, with its blocks that can be hidden, and
// honest when data is missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from '../src/widgets.js';
import { NOW, issueCap } from './helpers/fakeChmi.js';
import { createWorld } from './helpers/world.js';

const HOUR = 3600 * 1000;
const get = async (world, language = 'en', units = 'metric', settings = {}) => {
  const ack = await world.gladys.fake.widgetGet(WIDGET_KEY, { language, units, settings });
  assert.equal(ack.success, true);
  return ack.data.content;
};
const ofType = (content, type) => content.components.filter((c) => c.type === type);

test('the full content fits the budget in every language and unit system', async () => {
  const world = await createWorld();
  const now = world.clock.now;
  issueCap(world.chmi, now, [
    { type: 'wind', level: 1, start: now - HOUR, end: now + 5 * HOUR },
    { type: 'thunderstorm', level: 2, start: now + 6 * HOUR, end: now + 9 * HOUR },
    { type: 'rain', level: 3, start: now - 2 * HOUR, end: now + 2 * HOUR },
  ]);
  await world.refresh(15);
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const units of ['metric', 'us']) {
      const content = await get(world, language, units);
      assert.deepEqual(validateWidgetContent(content), [], `${language}/${units}`);
      assert.ok(content.components.length <= 8);
      assert.ok(ofType(content, 'text').length <= 2);
    }
  }
  const content = await get(world, 'fr');
  assert.equal(content.components[0].text, 'Maison');
  assert.deepEqual(
    ofType(content, 'value').map((tile) => [tile.label, tile.value, tile.unit]),
    [
      ['Température', 6.5, '°C'],
      ['Humidité', 90, '%'],
      ['Vent', 16.2, 'km/h'],
      ['Rafales', 26.6, 'km/h'],
    ],
  );
  const [status] = ofType(content, 'status');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.color]),
    [
      ['Rouge · Pluie', 'danger'],
      ['Jaune · Vent', 'warning'],
      ['Orange · Orages', 'warning'],
    ],
  );
  assert.match(status.items[1].value, /^jusqu'à \d\d:\d\d$/);
  assert.match(status.items[2].value, /^à partir de \d\d:\d\d$/);
  assert.match(ofType(content, 'text').at(-1).text, /^Source : ČHMÚ \(CC BY 4\.0\) · \d\d:\d\d$/);
  await world.app.stop();
});

test('US units: Fahrenheit and mph', async () => {
  const world = await createWorld();
  const tiles = ofType(await get(world, 'en', 'us'), 'value');
  assert.deepEqual(
    tiles.map((tile) => [tile.value, tile.unit]),
    [
      [43.7, '°F'],
      [90, '%'],
      [10.1, 'mph'],
      [16.5, 'mph'],
    ],
  );
  await world.app.stop();
});

test('no warning: one green line', async () => {
  const world = await createWorld();
  issueCap(world.chmi, world.clock.now, []);
  await world.refresh(15);
  const [status] = ofType(await get(world, 'de'), 'status');
  assert.deepEqual(status.items, [
    { label: 'Warnungen', value: 'Keine', color: 'success', icon: 'check-circle' },
  ]);
  await world.app.stop();
});

test('each block can be hidden by a widget setting', async () => {
  const world = await createWorld();
  const noStation = await get(world, 'en', 'metric', { show_station: false });
  assert.equal(ofType(noStation, 'value').length, 0);
  assert.equal(ofType(noStation, 'status').length, 1);
  assert.equal(ofType(noStation, 'text').at(-1).text, 'Source: ČHMÚ (CC BY 4.0)');
  const noWarnings = await get(world, 'en', 'metric', { show_warnings: false });
  assert.equal(ofType(noWarnings, 'status').length, 0);
  assert.equal(ofType(noWarnings, 'value').length, 4);
  const nothing = await get(world, 'en', 'metric', { show_station: false, show_warnings: false });
  assert.deepEqual(validateWidgetContent(nothing), []);
  assert.equal(ofType(nothing, 'value').length + ofType(nothing, 'status').length, 0);
  await world.app.stop();
});

test('not configured, or nothing read yet: a sentence instead of an empty card', async () => {
  const nowhere = await createWorld({ houses: [] });
  const content = await get(nowhere, 'es');
  assert.match(content.components[0].text, /Ningún lugar/);
  await nowhere.app.stop();

  const down = await createWorld({ connect: false });
  down.chmi.state.fail = { observations: { status: 500 }, listing: { status: 500 } };
  await down.gladys.connect();
  await down.app.ready;
  assert.match((await get(down, 'fr')).components[0].text, /En attente des premières données/);
  await down.app.stop();
});

test('a refresh that changes what the widget shows nudges it; an identical one does not', async (t) => {
  // The SDK spaces the nudges by 10 s of the system clock.
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const world = await createWorld();
  const before = world.gladys.fake.widgetRefreshes.length;
  t.mock.timers.setTime(NOW + 15 * 60 * 1000);
  await world.refresh(15);
  assert.equal(world.gladys.fake.widgetRefreshes.length, before, 'nothing new');
  issueCap(world.chmi, world.clock.now, []);
  t.mock.timers.setTime(NOW + 30 * 60 * 1000);
  await world.refresh(15);
  assert.equal(world.gladys.fake.widgetRefreshes.length, before + 1);
  await world.app.stop();
});
