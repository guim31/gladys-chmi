# ČHMÚ Czech weather for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration for **ČHMÚ** (Český
hydrometeorologický ústav, the Czech Hydrometeorological Institute): the readings of the nearest
Czech weather station and the official weather warnings of your ORP district, from the ČHMÚ open
data. No account, no API key.

This integration is not affiliated with ČHMÚ.

## Features

- **Station device**: temperature, humidity, pressure (at the station), wind speed, gusts, wind
  direction, rain intensity and sunshine of the nearest ČHMÚ station (or a chosen one), from the
  10-minute observations ČHMÚ publishes every hour. Only the elements the station measures.
- **District device**: the warning level in force (0 to 3), the highest level announced, and the
  list of warnings in force or announced, for the ORP district of the house (one of the 206
  districts ČHMÚ issues its warnings for), or a chosen one.
- **Scene trigger** "New ČHMÚ warning": fires once per warning episode as soon as it is announced,
  and again when its level rises; filters by type (wind, snow and ice, thunderstorms, fog, heat,
  cold, fire risk, rain, flooding, other) and level (yellow, orange, red). The official texts
  (English and Czech names, description, advice) are passed to the scene.
- **Dashboard widget** "ČHMÚ weather": the station readings and the warnings, in the language and
  units of the dashboard; each block can be hidden.
- **Configuration actions**: list the nearest stations and the district of the place, check the
  connection.
- Texts in English, French, German and Spanish.

Compared with the MeteoAlarm integration, which also shows Czech warnings from the European feed,
this one reads the ČHMÚ files directly, finds the district of the house offline, passes the Czech
names and the advice to the scenes, and adds the station readings.

## Requirements

- Gladys Assistant **5.3.0** or later.
- A place in Czechia: a Gladys house located on the map, or coordinates, a station or a district
  typed in the configuration.
- Internet access to `opendata.chmi.cz`.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter the address of this repository:

```
https://github.com/guim31/gladys-chmi
```

Then open the configuration of the integration (every field is optional), and add the two devices
from its **Discovery** tab. The full user documentation is in [docs/en.md](docs/en.md)
([fr](docs/fr.md), [de](docs/de.md), [es](docs/es.md)).

## How it works

- **Stations**: the station list (`climate/now/metadata/meta1` and `meta2`, once a day) gives the
  position and the elements of each station; the nearest one measuring temperature, humidity and
  wind is taken. Its file of the day (`climate/now/data/10m-<station>-<YYYYMMDD>.json`) is read at
  each refresh with `If-None-Match`: ČHMÚ rewrites it once an hour, the other requests cost a 304.
- **Warnings**: the CAP directory (`weather/alerts/cap/`) holds one file per issue, each a full
  picture of the country (1.5 to 2 MB). The index is read at each refresh, and the newest
  `alert_cap_50_*` file is downloaded only when a new one appears. The warnings of the district
  are those whose `CISORP` geocode is its code; the "no warning" blocks and the hazard outlook are
  left out.
- **District of the house**: found in the container from the outlines of the 206 ORP districts
  (`src/data/orp.json`, about 190 KB, built by `scripts/build-orp.mjs` from ČÚZK and ČSÚ open
  data). The position of the house never leaves Gladys.
- **Refresh**: the container refreshes on its own timer (15, 30 or 60 minutes); the core's polling
  is only a fallback.

## Limits

- The observations come in hourly batches: a value is up to about 70 minutes old.
- No forecast: ČHMÚ publishes none for a point as open data.
- The district outlines are simplified to about 500 m: near a border, type the district.
- One place, one station and one district per installation.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
node scripts/probe.mjs 50.08 14.42                       # read the real ČHMÚ data for a point
node scripts/probe.mjs 49.96 14.07 --station P1PRUZ01 --district Beroun
node scripts/build-orp.mjs                              # rebuild src/data/orp.json
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and real ČHMÚ files recorded in `test/fixtures` (see
its README); they never touch the network.

## Credits

- [ČHMÚ](https://www.chmi.cz) for the open data ([opendata.chmi.cz](https://opendata.chmi.cz/)),
  licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- [ČÚZK](https://www.cuzk.cz) (RÚIAN) for the outlines of the ORP districts, and
  [ČSÚ](https://www.czso.cz) for the code list linking them to the codes of the warnings, both CC BY
  4.0.
- The cover shows the official logo of ČHMÚ, taken from [chmi.cz](https://www.chmi.cz); it belongs
  to ČHMÚ and is used here only to identify the data source.

## License

[Apache-2.0](LICENSE)
