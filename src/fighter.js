import * as THREE from 'three';
import { Animator, ATTACKS, applyLegIK, buildPose } from './anim.js';
import { applyLook, createCharacter } from './character.js';
import { clamp, damp, dampAngle } from './math.js';

let NEXT_ID = 1;

const STATS = {
  player: { hp: 120, walk: 3.55, run: 7.15, radius: 0.38, rate: 1 },
  striker: { hp: 78, walk: 3.3, run: 6.25, radius: 0.38, rate: 0.88 },
  bruiser: { hp: 150, walk: 2.6, run: 4.85, radius: 0.48, rate: 0.74 },
};

function makeBar() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.2, 0.15, 1);
  sprite.visible = false;
  return { c, ctx, tex, sprite };
}

export class Fighter {
  constructor(scene, kind, team) {
    this.scene = scene;
    this.rig = createCharacter(kind === 'player' ? 'player' : kind);
    scene.add(this.rig.root);
    this.rig.root.remove(this.rig.shadow);
    scene.add(this.rig.shadow);
    this.animator = new Animator(this.rig);
    this.bar = makeBar();
    scene.add(this.bar.sprite);
    this.kind = kind;
    this.team = team;
    this.id = NEXT_ID++;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.yaw = 0;
    this.prevYaw = 0;
    this.active = team === 0;
    this.dead = false;
    this.driving = false;
    this.resetStats(1);
    this.stamina = 100;
    this.action = null;
    this.buffer = null;
    this.bufferT = 0;
    this.fadeClip = null;
    this.fadeTime = 0;
    this.fade = 0;
    this.hitstun = 0;
    this.reactDur = 0.35;
    this.invuln = 0;
    this.blink = 0;
    this.dodgeTime = 0;
    this.dodgeDur = 0.42;
    this.dodgeCd = 0;
    this.dodgeX = 0;
    this.dodgeZ = 1;
    this.dodgeSide = 1;
    this.blocking = false;
    this.sprinting = false;
    this.wishSpeed = 0;
    this.moveAmt = 0;
    this.phase = 0;
    this.lastStep = 0;
    this.grounded = true;
    this.wasGrounded = true;
    this.coyote = 0;
    this.land = 0;
    this.flash = 0;
    this.deadT = 0;
    this.fading = 0;
    this.staminaDelay = 0;
    this.carCd = 0;
    this.goodX = 0;
    this.goodZ = 0;
    this.game = null;
    this.controller = null;
    this._mats = Object.values(this.rig.mats);
  }

  resetStats(hpScale) {
    const s = STATS[this.kind] || STATS.striker;
    this.maxHp = s.hp * hpScale;
    this.hp = this.maxHp;
    this.walk = s.walk;
    this.run = s.run;
    this.radius = s.radius;
    this.rate = s.rate;
  }

  resetPlayer(x, z, maxHp) {
    this.kind = 'player';
    this.team = 0;
    applyLook(this.rig, 'player');
    this.pos.set(x, 0, z);
    this.goodX = x;
    this.goodZ = z;
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.walk = STATS.player.walk;
    this.run = STATS.player.run;
    this.radius = STATS.player.radius;
    this.rate = 1;
    this.stamina = 100;
    this.dead = false;
    this.active = true;
    this.driving = false;
    this.action = null;
    this.hitstun = 0;
    this.invuln = 1.4;
    this.blink = 1.4;
    this.dodgeTime = 0;
    this.blocking = false;
    this.fading = 0;
    this.deadT = 0;
    this.rig.root.visible = true;
    this.rig.visual.visible = true;
  }

  activate(kind, x, z, hpScale) {
    this.kind = kind;
    this.team = 1;
    applyLook(this.rig, kind);
    this.resetStats(hpScale);
    this.pos.set(x, 0, z);
    this.goodX = x;
    this.goodZ = z;
    this.vel.set(0, 0, 0);
    this.yaw = Math.random() * Math.PI * 2;
    this.stamina = 100;
    this.dead = false;
    this.active = true;
    this.driving = false;
    this.action = null;
    this.buffer = null;
    this.hitstun = 0;
    this.invuln = 0.4;
    this.blink = 0;
    this.dodgeTime = 0;
    this.blocking = false;
    this.fading = 0;
    this.deadT = 0;
    this.flash = 0;
    this.carCd = 0;
    this.rig.root.visible = true;
    this.rig.visual.visible = true;
    for (const m of this._mats) m.opacity = 1;
    this.controller?.reset?.();
  }

  deactivate() {
    this.active = false;
    this.dead = false;
    this.rig.root.visible = false;
    this.rig.shadow.visible = false;
    this.bar.sprite.visible = false;
  }

  dismiss() {
    if (!this.active) return;
    this.action = null;
    this.blocking = false;
    if (this.fading <= 0) this.fading = 0.01;
  }

  enterCar(car) {
    this.driving = true;
    this.action = null;
    this.blocking = false;
    this.vel.set(0, 0, 0);
    car.visual.seat.attach(this.rig.root);
    this.rig.root.position.set(0, -0.42, 0.02);
    this.rig.root.rotation.set(0, 0, 0);
  }

  exitCar(x, z, yaw) {
    this.scene.attach(this.rig.root);
    this.driving = false;
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.vel.set(0, 0, 0);
    this.rig.root.position.set(x, 0, z);
    this.rig.root.rotation.set(0, yaw, 0);
    this.invuln = 0.35;
  }

  update(dt, game) {
    this.game = game;
    if (!this.active) return;
    if (this.driving) {
      this.present(dt);
      return;
    }
    if (game.mode === 'menu' && this.team === 0) {
      this.present(dt);
      return;
    }
    if (game.mode !== 'play') return;
    this.carCd = Math.max(0, this.carCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (!this.dead && this.fading <= 0) this.controller?.update(dt, game, this);
    this.advance(dt, game);
    this.integrate(dt, game);
    this.present(dt);
  }

  tryAttack(request) {
    if (this.dead || this.hitstun > 0 || this.dodgeTime > 0 || this.driving || this.fading > 0) return false;
    const infinite = this.team === 0 && this.game.settings.gameplay.infiniteStamina;
    if (request === 'light') {
      if (this.action?.def.next && this.action.time >= this.action.def.chainAt) {
        const window = this.game.settings.combat.comboWindow;
        if (this.action.time <= this.action.def.chainAt + window) return this.beginAction(this.action.def.next, infinite);
      }
      if (this.action) {
        this.buffer = 'light';
        this.bufferT = 0.18;
        return false;
      }
      return this.beginAction(this.grounded ? 'jab' : 'air', infinite);
    }
    if (request === 'heavy') {
      if (!this.grounded) return false;
      if (this.action) {
        this.buffer = 'heavy';
        this.bufferT = 0.18;
        return false;
      }
      return this.beginAction('heavy', infinite);
    }
    if (this.action) return false;
    return this.beginAction(request, infinite);
  }

  beginAction(name, infinite = false) {
    const def = ATTACKS[name];
    if (!def) return false;
    if (!infinite && this.stamina < def.stamina) return false;
    if (this.action) {
      this.fadeClip = this.action.def.clip;
      this.fadeTime = this.action.time;
      this.fade = 1;
    } else {
      this.fadeClip = null;
      this.fade = 0;
    }
    const armor = !!def.armor || (this.kind === 'bruiser' && def.heavy && this.game.settings.combat.enemyArmor);
    this.action = { def, time: 0, hitIds: new Set(), lunged: false, armor };
    if (!infinite) this.stamina = Math.max(0, this.stamina - def.stamina);
    this.staminaDelay = 0.45;
    this.buffer = null;
    this.blocking = false;
    if (this.team === 0) this.game.audio.swing();
    return true;
  }

  tryDodge(dx, dz) {
    if (this.dead || this.hitstun > 0 || this.dodgeCd > 0 || this.driving || !this.grounded) return false;
    const infinite = this.team === 0 && this.game.settings.gameplay.infiniteStamina;
    if (!infinite && this.stamina < 26) return false;
    if (!infinite) this.stamina -= 26;
    this.staminaDelay = 0.35;
    this.dodgeCd = 0.7;
    this.dodgeDur = 0.42;
    this.dodgeTime = this.dodgeDur;
    const frames = this.team === 0 ? this.game.settings.combat.dodgeIFrames : 0.12;
    this.invuln = Math.max(0.08, Math.min(this.dodgeDur - 0.04, frames));
    this.action = null;
    this.blocking = false;
    let x = dx;
    let z = dz;
    if (Math.hypot(x, z) < 0.12) {
      x = -Math.sin(this.yaw);
      z = -Math.cos(this.yaw);
    }
    const l = Math.hypot(x, z) || 1;
    this.dodgeX = x / l;
    this.dodgeZ = z / l;
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    this.dodgeSide = this.dodgeX * rx + this.dodgeZ * rz >= 0 ? 1 : -1;
    this.game.audio.dodge();
    return true;
  }

  tryJump() {
    if (this.dead || this.dodgeTime > 0 || this.driving) return false;
    if (!this.grounded && this.coyote <= 0) return false;
    if (this.action && this.action.time < this.action.def.hitEnd) return false;
    const infinite = this.team === 0 && this.game.settings.gameplay.infiniteStamina;
    if (!infinite && this.stamina < 8) return false;
    if (!infinite) this.stamina -= 8;
    this.vel.y = 8;
    this.grounded = false;
    this.coyote = 0;
    this.staminaDelay = 0.2;
    return true;
  }

  advance(dt, game) {
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT > 2.15) this.fading = Math.min(1.3, this.fading + dt);
      if (this.team !== 0 && this.fading > 1) this.deactivate();
      return;
    }
    if (this.fading > 0) {
      this.fading += dt;
      if (this.fading > 1) this.deactivate();
      return;
    }
    const rate = this.rate * (this.team === 1 ? 0.92 + game.settings.gameplay.enemyAggression * 0.08 : 1);
    if (this.action) {
      this.action.time += dt * rate;
      if (this.action.time >= this.action.def.duration) {
        const buffered = this.buffer;
        this.action = null;
        this.buffer = null;
        if (buffered === 'light') this.tryAttack('light');
        else if (buffered === 'heavy') this.tryAttack('heavy');
      }
    }
    if (this.bufferT > 0) {
      this.bufferT -= dt;
      if (this.bufferT <= 0) this.buffer = null;
    }
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt / 0.08);
    this.hitstun = Math.max(0, this.hitstun - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.blink = Math.max(0, this.blink - dt);
    this.dodgeTime = Math.max(0, this.dodgeTime - dt);
    this.land = Math.max(0, this.land - dt * 4.5);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else if (!this.sprinting && !this.blocking && this.dodgeTime <= 0) {
      const regen = 24 * (this.team === 0 ? game.settings.combat.staminaRegen : 0.85);
      this.stamina = Math.min(100, this.stamina + regen * dt);
    }
    if (this.team === 0 && game.settings.gameplay.infiniteStamina) this.stamina = 100;

    if (this.team === 0 && this.action && this.action.time < this.action.def.hitStart) {
      const magnet = game.settings.combat.magnet;
      if (magnet > 0) {
        const target = game.nearestEnemy(this, 3.5, 0.15);
        if (target) {
          const face = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
          this.yaw = dampAngle(this.yaw, face, 4 + magnet * 14, dt);
        }
      }
    }
  }

  integrate(dt, game) {
    if (this.fading > 1) return;
    const infinite = this.team === 0 && game.settings.gameplay.infiniteStamina;
    if (this.hitstun > 0 || this.dead) {
      this.vel.x = damp(this.vel.x, 0, this.dead ? 2 : 3.4, dt);
      this.vel.z = damp(this.vel.z, 0, this.dead ? 2 : 3.4, dt);
    } else if (this.dodgeTime > 0) {
      const u = 1 - this.dodgeTime / this.dodgeDur;
      const spd = 12.2 * (1 - u * 0.4);
      this.vel.x = this.dodgeX * spd;
      this.vel.z = this.dodgeZ * spd;
    } else if (this.fading <= 0) {
      let speed = this.wishSpeed;
      if (this.action) speed *= this.action.def.moveScale;
      const accel = this.action ? 3.5 : this.grounded ? 14 : 2.1;
      this.vel.x = damp(this.vel.x, this.desired.x * speed, accel, dt);
      this.vel.z = damp(this.vel.z, this.desired.z * speed, accel, dt);
      if (this.sprinting && this.grounded && !infinite) {
        this.stamina = Math.max(0, this.stamina - 18 * dt);
        if (this.stamina <= 0) this.sprinting = false;
      }
    }
    if (this.blocking && !infinite && this.team === 0) {
      this.stamina = Math.max(0, this.stamina - 9 * dt);
      if (this.stamina <= 0) this.blocking = false;
    }
    this.vel.y += -26 * dt;
    this.vel.y = Math.max(-32, this.vel.y);

    if (this.action && !this.action.lunged && this.action.time >= this.action.def.hitStart) {
      this.action.lunged = true;
      this.vel.x += Math.sin(this.yaw) * this.action.def.lunge;
      this.vel.z += Math.cos(this.yaw) * this.action.def.lunge;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;
    if (this.pos.y < 0) {
      this.pos.y = 0;
      if (this.vel.y < 0) this.vel.y = 0;
    }
    const grounded = game.world.resolve(this.pos, this.vel, this.radius, 1.75);
    if (grounded) this.vel.y = Math.max(0, this.vel.y);
    if (grounded && !this.wasGrounded) this.land = 1;
    this.wasGrounded = grounded;
    this.grounded = grounded || this.pos.y <= 0.02;
    if (this.grounded) this.coyote = 0.12;
    else this.coyote = Math.max(0, this.coyote - dt);

    if (game.world.blocked(this.pos.x, this.pos.z, 0.08)) {
      this.pos.x = this.goodX;
      this.pos.z = this.goodZ;
      this.vel.x = 0;
      this.vel.z = 0;
    } else {
      this.goodX = this.pos.x;
      this.goodZ = this.pos.z;
    }

    const moving = this.grounded && this.moveAmt > 0.2 && this.dodgeTime <= 0 && !this.dead;
    if (moving) this.phase += dt * (7.2 + (this.sprinting ? 3.4 : 0)) * clamp(this.moveAmt, 0.3, 1);
    const step = Math.floor(this.phase / Math.PI);
    if (moving && step !== this.lastStep && this.team === 0) {
      this.lastStep = step;
      game.audio.foot();
    } else this.lastStep = step;
  }

  receiveHit({ damage, knock, heavy, dirX, dirZ, source, chip }) {
    if (!this.active || this.dead || this.fading > 0) return { type: 'whiff', damage: 0, heavy, killed: false };
    if (this.invuln > 0) return { type: 'whiff', damage: 0, heavy, killed: false };
    const sx = source.pos.x - this.pos.x;
    const sz = source.pos.z - this.pos.z;
    const face = (Math.sin(this.yaw) * sx + Math.cos(this.yaw) * sz) / (Math.hypot(sx, sz) || 1);

    if (this.action?.armor && !heavy && this.action.time < this.action.def.hitEnd) {
      this.hp -= damage;
      this.flash = 0.7;
      const killed = this.hp <= 0;
      if (killed) this.kill();
      return { type: 'armor', damage, heavy, killed };
    }

    if (this.blocking && this.stamina > 0 && face > 0.2 && this.grounded && this.dodgeTime <= 0) {
      const leak = damage * chip;
      this.hp -= leak;
      this.stamina -= heavy ? 46 : 26;
      this.flash = 0.35;
      this.hitstun = 0.09;
      this.reactDur = 0.2;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.blocking = false;
        this.action = null;
        this.hitstun = 0.8;
        this.reactDur = 0.8;
        this.vel.x = dirX * knock * 0.6;
        this.vel.z = dirZ * knock * 0.6;
        const killed = this.hp <= 0;
        if (killed) this.kill();
        return { type: 'break', damage: leak, heavy, killed };
      }
      const killed = this.hp <= 0;
      if (killed) this.kill();
      return { type: 'block', damage: leak, heavy, killed };
    }

    this.hp -= damage;
    this.action = null;
    this.blocking = false;
    this.reactDur = heavy ? 0.56 : 0.36;
    this.hitstun = this.reactDur;
    this.dodgeSide = Math.random() < 0.5 ? -1 : 1;
    this.vel.x = dirX * knock;
    this.vel.z = dirZ * knock;
    this.vel.y = Math.max(this.vel.y, heavy ? 3.2 : 0.7);
    this.flash = 1;
    this.staminaDelay = 0.35;
    const killed = this.hp <= 0;
    if (killed) this.kill();
    return { type: 'hit', damage, heavy, killed };
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.deadT = 0;
    this.action = null;
    this.blocking = false;
  }

  present(dt) {
    const turn = dt > 0 ? clamp((this.yaw - this.prevYaw) / dt / 4, -1, 1) : 0;
    this.prevYaw = this.yaw;
    const hitU = this.hitstun > 0 ? clamp(1 - this.hitstun / this.reactDur, 0.001, 1) : 0;
    const pose = buildPose({
      phase: this.phase,
      move: this.driving ? 0 : this.moveAmt,
      sprint: this.sprinting ? 1 : 0,
      air: this.grounded || this.driving ? 0 : 1,
      vy: this.vel.y,
      time: performance.now() / 1000,
      land: this.land,
      turnLean: turn,
      clip: this.action?.def.clip || null,
      clipTime: this.action?.time || 0,
      clipW: this.fade > 0 ? 1 - this.fade : 1,
      fadeClip: this.fade > 0 ? this.fadeClip : null,
      fadeTime: this.fadeTime,
      fadeW: this.fade,
      blocking: this.blocking,
      dodgeU: this.dodgeTime > 0 ? 1 - this.dodgeTime / this.dodgeDur : 0,
      dodgeSide: this.dodgeSide,
      hitU,
      hitSide: this.dodgeSide,
      deadU: this.dead ? clamp(this.deadT / 0.85, 0, 1) : 0,
      seated: this.driving,
    });
    this.animator.apply(pose, performance.now() / 1000, this.dead);
    if (!this.driving) {
      this.rig.root.position.set(this.pos.x, this.pos.y, this.pos.z);
      this.rig.root.rotation.set(0, this.yaw, 0);
    }
    const useIK = this.grounded && !this.dead && this.dodgeTime <= 0 && !this.driving && this.action?.def.clip !== 'air';
    this.rig.root.updateMatrixWorld(true);
    if (useIK) {
      applyLegIK(this.rig, {
        yaw: this.yaw,
        phase: this.phase,
        move: this.action ? 0 : this.moveAmt,
        sprint: this.sprinting ? 1 : 0,
        groundY: this.pos.y,
        rootX: this.pos.x,
        rootZ: this.pos.z,
      });
    }

    const showShadow = this.game?.settings.graphics.contactShadows !== false && this.active && !this.driving;
    this.rig.shadow.visible = showShadow;
    this.rig.shadow.position.set(this.pos.x, this.pos.y + 0.035, this.pos.z);
    const lift = this.grounded ? 0 : clamp(this.pos.y, 0, 4);
    this.rig.shadow.material.opacity = showShadow ? clamp(0.38 - lift * 0.1, 0.05, 0.38) : 0;
    this.rig.shadow.scale.setScalar(1 - lift * 0.08);

    for (const m of this._mats) {
      m.emissive.set('#000000');
      m.emissiveIntensity = 0;
      m.transparent = this.fading > 0 || this.deadT > 2.2;
      m.opacity = this.fading > 0 ? clamp(1 - (this.fading - 0.15), 0, 1) : 1;
    }
    if (this.flash > 0) {
      for (const m of this._mats) {
        m.emissive.set('#ffffff');
        m.emissiveIntensity = this.flash * 0.65;
      }
    } else if (this.dodgeTime > 0 && this.invuln > 0) {
      this.rig.mats.jacket.emissive.set('#9ae7ff');
      this.rig.mats.jacket.emissiveIntensity = 0.4;
    } else if (this.team === 1 && this.action) {
      const wind = this.action.time < this.action.def.hitStart;
      const hot = this.action.time <= this.action.def.hitEnd;
      if (wind || hot) {
        this.rig.mats.skin.emissive.set(wind ? '#ffcc44' : '#ff4422');
        this.rig.mats.skin.emissiveIntensity = wind ? 0.7 : 0.85;
      }
    }
    if (this.blink > 0 && this.game?.mode === 'play') this.rig.visual.visible = Math.sin(this.blink * 36) > -0.2;
    else this.rig.visual.visible = true;

    const showBar = this.team === 1 && this.active && !this.dead && (this.hp < this.maxHp - 0.5 || this.controller?.alert);
    this.bar.sprite.visible = !!showBar;
    if (showBar) {
      const h = 2.05 * (this.rig.scale || 1);
      this.bar.sprite.position.set(this.pos.x, this.pos.y + h, this.pos.z);
      const ctx = this.bar.ctx;
      ctx.clearRect(0, 0, 128, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 2, 128, 12);
      const ratio = clamp(this.hp / this.maxHp, 0, 1);
      ctx.fillStyle = this.kind === 'bruiser' ? '#ff8a3a' : '#ff3358';
      ctx.fillRect(2, 4, 124 * ratio, 8);
      this.bar.tex.needsUpdate = true;
    }
  }
}
