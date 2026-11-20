#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Builds src/data/orp.json: the 206 ORP districts of Czechia (správní obvody
// obcí s rozšířenou působností), the areas of the ČHMÚ weather warnings, with
// a simplified outline to find the district of a house offline.
//
//   node scripts/build-orp.mjs
//
// Sources (open data, CC BY 4.0):
//   - outlines: ČÚZK, RÚIAN map service, layer "ObecSRozsirenouPusobnosti",
//     generalized to about 500 m (0.005°) and rounded to 0.0001°;
//   - codes: ČSÚ code list 65 (CISORP), which maps the RÚIAN code to the
//     4-digit code used in the CAP files of ČHMÚ (`CISORP` geocode). Prague
//     is 1000 in the code list but 1100 in the CAP files.
//
// Output: [{ code, name, rings: [[lon1e4, lat1e4, lon1e4, lat1e4, ...], ...] }]
// sorted by code. A ring is a flat list of integers (degrees × 10 000).
// -----------------------------------------------------------------------------

import { writeFile } from 'node:fs/promises';

const RUIAN =
  'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/14/query?where=1%3D1' +
  '&outFields=kod,nazev&returnGeometry=true&outSR=4326&maxAllowableOffset=0.005' +
  '&geometryPrecision=4&f=geojson';
const CSU =
  'https://apl2.czso.cz/iSMS/do_cis_export?kodcis=65&typdat=0&cisjaz=203&format=2&separator=%2C';
// The CAP files of ČHMÚ code Prague 1100 (EMMA_ID CZ01100).
const CAP_CODE_OVERRIDES = { 1000: '1100' };

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) {
    throw new Error(`${new URL(url).host} answered HTTP ${response.status}`);
  }
  return response.text();
}

function parseCsv(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const split = (line) => [...line.matchAll(/"([^"]*)"|([^,]+)/g)].map((m) => m[1] ?? m[2]);
  const keys = split(header);
  return rows.map((row) => Object.fromEntries(split(row).map((value, i) => [keys[i], value])));
}

const codes = new Map();
for (const row of parseCsv(await get(CSU))) {
  codes.set(Number(row.kod_ruian), CAP_CODE_OVERRIDES[row.chodnota] ?? row.chodnota);
}

const geojson = JSON.parse(await get(RUIAN));
const scale = (value) => Math.round(value * 10000);
const districts = geojson.features.map((feature) => {
  const code = codes.get(feature.properties.kod);
  if (!code) {
    throw new Error(`No CISORP code for RÚIAN ${feature.properties.kod}`);
  }
  const { type, coordinates } = feature.geometry;
  const polygons = type === 'Polygon' ? [coordinates] : coordinates;
  return {
    code,
    name: feature.properties.nazev,
    // Every ring, holes included: the even-odd rule handles them.
    rings: polygons.flat().map((ring) => ring.flatMap(([lon, lat]) => [scale(lon), scale(lat)])),
  };
});
districts.sort((a, b) => a.code.localeCompare(b.code));
if (districts.length !== 206) {
  throw new Error(`Expected 206 ORP districts, got ${districts.length}`);
}

const target = new URL('../src/data/orp.json', import.meta.url);
await writeFile(target, `${JSON.stringify(districts)}\n`);
console.log(`${districts.length} districts written to src/data/orp.json`);
