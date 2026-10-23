import * as THREE from 'three';

export function createFX(scene) {
  const sparks = [];
  const numbers = [];
  const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.28, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe1a8, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  let ringLife = 0;

  const trailPos = new Float32Array(12 * 2 * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Mesh(
    trailGeo,
    new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
  );
  scene.add(trail);
  const history = [];

  function burst(x, y, z, color, count, speed) {
    for (let i = 0; i < count; i++) {
      let s = sparks.find((p) => p.life <= 0);
      if (!s) {
        const mat = new THREE.MeshBasicMaterial({ color });
        const mesh = new THREE.Mesh(sparkGeo, mat);
        scene.add(mesh);
        s = { mesh, mat, life: 0, vx: 0, vy: 0, vz: 0 };
        sparks.push(s);
      }
      s.mat.color.set(color);
      s.life = 0.18 + Math.random() * 0.16;
      s.mesh.position.set(x, y, z);
      s.mesh.visible = true;
      s.vx = (Math.random() - 0.5) * speed;
      s.vy = Math.random() * speed * 0.8;
      s.vz = (Math.random() - 0.5) * speed;
    }
  }

  function number(x, y, z, text, color) {
    let n = numbers.find((p) => p.life <= 0);
    if (!n) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      const ctx = c.getContext('2d');
      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.3, 0.65, 1);
      scene.add(sprite);
      n = { sprite, ctx, tex, life: 0, vy: 0 };
      numbers.push(n);
    }
    const ctx = n.ctx;
    ctx.clearRect(0, 0, 256, 128);
    ctx.font = '700 72px Oswald, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 86);
    n.tex.needsUpdate = true;
    n.sprite.position.set(x, y, z);
    n.sprite.visible = true;
    n.sprite.material.opacity = 1;
    n.life = 0.7;
    n.vy = 1.4;
  }

  function ringAt(x, z) {
    ring.position.set(x, 0.08, z);
    ring.scale.setScalar(0.4);
    ring.material.opacity = 0.9;
    ring.visible = true;
    ringLife = 0.32;
  }

  function update(dt) {
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.vy -= 8 * dt;
      s.mesh.visible = s.life > 0;
    }
    for (const n of numbers) {
      if (n.life <= 0) continue;
      n.life -= dt;
      n.sprite.position.y += n.vy * dt;
      n.sprite.material.opacity = Math.max(0, n.life / 0.7);
      n.sprite.visible = n.life > 0;
    }
    if (ringLife > 0) {
      ringLife -= dt;
      const u = 1 - ringLife / 0.32;
      ring.scale.setScalar(0.4 + u * 3.2);
      ring.material.opacity = Math.max(0, 0.85 * (1 - u));
      ring.visible = ringLife > 0;
    }
  }

  function trailFrom(points, on) {
    if (!on || points.length < 2) {
      trail.visible = false;
      return;
    }
    trail.visible = true;
    const up = 0.12;
    let vi = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const n = points[Math.min(points.length - 1, i + 1)];
      const dx = n.x - p.x;
      const dz = n.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const sx = (-dz / len) * (0.02 + (i / points.length) * 0.12);
      const sz = (dx / len) * (0.02 + (i / points.length) * 0.12);
      trailPos[vi++] = p.x - sx;
      trailPos[vi++] = p.y + up * (i / points.length);
      trailPos[vi++] = p.z - sz;
      trailPos[vi++] = p.x + sx;
      trailPos[vi++] = p.y;
      trailPos[vi++] = p.z + sz;
    }
    const indices = [];
    const pairs = Math.min(points.length, 12);
    for (let i = 0; i < pairs - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    trailGeo.setIndex(indices);
    trailGeo.setDrawRange(0, indices.length);
    trailGeo.attributes.position.needsUpdate = true;
    trail.material.opacity = 0.8;
  }

  return { burst, number, ringAt, update, trailFrom, history };
}
