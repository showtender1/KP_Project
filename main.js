import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

function assetUrl(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

let _lastTime = performance.now();
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);

const exrLoader = new EXRLoader();
exrLoader.load(assetUrl('textures/sky.exr'), (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
});

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enabled = true;

const fps = new PointerLockControls(camera, document.body);
scene.add(fps.getObject());

const FIXED_Y = 1.7;
fps.getObject().position.set(-5, FIXED_Y, 10);

const raycaster = new THREE.Raycaster();
const centerPosition = new THREE.Vector2(0, 0);
const interactableDoors = [];

const collisionRaycaster = new THREE.Raycaster();
const mapObjects = [];

// 충돌 방향 벡터 — 매 프레임 new 하지 않도록 미리 생성
const COLLISION_DIRS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(1, 0, 1).normalize(),
  new THREE.Vector3(-1, 0, -1).normalize(),
  new THREE.Vector3(1, 0, -1).normalize(),
  new THREE.Vector3(-1, 0, 1).normalize(),
];
const _checkPos = new THREE.Vector3();

// 모델 로드
const loadingEl = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (_url, loaded, total) => {
  loadingText.textContent = `로딩 중... ${Math.round(loaded / total * 100)}%`;
};
loadingManager.onLoad = () => {
  loadingEl.style.display = 'none';
};

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/libs/draco/');
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(assetUrl('models/classroom.glb'), (gltf) => {
  mapObjects.push(gltf.scene);
  scene.add(gltf.scene);
});

gltfLoader.load(assetUrl('models/door1.glb'), (gltf) => {
  const door1 = gltf.scene;
  door1.position.set(6.38, 0.99, 1.13);
  door1.userData.isOpen = false;
  door1.userData.openRotationY = -Math.PI / 2;
  door1.userData.targetRotation = 0;
  interactableDoors.push(door1);
  scene.add(door1);
});

gltfLoader.load(assetUrl('models/door2.glb'), (gltf) => {
  const door2 = gltf.scene;
  door2.position.set(4.66, 0.96, 3.75);
  door2.userData.isOpen = false;
  door2.userData.targetRotation = 0;
  interactableDoors.push(door2);
  scene.add(door2);
});

gltfLoader.load(assetUrl('models/door3.glb'), (gltf) => {
  const door3 = gltf.scene;
  door3.position.set(0.7, 1.02, 3.75);
  door3.userData.isOpen = false;
  door3.userData.targetRotation = 0;
  interactableDoors.push(door3);
  scene.add(door3);
});

// ===== 입력 =====
const move = { forward: false, backward: false, left: false, right: false };

// 플레이어 수평 속도 (units/sec)
const playerVel = new THREE.Vector2(0, 0); // x=right, y=forward
const MAX_SPEED  = 7;   // units/sec (0.117/frame × 60fps ≈ 7)
const ACCEL      = 63;  // units/sec² — terminal velocity = ACCEL/FRICTION = 7
const FRICTION   = 9;   // 감속 계수 (클수록 미끄러짐 짧아짐)

// 수직 (점프/중력)
let velocityY = 0;
const GRAVITY    = 54;  // units/sec² (0.015/frame² × 60² = 54)
const JUMP_FORCE = 14;  // units/sec  (0.24/frame  × 60   = 14.4)
let canJump = true;

// ===== 이벤트 =====
document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': move.forward  = true; break;
    case 'KeyS': move.backward = true; break;
    case 'KeyA': move.left     = true; break;
    case 'KeyD': move.right    = true; break;
    case 'Space':
      if (canJump && fps.isLocked) { velocityY = JUMP_FORCE; canJump = false; }
      break;
  }
});

document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': move.forward  = false; break;
    case 'KeyS': move.backward = false; break;
    case 'KeyA': move.left     = false; break;
    case 'KeyD': move.right    = false; break;
  }
});

window.addEventListener('mousedown', (e) => {
  if (!fps.isLocked || e.button !== 0) return;

  raycaster.setFromCamera(centerPosition, camera);
  const intersects = raycaster.intersectObjects(interactableDoors, true);

  if (intersects.length > 0) {
    let clicked = intersects[0].object;
    while (!Object.prototype.hasOwnProperty.call(clicked.userData, 'isOpen') && clicked.parent) {
      clicked = clicked.parent;
    }
    if (Object.prototype.hasOwnProperty.call(clicked.userData, 'isOpen')) {
      clicked.userData.isOpen = !clicked.userData.isOpen;
      const openAngle = clicked.userData.openRotationY ?? Math.PI / 2;
      clicked.userData.targetRotation = clicked.userData.isOpen ? openAngle : 0;
    }
  }
});

document.getElementById('firstView').addEventListener('click', () => {
  orbit.enabled = false;
  fps.lock();
});

document.getElementById('freeView').addEventListener('click', () => {
  fps.unlock();
  orbit.enabled = true;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== 이동 + 충돌 (delta-time 기반) =====
function updateMovement(delta) {
  if (!fps.isLocked) return;

  const pos = fps.getObject().position;
  const oldX = pos.x;
  const oldZ = pos.z;

  // 가속 적용
  if (move.forward)  playerVel.y += ACCEL * delta;
  if (move.backward) playerVel.y -= ACCEL * delta;
  if (move.left)     playerVel.x -= ACCEL * delta;
  if (move.right)    playerVel.x += ACCEL * delta;

  // 속도 상한
  const spd = Math.sqrt(playerVel.x ** 2 + playerVel.y ** 2);
  if (spd > MAX_SPEED) {
    const inv = MAX_SPEED / spd;
    playerVel.x *= inv;
    playerVel.y *= inv;
  }

  // 프레임레이트 독립적 마찰: v *= e^(-k*dt)
  const friction = Math.exp(-FRICTION * delta);
  playerVel.x *= friction;
  playerVel.y *= friction;

  fps.moveForward(playerVel.y * delta);
  fps.moveRight(playerVel.x * delta);

  // 벽 충돌
  _checkPos.set(pos.x, FIXED_Y - 1.0, pos.z);
  const playerRadius = 0.3;
  let isColliding = false;

  for (const dir of COLLISION_DIRS) {
    collisionRaycaster.set(_checkPos, dir);
    const hits = collisionRaycaster.intersectObjects(mapObjects, true);
    if (hits.length > 0 && hits[0].distance < playerRadius) {
      isColliding = true;
      break;
    }
  }

  if (isColliding) {
    pos.x = oldX;
    pos.z = oldZ;
    playerVel.set(0, 0);
  }

  // 중력 + 점프 (delta-time 기반)
  velocityY -= GRAVITY * delta;
  pos.y += velocityY * delta;

  if (pos.y <= FIXED_Y) {
    pos.y = FIXED_Y;
    velocityY = 0;
    canJump = true;
  }
}

// ===== 루프 =====
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - _lastTime) / 1000, 0.05);
  _lastTime = now;

  if (fps.isLocked) {
    updateMovement(delta);
  } else if (orbit.enabled) {
    orbit.update();
  }

  // 문 회전: 프레임레이트 독립적 지수 보간
  const doorAlpha = 1 - Math.exp(-10 * delta);
  for (const door of interactableDoors) {
    door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, door.userData.targetRotation, doorAlpha);
  }

  renderer.render(scene, camera);
}

animate();
