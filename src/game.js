import * as THREE from 'three';
import { CameraRig } from './cameraRig.js';
import { EnemyAI } from './enemy.js';
import { Fighter } from './fighter.js';
import { createFX } from './fx.js';
import { createHUD } from './hud.js';
import { Input } from './input.js';
import { CAR_PARK, CLINIC, PLAYER_SPAWN, SPAWN_POINTS } from './layout.js';
import { PlayerController } from './player.js';
import { commitSetting, loadSettings, resetSettings } from './settings.js';
import { DriveCar, TrafficCar, setHeadlights, vehicleCircles } from './vehicle.js';
import { createWorld, pushCircles } from './world.js';
import { createAudio } from './audio.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _hand = new THREE.Vector3();

export function createGame(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 500);
  const world = createWorld(scene, renderer);
  const audio = createAudio();
  const settings = loadSettings();
  const fx = createFX(scene);
  const cam = new CameraRig(camera);
  const input = new Input(canvas, () => game.mode);

  const player = new Fighter(scene, 'player', 0);
  player.controller = new PlayerController();
  player.resetPlayer(PLAYER_SPAWN.x, PLAYER_SPAWN.z, settings.gameplay.playerVitality);
  player.invuln = 0;
  player.blink = 0;

  const car = new DriveCar(scene, CAR_PARK.x, CAR_PARK.z);
  const traffic = [
    new TrafficCar(scene, '#d8d2c4', 0.05),
    new TrafficCar(scene, '#355c7d', 0.55),
  ];

  const game = {
    mode: 'menu',
    settings,
    scene,
    world,
    audio,
    input,
    camera: cam,
    player,
    enemies: [],
    car,
    traffic,
    wave: 1,
    kos: 0,
    score: 0,
    best: Number(localStorage.getItem('southline.best') || 0),
    heat: 0,
    calm: 0,
    clinicCd: 0,
    combatTimer: 10,
    playTime: 0,
    bannerT: 0,
    banner: '',
    bannerSub: '',
    feed: '',
    feedT: 0,
    hitStop: 0,
    combo: 0,
    comboT: 0,
    wastedPlayed: false,
    lockPauseAt: 0,
    time: 0,
  };

  const hud = createHUD(settings, {
    onChange(path, value) {
      commitSetting(settings, path, value);
      game.applyLive();
      hud.sync();
      audio.resume();
    },
    onPlay() { audio.resume(); audio.ui(); game.startRun(); },
    onResume() { audio.ui(); game.resume(); },
    onRestart() { audio.ui(); game.startRun(); },
    onTitle() { audio.ui(); game.toTitle(); },
    onReset() {
      const fresh = resetSettings();
      for (const key of Object.keys(fresh)) Object.assign(settings[key], fresh[key]);
      game.applyLive();
      hud.sync();
    },
  });

  game.applyLive = () => {
    world.applyTime(settings.graphics.timeOfDay, settings.graphics.fog);
    world.applyQuality(settings.graphics.quality, settings.graphics.shadows);
    const duck = game.mode === 'play' ? 1 : 0.7;
    audio.apply(settings.audio, duck);
    for (const t of traffic) t.visual.root.visible = settings.gameplay.traffic;
    if (!player.dead) {
      const maxHp = settings.gameplay.playerVitality;
      if (player.maxHp !== maxHp) {
        const ratio = player.maxHp > 0 ? player.hp / player.maxHp : 1;
        player.maxHp = maxHp;
        player.hp = Math.max(1, maxHp * ratio);
      }
    }
    if (game.mode === 'play') game.reconcile();
  };

  game.nearestEnemy = (from, maxDist, minDot) => {
    let best = null;
    let bestD = maxDist;
    const fx = Math.sin(from.yaw);
    const fz = Math.cos(from.yaw);
    for (const e of game.enemies) {
      if (!e.active || e.dead || e.fading > 0) continue;
      const dx = e.pos.x - from.pos.x;
      const dz = e.pos.z - from.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || d < 0.05) continue;
      if ((dx * fx + dz * fz) / d < minDot) continue;
      best = e;
      bestD = d;
    }
    return best;
  };

  game.startRun = () => {
    game.mode = 'play';
    game.wave = 1;
    game.kos = 0;
    game.score = 0;
    game.heat = 0;
    game.calm = 0;
    game.clinicCd = 0;
    game.combo = 0;
    game.playTime = 0;
    game.hitStop = 0;
    game.wastedPlayed = false;
    for (const e of game.enemies) e.deactivate();
    if (player.driving) leaveCar();
    player.resetPlayer(PLAYER_SPAWN.x, PLAYER_SPAWN.z, settings.gameplay.playerVitality);
    player.controller.lock = null;
    car.reset(CAR_PARK.x, CAR_PARK.z);
    cam.yaw = player.yaw;
    cam.pitch = 0.42;
    cam.zoom = 0;
    hud.show(null);
    hud.setFrom('pause');
    say('WAVE 1', 'Clear the docks', 2.2);
    game.reconcile();
    canvas.requestPointerLock?.();
  };

  game.resume = () => {
    game.mode = 'play';
    hud.show(null);
    canvas.requestPointerLock?.();
  };

  game.pause = () => {
    if (game.mode !== 'play') return;
    game.mode = 'paused';
    hud.setFrom('pause');
    hud.show('pause');
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  };

  game.toTitle = () => {
    if (player.driving) leaveCar();
    for (const e of game.enemies) e.deactivate();
    player.resetPlayer(PLAYER_SPAWN.x, PLAYER_SPAWN.z, settings.gameplay.playerVitality);
    player.invuln = 0;
    player.blink = 0;
    car.reset(CAR_PARK.x, CAR_PARK.z);
    game.mode = 'menu';
    hud.show('menu');
    hud.sync();
  };

  function say(title, sub, time) {
    game.banner = title;
    game.bannerSub = sub;
    game.bannerT = time;
  }

  function quota() {
    return 4 + game.wave;
  }

  function rememberScore() {
    if (game.score > game.best) {
      game.best = game.score;
      localStorage.setItem('southline.best', String(game.best));
      hud.sync();
    }
  }

  game.reconcile = () => {
    if (game.mode !== 'play' || game.calm > 0) return;
    const want = settings.gameplay.enemyCount;
    let living = game.enemies.filter((e) => e.active && !e.dead && e.fading <= 0);
    while (living.length > want) {
      living.sort((a, b) => distToPlayer(b) - distToPlayer(a));
      living.shift().dismiss();
    }
    let guard = 0;
    while (living.length < want && guard < 6) {
      guard += 1;
      const spawned = spawnOne();
      if (!spawned) break;
      living.push(spawned);
    }
  };

  function distToPlayer(e) {
    return Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
  }

  function spawnOne() {
    const heat = settings.gameplay.heatEnabled ? game.heat : 0;
    const bruisers = game.enemies.filter((e) => e.active && !e.dead && e.kind === 'bruiser').length;
    const kind = heat >= 4 || bruisers < Math.floor(settings.gameplay.enemyCount / 3) ? 'bruiser' : 'striker';
    const points = [...SPAWN_POINTS].sort(() => Math.random() - 0.5);
    let spot = null;
    for (const p of points) {
      const x = p[0];
      const z = p[1];
      if (Math.hypot(x - player.pos.x, z - player.pos.z) < 14) continue;
      if (world.blocked(x, z, 0.6) || !clearOfCars(x, z, 0.8)) continue;
      spot = { x, z };
      break;
    }
    if (!spot) {
      const far = [...SPAWN_POINTS]
        .filter((p) => !world.blocked(p[0], p[1], 0.6) && clearOfCars(p[0], p[1], 0.8))
        .sort((a, b) => Math.hypot(b[0] - player.pos.x, b[1] - player.pos.z) - Math.hypot(a[0] - player.pos.x, a[1] - player.pos.z))[0];
      if (!far) return null;
      spot = { x: far[0], z: far[1] };
    }
    let enemy = game.enemies.find((e) => !e.active);
    if (!enemy) {
      if (game.enemies.length >= 14) return null;
      enemy = new Fighter(scene, kind, 1);
      enemy.controller = new EnemyAI();
      enemy.game = game;
      game.enemies.push(enemy);
    }
    const scale = settings.gameplay.enemyHealth * (1 + (game.wave - 1) * 0.14);
    enemy.activate(kind === 'bruiser' && Math.random() < 0.55 && heat < 4 ? 'striker' : kind, spot.x, spot.z, scale);
    return enemy;
  }

  function leaveCar() {
    const spot = exitSpot();
    player.exitCar(spot.x, spot.z, car.yaw);
    car.occupied = false;
  }

  function vehicleObstacles(except) {
    const list = [];
    const add = (ref) => {
      if (!ref || ref === except) return;
      list.push({ ref, x: ref.x, z: ref.z, yaw: ref.yaw || 0 });
    };
    add(car);
    if (settings.gameplay.traffic) for (const t of traffic) add(t);
    for (const p of world.parked) add(p);
    return list;
  }

  function carBodies() {
    const list = [];
    for (const o of vehicleObstacles(null)) list.push(...vehicleCircles(o.x, o.z, o.yaw));
    return list;
  }

  function clearOfCars(x, z, radius) {
    return carBodies().every((c) => Math.hypot(c.x - x, c.z - z) >= c.r + radius);
  }

  function exitSpot() {
    const tries = [
      [Math.cos(car.yaw), -Math.sin(car.yaw), 2.4],
      [-Math.cos(car.yaw), Math.sin(car.yaw), 2.4],
      [Math.sin(car.yaw), Math.cos(car.yaw), 3.1],
    ];
    for (const [x, z, dist] of tries) {
      const px = car.x + x * dist;
      const pz = car.z + z * dist;
      if (!world.blocked(px, pz, 0.5) && clearOfCars(px, pz, 0.45)) return { x: px, z: pz };
    }
    return { x: car.x + 2.2, z: car.z + 1.2 };
  }

  function resolveHits() {
    const list = [player, ...game.enemies.filter((e) => e.active && !e.dead)];
    for (const a of list) {
      if (!a.action || a.driving) continue;
      for (const b of list) {
        if (a === b || a.team === b.team || b.driving) continue;
        connect(a, b);
      }
    }
  }

  function connect(a, b) {
    const def = a.action.def;
    if (a.action.time < def.hitStart || a.action.time > def.hitEnd) return;
    if (a.action.hitIds.has(b.id) || b.invuln > 0 || !b.active || b.dead) return;
    const dx = b.pos.x - a.pos.x;
    const dz = b.pos.z - a.pos.z;
    const body = Math.hypot(dx, dz);
    if (body > def.bodyRange + b.radius) return;
    const dot = (Math.sin(a.yaw) * dx + Math.cos(a.yaw) * dz) / (body || 1);
    if (dot < 0.02) return;
    a.rig.root.updateMatrixWorld(true);
    b.rig.root.updateMatrixWorld(true);
    const fist = a.rig[def.hitBone].getWorldPosition(_v1);
    const chest = b.rig.chest.getWorldPosition(_v2);
    const fd = fist.distanceTo(chest);
    const close = body < def.bodyRange * 0.9 && dot > 0.4;
    if (fd > def.range + b.radius * 0.35 && !close) return;
    a.action.hitIds.add(b.id);
    let damage = def.damage;
    if (a.team === 0) damage *= settings.combat.playerDamage;
    else damage *= settings.gameplay.enemyDamage * (1 + (game.wave - 1) * 0.08) * (a.kind === 'bruiser' ? 1.18 : 1);
    const knock = def.knock * settings.combat.knockback * (a.team === 0 ? 1 : 0.8);
    const result = b.receiveHit({
      damage, knock, heavy: def.heavy,
      dirX: dx / (body || 1), dirZ: dz / (body || 1),
      source: a, chip: settings.combat.blockChip,
    });
    onHit(a, b, result, fist);
  }

  function onHit(a, b, result, point) {
    if (result.type === 'whiff') return;
    game.combatTimer = 0;
    if (result.type === 'block') {
      audio.block();
      if (settings.combat.sparks) fx.burst(point.x, point.y, point.z, '#d7e7ff', 5, 3);
      cam.shake(0.12 * settings.combat.shake);
      return;
    }
    if (result.type === 'break') {
      audio.hurt();
      say('GUARD BROKEN', '', 0.7);
      cam.shake(0.35 * settings.combat.shake);
    }
    if (a.team === 0 && (result.type === 'hit' || result.type === 'armor')) {
      game.combo += 1;
      game.comboT = 2.3;
      game.score += 8 * game.combo;
      if (settings.gameplay.heatEnabled) game.heat = Math.min(5, game.heat + 0.14);
      game.hitStop = settings.combat.hitStop * (result.heavy ? 1.45 : 1);
      cam.shake((result.heavy ? 0.55 : 0.28) * settings.combat.shake);
      audio.hit(result.heavy);
      if (settings.combat.sparks) {
        fx.burst(point.x, point.y, point.z, result.heavy ? '#ffd27a' : '#ffe8c8', result.heavy ? 12 : 7, result.heavy ? 6 : 4);
        if (result.heavy) fx.ringAt(b.pos.x, b.pos.z);
      }
      if (settings.combat.damageNumbers) {
        fx.number(b.pos.x, b.pos.y + 1.7, b.pos.z, String(Math.round(result.damage)), result.type === 'armor' ? '#ffb089' : '#fff4df');
      }
      if (result.killed) onKo(b);
    }
    if (a.team === 1 && result.type === 'hit') {
      audio.hurt();
      hud.hurt();
      cam.shake(0.4 * settings.combat.shake);
      if (settings.gameplay.heatEnabled) game.heat = Math.min(5, game.heat + 0.08);
      if (result.killed) onDown();
    }
    rememberScore();
  }

  function onKo(enemy) {
    game.kos += 1;
    game.score += Math.round(140 * (1 + game.combo * 0.15) * (1 + game.heat * 0.06));
    if (settings.gameplay.heatEnabled) game.heat = Math.min(5, game.heat + 0.48);
    audio.ko();
    game.feed = enemy.kind === 'bruiser' ? 'BRUISER DOWN' : 'STRIKER DOWN';
    game.feedT = 1.4;
    rememberScore();
    if (game.kos >= quota()) clearWave();
  }

  function clearWave() {
    game.score += 450 * game.wave;
    say('BLOCK SECURED', `Wave ${game.wave} cleared`, 2.4);
    game.wave += 1;
    game.kos = 0;
    game.calm = 6;
    game.heat = Math.max(0, game.heat - 1.8);
    for (const e of game.enemies) if (e.active && !e.dead) e.dismiss();
    rememberScore();
  }

  function onDown() {
    audio.wasted();
    game.wastedPlayed = true;
    say('WASTED', 'The block keeps you', 2);
  }

  function vehicleTouches(source, f) {
    return vehicleCircles(source.x, source.z, source.yaw).some(
      (c) => Math.hypot(f.pos.x - c.x, f.pos.z - c.z) < c.r + f.radius,
    );
  }

  function vehicleBump(source, speed, scale, canHitPlayer) {
    if (Math.abs(speed) < 5.2) return;
    const bodies = canHitPlayer ? [player, ...game.enemies] : game.enemies;
    for (const f of bodies) {
      if (!f.active || f.dead || f.driving || f.carCd > 0) continue;
      if (!vehicleTouches(source, f)) continue;
      const d = Math.hypot(f.pos.x - source.x, f.pos.z - source.z);
      f.carCd = 0.7;
      const dx = f.pos.x - source.x;
      const dz = f.pos.z - source.z;
      const body = d || 1;
      const damage = (10 + Math.abs(speed) * 1.35) * scale * settings.gameplay.trafficDamage;
      if (damage <= 0) {
        f.vel.x += (dx / body) * 6;
        f.vel.z += (dz / body) * 6;
        continue;
      }
      const result = f.receiveHit({
        damage, knock: 8 + Math.abs(speed) * 0.3, heavy: true,
        dirX: dx / body, dirZ: dz / body, source: { pos: source }, chip: 1,
      });
      if (f === player && result.killed) onDown();
      if (f !== player && result.killed) onKo(f);
      source.speed *= 0.82;
    }
  }

  function interact() {
    if (player.dead) return;
    if (player.driving) {
      if (input.just('KeyF')) leaveCar();
      if (input.just('KeyH')) audio.honk();
      return;
    }
    const nearCar = Math.hypot(player.pos.x - car.x, player.pos.z - car.z) < 3.1;
    if (nearCar && input.just('KeyF') && player.hitstun <= 0) {
      player.enterCar(car);
      car.occupied = true;
      player.controller.lock = null;
      return;
    }
    const nearClinic = Math.hypot(player.pos.x - CLINIC.x, player.pos.z - CLINIC.z) < 2.6;
    if (nearClinic && input.just('KeyE') && game.clinicCd <= 0 && player.hp < player.maxHp - 0.5) {
      player.hp = Math.min(player.maxHp, player.hp + 55);
      game.clinicCd = 24;
      audio.heal();
      player.flash = 0.6;
    }
  }

  function prompt() {
    if (player.dead) return '';
    if (player.driving) return 'F  STEP OUT';
    if (Math.hypot(player.pos.x - car.x, player.pos.z - car.z) < 3.1) return 'F  GET IN';
    if (Math.hypot(player.pos.x - CLINIC.x, player.pos.z - CLINIC.z) < 2.6) {
      if (game.clinicCd > 0) return `CLINIC  ${Math.ceil(game.clinicCd)}S`;
      if (player.hp >= player.maxHp - 0.5) return 'ALREADY PATCHED UP';
      return 'E  PATCH UP';
    }
    return '';
  }

  function updatePlay(dt) {
    game.playTime += dt;
    game.clinicCd = Math.max(0, game.clinicCd - dt);
    game.bannerT = Math.max(0, game.bannerT - dt);
    game.feedT = Math.max(0, game.feedT - dt);
    game.comboT = Math.max(0, game.comboT - dt);
    if (game.comboT <= 0) game.combo = 0;
    if (game.bannerT <= 0) {
      game.banner = '';
      game.bannerSub = '';
    }
    if (game.feedT <= 0) game.feed = '';
    game.combatTimer += dt;
    if (game.combatTimer > 7 && settings.gameplay.heatEnabled) {
      game.heat = Math.max(0, game.heat - dt * 0.2 * settings.gameplay.heatDecay);
    }
    if (game.calm > 0) {
      game.calm -= dt;
      if (game.calm <= 0) {
        say(`WAVE ${game.wave}`, 'They came back', 1.8);
        game.reconcile();
      }
    }

    if (!player.dead) interact();
    if (player.driving) {
      car.update(dt, input, world.blocks, vehicleObstacles(car));
      player.pos.set(car.x, 0, car.z);
      player.update(dt, game);
      vehicleBump(car, car.speed, 1, false);
    } else if (!player.dead) {
      player.update(dt, game);
      car.sync(dt, 0);
    } else {
      player.update(dt, game);
      if (player.deadT > 2.7) {
        player.resetPlayer(PLAYER_SPAWN.x, PLAYER_SPAWN.z, settings.gameplay.playerVitality);
        game.heat = Math.max(0, game.heat - 1);
        game.wastedPlayed = false;
        cam.yaw = 0;
      }
    }

    for (const e of game.enemies) e.update(dt, game);
    separate();
    for (const f of [player, ...game.enemies]) {
      if (!f.active || f.driving) continue;
      pushCircles(f.pos, f.radius, carBodies());
      world.resolve(f.pos, f.vel, f.radius, 1.75);
    }
    resolveHits();

    if (settings.gameplay.traffic) {
      for (const t of traffic) {
        const dx = (player.driving ? car.x : player.pos.x) - t.x;
        const dz = (player.driving ? car.z : player.pos.z) - t.z;
        const ahead = dx * Math.sin(t.yaw) + dz * Math.cos(t.yaw);
        const side = Math.hypot(dx, dz);
        const crawl = ahead > 0 && ahead < 8 && side < 2.6;
        t.update(dt, vehicleObstacles(t), crawl ? 1.2 : t.baseSpeed);
        vehicleBump(t, t.speed, 0.85, !player.driving);
        if (crawl && t.honkCd <= 0 && side < 2.4) {
          t.honkCd = 1.6;
          audio.honk();
        }
      }
    }
    if (player.driving) {
      car.collide(world.blocks, vehicleObstacles(car));
      player.pos.set(car.x, 0, car.z);
    }
    audio.engine(player.driving ? car.speed : 0);
    if (!player.driving) audio.engineOff();

    const hand = player.action ? player.rig[player.action.def.hitBone] : null;
    if (hand && settings.combat.trails && !player.driving) {
      hand.getWorldPosition(_hand);
      fx.history.push(_hand.clone());
      if (fx.history.length > 8) fx.history.shift();
    } else if (fx.history.length) fx.history.shift();
    fx.trailFrom(fx.history, settings.combat.trails);
    fx.update(dt);

    if (player.dead && !game.wastedPlayed) onDown();
  }

  function separate() {
    const bodies = [player, ...game.enemies.filter((e) => e.active && !e.dead && !e.driving)];
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (a.dodgeTime > 0 || b.dodgeTime > 0) continue;
        let dx = b.pos.x - a.pos.x;
        let dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = a.radius + b.radius;
        if (d < min && d > 0.0001) {
          const push = (min - d) / d * 0.5;
          if (!a.action) { a.pos.x -= dx * push; a.pos.z -= dz * push; }
          if (!b.action) { b.pos.x += dx * push; b.pos.z += dz * push; }
        }
      }
    }
  }

  function showcase(dt) {
    game.time += dt;
    player.yaw = cam.orbit + 2.35;
    player.moveAmt = 0;
    player.sprinting = false;
    player.phase += dt * 0.6;
    player.update(dt, game);
    if (settings.gameplay.traffic) {
      for (const t of traffic) t.update(dt, vehicleObstacles(t));
    }
    car.sync(dt, 0);
    fx.update(dt);
    audio.engineOff();
  }

  function cameraTarget() {
    const driving = player.driving;
    const lock = player.controller.lock;
    let lockYaw = null;
    if (lock && lock.active && !lock.dead && !driving) {
      lockYaw = Math.atan2(lock.pos.x - player.pos.x, lock.pos.z - player.pos.z);
    }
    return {
      x: driving ? car.x : player.pos.x,
      y: driving ? 0 : player.pos.y,
      z: driving ? car.z : player.pos.z,
      vx: driving ? Math.sin(car.yaw) * car.speed : player.vel.x,
      vz: driving ? Math.cos(car.yaw) * car.speed : player.vel.z,
      phase: player.phase,
      move: driving ? 0 : player.moveAmt,
      sprint: player.sprinting,
      driving,
      carSpeed: driving ? car.speed : 0,
      lockYaw,
    };
  }

  function drawMap() {
    if (game.mode !== 'play' || !settings.gameplay.showMinimap) return;
    const dots = [];
    const crew = settings.gameplay.colorblind ? '#3ee0ff' : '#ff3358';
    for (const e of game.enemies) {
      if (!e.active) continue;
      dots.push({ x: e.pos.x, z: e.pos.z, color: e.dead ? '#664044' : crew, r: e.kind === 'bruiser' ? 4.4 : 3.2 });
    }
    dots.push({ x: car.x, z: car.z, color: '#e4572e', shape: 'rect', yaw: -car.yaw, r: 3 });
    if (settings.gameplay.traffic) {
      for (const t of traffic) dots.push({ x: t.x, z: t.z, color: '#d5dbe6', shape: 'rect', yaw: -t.yaw });
    }
    world.drawMap(hud.ui.map, 168, {
      x: player.driving ? car.x : player.pos.x,
      z: player.driving ? car.z : player.pos.z,
      yaw: player.driving ? car.yaw : cam.yaw,
    }, dots, settings.gameplay.rotateMinimap, settings.gameplay.colorblind);
  }

  function refreshHud() {
    const tipIndex = settings.gameplay.tutorial && game.playTime < 28 ? Math.floor(game.playTime / 7) : -1;
    hud.update({
      mode: game.mode,
      hp: player.hp,
      maxHp: player.maxHp,
      stamina: player.stamina,
      heat: game.heat,
      heatEnabled: settings.gameplay.heatEnabled,
      waveText: game.mode === 'play' ? `WAVE ${Math.max(1, game.calm > 0 ? game.wave - 1 : game.wave)}` : '',
      subText: game.calm > 0 ? 'STREET IS QUIET' : `${Math.min(game.kos, quota())} / ${quota()} DOWN`,
      score: game.score,
      combo: game.combo,
      banner: game.bannerT > 0 ? game.banner : '',
      bannerSub: game.bannerT > 0 ? game.bannerSub : '',
      feed: game.feedT > 0 ? game.feed : '',
      prompt: game.mode === 'play' ? prompt() : '',
      hint: tipIndex >= 0 ? hud.tip(tipIndex) : '',
      wasted: player.dead && player.deadT > 0.35 && player.deadT < 2.6,
      vignette: settings.graphics.vignette,
      minimap: settings.gameplay.showMinimap,
      driving: player.driving,
      locked: !!player.controller.lock,
      lockedPointer: document.pointerLockElement === canvas,
    });
  }

  const clock = new THREE.Clock();
  function frame() {
    const real = Math.min(clock.getDelta(), 0.05);
    try {
    if (game.mode === 'play') {
      cam.consumeLook(input, settings, real);
      if (game.hitStop > 0) {
        game.hitStop -= real;
        fx.update(real);
      } else updatePlay(real * settings.gameplay.gameSpeed);
      cam.update(real, cameraTarget(), settings, world.blocks);
      setHeadlights(car, world.headlight);
      for (const t of traffic) setHeadlights(t, world.headlight * 0.45);
      world.update(real, cameraTarget());
      audio.music(settings.gameplay.heatEnabled ? game.heat : 0, true);
      drawMap();
      refreshHud();
      input.endFrame();
    } else if (game.mode === 'menu') {
      showcase(real);
      cam.updateMenu(real, game.time, player.pos);
      setHeadlights(car, world.headlight);
      world.update(real, player.pos);
      audio.music(0, true);
      audio.apply(settings.audio, 0.65);
      refreshHud();
    } else {
      world.update(real, player.driving ? car : player.pos);
      setHeadlights(car, world.headlight);
      audio.apply(settings.audio, 0.45);
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
      return;
    }
    renderer.render(scene, camera);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) {
      settings.audio.mute = !settings.audio.mute;
      audio.apply(settings.audio, game.mode === 'play' ? 1 : 0.6);
      hud.sync();
    }
    if (e.code === 'F1') {
      hud.setFrom(game.mode === 'play' ? 'pause' : game.mode === 'paused' ? 'pause' : 'menu');
      if (game.mode === 'play') game.pause();
      hud.show('controls');
      return;
    }
    if (e.code !== 'Escape' || e.repeat) return;
    if (performance.now() - game.lockPauseAt < 350) return;
    const screen = document.querySelector('[data-screen]:not(.hidden)');
    const which = screen?.dataset.screen;
    if (which === 'settings' || which === 'controls') {
      hud.back();
      return;
    }
    if (document.pointerLockElement === canvas) return;
    if (game.mode === 'play') game.pause();
    else if (game.mode === 'paused') game.resume();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && game.mode === 'play') {
      game.lockPauseAt = performance.now();
      game.pause();
    }
  });
  window.addEventListener('pointerdown', () => audio.resume());

  game.applyLive();
  player.pos.set(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);
  frame();
  return game;
}
