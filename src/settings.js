import { clamp } from './math.js';

const PRESET_PATHS = new Set([
  'gameplay.enemyCount',
  'gameplay.enemyHealth',
  'gameplay.enemyDamage',
  'gameplay.enemyAggression',
  'combat.playerDamage',
]);

const PRESETS = {
  easy: { enemyCount: 4, enemyHealth: 0.7, enemyDamage: 0.6, enemyAggression: 0.72, playerDamage: 1.25 },
  normal: { enemyCount: 6, enemyHealth: 1, enemyDamage: 1, enemyAggression: 1, playerDamage: 1 },
  hard: { enemyCount: 8, enemyHealth: 1.5, enemyDamage: 1.4, enemyAggression: 1.32, playerDamage: 0.85 },
};

export const DEFAULTS = {
  gameplay: {
    difficulty: 'normal',
    enemyCount: 6,
    enemyHealth: 1,
    enemyDamage: 1,
    enemyAggression: 1,
    heatEnabled: true,
    heatDecay: 1,
    traffic: true,
    trafficDamage: 1,
    gameSpeed: 1,
    playerVitality: 120,
    infiniteStamina: false,
    tutorial: true,
    showMinimap: true,
    rotateMinimap: false,
    colorblind: false,
  },
  combat: {
    playerDamage: 1,
    comboWindow: 0.48,
    dodgeIFrames: 0.28,
    hitStop: 0.045,
    knockback: 1,
    shake: 1,
    magnet: 0.65,
    staminaRegen: 1,
    blockChip: 0.16,
    damageNumbers: true,
    sparks: true,
    trails: true,
    enemyArmor: true,
  },
  camera: {
    fov: 68,
    distance: 5.4,
    height: 1.55,
    shoulder: 0.62,
    sensitivity: 1,
    invertY: false,
    lag: 0.28,
    collision: true,
    zoom: true,
    bob: 0.45,
  },
  graphics: {
    quality: 'high',
    shadows: true,
    fog: 0.55,
    timeOfDay: 'dusk',
    vignette: true,
    contactShadows: true,
  },
  audio: {
    mute: false,
    master: 0.8,
    sfx: 0.9,
    music: 0.42,
  },
};

export const SCHEMA = [
  {
    id: 'gameplay',
    label: 'Gameplay',
    blurb: 'Who is on the street, and how the district pushes back.',
    items: [
      { type: 'select', path: 'gameplay.difficulty', label: 'Difficulty', wide: true, help: 'Presets rewrite health, damage, aggression, and crowd size. Custom keeps your numbers.', options: [
        { id: 'easy', label: 'Easy' }, { id: 'normal', label: 'Normal' }, { id: 'hard', label: 'Hard' }, { id: 'custom', label: 'Custom' },
      ]},
      { type: 'range', path: 'gameplay.enemyCount', label: 'Street population', min: 3, max: 10, step: 1, help: 'How many rivals are out at once.' },
      { type: 'range', path: 'gameplay.enemyHealth', label: 'Enemy health', min: 0.5, max: 2, step: 0.05, help: 'Multiplier on crew health. Waves still toughen this.' },
      { type: 'range', path: 'gameplay.enemyDamage', label: 'Enemy damage', min: 0.4, max: 2, step: 0.05, help: 'How hard their punches land.' },
      { type: 'range', path: 'gameplay.enemyAggression', label: 'Aggression', min: 0.5, max: 2, step: 0.05, help: 'Chase distance and how often they swing.' },
      { type: 'range', path: 'gameplay.playerVitality', label: 'Your vitality', min: 80, max: 180, step: 5, help: 'Maximum health. Current health scales with it.' },
      { type: 'range', path: 'gameplay.heatDecay', label: 'Heat cooldown', min: 0.25, max: 2, step: 0.05, help: 'How fast heat falls after you leave a fight.' },
      { type: 'range', path: 'gameplay.trafficDamage', label: 'Traffic damage', min: 0, max: 2, step: 0.05, help: 'Damage when a car clips you. Zero makes traffic harmless.' },
      { type: 'range', path: 'gameplay.gameSpeed', label: 'Game speed', min: 0.6, max: 1.25, step: 0.05, help: 'Simulation rate. Hit-stop still uses real time.' },
      { type: 'toggle', path: 'gameplay.heatEnabled', label: 'Heat system', help: 'Fighting raises heat. High heat calls a meaner crew from farther away.' },
      { type: 'toggle', path: 'gameplay.traffic', label: 'Traffic', help: 'Cars loop the ring road. They will not leave the lanes.' },
      { type: 'toggle', path: 'gameplay.infiniteStamina', label: 'Infinite stamina', help: 'Sprint, dodge, and the uppercut never gas out.' },
      { type: 'toggle', path: 'gameplay.tutorial', label: 'Opening hints', help: 'Control reminders for the first half-minute of a run.' },
      { type: 'toggle', path: 'gameplay.showMinimap', label: 'Minimap', help: 'Corner map of roads, crew, clinic, and the orange car.' },
      { type: 'toggle', path: 'gameplay.rotateMinimap', label: 'Rotate minimap', help: 'The map turns so forward is always up.' },
      { type: 'toggle', path: 'gameplay.colorblind', label: 'High-contrast crew', help: 'Enemy markers switch from red to cyan.' },
    ],
  },
  {
    id: 'combat',
    label: 'Combat',
    blurb: 'The timing and weight of a punch.',
    items: [
      { type: 'range', path: 'combat.playerDamage', label: 'Your damage', min: 0.5, max: 2, step: 0.05, help: 'Multiplier on jab, cross, hook, uppercut, and the air kick.' },
      { type: 'range', path: 'combat.comboWindow', label: 'Combo window', min: 0.22, max: 0.85, step: 0.01, help: 'Seconds after a punch in which the next link still counts.' },
      { type: 'range', path: 'combat.dodgeIFrames', label: 'Dodge opening', min: 0.08, max: 0.42, step: 0.01, help: 'How long a dodge ignores hits. It cannot outlast the roll itself.' },
      { type: 'range', path: 'combat.hitStop', label: 'Hit stop', min: 0, max: 0.1, step: 0.005, help: 'Freeze on a clean hit. Zero is floaty, higher is heavier.' },
      { type: 'range', path: 'combat.knockback', label: 'Knockback', min: 0.3, max: 2, step: 0.05, help: 'How far a clean hit shoves someone.' },
      { type: 'range', path: 'combat.shake', label: 'Camera shake', min: 0, max: 2, step: 0.05, help: 'Shake added on hits. Zero keeps the camera still.' },
      { type: 'range', path: 'combat.magnet', label: 'Attack steer', min: 0, max: 1, step: 0.05, help: 'During a swing, turn toward a rival already in front of you.' },
      { type: 'range', path: 'combat.staminaRegen', label: 'Stamina return', min: 0.4, max: 2, step: 0.05, help: 'How fast the bar refills after you stop spending it.' },
      { type: 'range', path: 'combat.blockChip', label: 'Block chip', min: 0, max: 0.5, step: 0.01, help: 'Fraction of damage that leaks through a solid guard.' },
      { type: 'toggle', path: 'combat.damageNumbers', label: 'Damage numbers', help: 'Floating numbers on every landed hit.' },
      { type: 'toggle', path: 'combat.sparks', label: 'Hit sparks', help: 'Impact flashes and the shock ring on heavy hits.' },
      { type: 'toggle', path: 'combat.trails', label: 'Swing trails', help: 'A ribbon follows your fist through a punch.' },
      { type: 'toggle', path: 'combat.enemyArmor', label: 'Bruiser armor', help: 'Bruisers keep swinging through light hits during a heavy attack.' },
    ],
  },
  {
    id: 'camera',
    label: 'Camera',
    blurb: 'Where you watch the fight from.',
    items: [
      { type: 'range', path: 'camera.fov', label: 'Field of view', min: 52, max: 95, step: 1, help: 'Wider shows more street and stretches the edges.' },
      { type: 'range', path: 'camera.distance', label: 'Distance', min: 3.2, max: 8.5, step: 0.1, help: 'How far behind you the camera sits.' },
      { type: 'range', path: 'camera.height', label: 'Height', min: 0.6, max: 2.8, step: 0.05, help: 'Extra height above your shoulders.' },
      { type: 'range', path: 'camera.shoulder', label: 'Shoulder offset', min: -1.2, max: 1.2, step: 0.05, help: 'Negative puts you on the right side of the frame.' },
      { type: 'range', path: 'camera.sensitivity', label: 'Look sensitivity', min: 0.35, max: 2.6, step: 0.05, help: 'Mouse and arrow-key look speed.' },
      { type: 'range', path: 'camera.lag', label: 'Camera lag', min: 0, max: 1, step: 0.01, help: 'Zero is glued to you. Higher trails through corners.' },
      { type: 'range', path: 'camera.bob', label: 'Step bob', min: 0, max: 1, step: 0.05, help: 'A small dip in time with your feet. Ease this if it bothers you.' },
      { type: 'toggle', path: 'camera.invertY', label: 'Invert look up/down', help: 'Pulling the mouse down looks up.' },
      { type: 'toggle', path: 'camera.collision', label: 'Camera collision', help: 'The camera pulls in instead of entering buildings.' },
      { type: 'toggle', path: 'camera.zoom', label: 'Scroll zoom', help: 'The mouse wheel changes distance for this session.' },
    ],
  },
  {
    id: 'graphics',
    label: 'Graphics',
    blurb: 'Time of day, fog, and how hard the machine works.',
    items: [
      { type: 'select', path: 'graphics.quality', label: 'Quality', help: 'Shadow size, pixel ratio, and how many street lights are real.', options: [
        { id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' },
      ]},
      { type: 'select', path: 'graphics.timeOfDay', label: 'Time of day', help: 'Day is flat and bright. Dusk and night turn the signs on.', options: [
        { id: 'day', label: 'Day' }, { id: 'dusk', label: 'Dusk' }, { id: 'night', label: 'Night' },
      ]},
      { type: 'range', path: 'graphics.fog', label: 'Fog', min: 0, max: 1, step: 0.01, help: 'How fast the skyline disappears.' },
      { type: 'toggle', path: 'graphics.shadows', label: 'Shadows', help: 'Turn off if the frame rate dips in the alleys.' },
      { type: 'toggle', path: 'graphics.vignette', label: 'Vignette', help: 'Darkens the corners of the screen.' },
      { type: 'toggle', path: 'graphics.contactShadows', label: 'Ground shadows', help: 'Soft discs under fighters so they sit on the street.' },
    ],
  },
  {
    id: 'audio',
    label: 'Audio',
    blurb: 'The drone, the punches, and the engine.',
    items: [
      { type: 'toggle', path: 'audio.mute', label: 'Mute', wide: true, help: 'Silences everything. M does the same during a fight.' },
      { type: 'range', path: 'audio.master', label: 'Master', min: 0, max: 1, step: 0.01, help: 'Overall level.' },
      { type: 'range', path: 'audio.sfx', label: 'Effects', min: 0, max: 1, step: 0.01, help: 'Punches, footsteps, cars, the clinic.' },
      { type: 'range', path: 'audio.music', label: 'Music', min: 0, max: 1, step: 0.01, help: 'The district loop. It tightens when heat is high.' },
    ],
  },
];

const STORAGE_KEY = 'southline.settings.v1';

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

function num(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}

export function applyPreset(settings) {
  const d = settings.gameplay.difficulty;
  const p = PRESETS[d];
  if (!p) return settings;
  settings.gameplay.enemyCount = p.enemyCount;
  settings.gameplay.enemyHealth = p.enemyHealth;
  settings.gameplay.enemyDamage = p.enemyDamage;
  settings.gameplay.enemyAggression = p.enemyAggression;
  settings.combat.playerDamage = p.playerDamage;
  return settings;
}

export function sanitize(settings) {
  for (const group of SCHEMA) {
    for (const item of group.items) {
      const fallback = getPath(DEFAULTS, item.path);
      if (item.type === 'range') setPath(settings, item.path, num(getPath(settings, item.path), fallback, item.min, item.max));
      else if (item.type === 'toggle') setPath(settings, item.path, !!getPath(settings, item.path));
      else if (item.type === 'select' && !item.options.some((o) => o.id === getPath(settings, item.path))) {
        setPath(settings, item.path, fallback);
      }
    }
  }
  applyPreset(settings);
  return settings;
}

export function loadSettings() {
  const base = structuredClone(DEFAULTS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      for (const group of Object.keys(base)) {
        if (saved?.[group] && typeof saved[group] === 'object') Object.assign(base[group], saved[group]);
      }
    }
  } catch {
    /* keep defaults */
  }
  return sanitize(base);
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore private mode */
  }
}

export function commitSetting(settings, path, value) {
  setPath(settings, path, value);
  if (path === 'gameplay.difficulty') applyPreset(settings);
  else if (PRESET_PATHS.has(path)) settings.gameplay.difficulty = 'custom';
  sanitizeRanges(settings);
  saveSettings(settings);
}

function sanitizeRanges(settings) {
  for (const group of SCHEMA) {
    for (const item of group.items) {
      if (item.type !== 'range') continue;
      const fallback = getPath(DEFAULTS, item.path);
      setPath(settings, item.path, num(getPath(settings, item.path), fallback, item.min, item.max));
    }
  }
}

export function resetSettings() {
  const next = sanitize(structuredClone(DEFAULTS));
  saveSettings(next);
  return next;
}

export function isPresetPath(path) {
  return PRESET_PATHS.has(path);
}
