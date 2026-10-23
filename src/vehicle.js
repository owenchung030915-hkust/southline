import * as THREE from 'three';
import { clamp } from './math.js';
import { LOOP, WORLD } from './layout.js';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14);
wheelGeo.rotateZ(Math.PI / 2);
const bodyGeo = new THREE.BoxGeometry(1.72, 0.48, 3.7);
const cabinGeo = new THREE.BoxGeometry(1.52, 0.42, 1.9);
const glassGeo = new THREE.BoxGeometry(1.38, 0.32, 1.55);

export function createCarVisual(color) {
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  chassis.position.y = 0.15;
  root.add(chassis);

  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: '#14161c', roughness: 0.6, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({
    color: '#9fd7e8',
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.45,
  });
  const lightMat = new THREE.MeshStandardMaterial({
    color: '#fff4d2',
    emissive: '#fff1c4',
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: '#ff3048',
    emissive: '#ff2030',
    emissiveIntensity: 0.9,
    roughness: 0.35,
  });

  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.62;
  body.castShadow = true;
  body.receiveShadow = true;
  chassis.add(body);

  const cabin = new THREE.Mesh(cabinGeo, dark);
  cabin.position.set(0, 1.02, -0.18);
  cabin.castShadow = true;
  chassis.add(cabin);

  const glassMesh = new THREE.Mesh(glassGeo, glass);
  glassMesh.position.set(0, 1.08, -0.16);
  chassis.add(glassMesh);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.16, 0.2), dark);
  bumper.position.set(0, 0.46, 1.85);
  chassis.add(bumper);

  for (const x of [-0.62, 0.62]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), lightMat);
    lamp.position.set(x, 0.68, 1.86);
    chassis.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.06), tailMat);
    tail.position.set(x, 0.66, -1.86);
    chassis.add(tail);
  }

  const wheels = [];
  const tire = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.85 });
  const hub = new THREE.MeshStandardMaterial({ color: '#c8ccd2', roughness: 0.3, metalness: 0.6 });
  for (const [x, z, front] of [[-0.86, 1.28, true], [0.86, 1.28, true], [-0.86, -1.28, false], [0.86, -1.28, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const mesh = new THREE.Mesh(wheelGeo, tire);
    mesh.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 8), hub);
    cap.rotation.z = Math.PI / 2;
    mesh.add(cap);
    pivot.add(mesh);
    root.add(pivot);
    wheels.push({ pivot, mesh, front });
  }

  const seat = new THREE.Group();
  seat.position.set(-0.32, 0.55, -0.05);
  chassis.add(seat);

  const spotL = new THREE.SpotLight('#fff1d0', 0, 28, Math.PI / 5, 0.45, 1.2);
  spotL.position.set(-0.5, 0.7, 1.7);
  const spotR = new THREE.SpotLight('#fff1d0', 0, 28, Math.PI / 5, 0.45, 1.2);
  spotR.position.set(0.5, 0.7, 1.7);
  const target = new THREE.Group();
  target.position.set(0, 0.4, 10);
  chassis.add(spotL, spotR, target);
  spotL.target = target;
  spotR.target = target;

  return { root, chassis, wheels, seat, paint, lightMat, tailMat, spots: [spotL, spotR], glass };
}

const AXLE = 1.05;
const BODY_R = 0.96;
const SLOP = 0.05;

export function vehicleCircles(x, z, yaw, radius = BODY_R) {
  const fx = Math.sin(yaw || 0);
  const fz = Math.cos(yaw || 0);
  return [
    { x: x + fx * AXLE, z: z + fz * AXLE, r: radius },
    { x: x - fx * AXLE, z: z - fz * AXLE, r: radius },
  ];
}

function shapeOf(o) {
  if (!o) return [];
  if (o.circles) return o.circles;
  return vehicleCircles(o.x, o.z, o.yaw || 0, o.r || BODY_R);
}

export function vehicleHits(x, z, yaw, others, self) {
  const mine = vehicleCircles(x, z, yaw);
  const fx = Math.sin(yaw || 0);
  const fz = Math.cos(yaw || 0);
  for (const o of others) {
    if (!o || o.ref === self) continue;
    const along = (o.x - x) * fx + (o.z - z) * fz;
    if (along < -1.35) continue;
    for (const a of mine) {
      for (const b of shapeOf(o)) {
        if (Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r - 0.02) return true;
      }
    }
  }
  return false;
}

export function pushVehicle(car, others) {
  let hit = false;
  for (let pass = 0; pass < 12; pass++) {
    let worst = null;
    const mine = vehicleCircles(car.x, car.z, car.yaw);
    for (const o of others) {
      if (!o || o.ref === car) continue;
      for (const a of mine) {
        for (const b of shapeOf(o)) {
          const dx = a.x - b.x;
          const dz = a.z - b.z;
          const d = Math.hypot(dx, dz) || 0.0001;
          const overlap = a.r + b.r + SLOP - d;
          if (overlap > (worst?.overlap || 0)) worst = { dx, dz, d, overlap };
        }
      }
    }
    if (!worst) break;
    hit = true;
    car.x += (worst.dx / worst.d) * worst.overlap;
    car.z += (worst.dz / worst.d) * worst.overlap;
    const nx = -worst.dx / worst.d;
    const nz = -worst.dz / worst.d;
    const into = Math.sin(car.yaw) * car.speed * nx + Math.cos(car.yaw) * car.speed * nz;
    if (into > 0.4) car.speed *= 0.55;
  }
  return hit;
}

function loopLength() {
  let n = 0;
  for (let i = 0; i < LOOP.length; i++) {
    const a = LOOP[i];
    const b = LOOP[(i + 1) % LOOP.length];
    n += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return n;
}

const LOOP_LEN = loopLength();

function pointOnLoop(u) {
  const segs = LOOP.length;
  const f = ((u % 1) + 1) % 1 * segs;
  const i = Math.floor(f) % segs;
  const t = f - Math.floor(f);
  const a = LOOP[i];
  const b = LOOP[(i + 1) % segs];
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    dx: b.x - a.x,
    dz: b.z - a.z,
  };
}

export class TrafficCar {
  constructor(scene, color, offset) {
    this.visual = createCarVisual(color);
    scene.add(this.visual.root);
    this.u = offset;
    this.baseSpeed = 7.2;
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
    this.speed = this.baseSpeed;
    this.spin = 0;
    this.radius = 1.65;
    this.honkCd = 0;
    this.sync(0);
  }

  sync(dt) {
    const p = pointOnLoop(this.u);
    const len = Math.hypot(p.dx, p.dz) || 1;
    const fx = p.dx / len;
    const fz = p.dz / len;
    const rx = fz;
    const rz = -fx;
    this.x = p.x + rx * 2.35;
    this.z = p.z + rz * 2.35;
    this.yaw = Math.atan2(fx, fz);
    this.visual.root.position.set(this.x, 0, this.z);
    this.visual.root.rotation.y = this.yaw;
    this.spin += this.speed * dt / 0.36;
    for (const w of this.visual.wheels) {
      w.mesh.rotation.x = this.spin;
      w.pivot.rotation.y = 0;
    }
  }

  sample(u) {
    const p = pointOnLoop(u);
    const len = Math.hypot(p.dx, p.dz) || 1;
    const fx = p.dx / len;
    const fz = p.dz / len;
    return {
      x: p.x + fz * 2.35,
      z: p.z - fx * 2.35,
      yaw: Math.atan2(fx, fz),
    };
  }

  update(dt, obstacles = [], desired = this.baseSpeed) {
    this.honkCd = Math.max(0, this.honkCd - dt);
    const look = Math.max(this.speed, desired);
    const probe = this.sample(this.u + (Math.max(0, look) * dt) / LOOP_LEN);
    const now = this.sample(this.u);
    const aheadBlocked = obstacles.length > 0 && vehicleHits(probe.x, probe.z, probe.yaw, obstacles, this);
    const inside = obstacles.length > 0 && vehicleHits(now.x, now.z, now.yaw, obstacles, this);
    if (aheadBlocked || inside) {
      this.speed = Math.max(0, this.speed - 34 * dt);
      if (inside) this.u = (this.u - (3 * dt) / LOOP_LEN + 1) % 1;
    } else {
      this.speed += (desired - this.speed) * Math.min(1, dt * 2);
      const step = (Math.max(0, this.speed) * dt) / LOOP_LEN;
      const dest = this.sample(this.u + step);
      if (obstacles.length > 0 && vehicleHits(dest.x, dest.z, dest.yaw, obstacles, this)) {
        this.speed *= 0.35;
      } else {
        this.u = (this.u + step) % 1;
      }
    }
    this.sync(dt);
    return aheadBlocked || inside;
  }
}

export class DriveCar {
  constructor(scene, x, z) {
    this.visual = createCarVisual('#e4572e');
    scene.add(this.visual.root);
    this.x = x;
    this.z = z;
    this.yaw = 0;
    this.speed = 0;
    this.steer = 0;
    this.spin = 0;
    this.radius = 1.7;
    this.occupied = false;
    this.hornCd = 0;
    this.sync(0, 0);
  }

  reset(x, z) {
    this.x = x;
    this.z = z;
    this.yaw = 0;
    this.speed = 0;
    this.steer = 0;
    this.occupied = false;
    this.sync(0, 0);
  }

  update(dt, input, blocks, obstacles = []) {
    this.hornCd = Math.max(0, this.hornCd - dt);
    const throttle = (input.held('KeyW') ? 1 : 0) - (input.held('KeyS') ? 1 : 0);
    const hand = input.held('Space');
    const maxSpeed = 16;
    if (throttle > 0 && this.speed > -0.4) {
      this.speed += 26 * dt * (1 - Math.max(0, this.speed) / maxSpeed);
    } else if (throttle < 0 && this.speed > 0.6) {
      this.speed -= 36 * dt;
    } else if (throttle < 0) {
      this.speed -= 14 * dt;
      this.speed = Math.max(this.speed, -6.5);
    }
    const drag = hand ? 2.4 : 0.55;
    this.speed -= this.speed * drag * dt;
    if (Math.abs(this.speed) < 0.08 && throttle === 0) this.speed = 0;

    const steerInput = (input.held('KeyA') ? 1 : 0) - (input.held('KeyD') ? 1 : 0);
    const targetSteer = steerInput * 0.55;
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 8);
    const turn = this.steer / (1 + Math.abs(this.speed) * 0.06);
    this.yaw += turn * this.speed * dt * (hand ? 1.7 : 1);

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    this.x = clamp(this.x, WORLD.minX + 2, WORLD.maxX - 2);
    this.z = clamp(this.z, WORLD.minZ + 2, WORLD.maxZ - 2);
    this.collide(blocks, obstacles);

    if (input.just('KeyH') && this.hornCd <= 0) this.hornCd = 0.4;
    this.visual.chassis.rotation.z = -this.steer * this.speed * 0.035;
    this.visual.chassis.rotation.x = -throttle * 0.03;
    this.sync(dt, this.steer);
    return this.hornCd === 0.4;
  }

  collide(blocks, obstacles = []) {
    resolveCar(this, blocks);
    if (obstacles.length) pushVehicle(this, obstacles);
    resolveCar(this, blocks);
    this.sync(0, this.steer);
  }

  sync(dt, steer = 0) {
    this.visual.root.position.set(this.x, 0, this.z);
    this.visual.root.rotation.y = this.yaw;
    this.spin += this.speed * dt / 0.36;
    for (const w of this.visual.wheels) {
      w.mesh.rotation.x = this.spin;
      if (w.front) w.pivot.rotation.y = steer;
    }
  }
}

function resolveCar(car, blocks) {
  const r = car.radius;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of blocks) {
      if (b.maxY < 0.4) continue;
      const cx = clamp(car.x, b.minX, b.maxX);
      const cz = clamp(car.z, b.minZ, b.maxZ);
      let dx = car.x - cx;
      let dz = car.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > 0.0001 && d2 < r * r) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        car.x += dx * push;
        car.z += dz * push;
        car.speed *= 0.72;
      } else if (d2 <= 0.0001 && car.x > b.minX && car.x < b.maxX && car.z > b.minZ && car.z < b.maxZ) {
        const left = car.x - b.minX;
        const right = b.maxX - car.x;
        const back = car.z - b.minZ;
        const fwd = b.maxZ - car.z;
        const m = Math.min(left, right, back, fwd);
        if (m === left) car.x = b.minX - r;
        else if (m === right) car.x = b.maxX + r;
        else if (m === back) car.z = b.minZ - r;
        else car.z = b.maxZ + r;
        car.speed *= 0.5;
      }
    }
  }
}

export function setHeadlights(car, intensity) {
  for (const spot of car.visual.spots) spot.intensity = intensity;
  car.visual.lightMat.emissiveIntensity = 0.4 + intensity * 0.35;
}
