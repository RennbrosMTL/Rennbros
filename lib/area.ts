/**
 * The service area as geography: the coverage outline (PENDING the owner's
 * confirmation — see business.area.isPlaceholder) and a point for each town.
 * [longitude, latitude], WGS84.
 */
export type LngLat = [number, number];

/** Base the map is framed around (Sainte-Anne-de-Bellevue, mid-territory). */
export const center: LngLat = [-74.02, 45.4];

export const coverage: LngLat[] = [
  [-74.38, 45.52],
  [-74.05, 45.55],
  [-73.86, 45.53],
  [-73.7, 45.47],
  [-73.72, 45.4],
  [-73.95, 45.28],
  [-74.18, 45.21],
  [-74.42, 45.35],
  [-74.38, 45.52],
];

/** Town centres from OpenStreetMap place nodes (via Photon). */
export const townPoints: Record<string, LngLat> = {
  "Baie-D'Urfé": [-73.9154, 45.4174],
  Beaconsfield: [-73.8654, 45.429],
  Dorval: [-73.7511, 45.4453],
  Hudson: [-74.1508, 45.4645],
  "Île Bizard": [-73.8728, 45.4896],
  Kirkland: [-73.8648, 45.4529],
  "L'Île-Perrot": [-73.9533, 45.3833],
  "Notre-Dame-de-l'Île-Perrot": [-73.903, 45.3517],
  Pierrefonds: [-73.8472, 45.4955],
  Pincourt: [-73.9861, 45.3712],
  "Pointe-Claire": [-73.8067, 45.4567],
  Rigaud: [-74.302, 45.4794],
  "Saint-Lazare": [-74.136, 45.3996],
  "Sainte-Anne-de-Bellevue": [-73.9524, 45.4039],
  Senneville: [-73.9603, 45.4145],
  "Terrasse-Vaudreuil": [-73.9867, 45.3907],
  Valleyfield: [-74.1317, 45.2556],
  "Vaudreuil-Dorion": [-74.0255, 45.3972],
};

/** Ray casting: is a point inside the coverage ring? */
export function covered([x, y]: LngLat, ring: LngLat[] = coverage): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
