export const ROAD_XS = [-36, 0, 36];
export const ROAD_ZS = [-36, 0, 36];
export const ROAD_HALF = 7;

export const WORLD = { minX: -72, maxX: 72, minZ: -50, maxZ: 70 };
export const WATER_Z = -54;

export const LOOP = [
  { x: -36, z: -36 },
  { x: 36, z: -36 },
  { x: 36, z: 36 },
  { x: -36, z: 36 },
];

export const PLAYER_SPAWN = { x: 0, z: 18 };
export const CLINIC = { x: -14, z: -46 };
export const CAR_PARK = { x: 16, z: -16 };

export const SPAWN_POINTS = [
  [-36, -36], [36, -36], [36, 36], [-36, 36],
  [0, -36], [0, 40], [-36, 0], [36, 0],
  [-50, 0], [50, 0], [0, -18], [-18, 36],
  [18, 36], [-36, 18], [36, -18], [54, 36],
];

export function onRoad(x, z, pad = 0) {
  const h = ROAD_HALF + pad;
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < h) return true;
  for (const rz of ROAD_ZS) if (Math.abs(z - rz) < h) return true;
  return false;
}
