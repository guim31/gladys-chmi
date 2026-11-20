# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- ČHMÚ in Gladys: the official Czech weather, from the open data of the Czech Hydrometeorological
  Institute, no account and no key.
- A station device with the 10-minute readings of the nearest ČHMÚ weather station (or a chosen
  one), published every hour: temperature, humidity, pressure, wind, gusts, wind direction, rain
  intensity and sunshine, as measured by the station.
- A district device with the official warnings of the ORP district of the house (or a chosen
  one): the level in force, the highest level announced, and the list of warnings.
- A "New ČHMÚ warning" scene trigger, filtered by type and level, with the official texts.
- A "ČHMÚ weather" dashboard widget with the station readings and the warnings.
- Configuration actions to list the nearest stations and the district, and to check the
  connection.
- Texts and documentation in English, French, German and Spanish.
