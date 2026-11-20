// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a simulated ČHMÚ, a
// controllable clock, an in-memory /data and a recording logger, with the
// integration wired on top through registerHandlers.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MemoryStore } from '../../src/store.js';
import { NOW, TIME_ZONE, createFakeChmi } from './fakeChmi.js';

/** A house in Beroun (main square, public coordinates): ORP district 2102. */
export const HOUSE = {
  id: 'house-1',
  name: 'Maison',
  selector: 'maison',
  latitude: 49.9638,
  longitude: 14.072,
};

/** A second house in Prague (Old Town Square): ORP district 1100. */
export const PRAGUE = {
  id: 'house-2',
  name: 'Praha',
  selector: 'praha',
  latitude: 50.0875,
  longitude: 14.4213,
};

/** A logger that records every line, by level. */
export function createRecordingLogger() {
  const lines = [];
  const make = (name) => {
    const log =
      (level) =>
      (...args) =>
        lines.push({ level, name, text: args.map(String).join(' ') });
    return {
      debug: log('debug'),
      info: log('info'),
      warn: log('warn'),
      error: log('error'),
      child: (child) => make(`${name}:${child}`),
    };
  };
  return {
    logger: make('chmi'),
    lines,
    at: (level) => lines.filter((l) => l.level === level),
  };
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.houses]
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers]
 * @param {object} [options.store]
 * @param {number} [options.start] initial clock
 */
export async function createWorld({
  config = {},
  houses = [HOUSE],
  devices = [],
  connect = true,
  timers = false,
  store = new MemoryStore(),
  start = NOW,
} = {}) {
  const clock = { now: start };
  const now = () => clock.now;
  const chmi = createFakeChmi({ now });
  const gladys = createFakeGladys({ config, houses, devices });
  const recording = createRecordingLogger();
  const app = registerHandlers(gladys, {
    fetch: chmi.fetch,
    store,
    now,
    timers,
    logger: recording.logger,
    timeZone: TIME_ZONE,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  return {
    gladys,
    chmi,
    app,
    clock,
    store,
    logs: recording,
    /** Add every discovered device to Gladys, as the user would. */
    async createAll() {
      for (const device of gladys.fake.discoveredDevices) {
        await gladys.fake.deviceCreated(device);
      }
    },
    /** Move the clock and run one refresh cycle, as the timer would. */
    async refresh(minutes = 15) {
      clock.now += minutes * 60 * 1000;
      await app.poller.runNow();
    },
  };
}

export const featureId = (gladys, type, platformId, key) =>
  gladys.externalIds(type, platformId).feature(key);
