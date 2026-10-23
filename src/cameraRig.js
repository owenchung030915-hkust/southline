import * as THREE from 'three';
import { clamp, dampAngle } from './math.js';

const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.42;
    this.pos = new THREE.Vector3(0, 4, -8);
    this.look = new THREE.Vector3(0, 1.4, 0);
    this.zoom = 0;
    this.shakeAmp = 0;
    this.orbit = 0;
  }

  shake(amount) {
    this.shakeAmp = Math.min(1.5, this.shakeAmp + amount);
  }

  consumeLook(input, settings, dt) {
    input.tick(dt);
    const look = input.consumeLook();
    const sens = 0.00215 * settings.camera.sensitivity;
    this.yaw -= look.x * sens;
    const dir = settings.camera.invertY ? -1 : 1;
    this.pitch = clamp(this.pitch + look.y * sens * dir, 0.08, 1.15);
    if (settings.camera.zoom) this.zoom = clamp(this.zoom - input.consumeWheel() * 0.0025, -2, 3.2);
    else input.consumeWheel();
  }

  update(dt, target, settings, blocks) {
    if (target.lockYaw != null) {
      this.yaw = dampAngle(this.yaw, target.lockYaw, 3.2, dt);
    }
    const dist = clamp(settings.camera.distance + this.zoom + (target.driving ? 2.4 : 0), 2.6, 11);
    const pitch = this.pitch + (target.driving ? 0.08 : 0);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const shoulder = target.driving ? settings.camera.shoulder * 0.3 : settings.camera.shoulder;
    const headY = target.y + (target.driving ? 1.7 : 1.45);
    _desired.set(
      target.x - fx * dist * cp + rx * shoulder,
      headY + sp * dist * 0.72 + settings.camera.height * 0.35,
      target.z - fz * dist * cp + rz * shoulder,
    );
    _look.set(
      target.x + rx * shoulder * 0.2 + (target.vx || 0) * 0.12,
      headY - 0.05,
      target.z + rz * shoulder * 0.2 + (target.vz || 0) * 0.12,
    );
    if (settings.camera.collision && !target.driving) clip(_look, _desired, blocks);
    const lambda = 16 - settings.camera.lag * 12;
    const k = 1 - Math.exp(-Math.max(2.5, lambda) * dt);
    this.pos.lerp(_desired, k);
    this.look.lerp(_look, k);
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * (2.2 + this.shakeAmp));
    const mag = this.shakeAmp * this.shakeAmp * (settings.combat?.shake ?? 0);
    const bob = Math.sin((target.phase || 0) * 2) * settings.camera.bob * (target.move || 0) * 0.08;
    this.camera.position.set(
      this.pos.x + (Math.random() - 0.5) * mag,
      this.pos.y + (Math.random() - 0.5) * mag + bob,
      this.pos.z + (Math.random() - 0.5) * mag * 0.6,
    );
    this.camera.lookAt(this.look);
    const fov = settings.camera.fov + (target.sprint ? 4.5 : 0) + Math.min(8, Math.abs(target.carSpeed || 0) * 0.38);
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix();
  }

  updateMenu(dt, time, focus) {
    this.orbit = time * 0.16;
    const dist = 9 + Math.sin(time * 0.21) * 1.1;
    _desired.set(focus.x + Math.sin(this.orbit) * dist, focus.y + 3.1, focus.z + Math.cos(this.orbit) * dist);
    this.pos.lerp(_desired, 1 - Math.exp(-1.6 * dt));
    this.camera.position.copy(this.pos);
    this.camera.lookAt(focus.x, 1.25, focus.z);
    this.yaw = this.orbit;
  }
}

function clip(from, to, blocks) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.05) return;
  const invx = dx / len;
  const invy = dy / len;
  const invz = dz / len;
  let best = len;
  for (const b of blocks) {
    const t = rayBox(from.x, from.y, from.z, invx, invy, invz, b, best);
    if (t != null && t < best) best = t;
  }
  if (best < len - 0.05) {
    const keep = Math.max(0.4, best - 0.3);
    to.x = from.x + invx * keep;
    to.y = Math.max(0.4, from.y + invy * keep);
    to.z = from.z + invz * keep;
  }
}

function rayBox(ox, oy, oz, dx, dy, dz, b, max) {
  let tmin = 0;
  let tmax = max;
  const tests = [
    [dx, ox, b.minX, b.maxX],
    [dy, oy, b.minY, b.maxY],
    [dz, oz, b.minZ, b.maxZ],
  ];
  for (const [d, origin, min, maxv] of tests) {
    if (Math.abs(d) < 1e-7) {
      if (origin < min || origin > maxv) return null;
    } else {
      let t1 = (min - origin) / d;
      let t2 = (maxv - origin) / d;
      if (t1 > t2) {
        const s = t1;
        t1 = t2;
        t2 = s;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmax < tmin) return null;
    }
  }
  if (tmin > 0.001) return tmin;
  return null;
}
