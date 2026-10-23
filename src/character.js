import * as THREE from 'three';

export const LIMB = {
  thigh: 0.44,
  shin: 0.42,
  upperArm: 0.3,
  foreArm: 0.26,
  hipHeight: 0.95,
  ankle: 0.07,
  hipWidth: 0.11,
};

const _geo = {};

function capsule(radius, total) {
  const key = `c${radius}x${total}`;
  if (!_geo[key]) {
    const length = Math.max(0.02, total - radius * 2);
    _geo[key] = new THREE.CapsuleGeometry(radius, length, 4, 8);
  }
  return _geo[key];
}

function box(w, h, d) {
  const key = `b${w}x${h}x${d}`;
  if (!_geo[key]) _geo[key] = new THREE.BoxGeometry(w, h, d);
  return _geo[key];
}

function sphere(r) {
  const key = `s${r}`;
  if (!_geo[key]) _geo[key] = new THREE.SphereGeometry(r, 14, 12);
  return _geo[key];
}

function makeMat(color, rough = 0.62, metal = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function hang(mesh, length) {
  mesh.position.y = -length * 0.5;
  mesh.castShadow = true;
  return mesh;
}

const LOOKS = {
  player: {
    skin: '#e0aa84',
    hair: '#1a120e',
    jacket: '#243044',
    shirt: '#f4efe4',
    pants: '#2a3142',
    shoes: '#141414',
    accent: '#d7b15a',
    bald: false,
    pads: false,
    scale: 1,
  },
  striker: {
    skin: '#c6866a',
    hair: '#0e0e10',
    jacket: '#8d2436',
    shirt: '#1a1214',
    pants: '#23262e',
    shoes: '#101014',
    accent: '#e8d7b0',
    bald: false,
    pads: false,
    scale: 1,
  },
  bruiser: {
    skin: '#8d5a3c',
    hair: '#1a120e',
    jacket: '#3a342c',
    shirt: '#4a1818',
    pants: '#1a1a1c',
    shoes: '#0c0c0c',
    accent: '#8a3030',
    bald: true,
    pads: true,
    scale: 1.14,
  },
};

function bone(name, parent, x, y, z) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function createCharacter(lookName = 'player') {
  const look = LOOKS[lookName] || LOOKS.player;
  const mats = {
    skin: makeMat(look.skin, 0.55, 0.02),
    hair: makeMat(look.hair, 0.7, 0.08),
    jacket: makeMat(look.jacket, 0.58, 0.18),
    shirt: makeMat(look.shirt, 0.7, 0.02),
    pants: makeMat(look.pants, 0.78, 0.04),
    shoes: makeMat(look.shoes, 0.45, 0.2),
    accent: makeMat(look.accent, 0.4, 0.35),
    eye: makeMat('#1a1a1a', 0.35, 0.1),
    pad: makeMat('#2a241e', 0.5, 0.25),
  };

  const root = new THREE.Group();
  root.name = 'fighter';
  const visual = new THREE.Group();
  root.add(visual);

  const hips = bone('hips', visual, 0, LIMB.hipHeight, 0);
  const pelvis = new THREE.Mesh(box(0.28, 0.12, 0.16), mats.pants);
  pelvis.position.y = -0.02;
  pelvis.castShadow = true;
  hips.add(pelvis);

  const spine = bone('spine', hips, 0, 0.12, 0);
  const chest = bone('chest', spine, 0, 0.18, 0);
  const torso = new THREE.Mesh(box(0.42, 0.5, 0.24), mats.jacket);
  torso.position.y = -0.1;
  torso.castShadow = true;
  chest.add(torso);
  const shirt = new THREE.Mesh(box(0.26, 0.24, 0.06), mats.shirt);
  shirt.position.set(0, -0.02, 0.1);
  shirt.castShadow = true;
  chest.add(shirt);
  const stripe = new THREE.Mesh(box(0.42, 0.04, 0.23), mats.accent);
  stripe.position.y = -0.12;
  chest.add(stripe);

  const head = bone('head', chest, 0, 0.28, 0);
  const skull = new THREE.Mesh(sphere(0.125), mats.skin);
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(sphere(0.132), mats.hair);
  hair.scale.set(1.02, 0.72, 1.05);
  hair.position.y = 0.06;
  hair.castShadow = true;
  head.add(hair);
  const eyeL = new THREE.Mesh(sphere(0.018), mats.eye);
  const eyeR = new THREE.Mesh(sphere(0.018), mats.eye);
  eyeL.position.set(-0.045, 0.02, 0.1);
  eyeR.position.set(0.045, 0.02, 0.1);
  head.add(eyeL, eyeR);
  const brow = new THREE.Mesh(box(0.12, 0.02, 0.04), mats.hair);
  brow.position.set(0, 0.055, 0.1);
  head.add(brow);

  function arm(side) {
    const s = side === 'L' ? -1 : 1;
    const upper = bone(`upperArm${side}`, chest, s * 0.3, 0.1, 0);
    const upperMesh = hang(new THREE.Mesh(capsule(0.055, LIMB.upperArm), mats.jacket), LIMB.upperArm);
    upper.add(upperMesh);
    const fore = bone(`foreArm${side}`, upper, 0, -LIMB.upperArm, 0);
    const foreMesh = hang(new THREE.Mesh(capsule(0.048, LIMB.foreArm), mats.jacket), LIMB.foreArm);
    fore.add(foreMesh);
    const cuff = new THREE.Mesh(box(0.09, 0.03, 0.09), mats.accent);
    cuff.position.y = -LIMB.foreArm + 0.02;
    fore.add(cuff);
    const hand = bone(`hand${side}`, fore, 0, -LIMB.foreArm, 0);
    const fist = new THREE.Mesh(sphere(0.062), mats.skin);
    fist.castShadow = true;
    hand.add(fist);
    const pad = new THREE.Mesh(box(0.14, 0.08, 0.14), mats.pad);
    pad.position.set(s * 0.02, -0.04, 0);
    pad.visible = false;
    upper.add(pad);
    return { upper, fore, hand, fistMat: mats.skin, pad };
  }

  const left = arm('L');
  const right = arm('R');

  function leg(side) {
    const s = side === 'L' ? -1 : 1;
    const thigh = bone(`thigh${side}`, hips, s * LIMB.hipWidth, -0.04, 0);
    const thighMesh = hang(new THREE.Mesh(capsule(0.07, LIMB.thigh), mats.pants), LIMB.thigh);
    thigh.add(thighMesh);
    const shin = bone(`shin${side}`, thigh, 0, -LIMB.thigh, 0);
    const shinMesh = hang(new THREE.Mesh(capsule(0.055, LIMB.shin), mats.pants), LIMB.shin);
    shin.add(shinMesh);
    const foot = bone(`foot${side}`, shin, 0, -LIMB.shin, 0);
    const shoe = new THREE.Mesh(box(0.11, 0.07, 0.26), mats.shoes);
    shoe.position.set(0, -0.02, 0.06);
    shoe.castShadow = true;
    foot.add(shoe);
    return { thigh, shin, foot };
  }

  const legL = leg('L');
  const legR = leg('R');

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  const rig = {
    root,
    visual,
    shadow,
    hips,
    spine,
    chest,
    head,
    hair,
    upperArmL: left.upper,
    foreArmL: left.fore,
    handL: left.hand,
    upperArmR: right.upper,
    foreArmR: right.fore,
    handR: right.hand,
    thighL: legL.thigh,
    shinL: legL.shin,
    footL: legL.foot,
    thighR: legR.thigh,
    shinR: legR.shin,
    footR: legR.foot,
    pads: [left.pad, right.pad],
    mats,
    handMats: [mats.skin],
  };

  applyLook(rig, lookName);
  return rig;
}

export function applyLook(rig, lookName) {
  const look = LOOKS[lookName] || LOOKS.player;
  rig.lookName = lookName;
  rig.mats.skin.color.set(look.skin);
  rig.mats.hair.color.set(look.hair);
  rig.mats.jacket.color.set(look.jacket);
  rig.mats.shirt.color.set(look.shirt);
  rig.mats.pants.color.set(look.pants);
  rig.mats.shoes.color.set(look.shoes);
  rig.mats.accent.color.set(look.accent);
  rig.hair.visible = !look.bald;
  for (const pad of rig.pads) pad.visible = !!look.pads;
  rig.visual.scale.setScalar(look.scale);
  rig.scale = look.scale;
}

export const BONE_NAMES = [
  'hips', 'spine', 'chest', 'head',
  'upperArmL', 'foreArmL', 'handL',
  'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL',
  'thighR', 'shinR', 'footR',
];
