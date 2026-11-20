// -----------------------------------------------------------------------------
// The dashboard widget "ČHMÚ weather": the station's readings and the warnings
// of the district. Built from what the last refresh read (no request of its
// own), in the language and the unit system of the dashboard: the core caches
// the content per language and units, pre-localizing it here is the expected
// design.
//
// Budget of the core: 8 components at most, 2 texts, 6 tiles, 1 status list.
// This content uses at most 7: heading, 4 tiles, status, caption.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { warningsAhead } from './chmi/model.js';
import { TEXT, WIDGET_TEXT, formatWhen, pickLanguage, warningLabel } from './i18n.js';

/** Widget key: forever. */
export const WIDGET_KEY = 'weather';

/** Widget settings keys: forever. */
export const WIDGET_SETTINGS = { SHOW_STATION: 'show_station', SHOW_WARNINGS: 'show_warnings' };

// Content lifetime: the data moves once an hour (observations) or a few times
// a day (warnings); the service also nudges the widget when it changed.
const TTL_SECONDS = 600;

const LEVEL_COLORS = {
  1: WIDGET_COLORS.WARNING,
  2: WIDGET_COLORS.WARNING,
  3: WIDGET_COLORS.DANGER,
};

const round = (value) => Math.round(value * 10) / 10;

/** Metric values, converted for a dashboard in US units. */
function unitsOf(units) {
  const us = units === 'us';
  return {
    temperature: (celsius) => (us ? round((celsius * 9) / 5 + 32) : celsius),
    temperatureUnit: us ? '°F' : '°C',
    speed: (kmh) => (us ? round(kmh / 1.609344) : kmh),
    speedUnit: us ? 'mph' : 'km/h',
  };
}

const textOnly = (text) => ({
  ttl_seconds: 60,
  components: [{ type: 'text', variant: 'body', text }],
});

// A boolean setting, true unless explicitly false (older dashboards have none).
const enabled = (settings, key) => settings?.[key] !== false && settings?.[key] !== 'false';

/**
 * @param {ReturnType<import('./service.js').createService>['snapshot']} snapshot
 * @param {{ language: string, units: string, now: number, timeZone?: string, settings?: object }} context
 */
export function buildWeatherContent(snapshot, { language, units, now, timeZone, settings }) {
  const lang = pickLanguage(language);
  const t = WIDGET_TEXT[lang];
  const { target, observation, warnings } = snapshot;
  if (!target || (!target.station && !target.district)) {
    return textOnly(
      target?.problem && TEXT[target.problem] ? TEXT[target.problem][lang] : t.notConfigured,
    );
  }
  const showStation = enabled(settings, WIDGET_SETTINGS.SHOW_STATION) && target.station;
  const showWarnings = enabled(settings, WIDGET_SETTINGS.SHOW_WARNINGS) && target.district;
  if ((!showStation || !observation) && (!showWarnings || !warnings)) {
    return textOnly(t.waiting);
  }
  const convert = unitsOf(units);
  const heading = target.place?.source === 'house' ? target.place.name : target.district?.name;
  const components = [
    {
      type: 'text',
      variant: 'heading',
      text: String(heading ?? target.station?.name ?? 'ČHMÚ').slice(0, 40),
    },
  ];

  if (showStation && observation) {
    const values = observation.values;
    const tile = (label, value, unit, icon) =>
      value === undefined ? null : { type: 'value', label, value, unit, icon };
    components.push(
      ...[
        tile(
          t.temperature,
          values.temperature === undefined ? undefined : convert.temperature(values.temperature),
          convert.temperatureUnit,
          'thermometer',
        ),
        tile(
          t.humidity,
          values.humidity === undefined ? undefined : Math.round(values.humidity),
          '%',
          'droplet',
        ),
        tile(
          t.wind,
          values.wind_speed === undefined ? undefined : convert.speed(values.wind_speed),
          convert.speedUnit,
          'wind',
        ),
        tile(
          t.gusts,
          values.wind_gust === undefined ? undefined : convert.speed(values.wind_gust),
          convert.speedUnit,
          'wind',
        ),
      ].filter(Boolean),
    );
  }

  if (showWarnings && warnings) {
    const ahead = warningsAhead(warnings.warnings, now);
    const items = ahead.slice(0, 6).map((warning) => {
      const inForce = warning.start <= now;
      const when = inForce ? warning.end : warning.start;
      return {
        label: warningLabel(warning, lang).slice(0, 40),
        value:
          when === null
            ? '…'
            : `${inForce ? t.until : t.from} ${formatWhen(when, lang, timeZone, now)}`.slice(0, 40),
        color: LEVEL_COLORS[warning.level],
        icon: 'alert-triangle',
      };
    });
    if (items.length === 0) {
      items.push({
        label: t.warnings,
        value: t.none,
        color: WIDGET_COLORS.SUCCESS,
        icon: 'check-circle',
      });
    }
    components.push({ type: 'status', items });
  }

  // Attribution asked by the licence of the data (CC BY 4.0).
  const time =
    showStation && observation?.time
      ? ` · ${formatWhen(observation.time, lang, timeZone, now)}`
      : '';
  components.push({ type: 'text', variant: 'caption', text: `${t.source}${time}` });
  return { ttl_seconds: TTL_SECONDS, components };
}
