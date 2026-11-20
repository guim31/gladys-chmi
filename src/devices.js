// -----------------------------------------------------------------------------
// The two devices of the integration, and the states they publish.
//
//   - station: the 10-minute observations of one ČHMÚ station (external id
//     from its WIGOS id, e.g. 0-20000-0-11518). Its features are the elements
//     the station measures (a station without a barometer has no pressure);
//   - district: the ČHMÚ warnings of one ORP district (external id from its
//     4-digit CISORP code, e.g. 1100 for Prague).
//
// Feature keys are forever (Gladys keys history, scenes and dashboards on
// them). Everything is read-only: ČHMÚ is a data source, nothing to drive.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { stationFeatureKeys, warningLevels, warningsAhead } from './chmi/model.js';
import { DISTRICT_DEVICE_NAME, FEATURE_NAMES, TEXT, formatWhen, warningLabel } from './i18n.js';

/** Device types (first part of the external ids): forever. */
export const DEVICE_TYPES = { STATION: 'station', DISTRICT: 'district' };

const sensor = (category, type, unit, min, max) => ({ category, type, unit, min, max });

/** Features of the station device, by key: forever. */
export const STATION_FEATURES = {
  temperature: sensor(C.TEMPERATURE_SENSOR, 'decimal', U.CELSIUS, -50, 50),
  humidity: sensor(C.HUMIDITY_SENSOR, 'decimal', U.PERCENT, 0, 100),
  // At the station's altitude (up to 1 600 m): not reduced to sea level.
  pressure: sensor(C.PRESSURE_SENSOR, 'decimal', U.HECTO_PASCAL, 800, 1100),
  wind_speed: sensor(C.SPEED_SENSOR, 'decimal', U.KILOMETER_PER_HOUR, 0, 250),
  wind_gust: sensor(C.SPEED_SENSOR, 'decimal', U.KILOMETER_PER_HOUR, 0, 250),
  wind_direction: sensor(C.ANGLE_SENSOR, 'integer', U.DEGREE, 0, 360),
  rain_rate: sensor(C.PRECIPITATION_SENSOR, 'decimal', U.MILLIMETER_PER_HOUR, 0, 200),
  sunshine: sensor(C.DURATION, 'decimal', U.MINUTES, 0, 10),
};

const level = { category: C.RISK, type: 'integer', min: 0, max: 3 };

/** Features of the district device, by key: forever. */
export const DISTRICT_FEATURES = {
  warning_level: level,
  upcoming_level: level,
  warnings: { category: C.TEXT, type: 'text', min: 0, max: 0 },
};

function buildFeatures(ids, keys, definitions, language) {
  return keys.map((key) => {
    const definition = definitions[key];
    return {
      name: FEATURE_NAMES[language][key],
      external_id: ids.feature(key),
      category: definition.category,
      type: definition.type,
      ...(definition.unit ? { unit: definition.unit } : {}),
      // Display bounds of the gauges; the core never clamps a state on them.
      min: definition.min,
      max: definition.max,
      read_only: true,
      has_feedback: false,
      keep_history: true,
    };
  });
}

/**
 * The devices to publish. Polling: the container refreshes the data itself
 * (src/poller.js); the core's onPoll, once a minute, is only a fallback.
 * @param {object} gladys
 * @param {{ station: object | null, district: { code: string, name: string } | null, language: string }} target
 */
export function buildDevices(gladys, { station, district, language }) {
  const devices = [];
  if (station) {
    const ids = gladys.externalIds(DEVICE_TYPES.STATION, station.id);
    devices.push({
      name: `ČHMÚ ${station.name}`,
      external_id: ids.device,
      model: 'Weather station',
      should_poll: true,
      poll_frequency: 60000,
      features: buildFeatures(ids, stationFeatureKeys(station), STATION_FEATURES, language),
      params: [
        { name: 'station_id', value: station.id },
        { name: 'altitude', value: String(station.altitude ?? '') },
      ],
    });
  }
  if (district) {
    const ids = gladys.externalIds(DEVICE_TYPES.DISTRICT, district.code);
    devices.push({
      name: DISTRICT_DEVICE_NAME[language](district.name),
      external_id: ids.device,
      model: 'Weather warnings',
      should_poll: true,
      poll_frequency: 60000,
      features: buildFeatures(ids, Object.keys(DISTRICT_FEATURES), DISTRICT_FEATURES, language),
      params: [{ name: 'district_code', value: district.code }],
    });
  }
  return devices;
}

const state = (ids, key, value) =>
  value === null || value === undefined
    ? null
    : { device_feature_external_id: ids.feature(key), state: value };

/** States of the station device from an observation (values already converted). */
export function stationStates(gladys, station, observation) {
  const ids = gladys.externalIds(DEVICE_TYPES.STATION, station.id);
  return stationFeatureKeys(station)
    .map((key) => state(ids, key, observation.values[key]))
    .filter(Boolean);
}

/** One line per warning not over yet, the ones in force first. */
export function warningsSummary(warnings, now, language, timeZone) {
  const ahead = warningsAhead(warnings, now);
  if (ahead.length === 0) {
    return null;
  }
  return ahead
    .map((warning) => {
      const end = warning.end === null ? '…' : formatWhen(warning.end, language, timeZone, now);
      const when =
        warning.start <= now
          ? `→ ${end}`
          : `${formatWhen(warning.start, language, timeZone, now)} → ${end}`;
      return `${warningLabel(warning, language)} ${when}`;
    })
    .join(' | ');
}

/** States of the district device. */
export function districtStates(gladys, district, warnings, { now, language, timeZone }) {
  const ids = gladys.externalIds(DEVICE_TYPES.DISTRICT, district.code);
  const levels = warningLevels(warnings, now);
  const summary = warningsSummary(warnings, now, language, timeZone) ?? TEXT.noWarning[language];
  return [
    state(ids, 'warning_level', levels.now),
    state(ids, 'upcoming_level', levels.ahead),
    { device_feature_external_id: ids.feature('warnings'), text: summary.slice(0, 250) },
  ];
}
