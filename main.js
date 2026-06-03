import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function loadSkybox() {
  return new Promise((resolve, reject) => {
    new THREE.CubeTextureLoader()
      .setPath('assets/')
      .load(
        ['sky_px.png', 'sky_nx.png', 'sky_py.png', 'sky_ny.png', 'sky_pz.png', 'sky_nz.png'],
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        reject
      );
  });
}

// ---------------------------------------------------------------------------
// Textures (procedural canvas textures)
// ---------------------------------------------------------------------------

function makeCanvasTexture(drawFn, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const grassTexture = makeCanvasTexture((ctx, s) => {
  ctx.fillStyle = '#3a7d44';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const g = 90 + Math.random() * 80;
    ctx.fillStyle = `rgb(${30 + Math.random() * 30}, ${g}, ${40 + Math.random() * 30})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 4);
  }
}, 512);
grassTexture.repeat.set(8, 8);

const sandTexture = makeCanvasTexture((ctx, s) => {
  ctx.fillStyle = '#d4b483';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    ctx.fillStyle = `rgba(${180 + Math.random() * 40}, ${150 + Math.random() * 40}, ${90 + Math.random() * 30}, 0.35)`;
    ctx.fillRect(x, y, 1, 1);
  }
}, 256);
sandTexture.repeat.set(3, 3);

const brickTexture = makeCanvasTexture((ctx, s) => {
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(0, 0, s, s);
  const bw = s / 4;
  const bh = s / 8;
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * (bw / 2);
    for (let col = -1; col < 5; col++) {
      ctx.strokeStyle = '#5c3317';
      ctx.lineWidth = 2;
      ctx.strokeRect(offset + col * bw, row * bh, bw - 2, bh - 2);
      ctx.fillStyle = row % 2 ? '#a0522d' : '#9b4b2f';
      ctx.fillRect(offset + col * bw + 1, row * bh + 1, bw - 4, bh - 4);
    }
  }
}, 256);
brickTexture.repeat.set(2, 1);

// ---------------------------------------------------------------------------
// Scene, renderer, camera
// ---------------------------------------------------------------------------

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 14, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minDistance = 6;
controls.maxDistance = 40;
controls.target.set(0, 0, 8);
controls.mouseButtons = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE,
};

// WASD camera rotation (orbit around target)
const rotateKeys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
const camOffset = new THREE.Vector3();
const camSpherical = new THREE.Spherical();
const CAM_ROTATE_SPEED = 1.75;

function updateWasdCamera(dt) {
  let dAzimuth = 0;
  let dPolar = 0;
  if (rotateKeys.KeyA) dAzimuth += CAM_ROTATE_SPEED * dt;
  if (rotateKeys.KeyD) dAzimuth -= CAM_ROTATE_SPEED * dt;
  if (rotateKeys.KeyW) dPolar += CAM_ROTATE_SPEED * dt;
  if (rotateKeys.KeyS) dPolar -= CAM_ROTATE_SPEED * dt;
  if (dAzimuth === 0 && dPolar === 0) return;

  camOffset.copy(camera.position).sub(controls.target);
  camSpherical.setFromVector3(camOffset);
  camSpherical.theta += dAzimuth;
  camSpherical.phi = THREE.MathUtils.clamp(
    camSpherical.phi + dPolar,
    0.2,
    Math.PI / 2.05
  );
  camOffset.setFromSpherical(camSpherical);
  camera.position.copy(controls.target).add(camOffset);
  cameraAutoFollow = false;
}

// Camera follow — pans to the ball after each shot
let cameraAutoFollow = true;
const cameraTargetGoal = new THREE.Vector3(0, 0.4, 8);
const cameraPositionGoal = new THREE.Vector3(0, 11, 18);

function setCameraGoals(bx, bz, viewAngle, immediate = false) {
  cameraTargetGoal.set(bx, 0.4, bz);
  const dist = 9;
  const height = 10;
  cameraPositionGoal.set(
    bx + Math.sin(viewAngle) * dist,
    height,
    bz + Math.cos(viewAngle) * dist
  );
  if (immediate) {
    controls.target.copy(cameraTargetGoal);
    camera.position.copy(cameraPositionGoal);
  }
}

setCameraGoals(0, 8, 0, true);

// ---------------------------------------------------------------------------
// Sky — cloudy.png cubemap cross texture
// ---------------------------------------------------------------------------

const skybox = await loadSkybox();
scene.background = skybox;
scene.environment = skybox;

const SUN_POSITION = new THREE.Vector3(30, 50, -20);

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------

scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.15);
sunLight.position.copy(SUN_POSITION);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -20;
sunLight.shadow.camera.right = 20;
sunLight.shadow.camera.top = 20;
sunLight.shadow.camera.bottom = -20;
scene.add(sunLight);

scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a7d44, 0.45));

const holeLight = new THREE.PointLight(0xffd166, 0.8, 12);
holeLight.position.set(0, 2, -8);
scene.add(holeLight);

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const mat = {
  grass: new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 0.85 }),
  sand: new THREE.MeshStandardMaterial({ map: sandTexture, roughness: 0.95 }),
  brick: new THREE.MeshStandardMaterial({ map: brickTexture, roughness: 0.7 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.8 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.95 }),
  treeTrunk: new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }),
  treeLeaf: new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.5 }),
  red: new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.5 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.2 }),
  ball: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.05 }),
  water: new THREE.MeshStandardMaterial({
    color: 0x1ba3c4,
    transparent: true,
    opacity: 0.88,
    roughness: 0.15,
    metalness: 0.25,
  }),
  bumper: new THREE.MeshStandardMaterial({ color: 0x457b9d, roughness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.4, metalness: 0.3 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 }),
};

function addMesh(geometry, material, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

const courseGroup = new THREE.Group();
scene.add(courseGroup);

const green = addMesh(new THREE.BoxGeometry(18, 0.35, 24), mat.grass, 0, -0.18, -2);
courseGroup.add(green);

[[0, 0.5, -14.2, 18, 1, 0.4], [-9.2, 0.5, -2, 0.4, 1, 24], [9.2, 0.5, -2, 0.4, 1, 24], [0, 0.5, 10.2, 18, 1, 0.4]].forEach(([x, y, z, sx, sy, sz]) => {
  const wall = addMesh(new THREE.BoxGeometry(sx, sy, sz), mat.brick, x, y, z);
  courseGroup.add(wall);
});

[[-5, -0.03, 2, 2.2], [6, -0.03, -5, 1.8], [-3, -0.03, -9, 1.5], [4, -0.03, 4, 2]].forEach(([x, y, z, r]) => {
  const bunker = addMesh(new THREE.CylinderGeometry(r, r, 0.06, 24), mat.sand, x, y, z);
  courseGroup.add(bunker);
});

[[-7, 0.35, 8, 0.5], [-6.2, 0.28, 8.6, 0.35], [7.5, 0.4, 6, 0.55], [8.1, 0.3, 5.3, 0.3],
 [-8, 0.32, -6, 0.4], [8.5, 0.38, -3, 0.45], [-2, 0.25, 9, 0.28], [3, 0.3, 9.5, 0.32]].forEach(([x, y, z, r]) => {
  const rock = addMesh(new THREE.SphereGeometry(r, 12, 10), mat.rock, x, y, z);
  courseGroup.add(rock);
});

[[-2, 0.6, 6, 0.12], [2, 0.6, 6, 0.12], [-2, 0.6, 0, 0.12], [2, 0.6, 0, 0.12]].forEach(([x, y, z, r]) => {
  const post = addMesh(new THREE.CylinderGeometry(r, r, 1.2, 8), mat.white, x, y, z);
  courseGroup.add(post);
});

[[-8, 0, -10], [8, 0, -11], [-8.5, 0, 5], [8, 0, 2]].forEach(([tx, ty, tz]) => {
  const trunk = addMesh(new THREE.CylinderGeometry(0.25, 0.35, 2.5, 8), mat.treeTrunk, tx, 1.25 + ty, tz);
  const leaves = addMesh(new THREE.ConeGeometry(1.4, 3, 10), mat.treeLeaf, tx, 3.5 + ty, tz);
  courseGroup.add(trunk, leaves);
});

[[-3, 0.35, -2, 0.8], [3, 0.35, -2, 0.8], [0, 0.35, -5, 0.8], [0, 0.35, 1, 0.8]].forEach(([x, y, z, s]) => {
  const bumper = addMesh(new THREE.BoxGeometry(s, 0.7, s), mat.bumper, x, y, z);
  courseGroup.add(bumper);
});

const POND_X = 7.2;
const POND_Z = 8.6;
const POND_RADIUS = 1.45;
const pond = addMesh(
  new THREE.CylinderGeometry(POND_RADIUS, POND_RADIUS, 0.06, 32),
  mat.water,
  POND_X, 0.008, POND_Z
);
courseGroup.add(pond);

const holeCup = addMesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 24), mat.black, 0, -0.045, -8);
courseGroup.add(holeCup);

const holeRim = addMesh(new THREE.TorusGeometry(0.55, 0.025, 8, 24), mat.gold, 0, 0.015, -8, Math.PI / 2, 0, 0);
courseGroup.add(holeRim);

const flagPole = addMesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), mat.white, 0, 1.1, -8);
courseGroup.add(flagPole);

const flagGeometry = new THREE.PlaneGeometry(0.9, 0.55);
flagGeometry.translate(0.45, 0, 0);
const flagMesh = addMesh(flagGeometry, mat.red, 0, 1.85, -8);
flagMesh.material.side = THREE.DoubleSide;
flagMesh.castShadow = false;
courseGroup.add(flagMesh);

const tee = addMesh(new THREE.CylinderGeometry(0.6, 0.7, 0.05, 16), mat.white, 0, 0.01, 8);
courseGroup.add(tee);

// ---------------------------------------------------------------------------
// GLB model — decorative duck by the pond
// ---------------------------------------------------------------------------

const gltfLoader = new GLTFLoader();
gltfLoader.load('assets/models/duck.glb', (gltf) => {
  const duckScale = 0.28;

  function addDuck(x, z, rotY) {
    const duck = gltf.scene.clone(true);
    duck.scale.set(duckScale, duckScale, duckScale);
    duck.position.set(x, 0.12, z);
    duck.rotation.y = rotY;
    duck.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(duck);
  }

  addDuck(POND_X - 0.45, POND_Z - 0.2, Math.PI * 0.55);
  addDuck(POND_X + 0.5, POND_Z + 0.25, Math.PI * 1.15);
});

// ---------------------------------------------------------------------------
// Golf ball
// ---------------------------------------------------------------------------

const BALL_RADIUS = 0.22;
const ball = addMesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 20), mat.ball, 0, BALL_RADIUS + 0.02, 8);

const ballState = {
  x: 0, z: 8,
  vx: 0, vz: 0,
  moving: false,
  inHole: false,
  inWater: false,
};

controls.addEventListener('start', () => {
  if (!ballState.moving) cameraAutoFollow = false;
});

function updateCameraFollow(dt) {
  if (!cameraAutoFollow) return;
  const t = 1 - Math.exp(-5 * dt);
  controls.target.lerp(cameraTargetGoal, t);
  camera.position.lerp(cameraPositionGoal, t);
}

// ---------------------------------------------------------------------------
// Putter club (animated swing)
// ---------------------------------------------------------------------------

const clubGroup = new THREE.Group();
clubGroup.position.set(0, 0, 8);
scene.add(clubGroup);

const clubPivot = new THREE.Group();
clubPivot.position.set(0, 0.35, -0.55);
clubGroup.add(clubPivot);

const shaft = addMesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), mat.wood, 0, 0.35, 0);
shaft.castShadow = true;
clubPivot.add(shaft);

const clubHead = addMesh(new THREE.BoxGeometry(0.35, 0.12, 0.2), mat.metal, 0, -0.3, 0.12);
clubPivot.add(clubHead);

let swingPhase = 0;
let swinging = false;
const SWING_DURATION = 0.55;

// ---------------------------------------------------------------------------
// Aim arrow (direction only — fixed length)
// ---------------------------------------------------------------------------

const AIM_ARROW_LENGTH = 2.2;

const aimGroup = new THREE.Group();
scene.add(aimGroup);

const aimMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });

const aimShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), aimMat);
aimShaft.rotation.x = Math.PI / 2;
aimGroup.add(aimShaft);

const aimHead = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 12), aimMat);
aimHead.rotation.x = -Math.PI / 2;
aimGroup.add(aimHead);

function updateAimArrow() {
  const show = !ballState.moving && !isGameOver() && !swinging;
  aimGroup.visible = show;
  if (!show) return;

  aimGroup.position.set(ballState.x, 0.12, ballState.z);
  aimGroup.rotation.y = aimAngle;

  aimShaft.scale.set(1, AIM_ARROW_LENGTH, 1);
  aimShaft.position.set(0, 0, AIM_ARROW_LENGTH * 0.5);
  aimHead.position.set(0, 0, AIM_ARROW_LENGTH + 0.12);
}

// ---------------------------------------------------------------------------
// Fireworks particle system
// ---------------------------------------------------------------------------

const fireworksGroup = new THREE.Group();
fireworksGroup.visible = false;
scene.add(fireworksGroup);

const fireworkParticles = [];
const FIREWORK_COUNT = 80;

for (let i = 0; i < FIREWORK_COUNT; i++) {
  const p = addMesh(
    new THREE.SphereGeometry(0.06, 6, 6),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(Math.random(), 1, 0.55),
    }),
    0, 0, -8
  );
  p.visible = false;
  fireworksGroup.add(p);
  fireworkParticles.push({
    mesh: p,
    vx: 0, vy: 0, vz: 0,
    life: 0,
  });
}

let fireworkActive = false;
let fireworkTime = 0;

function launchFireworks() {
  fireworkActive = true;
  fireworkTime = 0;
  fireworksGroup.visible = true;
  fireworksGroup.position.set(0, 0.5, -8);

  fireworkParticles.forEach((p) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    const upSpeed = 3 + Math.random() * 5;
    p.vx = Math.cos(angle) * speed;
    p.vy = upSpeed;
    p.vz = Math.sin(angle) * speed;
    p.life = 1.2 + Math.random() * 0.5;
    p.mesh.visible = true;
    p.mesh.position.set(0, 0, 0);
    p.mesh.material.color.setHSL(Math.random(), 1, 0.55);
  });
}

function updateFireworks(dt) {
  if (!fireworkActive) return;
  fireworkTime += dt;
  let alive = 0;

  fireworkParticles.forEach((p) => {
    if (p.life <= 0) {
      p.mesh.visible = false;
      return;
    }
    alive++;
    p.life -= dt;
    p.vy -= 9.8 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.scale.setScalar(Math.max(0.1, p.life));
  });

  if (alive === 0 || fireworkTime > 2.5) {
    fireworkActive = false;
    fireworksGroup.visible = false;
    fireworkParticles.forEach((p) => { p.life = 0; p.mesh.visible = false; });
  }
}

// ---------------------------------------------------------------------------
// Game state & UI
// ---------------------------------------------------------------------------

let strokes = 0;
let aimAngle = Math.PI;
let aimLocked = false;
let gameWon = false;
let gameLost = false;

function isGameOver() {
  return gameWon || gameLost;
}

const powerSlider = document.getElementById('power');
const powerVal = document.getElementById('powerVal');
const puttBtn = document.getElementById('puttBtn');
const statusEl = document.getElementById('status');

powerSlider.addEventListener('input', () => {
  powerVal.textContent = powerSlider.value;
});

function updateStatus(msg, win = false, lose = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('win', win);
  statusEl.classList.toggle('lose', lose);
}

function updateAimStatus() {
  if (ballState.moving || isGameOver()) return;
  if (aimLocked) {
    updateStatus(`Strokes: ${strokes} — Aim locked. Set power and Putt! (click green to re-aim)`);
  } else {
    updateStatus(`Strokes: ${strokes} — Move mouse to aim, click to lock`);
  }
}

function setAimLocked(locked) {
  aimLocked = locked;
  const color = locked ? 0x06d6a0 : 0xffd166;
  aimMat.color.setHex(color);
  updateAimStatus();
}

function resetBall() {
  ballState.x = 0;
  ballState.z = 8;
  ballState.vx = 0;
  ballState.vz = 0;
  ballState.moving = false;
  ballState.inHole = false;
  ballState.inWater = false;
  ball.position.set(0, BALL_RADIUS + 0.02, 8);
  clubGroup.position.set(0, 0, 8);
  aimAngle = Math.PI;
  gameWon = false;
  gameLost = false;
  puttBtn.disabled = false;
  cameraAutoFollow = true;
  setCameraGoals(0, 8, 0, false);
  setAimLocked(false);
}

// Aim with mouse drag on canvas (project to green plane)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const greenPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const intersectPt = new THREE.Vector3();

function updateAimFromPointer(clientX, clientY) {
  if (ballState.moving || isGameOver() || swinging || aimLocked) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  if (raycaster.ray.intersectPlane(greenPlane, intersectPt)) {
    const dx = intersectPt.x - ballState.x;
    const dz = intersectPt.z - ballState.z;
    if (dx * dx + dz * dz > 0.15) {
      aimAngle = Math.atan2(dx, dz);
    }
  }
}

renderer.domElement.addEventListener('pointermove', (e) => updateAimFromPointer(e.clientX, e.clientY));
renderer.domElement.addEventListener('click', (e) => {
  if (ballState.moving || isGameOver() || swinging) return;
  if (aimLocked) {
    setAimLocked(false);
    updateAimFromPointer(e.clientX, e.clientY);
    return;
  }
  updateAimFromPointer(e.clientX, e.clientY);
  setAimLocked(true);
});

function startPutt() {
  if (ballState.moving || isGameOver() || swinging) return;
  if (!aimLocked) {
    updateStatus(`Strokes: ${strokes} — Click the green to lock your aim first!`);
    return;
  }

  swinging = true;
  swingPhase = 0;
  strokes += 1;
  cameraAutoFollow = true;

  const power = Number(powerSlider.value) / 100;
  const speed = 8 + power * 72;

  setTimeout(() => {
    ballState.vx = Math.sin(aimAngle) * speed;
    ballState.vz = Math.cos(aimAngle) * speed;
    ballState.moving = true;
    setCameraGoals(ballState.x, ballState.z, aimAngle + Math.PI);
    updateStatus(`Strokes: ${strokes} — Ball rolling…`);
  }, SWING_DURATION * 500);
}

puttBtn.addEventListener('click', startPutt);
window.addEventListener('keydown', (e) => {
  if (Object.hasOwn(rotateKeys, e.code)) {
    rotateKeys[e.code] = true;
    cameraAutoFollow = false;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    startPutt();
  }
  if (e.code === 'KeyR') {
    strokes = 0;
    resetBall();
  }
});
window.addEventListener('keyup', (e) => {
  if (Object.hasOwn(rotateKeys, e.code)) rotateKeys[e.code] = false;
});

updateAimStatus();

// ---------------------------------------------------------------------------
// Physics & collision
// ---------------------------------------------------------------------------

const HOLE_X = 0;
const HOLE_Z = -8;
const HOLE_RADIUS = 0.5;
const GREEN_X_MIN = -8.5, GREEN_X_MAX = 8.5;
const GREEN_Z_MIN = -13.5, GREEN_Z_MAX = 9.5;
const FRICTION = 2.2;
const SAND_FRICTION = 9;

const sandTraps = [
  { x: -5, z: 2, r: 2.2 },
  { x: 6, z: -5, r: 1.8 },
  { x: -3, z: -9, r: 1.5 },
  { x: 4, z: 4, r: 2 },
];

function isInSand(x, z) {
  return sandTraps.some((s) => {
    const dx = x - s.x;
    const dz = z - s.z;
    return dx * dx + dz * dz <= s.r * s.r;
  });
}

const colliders = [
  // Bumpers
  { x: -3, z: -2, r: 0.55 },
  { x: 3, z: -2, r: 0.55 },
  { x: 0, z: -5, r: 0.55 },
  { x: 0, z: 1, r: 0.55 },
  // Rocks
  { x: -7, z: 8, r: 0.5 }, { x: -6.2, z: 8.6, r: 0.35 }, { x: 7.5, z: 6, r: 0.55 },
  { x: 8.1, z: 5.3, r: 0.3 }, { x: -8, z: -6, r: 0.4 }, { x: 8.5, z: -3, r: 0.45 },
  { x: -2, z: 9, r: 0.28 }, { x: 3, z: 9.5, r: 0.32 },
  // Path marker posts
  { x: -2, z: 6, r: 0.14 }, { x: 2, z: 6, r: 0.14 },
  { x: -2, z: 0, r: 0.14 }, { x: 2, z: 0, r: 0.14 },
  // Trees (trunk + foliage)
  { x: -8, z: -10, r: 1.1 }, { x: 8, z: -11, r: 1.1 },
  { x: -8.5, z: 5, r: 1.1 }, { x: 8, z: 2, r: 1.1 },
  // Flag pole
  { x: 0, z: -8, r: 0.1 },
];

function bounceOffColliders(items, restitution = 0.75) {
  items.forEach((b) => {
    const dx = ballState.x - b.x;
    const dz = ballState.z - b.z;
    const dist = Math.hypot(dx, dz);
    const minDist = BALL_RADIUS + b.r;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;
      ballState.x = b.x + nx * minDist;
      ballState.z = b.z + nz * minDist;
      const dot = ballState.vx * nx + ballState.vz * nz;
      ballState.vx = (ballState.vx - 2 * dot * nx) * restitution;
      ballState.vz = (ballState.vz - 2 * dot * nz) * restitution;
    }
  });
}

function isInWater(x, z) {
  const dx = x - POND_X;
  const dz = z - POND_Z;
  return dx * dx + dz * dz <= (POND_RADIUS + BALL_RADIUS * 0.25) ** 2;
}

function triggerWaterLoss() {
  ballState.moving = false;
  ballState.inWater = true;
  ballState.vx = 0;
  ballState.vz = 0;
  ballState.x = POND_X;
  ballState.z = POND_Z;
  ball.position.set(POND_X, -0.04, POND_Z);
  gameLost = true;
  puttBtn.disabled = true;
  cameraAutoFollow = true;
  setCameraGoals(POND_X, POND_Z, aimAngle + Math.PI);
  updateStatus('💧 Water hazard! You lose — press R to restart.', false, true);
}

function updateBall(dt) {
  if (!ballState.moving || ballState.inHole || ballState.inWater) return;

  ballState.x += ballState.vx * dt;
  ballState.z += ballState.vz * dt;

  const speed = Math.hypot(ballState.vx, ballState.vz);
  if (speed > 0.01) {
    const friction = isInSand(ballState.x, ballState.z) ? SAND_FRICTION : FRICTION;
    const drag = Math.min(speed, friction * dt * speed);
    ballState.vx -= (ballState.vx / speed) * drag;
    ballState.vz -= (ballState.vz / speed) * drag;
  } else {
    ballState.vx = 0;
    ballState.vz = 0;
    ballState.moving = false;
    cameraAutoFollow = true;
    setCameraGoals(ballState.x, ballState.z, aimAngle + Math.PI);
    setAimLocked(false);
  }

  // Wall bounce
  if (ballState.x < GREEN_X_MIN) { ballState.x = GREEN_X_MIN; ballState.vx *= -0.65; }
  if (ballState.x > GREEN_X_MAX) { ballState.x = GREEN_X_MAX; ballState.vx *= -0.65; }
  if (ballState.z < GREEN_Z_MIN) { ballState.z = GREEN_Z_MIN; ballState.vz *= -0.65; }
  if (ballState.z > GREEN_Z_MAX) { ballState.z = GREEN_Z_MAX; ballState.vz *= -0.65; }

  bounceOffColliders(colliders);

  if (isInWater(ballState.x, ballState.z)) {
    triggerWaterLoss();
    clubGroup.position.set(ballState.x, 0, ballState.z);
    return;
  }

  const currentSpeed = Math.hypot(ballState.vx, ballState.vz);

  // Hole detection
  const hdx = ballState.x - HOLE_X;
  const hdz = ballState.z - HOLE_Z;
  const holeDist = Math.hypot(hdx, hdz);

  if (holeDist < HOLE_RADIUS && currentSpeed < 22) {
    ballState.inHole = true;
    ballState.moving = false;
    ballState.x = HOLE_X;
    ballState.z = HOLE_Z;
    ball.position.set(HOLE_X, -0.1, HOLE_Z);
    gameWon = true;
    puttBtn.disabled = true;
    cameraAutoFollow = true;
    setCameraGoals(HOLE_X, HOLE_Z, aimAngle + Math.PI);
    launchFireworks();
    updateStatus(`🎉 Hole in ${strokes} stroke${strokes === 1 ? '' : 's'}! Press R to replay.`, true);
  } else {
    ball.position.set(ballState.x, BALL_RADIUS + 0.02, ballState.z);
  }

  if (ballState.moving) {
    const travelAngle = Math.atan2(ballState.vx, ballState.vz);
    setCameraGoals(ballState.x, ballState.z, travelAngle + Math.PI);
  }

  clubGroup.position.set(ballState.x, 0, ballState.z);
}

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();
let flagTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  flagTime += dt;

  // Animated flag (wave)
  flagMesh.rotation.y = Math.sin(flagTime * 4) * 0.25;
  flagMesh.rotation.z = Math.sin(flagTime * 3) * 0.08;

  // Club swing animation — rotate on pivot so the head stays above the green
  if (swinging) {
    swingPhase += dt / SWING_DURATION;
    const t = Math.min(swingPhase, 1);
    const swing = Math.sin(t * Math.PI);
    clubGroup.rotation.y = aimAngle;
    clubGroup.position.set(ballState.x, 0, ballState.z);
    clubPivot.rotation.x = THREE.MathUtils.lerp(-0.42, 0.32, swing);
    clubPivot.rotation.z = 0;
    if (swingPhase >= 1) {
      swinging = false;
      clubPivot.rotation.x = -0.18;
    }
  } else if (!ballState.moving && !isGameOver()) {
    clubGroup.rotation.y = aimAngle;
    clubGroup.rotation.z = 0;
    clubGroup.position.set(ballState.x, 0, ballState.z);
    clubPivot.rotation.x = -0.18;
    clubPivot.rotation.z = 0;
  }

  // Subtle hole light pulse
  holeLight.intensity = 0.6 + Math.sin(flagTime * 2) * 0.25;

  updateBall(dt);
  updateFireworks(dt);
  updateAimArrow();
  updateWasdCamera(dt);
  updateCameraFollow(dt);
  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
