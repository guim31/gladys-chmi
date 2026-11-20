// -----------------------------------------------------------------------------
// Wires the Gladys SDK to the ČHMÚ service: handlers, configuration actions,
// widget, refresh timer. Everything external is injectable (fetch, store,
// clock, timers, logger) so the tests run the real wiring against the SDK's
// fake Gladys and recorded ČHMÚ files.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES, normalizeConfig } from './config.js';
import { createChmiClient } from './chmi/client.js';
import { warningsAhead } from './chmi/model.js';
import { ACTION_TEXT, ActionFailure, TEXT, formatNumber, formatWhen } from './i18n.js';
import { createPoller } from './poller.js';
import { createService } from './service.js';
import { Store } from './store.js';
import { WIDGET_KEY, buildWeatherContent } from './widgets.js';

/** Configuration action keys: forever. */
export const ACTIONS = { LIST_STATIONS: 'list_stations', CHECK: 'check_connection' };

const NEAREST_COUNT = 8;

/** The same message in every language. */
const everyLanguage = (build) => Object.fromEntries(LANGUAGES.map((lang) => [lang, build(lang)]));

/** Text of the "List the nearest stations" action; throws on a problem. */
export function nearestMessage(result) {
  if (result.problem) {
    throw new ActionFailure(TEXT[result.problem]);
  }
  return everyLanguage((lang) => {
    const t = ACTION_TEXT[lang];
    const where = result.place.source === 'house' ? t.yourHouse(result.place.name) : t.coordinates;
    return [
      t.nearest(where),
      ...result.stations.map((station) =>
        t.station({ ...station, distance: formatNumber(station.distance, lang) }),
      ),
      result.district ? t.district(result.district) : t.noDistrict,
      t.copy,
    ].join('\n');
  });
}

/**
 * Text of the "Check the connection" action: a success only when every
 * source configured answered; throws otherwise.
 */
export function checkMessage(result, { now, timeZone }) {
  const { target, errors } = result;
  if (errors.setup) {
    throw new ActionFailure(
      everyLanguage((lang) => ACTION_TEXT[lang].failed('ČHMÚ', errors.setup)),
    );
  }
  if (!target.station && !target.district) {
    throw new ActionFailure(TEXT[target.problem ?? 'notConfigured']);
  }
  const message = everyLanguage((lang) => {
    const t = ACTION_TEXT[lang];
    const parts = [];
    if (target.station) {
      const temperature = result.observation?.values.temperature;
      if (errors.observation) {
        parts.push(t.failed(t.stationPart, errors.observation));
      } else if (temperature === undefined) {
        parts.push(t.noObservation(target.station.name));
      } else {
        parts.push(
          t.observation(
            target.station.name,
            formatNumber(temperature, lang),
            formatWhen(result.observation.time, lang, timeZone, now),
          ),
        );
      }
    }
    if (target.district) {
      parts.push(
        errors.warnings
          ? t.failed(t.warningsPart, errors.warnings)
          : t.warningsCount(
              warningsAhead(result.warnings.warnings, now).length,
              target.district.name,
            ),
      );
    }
    const text = t.checkOk(parts.join(' '));
    return target.problem ? `${text} ${TEXT[target.problem][lang]}` : text;
  });
  if (errors.observation || errors.warnings || target.problem) {
    throw new ActionFailure(message);
  }
  return message;
}

/**
 * @param {object} gladys GladysIntegration (or the SDK's fake Gladys)
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {{ load: Function, save: Function }} [options.store]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the refresh timer
 * @param {object} [options.logger]
 * @param {string} [options.timeZone]
 */
export function registerHandlers(gladys, options = {}) {
  const now = options.now ?? (() => Date.now());
  const logger = options.logger ?? createLogger({ name: 'chmi' });
  // The supervisor injects TZ, the time zone of Gladys; undefined = the system's.
  const timeZone = options.timeZone ?? (process.env.TZ || undefined);
  const store = options.store ?? new Store('/data');
  let config = normalizeConfig(gladys.config ?? {});
  const getConfig = () => config;

  const client = createChmiClient({ fetch: options.fetch, logger: logger.child('http') });
  const service = createService({ gladys, client, store, logger, getConfig, now, timeZone });

  // The widget is nudged when what it shows changed, not after every refresh.
  let shown = null;
  const refreshWidget = () => {
    const next = JSON.stringify(service.snapshot());
    if (next !== shown) {
      shown = next;
      gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  };
  const poller = createPoller({
    gladys,
    service,
    getConfig,
    logger,
    now,
    timers: options.timers ?? true,
    onCycle: refreshWidget,
  });

  gladys.onScanRequest(() => service.publishDevices());

  gladys.onPoll(async (device) => {
    if (service.owns(device.external_id)) {
      await poller.pollFromCore(device);
    }
  });

  // A device just added (or updated): the SDK forgot what it had published
  // for it, and Gladys dropped the states sent before it existed.
  const sendAgain = async () => {
    await service.publishStates();
    gladys.requestWidgetRefresh(WIDGET_KEY);
  };
  gladys.onDeviceCreated(sendAgain);
  gladys.onDeviceUpdated(sendAgain);

  gladys.onAction(ACTIONS.LIST_STATIONS, async () => {
    logger.info('Action: list the nearest stations');
    let result;
    try {
      result = await service.nearest(NEAREST_COUNT);
    } catch (err) {
      throw new ActionFailure(
        everyLanguage((lang) => ACTION_TEXT[lang].failed('ČHMÚ', err.message)),
      );
    }
    return nearestMessage(result);
  });

  gladys.onAction(ACTIONS.CHECK, async () => {
    logger.info('Action: check the connection');
    const result = await service.check();
    refreshWidget();
    return checkMessage(result, { now: now(), timeZone });
  });

  gladys.onWidgetGet(WIDGET_KEY, async ({ language, units, settings }) =>
    buildWeatherContent(service.snapshot(), { language, units, settings, now: now(), timeZone }),
  );

  async function start() {
    service.reset();
    await poller.restart();
  }

  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('Configuration updated');
    config = normalizeConfig(newConfig);
    await start();
  });

  // The SDK logs the connection lifecycle itself (gladys-sdk).
  let ready = Promise.resolve();
  gladys.on('connected', async () => {
    ready = (async () => {
      try {
        config = normalizeConfig(await gladys.getConfig());
        await start();
      } catch (err) {
        logger.error(`Initialization failed (${err.message})`);
        await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
      }
    })();
    await ready;
  });

  return {
    service,
    poller,
    get ready() {
      return ready;
    },
    async stop() {
      poller.stop();
      await poller.idle;
    },
  };
}
