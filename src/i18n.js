// -----------------------------------------------------------------------------
// Every text the integration produces, in the four languages of the Gladys
// interface: English, French, German (informal "du") and Spanish (formal
// "usted"). Feature names follow the `language` of the configuration (they are
// frozen once the device is created); widget texts follow the language of the
// dashboard. test/i18n.test.js checks every table.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

/** Feature names, by language then feature key. */
export const FEATURE_NAMES = {
  en: {
    temperature: 'Temperature',
    humidity: 'Humidity',
    pressure: 'Pressure (station level)',
    wind_speed: 'Wind speed',
    wind_gust: 'Wind gusts',
    wind_direction: 'Wind direction',
    rain_rate: 'Rain intensity',
    sunshine: 'Sunshine (last 10 min)',
    warning_level: 'Warning level now',
    upcoming_level: 'Highest warning announced',
    warnings: 'Weather warnings',
  },
  fr: {
    temperature: 'Température',
    humidity: 'Humidité',
    pressure: 'Pression (à la station)',
    wind_speed: 'Vitesse du vent',
    wind_gust: 'Rafales',
    wind_direction: 'Direction du vent',
    rain_rate: 'Intensité de pluie',
    sunshine: 'Ensoleillement (10 dernières min)',
    warning_level: 'Vigilance en cours',
    upcoming_level: 'Vigilance la plus haute annoncée',
    warnings: 'Alertes météo',
  },
  de: {
    temperature: 'Temperatur',
    humidity: 'Luftfeuchtigkeit',
    pressure: 'Luftdruck (Stationshöhe)',
    wind_speed: 'Windgeschwindigkeit',
    wind_gust: 'Windböen',
    wind_direction: 'Windrichtung',
    rain_rate: 'Regenintensität',
    sunshine: 'Sonnenschein (letzte 10 min)',
    warning_level: 'Aktuelle Warnstufe',
    upcoming_level: 'Höchste angekündigte Warnstufe',
    warnings: 'Wetterwarnungen',
  },
  es: {
    temperature: 'Temperatura',
    humidity: 'Humedad',
    pressure: 'Presión (en la estación)',
    wind_speed: 'Velocidad del viento',
    wind_gust: 'Ráfagas',
    wind_direction: 'Dirección del viento',
    rain_rate: 'Intensidad de lluvia',
    sunshine: 'Insolación (últimos 10 min)',
    warning_level: 'Nivel de alerta actual',
    upcoming_level: 'Nivel de alerta más alto anunciado',
    warnings: 'Alertas meteorológicas',
  },
};

/** Warning types (keys of src/chmi/model.js), by language. */
export const WARNING_TYPE_NAMES = {
  en: {
    wind: 'Wind',
    snow_ice: 'Snow, ice',
    thunderstorm: 'Thunderstorms',
    fog: 'Fog',
    heat: 'Heat',
    cold: 'Cold',
    forest_fire: 'Fire risk',
    rain: 'Rain',
    flood: 'Flooding',
    other: 'Other hazard',
  },
  fr: {
    wind: 'Vent',
    snow_ice: 'Neige, verglas',
    thunderstorm: 'Orages',
    fog: 'Brouillard',
    heat: 'Canicule',
    cold: 'Grand froid',
    forest_fire: 'Risque d’incendie',
    rain: 'Pluie',
    flood: 'Inondation',
    other: 'Autre phénomène',
  },
  de: {
    wind: 'Wind',
    snow_ice: 'Schnee, Glätte',
    thunderstorm: 'Gewitter',
    fog: 'Nebel',
    heat: 'Hitze',
    cold: 'Kälte',
    forest_fire: 'Brandgefahr',
    rain: 'Regen',
    flood: 'Hochwasser',
    other: 'Sonstige Gefahr',
  },
  es: {
    wind: 'Viento',
    snow_ice: 'Nieve, hielo',
    thunderstorm: 'Tormentas',
    fog: 'Niebla',
    heat: 'Calor',
    cold: 'Frío',
    forest_fire: 'Riesgo de incendio',
    rain: 'Lluvia',
    flood: 'Inundación',
    other: 'Otro fenómeno',
  },
};

/** Warning levels, by language. */
export const WARNING_LEVEL_NAMES = {
  en: { yellow: 'Yellow', orange: 'Orange', red: 'Red' },
  fr: { yellow: 'Jaune', orange: 'Orange', red: 'Rouge' },
  de: { yellow: 'Gelb', orange: 'Orange', red: 'Rot' },
  es: { yellow: 'Amarilla', orange: 'Naranja', red: 'Roja' },
};

/** Fixed messages, each a multi-language object. */
export const TEXT = {
  noWarning: {
    en: 'No warning',
    fr: 'Aucune alerte',
    de: 'Keine Warnung',
    es: 'Ninguna alerta',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les journaux de l'intégration.",
    de: 'Die Initialisierung ist fehlgeschlagen, sieh in den Protokollen der Integration nach.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  notConfigured: {
    en: 'No location: set the position of a Gladys house, or type coordinates, a station or a district.',
    fr: 'Aucun lieu : placez une maison Gladys sur la carte, ou saisissez des coordonnées, une station ou un district.',
    de: 'Kein Ort: Lege die Position eines Gladys-Zuhauses fest oder gib Koordinaten, eine Station oder einen Bezirk ein.',
    es: 'Ningún lugar: defina la posición de una casa de Gladys, o escriba coordenadas, una estación o un distrito.',
  },
  coordinatesInvalid: {
    en: 'The latitude and longitude are not readable: type two numbers, such as 50.08 and 14.42.',
    fr: 'Latitude et longitude illisibles : saisissez deux nombres, comme 50,08 et 14,42.',
    de: 'Breiten- und Längengrad sind nicht lesbar: Gib zwei Zahlen ein, etwa 50,08 und 14,42.',
    es: 'La latitud y la longitud no son legibles: escriba dos números, como 50,08 y 14,42.',
  },
  stationIdInvalid: {
    en: 'The station id looks like 0-20000-0-11518 or P1PRUZ01: use the "List the nearest stations" action.',
    fr: "L'identifiant de station ressemble à 0-20000-0-11518 ou P1PRUZ01 : utilisez l'action « Lister les stations proches ».",
    de: 'Die Stations-ID sieht aus wie 0-20000-0-11518 oder P1PRUZ01: Nutze die Aktion „Nächste Stationen anzeigen“.',
    es: 'El identificador de estación es como 0-20000-0-11518 o P1PRUZ01: use la acción «Listar las estaciones cercanas».',
  },
  stationUnknown: {
    en: 'This station id is not among the ČHMÚ stations: use the "List the nearest stations" action.',
    fr: "Cet identifiant ne correspond à aucune station du ČHMÚ : utilisez l'action « Lister les stations proches ».",
    de: 'Diese ID gehört zu keiner ČHMÚ-Station: Nutze die Aktion „Nächste Stationen anzeigen“.',
    es: 'Este identificador no corresponde a ninguna estación del ČHMÚ: use la acción «Listar las estaciones cercanas».',
  },
  districtUnknown: {
    en: 'This district is not one of the 206 Czech ORP districts: type its 4-digit code or its name, or leave it empty.',
    fr: "Ce district n'est pas l'un des 206 ORP tchèques : saisissez son code à 4 chiffres ou son nom, ou laissez vide.",
    de: 'Dieser Bezirk ist keiner der 206 tschechischen ORP-Bezirke: Gib seinen 4-stelligen Code oder Namen ein, oder lass das Feld leer.',
    es: 'Este distrito no es uno de los 206 distritos ORP checos: escriba su código de 4 cifras o su nombre, o déjelo vacío.',
  },
  houseNotFound: {
    en: 'The chosen house no longer exists or has no position: pick it again, or set its position in Gladys.',
    fr: "La maison choisie n'existe plus ou n'a pas de position : choisissez-la de nouveau, ou placez-la dans Gladys.",
    de: 'Das gewählte Zuhause gibt es nicht mehr oder es hat keine Position: Wähle es erneut oder lege seine Position in Gladys fest.',
    es: 'La casa elegida ya no existe o no tiene posición: elíjala de nuevo, o defina su posición en Gladys.',
  },
  outsideArea: {
    en: 'This location is outside Czechia: the ČHMÚ warnings cover the Czech districts only.',
    fr: 'Ce lieu est hors de Tchéquie : les alertes du ČHMÚ ne couvrent que les districts tchèques.',
    de: 'Dieser Ort liegt außerhalb Tschechiens: Die ČHMÚ-Warnungen gelten nur für tschechische Bezirke.',
    es: 'Este lugar está fuera de Chequia: las alertas del ČHMÚ solo cubren los distritos checos.',
  },
  unreachable: {
    en: 'ČHMÚ does not answer: the values will be updated when it is back.',
    fr: 'Le ČHMÚ ne répond pas : les valeurs seront mises à jour à son retour.',
    de: 'Der ČHMÚ antwortet nicht: Die Werte werden aktualisiert, sobald der Dienst zurück ist.',
    es: 'El ČHMÚ no responde: los valores se actualizarán cuando vuelva.',
  },
};

/** Texts of the widget, by language. */
export const WIDGET_TEXT = {
  en: {
    humidity: 'Humidity',
    wind: 'Wind',
    gusts: 'Gusts',
    temperature: 'Temperature',
    warnings: 'Warnings',
    none: 'None',
    until: 'until',
    from: 'from',
    source: 'Source: ČHMÚ (CC BY 4.0)',
    notConfigured: 'Set the location in the integration configuration.',
    waiting: 'Waiting for the first ČHMÚ data…',
  },
  fr: {
    humidity: 'Humidité',
    wind: 'Vent',
    gusts: 'Rafales',
    temperature: 'Température',
    warnings: 'Alertes',
    none: 'Aucune',
    until: "jusqu'à",
    from: 'à partir de',
    source: 'Source : ČHMÚ (CC BY 4.0)',
    notConfigured: "Indiquez le lieu dans la configuration de l'intégration.",
    waiting: 'En attente des premières données du ČHMÚ…',
  },
  de: {
    humidity: 'Feuchte',
    wind: 'Wind',
    gusts: 'Böen',
    temperature: 'Temperatur',
    warnings: 'Warnungen',
    none: 'Keine',
    until: 'bis',
    from: 'ab',
    source: 'Quelle: ČHMÚ (CC BY 4.0)',
    notConfigured: 'Lege den Ort in der Konfiguration der Integration fest.',
    waiting: 'Warte auf die ersten ČHMÚ-Daten…',
  },
  es: {
    humidity: 'Humedad',
    wind: 'Viento',
    gusts: 'Ráfagas',
    temperature: 'Temperatura',
    warnings: 'Alertas',
    none: 'Ninguna',
    until: 'hasta',
    from: 'desde',
    source: 'Fuente: ČHMÚ (CC BY 4.0)',
    notConfigured: 'Indique el lugar en la configuración de la integración.',
    waiting: 'Esperando los primeros datos del ČHMÚ…',
  },
};

/** Texts of the configuration actions, by language. */
export const ACTION_TEXT = {
  en: {
    nearest: (where) => `Nearest ČHMÚ stations to ${where}:`,
    station: (s) => `${s.id} (${s.code}) ${s.name}, ${s.altitude} m — ${s.distance} km`,
    district: (d) => `Warning district: ${d.name} (${d.code}).`,
    noDistrict: 'No Czech warning district at this location.',
    copy: 'Copy an id into "Station" and save, or leave it empty for the nearest one.',
    checkOk: (parts) => `ČHMÚ answers. ${parts}`,
    observation: (name, value, time) => `${name}: ${value} °C at ${time}.`,
    noObservation: (name) => `${name}: no recent value.`,
    warningsCount: (count, district) =>
      `${count} warning(s) in force or announced for ${district}.`,
    failed: (what, reason) => `${what} failed: ${reason}.`,
    stationPart: 'Station',
    warningsPart: 'Warnings',
    yourHouse: (name) => `the house “${name}”`,
    coordinates: 'the configured coordinates',
  },
  fr: {
    nearest: (where) => `Stations du ČHMÚ les plus proches de ${where} :`,
    station: (s) => `${s.id} (${s.code}) ${s.name}, ${s.altitude} m — ${s.distance} km`,
    district: (d) => `District des alertes : ${d.name} (${d.code}).`,
    noDistrict: "Aucun district d'alerte tchèque à cet endroit.",
    copy: 'Copiez un identifiant dans « Station » et enregistrez, ou laissez vide pour la plus proche.',
    checkOk: (parts) => `Le ČHMÚ répond. ${parts}`,
    observation: (name, value, time) => `${name} : ${value} °C à ${time}.`,
    noObservation: (name) => `${name} : aucune valeur récente.`,
    warningsCount: (count, district) =>
      `${count} alerte(s) en cours ou annoncée(s) pour ${district}.`,
    failed: (what, reason) => `${what} : échec (${reason}).`,
    stationPart: 'Station',
    warningsPart: 'Alertes',
    yourHouse: (name) => `la maison « ${name} »`,
    coordinates: 'les coordonnées saisies',
  },
  de: {
    nearest: (where) => `Nächste ČHMÚ-Stationen – ${where}:`,
    station: (s) => `${s.id} (${s.code}) ${s.name}, ${s.altitude} m — ${s.distance} km`,
    district: (d) => `Warnbezirk: ${d.name} (${d.code}).`,
    noDistrict: 'Kein tschechischer Warnbezirk an diesem Ort.',
    copy: 'Kopiere eine ID in „Station“ und speichere, oder lass das Feld leer für die nächste.',
    checkOk: (parts) => `Der ČHMÚ antwortet. ${parts}`,
    observation: (name, value, time) => `${name}: ${value} °C um ${time}.`,
    noObservation: (name) => `${name}: kein aktueller Wert.`,
    warningsCount: (count, district) =>
      `${count} Warnung(en) aktiv oder angekündigt für ${district}.`,
    failed: (what, reason) => `${what} fehlgeschlagen: ${reason}.`,
    stationPart: 'Station',
    warningsPart: 'Warnungen',
    yourHouse: (name) => `Zuhause „${name}“`,
    coordinates: 'eingegebene Koordinaten',
  },
  es: {
    nearest: (where) => `Estaciones del ČHMÚ más cercanas a ${where}:`,
    station: (s) => `${s.id} (${s.code}) ${s.name}, ${s.altitude} m — ${s.distance} km`,
    district: (d) => `Distrito de las alertas: ${d.name} (${d.code}).`,
    noDistrict: 'Ningún distrito de alerta checo en este lugar.',
    copy: 'Copie un identificador en «Estación» y guarde, o déjelo vacío para la más cercana.',
    checkOk: (parts) => `El ČHMÚ responde. ${parts}`,
    observation: (name, value, time) => `${name}: ${value} °C a las ${time}.`,
    noObservation: (name) => `${name}: ningún valor reciente.`,
    warningsCount: (count, district) =>
      `${count} alerta(s) en vigor o anunciada(s) para ${district}.`,
    failed: (what, reason) => `${what}: error (${reason}).`,
    stationPart: 'Estación',
    warningsPart: 'Alertas',
    yourHouse: (name) => `la casa «${name}»`,
    coordinates: 'las coordenadas indicadas',
  },
};

/**
 * An action that failed: Gladys shows in red what a handler throws, in green
 * what it returns. The message is the multi-language object.
 */
export class ActionFailure extends Error {
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

/** The language to use, English for anything Gladys may send we do not know. */
export const pickLanguage = (language) => (LANGUAGES.includes(language) ? language : 'en');

/** A decimal number with the separator of the language: 8.6 → "8,6" in French. */
export const formatNumber = (value, language, digits = 1) =>
  new Intl.NumberFormat(pickLanguage(language), { maximumFractionDigits: digits }).format(value);

/** "Orange · Wind" */
export function warningLabel(warning, language) {
  const lang = pickLanguage(language);
  const level = WARNING_LEVEL_NAMES[lang][['', 'yellow', 'orange', 'red'][warning.level]];
  return `${level} · ${WARNING_TYPE_NAMES[lang][warning.type] ?? WARNING_TYPE_NAMES[lang].other}`;
}

/** A short local date and time: "Tue 18:00" in the Gladys time zone. */
export function formatWhen(time, language, timeZone, now) {
  const lang = pickLanguage(language);
  const sameDay =
    new Date(time).toLocaleDateString('en-CA', { timeZone }) ===
    new Date(now).toLocaleDateString('en-CA', { timeZone });
  return new Intl.DateTimeFormat(lang, {
    timeZone,
    ...(sameDay ? {} : { weekday: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}
