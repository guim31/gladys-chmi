// -----------------------------------------------------------------------------
// The ORP districts of Czechia (206 "obce s rozšířenou působností"), the areas
// of the ČHMÚ warnings: finds the district of a point offline, from the
// simplified outlines of src/data/orp.json (built by scripts/build-orp.mjs
// from ČÚZK and ČSÚ open data, about 500 m of precision).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const DATA = JSON.parse(readFileSync(new URL('../data/orp.json', import.meta.url), 'utf8'));

/** @type {Array<{ code: string, name: string, rings: number[][] }>} */
export const DISTRICTS = DATA;

// A point outside every outline but this close to one (km) belongs to it: the
// outlines are simplified, a house on a border may fall just outside.
const BORDER_TOLERANCE_KM = 2;

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i];
    const yi = ring[i + 1];
    const xj = ring[j];
    const yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Distance in km from a point to the nearest vertex of a district (enough for
// a tolerance of a few km with vertices every few hundred meters).
function vertexDistance(district, lat, lon) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const ring of district.rings) {
    for (let i = 0; i < ring.length; i += 2) {
      const dx = (ring[i] / 10000 - lon) * kx;
      const dy = (ring[i + 1] / 10000 - lat) * 110.57;
      best = Math.min(best, Math.hypot(dx, dy));
    }
  }
  return best;
}

/**
 * The district of a point, or null outside Czechia.
 * @returns {{ code: string, name: string } | null}
 */
export function districtAt(lat, lon) {
  const x = Math.round(lon * 10000);
  const y = Math.round(lat * 10000);
  for (const district of DISTRICTS) {
    // Even-odd over every ring: holes (enclaves) count out.
    let inside = false;
    for (const ring of district.rings) {
      if (inRing(ring, x, y)) inside = !inside;
    }
    if (inside) {
      return { code: district.code, name: district.name };
    }
  }
  let nearest = null;
  for (const district of DISTRICTS) {
    const distance = vertexDistance(district, lat, lon);
    if (distance <= BORDER_TOLERANCE_KM && (!nearest || distance < nearest.distance)) {
      nearest = { code: district.code, name: district.name, distance };
    }
  }
  return nearest ? { code: nearest.code, name: nearest.name } : null;
}

const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * A district typed by the user: its 4-digit code, or its name with or without
 * diacritics ("Ceske Budejovice"). Prague answers to "Praha" too.
 */
export function findDistrict(text) {
  const wanted = fold(text);
  if (wanted === '') return null;
  const found =
    DISTRICTS.find((district) => district.code === wanted) ??
    DISTRICTS.find((district) => fold(district.name) === wanted) ??
    (wanted === 'praha' || wanted === 'prague' ? DISTRICTS.find((d) => d.code === '1100') : null);
  return found ? { code: found.code, name: found.name } : null;
}
