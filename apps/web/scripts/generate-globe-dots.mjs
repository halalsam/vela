// Builds public/geo/globe-dots.json: land sampled into evenly spaced dots, each tagged with its catalog continent.
// The destinations page globe draws these and lights up one continent at a time.
// Run after changing the spacing or the continent rules:  node scripts/generate-globe-dots.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoBounds, geoCentroid, geoContains } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const topology = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));
const countries = feature(topology, topology.objects.countries).features;

// Same keys as the catalog's regions (packages/api schemas). Order is the index stored with each dot.
const CONTINENTS = ['asia', 'europe', 'gulf', 'americas', 'africa', 'oceania'];

// ISO 3166-1 numeric ids. Gulf matches the catalog's Gulf area (apps/server catalog geo.ts):
// UAE, Bahrain, Israel, Iraq, Jordan, Kuwait, Lebanon, Oman, Palestine, Qatar, Saudi Arabia, Yemen.
const GULF = new Set(['784', '048', '376', '368', '400', '414', '422', '512', '275', '634', '682', '887']);
// Middle East outside the catalog's Gulf area: Syria and Iran. Their centroids fall in the Europe and Africa boxes'
// reach, so they're pinned to Asia (the destinations page lights Gulf with Asia, so the region reads as one).
const ASIA = new Set(['760', '364']);

/** Continent from the country's centroid. Coarse boxes, but each country lands whole in one group. */
function continentOf(country) {
  if (GULF.has(country.id)) return 'gulf';
  if (ASIA.has(country.id)) return 'asia';
  const [lng, lat] = geoCentroid(country);
  if (lng < -25 && lng > -170) return 'americas';
  if (lng > 110 && (lat < -10 || lng > 140)) return 'oceania';
  if (lng < -170) return 'oceania'; // Pacific islands across the antimeridian
  if (lat > 35 && lng > -30 && lng < 45) return 'europe';
  if (lat < 37.5 && lng > -20 && lng < 52 && (lng < 34.5 || lat < 18)) return 'africa';
  if (lat < -60) return 'oceania'; // Antarctica, kept out of the way: no catalog continent lights it
  return 'asia';
}

const tagged = countries
  .filter((country) => country.id !== '010')
  .map((country) => {
    // Bounding box first: geoContains is slow, and most countries can be ruled out by a box test.
    // Boxes that wrap the antimeridian (west > east) are always tested properly.
    const [[west, south], [east, north]] = geoBounds(country);
    return { country, continent: continentOf(country), west, south, east, north };
  });
const inBox = (row, lng, lat) => lat >= row.south && lat <= row.north && (row.west > row.east || (lng >= row.west && lng <= row.east));

// Even spacing on the sphere: fixed latitude step, longitude step widened toward the poles.
const STEP = 1.5;
const dots = [];
for (let lat = -58; lat <= 84; lat += STEP) {
  const lngStep = STEP / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  for (let lng = -180; lng < 180; lng += lngStep) {
    const hit = tagged.find((row) => inBox(row, lng, lat) && geoContains(row.country, [lng, lat]));
    if (hit) dots.push(Math.round(lat * 100) / 100, Math.round(lng * 100) / 100, CONTINENTS.indexOf(hit.continent));
  }
}

const out = new URL('../public/geo/globe-dots.json', import.meta.url);
writeFileSync(out, JSON.stringify({ continents: CONTINENTS, dots }));

const counts = Object.fromEntries(CONTINENTS.map((name, index) => [name, dots.filter((_, i) => i % 3 === 2 && dots[i] === index).length]));
console.log(`${dots.length / 3} dots`, counts);
// Spot-check a few countries so a rule change can't silently move them.
for (const [id, name] of [
  ['792', 'Türkiye'],
  ['818', 'Egypt'],
  ['643', 'Russia'],
  ['360', 'Indonesia'],
  ['598', 'Papua New Guinea'],
  ['304', 'Greenland'],
  ['364', 'Iran'],
  ['887', 'Yemen'],
  ['376', 'Israel'],
  ['400', 'Jordan'],
  ['760', 'Syria'],
  ['368', 'Iraq'],
  ['242', 'Fiji'],
  ['232', 'Eritrea'],
]) {
  const row = tagged.find(({ country }) => country.id === id);
  console.log(`  ${name}: ${row ? row.continent : 'not in data'}`);
}
