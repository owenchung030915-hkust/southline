import { SPAWN_POINTS } from './layout.js';
import { dampAngle } from './math.js';

export class EnemyAI {
  constructor() {
    this.alert = false;
    this.lose = 0;
    this.goal = null;
    this.wait = 0;
    this.strafe = 1;
    this.strafeT = 0;
    this.blockT = 0;
    this.cooldown = 0.6 + Math.random();
  }

  reset() {
    this.alert = false;
    this.lose = 0;
    this.goal = null;
    this.wait = 0;
    this.cooldown = 0.4 + Math.random() * 0.8;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.blockT = 0;
  }

  update(dt, game, f) {
    if (game.calm > 0) {
      this.alert = false;
      this.patrol(dt, game, f);
      return;
    }
    const player = game.player;
    const dx = player.pos.x - f.pos.x;
    const dz = player.pos.z - f.pos.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const heat = game.settings.gameplay.heatEnabled ? game.heat : 0;
    const aggr = game.settings.gameplay.enemyAggression;
    const sight = (9 + heat * 3.2) * aggr;
    const see = dist < sight && !game.world.lineBlocked(f.pos.x, f.pos.z, player.pos.x, player.pos.z);
    const heard = !!player.action && dist < 10;
    if ((see || heard) && !player.dead && !player.driving) {
      this.alert = true;
      this.lose = 0;
    } else if (this.alert) {
      this.lose += dt;
      if (this.lose > 4.5 || player.dead) this.alert = false;
    }
    this.cooldown -= dt;

    if (!this.alert || player.driving) {
      this.patrol(dt, game, f);
      return;
    }

    const face = Math.atan2(dx, dz);
    f.yaw = dampAngle(f.yaw, face, 8, dt);
    const range = f.kind === 'bruiser' ? 2.05 : 1.75;
    if (this.blockT > 0) {
      this.blockT -= dt;
      f.blocking = !f.action;
    } else {
      f.blocking = false;
      const winding = player.action && player.action.time < player.action.def.hitStart;
      if (winding && dist < 2.45 && !f.action && Math.random() < 0.045 * aggr) this.blockT = 0.42;
    }

    if (f.action) {
      f.desired.set(Math.sin(f.yaw) * 0.35, 0, Math.cos(f.yaw) * 0.35);
      f.wishSpeed = f.walk * 0.4;
      f.moveAmt = 0.3;
      f.sprinting = false;
      if (f.kind === 'striker') f.tryAttack('light');
      return;
    }

    if (this.blockT <= 0 && dist < range + 0.15 && this.cooldown <= 0 && f.hitstun <= 0) {
      const choice = f.kind === 'bruiser'
        ? (Math.random() < 0.62 ? 'heavy' : 'hook')
        : 'light';
      if (f.tryAttack(choice)) {
        this.cooldown = (f.kind === 'bruiser' ? 1.05 : 0.48) / aggr;
        f.blocking = false;
      }
    }

    let mx = dx / dist;
    let mz = dz / dist;
    if (dist < range * 0.82) {
      mx = -mx;
      mz = -mz;
    } else if (dist < range + 1.3) {
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafe = -this.strafe;
        this.strafeT = 0.7 + Math.random() * 1.1;
      }
      const sx = -mz * this.strafe;
      const sz = mx * this.strafe;
      mx = mx * 0.25 + sx;
      mz = mz * 0.25 + sz;
    }
    const separated = separate(game, f);
    mx += separated.x;
    mz += separated.z;
    const steered = steer(game, f, mx, mz);
    const len = Math.hypot(steered.x, steered.z) || 1;
    f.desired.set(steered.x / len, 0, steered.z / len);
    const run = dist > range + 0.8;
    f.sprinting = run;
    f.wishSpeed = run ? f.run : f.walk;
    f.moveAmt = run ? 1 : 0.6;
  }

  patrol(dt, game, f) {
    f.sprinting = false;
    f.blocking = false;
    if (this.wait > 0) {
      this.wait -= dt;
      f.desired.set(0, 0, 0);
      f.wishSpeed = 0;
      f.moveAmt = 0;
      return;
    }
    if (!this.goal || Math.hypot(this.goal.x - f.pos.x, this.goal.z - f.pos.z) < 1.4) {
      const p = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
      this.goal = { x: p[0], z: p[1] };
      this.wait = 0.4 + Math.random() * 1.2;
    }
    let mx = this.goal.x - f.pos.x;
    let mz = this.goal.z - f.pos.z;
    const steered = steer(game, f, mx, mz);
    const len = Math.hypot(steered.x, steered.z) || 1;
    f.yaw = dampAngle(f.yaw, Math.atan2(steered.x, steered.z), 6, dt);
    f.desired.set(steered.x / len, 0, steered.z / len);
    f.wishSpeed = f.walk;
    f.moveAmt = 0.5;
  }
}

function separate(game, f) {
  let x = 0;
  let z = 0;
  for (const o of game.enemies) {
    if (o === f || !o.active || o.dead) continue;
    const dx = f.pos.x - o.pos.x;
    const dz = f.pos.z - o.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.001 && d < 1.45) {
      x += (dx / d) * (1.45 - d);
      z += (dz / d) * (1.45 - d);
    }
  }
  return { x, z };
}

function steer(game, f, mx, mz) {
  const len = Math.hypot(mx, mz) || 1;
  const dx = mx / len;
  const dz = mz / len;
  const aheadX = f.pos.x + dx * 1.3;
  const aheadZ = f.pos.z + dz * 1.3;
  if (!game.world.blocked(aheadX, aheadZ, f.radius)) return { x: dx, z: dz };
  const left = { x: -dz, z: dx };
  const right = { x: dz, z: -dx };
  if (!game.world.blocked(f.pos.x + left.x * 1.2, f.pos.z + left.z * 1.2, f.radius)) {
    return { x: dx * 0.3 + left.x, z: dz * 0.3 + left.z };
  }
  if (!game.world.blocked(f.pos.x + right.x * 1.2, f.pos.z + right.z * 1.2, f.radius)) {
    return { x: dx * 0.3 + right.x, z: dz * 0.3 + right.z };
  }
  return { x: -dx, z: -dz };
}
