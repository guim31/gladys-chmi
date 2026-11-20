// -----------------------------------------------------------------------------
// The ČHMÚ service: where the data is read (location, station, district), when
// it is read, and what Gladys receives (devices, states, "new warning" scene
// events, the connection status).
//
// Pace of the sources, all public and without key (see docs, "Limits"):
//   - station metadata (about 520 KB): at setup, then once a day;
//   - observations of the station: every cycle (15 minutes by default), with
//     If-None-Match, so the file (about 150 KB) only comes once an hour, when
//     ČHMÚ rewrites it;
//   - warnings: the CAP directory index (about 100 KB) every cycle, and the
//     CAP file (1.5 to 2 MB) only when a new one is issued, a few times a day.
// -----------------------------------------------------------------------------

import { utcDay } from './chmi/client.js';
import { districtAt, findDistrict } from './chmi/districts.js';
import {
  EPISODE_GAP,
  WARNING_LEVEL_KEYS,
  findStation,
  latestCapFile,
  nearestStations,
  parseCap,
  parseObservation,
  parseStations,
  warningsAhead,
} from './chmi/model.js';
import { buildDevices, districtStates, stationStates } from './devices.js';
import { TEXT, WARNING_LEVEL_NAMES, WARNING_TYPE_NAMES, formatWhen } from './i18n.js';
import { createIssueLog } from './issues.js';

/** Scene trigger key: forever. */
export const WARNING_TRIGGER = 'warning_issued';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
export const METADATA_MAX_AGE = DAY;
// A station silent for this long is down: its last values are not re-sent.
// ČHMÚ publishes once an hour, values up to 70 minutes old.
export const OBSERVATION_MAX_AGE = 3 * HOUR;
// An unchanged value is re-sent this often, so Gladys never shows it as stale.
export const HEARTBEAT = 6 * HOUR;
// Announced episodes are remembered this long after their end.
const SEEN_RETENTION = 48 * HOUR;
// The nearest station is taken automatically only this close (km).
const MAX_STATION_DISTANCE = 40;

const formatCoordinates = (lat, lon) => `${lat.toFixed(2)}, ${lon.toFixed(2)}`;

/**
 * @param {object} options
 * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
 * @param {ReturnType<import('./chmi/client.js').createChmiClient>} options.client
 * @param {{ load: Function, save: Function }} options.store
 * @param {object} options.logger
 * @param {() => object} options.getConfig the current normalized config
 * @param {() => number} options.now
 * @param {string} [options.timeZone] IANA zone of Gladys (TZ), system zone if unset
 */
export function createService({ gladys, client, store, logger, getConfig, now, timeZone }) {
  const issues = createIssueLog(logger);
  let metadata = null; // { stations, at }
  let target = null; // { station, district, place, problem }
  let observation = null; // { data, url, etag }
  let warnings = null; // { file, sent, warnings }
  let seen; // { [type]: { level, end } }, undefined until loaded
  let lastStatus = null;
  // The last error of each failing source, for the check action.
  const lastErrors = new Map();

  async function loadMetadata() {
    if (metadata && now() - metadata.at < METADATA_MAX_AGE) {
      return metadata;
    }
    try {
      let files;
      try {
        files = await client.metadata(utcDay(now()));
      } catch (err) {
        // Today's files appear a minute after midnight UTC.
        if (err.status !== 404) throw err;
        files = await client.metadata(utcDay(now() - DAY));
      }
      metadata = { stations: parseStations(files.stations, files.elements), at: now() };
      issues.ok('metadata', 'Station list: ČHMÚ answers again');
    } catch (err) {
      issues.fail('metadata', `Station list unavailable (${err.message})`);
      // A stale list stays better than none.
      if (!metadata) {
        throw err;
      }
    }
    return metadata;
  }

  /** The location of the house, or a configuration problem. */
  async function resolveLocation(config) {
    if (config.coordinatesInvalid) {
      return { problem: 'coordinatesInvalid' };
    }
    if (config.latitude !== null) {
      return {
        place: {
          lat: config.latitude,
          lon: config.longitude,
          name: formatCoordinates(config.latitude, config.longitude),
          source: 'coordinates',
        },
      };
    }
    const houses = await gladys.getHouses();
    const located = houses.filter(
      (house) =>
        typeof house.latitude === 'number' &&
        typeof house.longitude === 'number' &&
        Number.isFinite(house.latitude) &&
        Number.isFinite(house.longitude),
    );
    const house = config.house
      ? located.find((candidate) => candidate.selector === config.house)
      : located[0];
    if (config.house && !house) {
      return { problem: 'houseNotFound' };
    }
    return house
      ? { place: { lat: house.latitude, lon: house.longitude, name: house.name, source: 'house' } }
      : { place: null };
  }

  /**
   * Work out the station and the district from the config, then publish the
   * devices. Throws when ČHMÚ or Gladys does not answer (retried at the next
   * cycle); a configuration problem is reported in `target.problem`.
   */
  async function setup() {
    const config = getConfig();
    const empty = (problem) => ({ station: null, district: null, place: null, problem });
    if (config.stationIdInvalid) {
      target = empty('stationIdInvalid');
      return target;
    }
    let district = null;
    if (config.district) {
      district = findDistrict(config.district);
      if (!district) {
        target = empty('districtUnknown');
        return target;
      }
    }
    const location = await resolveLocation(config);
    if (location.problem) {
      target = empty(location.problem);
      return target;
    }
    const { place } = location;
    if (!place && !config.stationId && !district) {
      target = empty('notConfigured');
      return target;
    }
    let problem = null;
    let station = null;
    if (config.stationId || place) {
      const { stations } = await loadMetadata();
      if (config.stationId) {
        station = findStation(stations, config.stationId);
        if (!station) problem = 'stationUnknown';
      } else {
        const [nearest] = nearestStations(stations, place.lat, place.lon, 1);
        station = nearest && nearest.distance <= MAX_STATION_DISTANCE ? nearest : null;
      }
    }
    if (!district) {
      const point = place ?? station;
      district = point ? districtAt(point.lat, point.lon) : null;
      if (!district && place) problem = problem ?? 'outsideArea';
    }
    target = { station, district, place, problem };
    logger.info(
      `Ready: ${station ? `station ${station.id} ${station.name}` : 'no station'}, ` +
        `${district ? `warnings of district ${district.code} ${district.name}` : 'no warnings'}` +
        `${problem ? ` (${problem})` : ''}`,
    );
    await gladys.publishDiscoveredDevices(
      buildDevices(gladys, { ...target, language: config.language }),
    );
    return target;
  }

  async function readObservation() {
    const { station } = target;
    const fetchDay = async (time) => {
      const day = utcDay(time);
      const key = `${station.id}/${day}`;
      const etag = observation?.key === key ? observation.etag : undefined;
      const answer = await client.observations(station.id, day, etag);
      if (answer.json === undefined) {
        logger.debug(`Station ${station.id}: file unchanged`);
        return observation.data;
      }
      const data = parseObservation(answer.json);
      observation = { key, etag: answer.etag, data };
      return data;
    };
    try {
      const data = await fetchDay(now());
      if (data.time !== null && now() - data.time < OBSERVATION_MAX_AGE) return data;
    } catch (err) {
      // The file of a new UTC day appears at its first hourly run.
      if (err.status !== 404) throw err;
    }
    // Shortly after midnight UTC, the latest values are in yesterday's file.
    return fetchDay(now() - DAY);
  }

  async function readWarnings() {
    const { district } = target;
    const latest = latestCapFile(await client.capListing());
    if (!latest) {
      throw new Error('no CAP file in the ČHMÚ index');
    }
    const file = `${latest.name}@${latest.time}`;
    if (warnings?.file === file && warnings.district === district.code) {
      return warnings;
    }
    const parsed = parseCap(await client.capFile(latest.name), district.code);
    warnings = { file, district: district.code, ...parsed };
    logger.debug(`CAP ${latest.name}: ${parsed.warnings.length} warning(s) for ${district.code}`);
    return warnings;
  }

  /** Run one source, logging a lasting failure once; resolves true on success. */
  async function attempt(key, label, read) {
    try {
      await read();
      lastErrors.delete(key);
      issues.ok(key, `${label}: ČHMÚ answers again`);
      return true;
    } catch (err) {
      lastErrors.set(key, err.message);
      issues.fail(key, `${label} unavailable (${err.message})`);
      return false;
    }
  }

  async function reportStatus(connected, message) {
    const next = JSON.stringify({ connected, message });
    if (next === lastStatus) {
      return;
    }
    lastStatus = next;
    await gladys.setConnectionStatus(connected, message);
  }

  /** The states of the devices the user added to Gladys. */
  function currentStates() {
    if (!target) {
      return [];
    }
    const config = getConfig();
    const created = new Set((gladys.devices ?? []).map((device) => device.external_id));
    const states = [];
    const { station, district } = target;
    if (
      station &&
      observation &&
      created.has(gladys.externalIds('station', station.id).device) &&
      observation.data.time !== null &&
      now() - observation.data.time < OBSERVATION_MAX_AGE
    ) {
      states.push(...stationStates(gladys, station, observation.data));
    }
    if (
      district &&
      warnings?.district === district.code &&
      created.has(gladys.externalIds('district', district.code).device)
    ) {
      states.push(
        ...districtStates(gladys, district, warnings.warnings, {
          now: now(),
          language: config.language,
          timeZone,
        }),
      );
    }
    return states.filter(Boolean);
  }

  async function publishStates() {
    const states = currentStates();
    if (states.length === 0) {
      return;
    }
    const result = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT });
    logger.debug(`${result.count} state(s) published`);
  }

  /**
   * Fire the scene trigger for each new warning episode: a warning of a type
   * that had no warning in progress (or ended more than an hour before), or
   * whose level rose. A CAP file is a full picture re-issued several times a
   * day: a warning merely extended or re-issued is the same episode, not a new
   * event. The very first run only takes note: a fresh install does not fire
   * for the warnings issued before it.
   */
  async function announceWarnings() {
    if (!warnings || warnings.district !== target?.district?.code) {
      return;
    }
    if (seen === undefined) {
      const saved = await store.load();
      seen = saved?.district === warnings.district ? (saved.seen ?? null) : null;
    }
    const baseline = seen === null;
    const next = { ...(seen ?? {}) };
    const fresh = [];
    for (const warning of warningsAhead(warnings.warnings, now()).sort(
      (a, b) => a.start - b.start,
    )) {
      const end = warning.end ?? now() + DAY;
      const previous = next[warning.type];
      const newEpisode = !previous || previous.end < warning.start - EPISODE_GAP;
      if (newEpisode || warning.level > previous.level) {
        fresh.push({ warning, update: !newEpisode });
      }
      next[warning.type] = newEpisode
        ? { level: warning.level, end }
        : { level: Math.max(warning.level, previous.level), end: Math.max(end, previous.end) };
    }
    for (const [type, entry] of Object.entries(next)) {
      if (entry.end < now() - SEEN_RETENTION) {
        delete next[type];
      }
    }
    const changed = JSON.stringify(next) !== JSON.stringify(seen);
    seen = next;
    if (changed) {
      await store
        .save({ district: warnings.district, seen })
        .catch((err) => issues.fail('store', `Cannot write /data (${err.message})`));
    }
    if (baseline) {
      logger.debug(`${fresh.length} warning(s) noted, first run: no scene event`);
      return;
    }
    const language = getConfig().language;
    for (const { warning, update } of fresh) {
      const levelKey = WARNING_LEVEL_KEYS[warning.level - 1];
      logger.info(`New warning: ${levelKey} ${warning.type}${update ? ' (level raised)' : ''}`);
      await gladys
        .publishSceneEvent(WARNING_TRIGGER, {
          warning_type: warning.type,
          level: levelKey,
          level_number: warning.level,
          type_label: WARNING_TYPE_NAMES[language][warning.type],
          level_label: WARNING_LEVEL_NAMES[language][levelKey],
          event: warning.event.slice(0, 200),
          event_cs: warning.eventCs.slice(0, 200),
          starts_at: formatWhen(warning.start, language, timeZone, now()),
          ends_at: warning.end === null ? '' : formatWhen(warning.end, language, timeZone, now()),
          in_force: warning.start <= now(),
          is_update: update,
          description: warning.description.slice(0, 1000),
          instruction: warning.instruction.slice(0, 1000),
          district: target.district.name,
        })
        .catch((err) => logger.error(`Scene event refused (${err.message})`));
    }
  }

  return {
    /** Forget everything read: the config changed. */
    reset() {
      target = null;
      observation = null;
      warnings = null;
      seen = undefined;
      lastStatus = null;
    },

    /**
     * One refresh: setup if needed, read the sources, publish the states,
     * announce the new warnings, report the status.
     * @returns {Promise<boolean>} whether a source answered
     */
    async cycle() {
      if (!target) {
        try {
          await setup();
        } catch (err) {
          lastErrors.set('setup', err.message);
          issues.fail('setup', `Setup failed (${err.message})`);
          await reportStatus(false, TEXT.unreachable);
          return false;
        }
        lastErrors.delete('setup');
        issues.ok('setup', 'Setup done: ČHMÚ answers again');
      } else if (metadata && now() - metadata.at >= METADATA_MAX_AGE) {
        await loadMetadata().catch(() => {});
      }
      const { station, district, problem } = target;
      if (!station && !district) {
        await reportStatus(false, TEXT[problem ?? 'notConfigured']);
        return false;
      }
      const results = [];
      if (station) {
        results.push(await attempt('observation', `Station ${station.id}`, readObservation));
      }
      if (district) {
        results.push(await attempt('warnings', 'Warnings', readWarnings));
      }
      await publishStates();
      await announceWarnings();
      const anyOk = results.some(Boolean);
      if (problem) {
        await reportStatus(false, TEXT[problem]);
      } else {
        await reportStatus(anyOk, anyOk ? undefined : TEXT.unreachable);
      }
      return anyOk;
    },

    publishStates,

    /** Publish the devices again (a scan request). */
    async publishDevices() {
      if (target) {
        await gladys.publishDiscoveredDevices(
          buildDevices(gladys, { ...target, language: getConfig().language }),
        );
      }
    },

    /** Whether a device belongs to the current target. */
    owns(externalId) {
      if (!target) {
        return false;
      }
      return buildDevices(gladys, { ...target, language: getConfig().language }).some(
        (device) => device.external_id === externalId,
      );
    },

    /** Everything the widget shows. */
    snapshot() {
      return {
        target,
        observation:
          observation?.data.time && now() - observation.data.time < OBSERVATION_MAX_AGE
            ? observation.data
            : null,
        warnings: warnings?.district === target?.district?.code ? warnings : null,
      };
    },

    /** The `count` nearest stations to the location, and its district. */
    async nearest(count) {
      const config = getConfig();
      const location = await resolveLocation(config);
      if (location.problem || !location.place) {
        return { problem: location.problem ?? 'notConfigured' };
      }
      const { place } = location;
      const { stations } = await loadMetadata();
      return {
        place,
        district: districtAt(place.lat, place.lon),
        stations: nearestStations(stations, place.lat, place.lon, count).map((station) => ({
          ...station,
          distance: Math.round(station.distance * 10) / 10,
          altitude: station.altitude === null ? '?' : Math.round(station.altitude),
        })),
      };
    },

    /** Read every source now (configuration action). */
    async check() {
      target = null;
      lastStatus = null;
      lastErrors.clear();
      await this.cycle();
      return {
        target,
        observation: this.snapshot().observation,
        warnings: this.snapshot().warnings,
        errors: Object.fromEntries(lastErrors),
      };
    },
  };
}
