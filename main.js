import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

function assetUrl(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

let _lastTime = performance.now();
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// 하늘/바닥 반사광 — 실내 자연광 느낌
const hemiLight = new THREE.HemisphereLight(0xddeeff, 0xd4c9b0, 0.5);
scene.add(hemiLight);

// 창문으로 들어오는 따사로운 햇빛 (그림자 생성)
const sunLight = new THREE.DirectionalLight(0xfff1cc, 2.2);
sunLight.position.set(8, 14, 6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far  = 60;
sunLight.shadow.camera.left   = -20;
sunLight.shadow.camera.right  =  20;
sunLight.shadow.camera.top    =  20;
sunLight.shadow.camera.bottom = -20;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

// 반대편 은은한 바운스 광 (그림자가 너무 어둡지 않게)
const bounceLight = new THREE.DirectionalLight(0xfce8c8, 0.4);
bounceLight.position.set(-6, 4, -4);
scene.add(bounceLight);

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

const PLAYER_RADIUS = 0.3;

// 충돌용: 씬 전체 재귀 대신 메시만 flat 배열로 관리
const collisionMeshes = [];
const collisionRaycaster = new THREE.Raycaster();
collisionRaycaster.far = PLAYER_RADIUS + 0.2; // 0.5m 이내만 검사 — BVH 불필요 탐색 차단

// 4방향 (대각선 제거 — 벽 슬라이딩으로 충분히 커버됨)
const COLLISION_DIRS = [
  new THREE.Vector3( 1, 0,  0),
  new THREE.Vector3(-1, 0,  0),
  new THREE.Vector3( 0, 0,  1),
  new THREE.Vector3( 0, 0, -1),
];
const _checkPos   = new THREE.Vector3();
const _rightVec   = new THREE.Vector3();
const _forwardVec = new THREE.Vector3();

// 로딩 UI
const loadingEl   = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (_url, loaded, total) => {
  loadingText.textContent = `로딩 중... ${Math.round(loaded / total * 100)}%`;
};
loadingManager.onLoad = () => { loadingEl.style.display = 'none'; };

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/libs/draco/');
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(assetUrl('models/classroom.glb'), (gltf) => {
  gltf.scene.traverse((node) => {
    node.matrixAutoUpdate = false;
    node.updateMatrix();

    if (node.isMesh) {
      node.geometry.computeBoundsTree();
      node.castShadow    = true;
      node.receiveShadow = true;
      collisionMeshes.push(node);
    }
  });
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

const playerVel = new THREE.Vector2(0, 0);
const MAX_SPEED = 7;
const ACCEL     = 63;
const FRICTION  = 9;

let velocityY = 0;
const GRAVITY    = 54;
const JUMP_FORCE = 14;
let canJump = true;

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

// ===== 충돌 체크 =====
function checkCollision(pos) {
  _checkPos.set(pos.x, FIXED_Y - 1.0, pos.z);
  for (const dir of COLLISION_DIRS) {
    collisionRaycaster.set(_checkPos, dir);
    // false = 재귀 없음 (이미 flat 배열)
    const hits = collisionRaycaster.intersectObjects(collisionMeshes, false);
    if (hits.length > 0 && hits[0].distance < PLAYER_RADIUS) return true;
  }
  return false;
}

// ===== 이동 + 벽 슬라이딩 =====
function updateMovement(delta) {
  if (!fps.isLocked) return;

  if (move.forward)  playerVel.y += ACCEL * delta;
  if (move.backward) playerVel.y -= ACCEL * delta;
  if (move.left)     playerVel.x -= ACCEL * delta;
  if (move.right)    playerVel.x += ACCEL * delta;

  const spd = Math.sqrt(playerVel.x ** 2 + playerVel.y ** 2);
  if (spd > MAX_SPEED) { const inv = MAX_SPEED / spd; playerVel.x *= inv; playerVel.y *= inv; }
  playerVel.multiplyScalar(Math.exp(-FRICTION * delta));

  _rightVec.setFromMatrixColumn(camera.matrix, 0);
  _rightVec.y = 0;
  _rightVec.normalize();
  _forwardVec.crossVectors(fps.getObject().up, _rightVec);

  const dx = (_rightVec.x * playerVel.x + _forwardVec.x * playerVel.y) * delta;
  const dz = (_rightVec.z * playerVel.x + _forwardVec.z * playerVel.y) * delta;

  const pos  = fps.getObject().position;
  const oldX = pos.x;
  const oldZ = pos.z;

  if (collisionMeshes.length > 0 && Math.abs(dx) + Math.abs(dz) > 0.0001) {
    pos.x += dx; pos.z += dz;

    if (checkCollision(pos)) {
      // X축 슬라이딩
      pos.x = oldX + dx; pos.z = oldZ;
      if (checkCollision(pos)) pos.x = oldX;

      // Z축 슬라이딩
      pos.z = oldZ + dz;
      if (checkCollision(pos)) pos.z = oldZ;
    }
  } else {
    pos.x += dx; pos.z += dz;
  }

  velocityY -= GRAVITY * delta;
  pos.y += velocityY * delta;
  if (pos.y <= FIXED_Y) { pos.y = FIXED_Y; velocityY = 0; canJump = true; }
}

// ===== 루프 =====
function animate() {
  requestAnimationFrame(animate);

  const now   = performance.now();
  const delta = Math.min((now - _lastTime) / 1000, 0.05);
  _lastTime   = now;

  if (fps.isLocked) {
    updateMovement(delta);
  } else if (orbit.enabled) {
    orbit.update();
  }

  const doorAlpha = 1 - Math.exp(-10 * delta);
  for (const door of interactableDoors) {
    door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, door.userData.targetRotation, doorAlpha);
  }

  renderer.render(scene, camera);
}

animate();
