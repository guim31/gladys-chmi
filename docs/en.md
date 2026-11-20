# ČHMÚ Czech weather

The official weather of **Czechia** in Gladys, from **ČHMÚ** (Český hydrometeorologický ústav, the
Czech Hydrometeorological Institute): the readings of the nearest **weather station** and the
**official weather warnings** of your **ORP district** (wind, snow and ice, thunderstorms, heat,
cold, fire risk, rain, flooding…).

Open data: no account, no API key. This integration is not affiliated with ČHMÚ.

## Overview

- **Two devices**: the nearest station (temperature, humidity, pressure, wind, gusts, rain,
  sunshine) and the warnings of your district (level in force, highest level announced, list of
  warnings).
- **A scene trigger**, "New ČHMÚ warning", as soon as a warning is announced, often hours before
  it starts.
- **A dashboard widget** with the readings of the station and the warnings of the district.
- **Read-only**: ČHMÚ is a data source, nothing is controlled.

ČHMÚ issues its warnings for each of the **206 ORP districts** of Czechia (obce s rozšířenou
působností). The MeteoAlarm integration also shows Czech warnings, from the European feed; this
one reads the ČHMÚ files directly and adds the readings of the Czech stations.

## Requirements

- Gladys **5.3.0** or later.
- A place in **Czechia**.
- Your Gladys house located on the map (**Settings → Houses**), or coordinates, a station or a
  district typed in the configuration.
- Gladys must reach the Internet (`opendata.chmi.cz`).

## Configuration

Install the integration from **Integrations → Install from GitHub** (or from the store), then
open its configuration. Every field is optional: by default the integration takes the position of
your first located house, the station nearest to it, the district it lies in, and refreshes every
15 minutes.

| Field                         | Use                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| House                         | The house whose position is used. Empty: the first house that has a position.                                        |
| Latitude, Longitude           | Another place than a house, for example `50.08` and `14.42` (a comma works too). Both, or neither.                   |
| Weather station               | A ČHMÚ station, for example `0-20000-0-11518` or `P1PRUZ01` (Praha, Ruzyně). Empty: the nearest one.                 |
| Warning district              | The name (`Beroun`, with or without diacritics) or the 4-digit code (`2102`) of an ORP district. Empty: the place's. |
| Refresh interval              | 15, 30 or 60 minutes. ČHMÚ publishes the station readings once an hour.                                              |
| Language of the feature names | Language of the feature names (set when the devices are created) and of the scene event texts. French by default.    |

The house position is read through the Gladys `location` permission, shown when you install the
integration. It never leaves Gladys: the district is found inside the container, from the outlines
of the districts it carries, and only the station and district files are downloaded.

Then open the **Discovery** tab of the integration and add the two devices to Gladys.

## Devices

### Station

The name is "ČHMÚ" followed by the station name. Values of the last 10-minute observation:

| Feature                  | Unit | Note                                                     |
| ------------------------ | ---- | -------------------------------------------------------- |
| Temperature              | °C   | Air temperature, 2 m                                     |
| Humidity                 | %    |                                                          |
| Pressure (station level) | hPa  | At the altitude of the station, not reduced to sea level |
| Wind speed               | km/h | 10-minute mean                                           |
| Wind gusts               | km/h | Strongest gust of the last 10 minutes                    |
| Wind direction           | °    | Where the wind comes from: 0 = north, 90 = east          |
| Rain intensity           | mm/h | Rain of the last 10 minutes, as an hourly rate           |
| Sunshine (last 10 min)   | min  | 0 to 10                                                  |

The device only has the features the station measures (many stations have no barometer). ČHMÚ
publishes the 10-minute values **once an hour**: the readings are up to about 70 minutes old. A
station silent for more than 3 hours is not re-published as current.

### District

The name is "ČHMÚ" followed by the district name.

| Feature                   | Unit   | Note                                                                 |
| ------------------------- | ------ | -------------------------------------------------------------------- |
| Warning level now         | 0 to 3 | Highest level in force: 0 none, 1 yellow, 2 orange, 3 red            |
| Highest warning announced | 0 to 3 | Highest level of the warnings in force or announced                  |
| Weather warnings          | text   | The warnings in force or announced, e.g. "Orange · Wind → Tue 18:00" |

## Widget

**ČHMÚ weather** shows, in the language and units of the dashboard:

- the house (or district) name, then the temperature, humidity, wind and gusts of the station;
- the warnings in force (until when) and announced (from when), or a green "None" line;
- the source and the time of the observation.

Two settings of the widget hide the station readings or the warnings.

## Scene trigger

**New ČHMÚ warning** fires when ČHMÚ issues a warning for the district, or raises the level of
one, as soon as it is announced. ČHMÚ re-issues its warnings several times a day: a warning that
is only extended or re-issued does not fire again. A restart does not fire it again either, and
the very first start only takes note of the warnings already issued.

Filters (empty = any): **Warning types** (wind, snow and ice, thunderstorms, fog, heat, cold, fire
risk, rain, flooding, other hazard) and **Levels** (yellow, orange, red).

Information passed to the scene actions: warning type, level, level (1 to 3), official name (in
English and in Czech), start, end, already in force, level raised, official text and advice (in
English) and district. For example, a message: `ČHMÚ: {{triggerEvent.data.level_label}}
{{triggerEvent.data.type_label}} warning from {{triggerEvent.data.starts_at}} to
{{triggerEvent.data.ends_at}}`.

## Configuration actions

- **List the nearest stations**: the 8 stations nearest to the place, with their ids, altitude and
  distance, and the warning district of the place. Copy an id into "Weather station" to choose
  another one.
- **Check the connection**: reads every source now and says what answered: the station temperature
  and its time, the number of warnings. Shown in red when a source fails.

## Scene examples

- **Storm coming**: trigger "New ČHMÚ warning", types "Wind" and "Thunderstorms", levels "Orange"
  and "Red" → close the shutters, retract the awning, send a message with the start time.
- **Heat day**: when "Warning level now" becomes greater than or equal to 2 → close the
  south-facing shutters and send a reminder to drink.
- **Frost**: when the "Temperature" of the station drops below 0 °C → notify to protect the plants.

## Troubleshooting

- **"No location"**: no house has a position. Place your house on the map in **Settings →
  Houses**, or type coordinates, a station or a district.
- **"Outside Czechia"**: the place is in no Czech district. Type a district to follow anyway.
- **"ČHMÚ does not answer"**: Gladys cannot reach `opendata.chmi.cz`; the values are updated when
  it is back. The logs say which source fails, once, and when it works again.
- **A feature is missing**: the station does not measure it. Choose another station with
  **List the nearest stations**.
- **More details**: set the `LOG_LEVEL` variable of the container to `debug`.

## Limits

- **Data**: open data of ČHMÚ, licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
  ("Source: ČHMÚ", shown by the widget). District outlines: ČÚZK (RÚIAN) and ČSÚ, CC BY 4.0,
  simplified to about 500 m: near a district border, type the district.
- **Requests**: at each refresh, the CAP index (about 100 KB) and the station file, which only comes
  again when ČHMÚ rewrites it (once an hour, about 150 KB); the CAP file (1.5 to 2 MB) only when a
  new one is issued, a few times a day; the station list once a day. ČHMÚ publishes no limit.
- The observations are hourly batches of 10-minute values, not live readings.
- One place, one station and one district per installation. No forecast: ČHMÚ publishes none as
  open data for a point.
- The feature names are set when the devices are created: changing the language later does not
  rename them.
