import { dampAngle } from './math.js';

export class PlayerController {
  constructor() {
    this.lock = null;
    this.jumpBuffer = 0;
  }

  update(dt, game, f) {
    const input = game.input;
    const wish = input.move;
    let mx = 0;
    let mz = 0;
    const lock = this.lock;
    if (lock && (!lock.active || lock.dead || Math.hypot(lock.pos.x - f.pos.x, lock.pos.z - f.pos.z) > 16)) {
      this.lock = null;
    }
    const target = this.lock;
    if (target) {
      const face = Math.atan2(target.pos.x - f.pos.x, target.pos.z - f.pos.z);
      f.yaw = dampAngle(f.yaw, face, f.action ? 16 : 10, dt);
      const fx = Math.sin(face);
      const fz = Math.cos(face);
      const rx = Math.cos(face);
      const rz = -Math.sin(face);
      mx = fx * wish.z + rx * wish.x;
      mz = fz * wish.z + rz * wish.x;
    } else {
      const yaw = game.camera.yaw;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      mx = fx * wish.z + rx * wish.x;
      mz = fz * wish.z + rz * wish.x;
      const moving = Math.hypot(mx, mz) > 0.15;
      if (moving && !f.action && f.dodgeTime <= 0 && f.hitstun <= 0) {
        f.yaw = dampAngle(f.yaw, Math.atan2(mx, mz), 12, dt);
      }
    }

    const moving = Math.hypot(mx, mz) > 0.08;
    if (moving) {
      const l = Math.hypot(mx, mz);
      f.desired.set(mx / l, 0, mz / l);
    } else f.desired.set(0, 0, 0);

    const canSprint = input.held('ShiftLeft') || input.held('ShiftRight');
    f.sprinting = canSprint && moving && f.grounded && f.stamina > 0 && !f.action && f.hitstun <= 0;
    f.wishSpeed = f.sprinting ? f.run : moving ? f.walk : 0;
    f.moveAmt = f.sprinting ? 1 : moving ? 0.55 : 0;

    const canAct = f.hitstun <= 0 && f.dodgeTime <= 0;
    if (canAct && (input.mouseJust(0) || input.just('KeyJ'))) f.tryAttack('light');
    if (canAct && (input.just('KeyK') || input.just('KeyQ'))) f.tryAttack('heavy');
    if (input.just('KeyX') || input.just('ControlLeft')) f.tryDodge(mx, mz);

    if (input.just('Space')) this.jumpBuffer = 0.14;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && (f.grounded || f.coyote > 0) && f.dodgeTime <= 0) {
      if (f.tryJump()) this.jumpBuffer = 0;
    }

    const canBlock = f.grounded && !f.action && f.dodgeTime <= 0 && f.hitstun <= 0 && f.stamina > 0;
    f.blocking = canBlock && (input.mouseHeld(2) || input.held('KeyL'));

    if (input.just('KeyV')) {
      if (this.lock) this.lock = null;
      else this.lock = game.nearestEnemy(f, 14, -0.2);
    }
  }
}
