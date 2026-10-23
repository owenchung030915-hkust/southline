import * as THREE from 'three';
import { BONE_NAMES, LIMB } from './character.js';
import { clamp } from './math.js';

const DEG = Math.PI / 180;
const LIMBS = new Set([
  'upperArmL', 'upperArmR', 'foreArmL', 'foreArmR', 'handL', 'handR',
  'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR',
]);

const tmpE = new THREE.Euler();
const tmpQ = new THREE.Quaternion();
const tmpBreath = new THREE.Quaternion();
const footTarget = new THREE.Vector3();
const footLocal = new THREE.Vector3();

function boneEuler(name, p = 0, y = 0, r = 0) {
  const sign = LIMBS.has(name) ? -1 : 1;
  return [sign * p * DEG, y * DEG, r * DEG];
}

function quatFrom(name, p, y, r, out) {
  const [x, yy, z] = boneEuler(name, p, y, r);
  tmpE.set(x, yy, z, 'XYZ');
  return out.setFromEuler(tmpE);
}

function sample(keys, time) {
  if (!keys?.length) return { p: 0, y: 0, r: 0, x: 0, z: 0 };
  if (time <= keys[0].time) return keys[0];
  const last = keys[keys.length - 1];
  if (time >= last.time) return last;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (time <= b.time) {
      const u = (time - a.time) / Math.max(0.0001, b.time - a.time);
      const s = u * u * (3 - 2 * u);
      const mix = (k) => (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * s;
      return { p: mix('p'), y: mix('y'), r: mix('r'), x: mix('x'), z: mix('z') };
    }
  }
  return last;
}

function actionWeight(time, duration) {
  const fadeIn = 0.05;
  const fadeOut = 0.1;
  if (time < fadeIn) return time / fadeIn;
  if (time > duration - fadeOut) return Math.max(0, (duration - time) / fadeOut);
  return 1;
}

function k(time, p = 0, y = 0, r = 0) {
  return { time, p, y, r };
}

const CLIPS = {
  jab: {
    duration: 0.4,
    bones: {
      hips: [k(0, 0, -6), k(0.1, -2, -14), k(0.2, 4, 14), k(0.4, 0, 0)],
      spine: [k(0, 2, -4), k(0.1, 0, -10), k(0.2, 6, 12), k(0.4, 2, 0)],
      chest: [k(0, 2, -8), k(0.1, -2, -18, 3), k(0.2, 8, 20, -3), k(0.4, 2, 0)],
      head: [k(0, 0, -4), k(0.1, 4, -8), k(0.2, 2, 6), k(0.4, 0, 0)],
      upperArmL: [k(0, 20, -6, 14), k(0.1, 6, 8, 10), k(0.2, 92, -4, 4), k(0.32, 74, -2, 8), k(0.4, 18, 0, 14)],
      foreArmL: [k(0, 36), k(0.1, 82), k(0.2, 8), k(0.34, 16), k(0.4, 24)],
      handL: [k(0, 0), k(0.2, -12, 0, 6), k(0.4, 0)],
      upperArmR: [k(0, 18, 16, -16), k(0.2, 14, 24, -18), k(0.4, 16, 10, -14)],
      foreArmR: [k(0, 46), k(0.2, 62), k(0.4, 28)],
    },
  },
  cross: {
    duration: 0.44,
    bones: {
      hips: [k(0, 0, 8), k(0.12, -4, 18), k(0.22, 6, -16), k(0.44, 0, 0)],
      spine: [k(0, 2, 6), k(0.12, -2, 16), k(0.22, 8, -18), k(0.44, 2, 0)],
      chest: [k(0, 2, 10), k(0.12, -6, 22, -4), k(0.22, 10, -24, 4), k(0.44, 2, 0)],
      head: [k(0, 0, 4), k(0.12, -4, 10), k(0.22, 4, -6), k(0.44, 0, 0)],
      upperArmR: [k(0, 18, 10, -14), k(0.12, -4, 18, -8), k(0.22, 96, 4, -4), k(0.34, 78, 2, -6), k(0.44, 18, 8, -14)],
      foreArmR: [k(0, 34), k(0.12, 88), k(0.22, 6), k(0.36, 14), k(0.44, 22)],
      handR: [k(0, 0), k(0.22, -14), k(0.44, 0)],
      upperArmL: [k(0, 16, -18, 16), k(0.22, 10, -28, 18), k(0.44, 16, -8, 14)],
      foreArmL: [k(0, 40), k(0.22, 58), k(0.44, 26)],
    },
  },
  hook: {
    duration: 0.52,
    bones: {
      hips: [k(0, -4, -10), k(0.16, -8, -22), k(0.3, 4, 20), k(0.52, 0, 0)],
      spine: [k(0, 2, -8), k(0.16, -4, -18), k(0.3, 8, 22), k(0.52, 2, 0)],
      chest: [k(0, 4, -10), k(0.16, -6, -28, 8), k(0.3, 12, 26, -8), k(0.52, 2, 0)],
      head: [k(0, 0, -6), k(0.16, -4, -12), k(0.3, 6, 10), k(0.52, 0, 0)],
      upperArmL: [k(0, 36, 10, 20), k(0.16, 48, 36, 28), k(0.3, 62, -48, -6), k(0.42, 48, -20, 8), k(0.52, 18, 0, 14)],
      foreArmL: [k(0, 50), k(0.16, 78), k(0.3, 70), k(0.52, 24)],
      handL: [k(0, 0), k(0.3, -8, 0, 20), k(0.52, 0)],
      upperArmR: [k(0, 16, 12, -16), k(0.3, 8, 30, -22), k(0.52, 16, 8, -14)],
      foreArmR: [k(0, 36), k(0.3, 48), k(0.52, 24)],
    },
  },
  heavy: {
    duration: 0.72,
    pos: {
      hips: [
        { time: 0, y: 0 },
        { time: 0.26, y: -0.16 },
        { time: 0.46, y: 0.05 },
        { time: 0.72, y: 0 },
      ],
    },
    bones: {
      hips: [k(0, 0, 8), k(0.26, -14, 16), k(0.46, 16, -10), k(0.72, 0, 0)],
      spine: [k(0, 2, 4), k(0.26, -12, 12), k(0.46, 14, -12), k(0.72, 2, 0)],
      chest: [k(0, 4, 8), k(0.26, -20, 18), k(0.46, 18, -16), k(0.72, 2, 0)],
      head: [k(0, 0, 4), k(0.26, -12, 8), k(0.46, 14, -6), k(0.72, 0, 0)],
      upperArmR: [k(0, 16, 8, -14), k(0.26, -18, 14, -20), k(0.46, 118, -6, -6), k(0.6, 90, -2, -8), k(0.72, 18, 4, -14)],
      foreArmR: [k(0, 30), k(0.26, 86), k(0.46, 18), k(0.72, 20)],
      handR: [k(0, 0), k(0.46, -20), k(0.72, 0)],
      upperArmL: [k(0, 16, -8, 16), k(0.3, 10, -24, 22), k(0.72, 16, 0, 14)],
      foreArmL: [k(0, 28), k(0.3, 46), k(0.72, 22)],
    },
  },
  air: {
    duration: 0.48,
    bones: {
      chest: [k(0, 6), k(0.14, -8, -10), k(0.26, 10, 8), k(0.48, 4)],
      head: [k(0, 0), k(0.2, -6), k(0.48, 0)],
      upperArmL: [k(0, 30, 0, 20), k(0.24, 40, -10, 24), k(0.48, 20, 0, 14)],
      upperArmR: [k(0, 30, 0, -20), k(0.24, 20, 16, -24), k(0.48, 18, 0, -14)],
      foreArmL: [k(0, 20), k(0.24, 30), k(0.48, 18)],
      foreArmR: [k(0, 20), k(0.24, 40), k(0.48, 18)],
      thighR: [k(0, 8), k(0.12, -16), k(0.24, 78), k(0.48, 10)],
      shinR: [k(0, -12), k(0.12, -68), k(0.24, -8), k(0.48, -14)],
      footR: [k(0, 0), k(0.24, 10), k(0.48, 0)],
      thighL: [k(0, 10), k(0.24, 18), k(0.48, 8)],
      shinL: [k(0, -16), k(0.24, -22), k(0.48, -12)],
    },
  },
};

export const ATTACKS = {
  jab: {
    clip: 'jab', duration: 0.4, hitStart: 0.14, hitEnd: 0.22, chainAt: 0.2, next: 'cross',
    hitBone: 'handL', range: 0.82, bodyRange: 1.72, damage: 12, knock: 3.2, lunge: 2.1,
    stamina: 6, heavy: false, armor: false, moveScale: 0.45,
  },
  cross: {
    clip: 'cross', duration: 0.44, hitStart: 0.16, hitEnd: 0.26, chainAt: 0.24, next: 'hook',
    hitBone: 'handR', range: 0.86, bodyRange: 1.8, damage: 15, knock: 4.6, lunge: 2.8,
    stamina: 7, heavy: false, armor: false, moveScale: 0.4,
  },
  hook: {
    clip: 'hook', duration: 0.52, hitStart: 0.2, hitEnd: 0.32, chainAt: 9, next: null,
    hitBone: 'handL', range: 0.92, bodyRange: 1.95, damage: 22, knock: 7.2, lunge: 1.6,
    stamina: 10, heavy: true, armor: false, moveScale: 0.28,
  },
  heavy: {
    clip: 'heavy', duration: 0.72, hitStart: 0.34, hitEnd: 0.5, chainAt: 9, next: null,
    hitBone: 'handR', range: 0.98, bodyRange: 2.05, damage: 30, knock: 8.5, lunge: 1.3,
    stamina: 24, heavy: true, armor: false, moveScale: 0.18,
  },
  air: {
    clip: 'air', duration: 0.48, hitStart: 0.14, hitEnd: 0.28, chainAt: 9, next: null,
    hitBone: 'footR', range: 0.95, bodyRange: 1.9, damage: 16, knock: 5.4, lunge: 1.8,
    stamina: 10, heavy: false, armor: false, moveScale: 0.55,
  },
};

const scratch = {
  bones: {},
  pos: { hips: { x: 0, y: 0, z: 0 } },
};
for (const name of BONE_NAMES) {
  scratch.bones[name] = { p: 0, y: 0, r: 0, q: new THREE.Quaternion(), useQ: false };
}

function resetScratch() {
  for (const name of BONE_NAMES) {
    const b = scratch.bones[name];
    b.p = 0;
    b.y = 0;
    b.r = 0;
    b.useQ = false;
  }
  scratch.pos.hips.x = 0;
  scratch.pos.hips.y = 0;
  scratch.pos.hips.z = 0;
}

function overlayClip(clip, time, weight) {
  if (!clip || weight <= 0.001) return;
  const sampledQ = tmpQ;
  for (const [name, keys] of Object.entries(clip.bones)) {
    const b = scratch.bones[name];
    if (!b) continue;
    const s = sample(keys, time);
    quatFrom(name, s.p, s.y, s.r, sampledQ);
    if (!b.useQ) {
      quatFrom(name, b.p, b.y, b.r, b.q);
      b.useQ = true;
    }
    b.q.slerp(sampledQ, weight);
  }
  if (clip.pos?.hips) {
    const s = sample(clip.pos.hips, time);
    const h = scratch.pos.hips;
    h.x += ((s.x || 0) - h.x) * weight;
    h.y += ((s.y || 0) - h.y) * weight;
    h.z += ((s.z || 0) - h.z) * weight;
  }
}

function toward(name, p, y, r, weight) {
  const b = scratch.bones[name];
  if (!b) return;
  quatFrom(name, p, y, r, tmpQ);
  if (!b.useQ) {
    quatFrom(name, b.p, b.y, b.r, b.q);
    b.useQ = true;
  }
  b.q.slerp(tmpQ, weight);
}

export function buildPose(params) {
  resetScratch();
  const move = clamp(params.move || 0, 0, 1);
  const sprint = params.sprint || 0;
  const phase = params.phase || 0;
  const time = params.time || 0;
  const swing = Math.sin(phase);
  const arm = (20 + sprint * 16) * move;

  const B = scratch.bones;
  B.hips.y = -swing * 5 * move;
  B.spine.p = (4 + sprint * 8) * move;
  B.spine.r = (params.turnLean || 0) * 8;
  B.chest.p = (3 + sprint * 6) * move + Math.sin(time * 1.8) * 1.5 * (1 - move * 0.65);
  B.chest.y = swing * 7 * move;
  B.chest.r = (params.turnLean || 0) * 5;
  B.head.y = Math.sin(time * 0.55) * 3.2 * (1 - move * 0.75) + swing * -3 * move;
  B.head.p = Math.sin(time * 1.15) * 1.1;

  B.upperArmL.p = 8 + -swing * arm;
  B.upperArmR.p = 8 + swing * arm;
  B.upperArmL.r = -26;
  B.upperArmR.r = 26;
  B.foreArmL.p = 18 + move * 8 + sprint * 22 * move;
  B.foreArmR.p = 18 + move * 8 + sprint * 22 * move;

  scratch.pos.hips.y += Math.cos(phase * 2) * (0.01 + sprint * 0.008) * move;
  scratch.pos.hips.x += swing * 0.03 * move;
  scratch.pos.hips.y -= (params.land || 0) * 0.1;
  B.chest.p += (params.land || 0) * 12;

  const air = clamp(params.air || 0, 0, 1);
  if (air > 0) {
    B.chest.p += (-6 * Math.sign(params.vy || 0) - B.chest.p) * air * 0.5;
    B.upperArmL.p += (34 - B.upperArmL.p) * air;
    B.upperArmR.p += (34 - B.upperArmR.p) * air;
    B.foreArmL.p += (16 - B.foreArmL.p) * air;
    B.foreArmR.p += (16 - B.foreArmR.p) * air;
    B.thighL.p = 22 * air;
    B.thighR.p = 8 * air;
    B.shinL.p = -28 * air;
    B.shinR.p = -18 * air;
  }

  if (params.fadeClip && params.fadeW > 0) overlayClip(CLIPS[params.fadeClip], params.fadeTime, params.fadeW);
  if (params.clip) {
    const defDuration = CLIPS[params.clip]?.duration || 0.4;
    const w = params.fadeClip ? params.clipW : actionWeight(params.clipTime, defDuration);
    overlayClip(CLIPS[params.clip], params.clipTime, w);
  }

  if (params.blocking) {
    const w = params.clip ? 0.15 : 0.92;
    toward('chest', 8, 0, 0, w);
    toward('head', 8, 0, 0, w);
    toward('upperArmL', 58, -16, 22, w);
    toward('foreArmL', 84, 0, 6, w);
    toward('upperArmR', 58, 16, -22, w);
    toward('foreArmR', 84, 0, -6, w);
    scratch.pos.hips.y -= 0.05 * w;
  }

  if (params.dodgeU > 0) {
    const s = Math.sin(Math.min(1, params.dodgeU) * Math.PI);
    const side = params.dodgeSide || 1;
    toward('chest', -18, 0, 36 * side, s);
    toward('head', -8, 0, 10 * side, s);
    toward('upperArmL', 24, 0, 10, s);
    toward('upperArmR', 24, 0, -10, s);
    toward('foreArmL', 40, 0, 0, s);
    toward('foreArmR', 40, 0, 0, s);
    toward('thighL', 46, 0, 0, s);
    toward('thighR', 34, 0, 0, s);
    toward('shinL', -62, 0, 0, s);
    toward('shinR', -48, 0, 0, s);
    scratch.pos.hips.y -= 0.22 * s;
  }

  if (params.hitU > 0) {
    const u = params.hitU;
    const spike = u < 0.18 ? u / 0.18 : 1 - (u - 0.18) / 0.82;
    const side = params.hitSide || 1;
    toward('chest', -24, side * 8, side * -6, spike);
    toward('head', -18, side * 14, 0, spike);
    toward('upperArmL', -16, 0, 28, spike);
    toward('upperArmR', -22, 0, -32, spike);
    toward('foreArmL', 20, 0, 0, spike);
    toward('foreArmR', 24, 0, 0, spike);
    toward('spine', -10, side * 6, 0, spike);
  }

  if (params.deadU > 0) {
    const u = params.deadU;
    const kgt = u * u * (3 - 2 * u);
    toward('thighL', -78, 0, 0, kgt);
    toward('thighR', -72, 0, 0, kgt);
    toward('shinL', -74, 0, 0, kgt);
    toward('shinR', -68, 0, 0, kgt);
    toward('chest', 68, 12, 10, kgt);
    toward('head', 28, 16, 0, kgt);
    toward('upperArmL', -8, 0, 46, kgt);
    toward('upperArmR', -18, 0, -52, kgt);
    toward('foreArmL', 24, 0, 0, kgt);
    toward('foreArmR', 30, 0, 0, kgt);
    scratch.pos.hips.y += (-0.62 - scratch.pos.hips.y) * kgt;
  }

  if (params.seated) {
    toward('chest', 8, 0, 0, 1);
    toward('head', 4, 0, 0, 1);
    toward('upperArmL', 42, 8, 16, 1);
    toward('upperArmR', 42, -8, -16, 1);
    toward('foreArmL', 36, 0, 0, 1);
    toward('foreArmR', 36, 0, 0, 1);
    toward('thighL', 74, 0, 0, 1);
    toward('thighR', 74, 0, 0, 1);
    toward('shinL', -78, 0, 0, 1);
    toward('shinR', -78, 0, 0, 1);
    scratch.pos.hips.y = -0.02;
  }

  return scratch;
}

export class Animator {
  constructor(rig) {
    this.rig = rig;
    this.rest = {};
    for (const name of BONE_NAMES) {
      this.rest[name] = rig[name].position.clone();
    }
  }

  apply(pose, time, dead) {
    for (const name of BONE_NAMES) {
      const bone = this.rig[name];
      const spec = pose.bones[name];
      if (spec?.useQ) bone.quaternion.copy(spec.q);
      else {
        const [x, y, z] = boneEuler(name, spec?.p || 0, spec?.y || 0, spec?.r || 0);
        bone.rotation.set(x, y, z);
      }
      bone.position.copy(this.rest[name]);
      if (name === 'hips') {
        bone.position.x += pose.pos.hips.x;
        bone.position.y += pose.pos.hips.y;
        bone.position.z += pose.pos.hips.z;
      }
    }
    if (!dead) {
      tmpBreath.setFromAxisAngle(_X, Math.sin(time * 1.8) * 0.02);
      this.rig.chest.quaternion.multiply(tmpBreath);
      tmpBreath.setFromAxisAngle(_Y, Math.sin(time * 0.7) * 0.012);
      this.rig.head.quaternion.multiply(tmpBreath);
    }
  }
}

const _X = new THREE.Vector3(1, 0, 0);
const _Y = new THREE.Vector3(0, 1, 0);

function solveLeg(thigh, shin, foot, local, thighLen, shinLen) {
  const tx = local.x;
  const ty = local.y;
  const tz = local.z;
  const dist = clamp(Math.hypot(tz, ty), 0.2, thighLen + shinLen - 0.008);
  const targetFromDown = Math.atan2(tz, -ty);
  const cosKnee = clamp((thighLen * thighLen + shinLen * shinLen - dist * dist) / (2 * thighLen * shinLen), -1, 1);
  const flex = Math.PI - Math.acos(cosKnee);
  const cosHip = clamp((thighLen * thighLen + dist * dist - shinLen * shinLen) / (2 * thighLen * dist), -1, 1);
  const hipBend = Math.acos(cosHip);
  // Stay in the sagittal plane so a foot behind the hip does not twist the leg around.
  // The thigh leads the foot and the shin folds back, which keeps the knee forward.
  const thighFromDown = targetFromDown + hipBend;
  const abduction = clamp(tx * 1.4, -0.4, 0.4);
  thigh.rotation.set(-thighFromDown, 0, abduction);
  shin.rotation.set(flex, 0, 0);
  foot.rotation.set(-(thigh.rotation.x + shin.rotation.x), 0, -abduction);
}

export function applyLegIK(rig, params) {
  const scale = rig.scale || 1;
  const yaw = params.yaw || 0;
  const phase = params.phase || 0;
  const move = clamp(params.move || 0, 0, 1);
  const sprint = params.sprint || 0;
  const ground = params.groundY || 0;
  const stride = (0.22 + sprint * 0.14) * move;
  const liftH = (0.12 + sprint * 0.08) * move;
  const ankle = LIMB.ankle * scale;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);

  rig.hips.updateWorldMatrix(true, false);

  const legs = [
    ['thighL', 'shinL', 'footL', phase],
    ['thighR', 'shinR', 'footR', phase + Math.PI],
  ];
  for (const [thighName, shinName, footName, legPhase] of legs) {
    const step = Math.sin(legPhase) * stride;
    const lift = Math.max(0, Math.cos(legPhase)) ** 1.15 * liftH;
    const thigh = rig[thighName];
    thigh.updateWorldMatrix(true, false);
    thigh.getWorldPosition(footTarget);
    footTarget.x += fx * step;
    footTarget.y = ground + ankle + lift;
    footTarget.z += fz * step;
    rig.hips.worldToLocal(footTarget);
    footLocal.copy(footTarget).sub(thigh.position);
    solveLeg(thigh, rig[shinName], rig[footName], footLocal, LIMB.thigh, LIMB.shin);
  }
}
