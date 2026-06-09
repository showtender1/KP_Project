import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

function assetUrl(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

let _lastTime = performance.now();
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.xr.enabled = true;
renderer.xr.setFramebufferScaleFactor(0.75); // Quest 2 GPU 부하 감소
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// VR 진입 시 그림자 끄기 (모바일 GPU 과부하 방지)
renderer.xr.addEventListener('sessionstart', () => {
  renderer.shadowMap.enabled = false;
});
renderer.xr.addEventListener('sessionend', () => {
  renderer.shadowMap.enabled = true;
});

const hemiLight = new THREE.HemisphereLight(0xddeeff, 0xd4c9b0, 0.1);
scene.add(hemiLight);

const roomLight1 = new THREE.PointLight(0xfff5e0, 6.0, 220);
roomLight1.position.set(0, 2.1, 1.18);
roomLight1.castShadow = true;
roomLight1.shadow.mapSize.set(512, 512);
roomLight1.shadow.camera.near = 0.1;
roomLight1.shadow.camera.far = 15;
roomLight1.shadow.bias = -0.001;
scene.add(roomLight1);

const roomLight2 = new THREE.PointLight(0xfff5e0, 6.0, 220);
roomLight2.position.set(5.5, 2.1, 1.18);
roomLight2.castShadow = false;
roomLight2.shadow.mapSize.set(512, 512);
roomLight2.shadow.camera.near = 0.1;
roomLight2.shadow.camera.far = 15;
roomLight2.shadow.bias = -0.001;
scene.add(roomLight2);

scene.background = new THREE.Color(0x888888);
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment()).texture;
pmremGenerator.dispose();

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enabled = false;

const fps = new PointerLockControls(camera, document.body);

// playerRig: 이동의 기준점. camera는 rig 안에 있어 XR/데스크톱 모두 동작
const playerRig = new THREE.Group();
playerRig.add(camera);
scene.add(playerRig);

const BOAT_FLOOR_Y = 35.0;
const CLASSROOM_FLOOR_Y = 1.7;
const BOAT_EYE_HEIGHT      = 6; // 4.42 * 2
const CLASSROOM_EYE_HEIGHT = 1.7;
let EYE_HEIGHT = BOAT_EYE_HEIGHT;

const BOAT_START      = new THREE.Vector3(-0.3, 25.47, 53.14);
const CLASSROOM_START = new THREE.Vector3(0, CLASSROOM_FLOOR_Y, 6.5);

playerRig.position.copy(BOAT_START);

const raycaster = new THREE.Raycaster();
const centerPosition = new THREE.Vector2(0, 0);
const interactableDoors = [];

const PLAYER_RADIUS = 0.3;

const boatCollisionMeshes      = [];
const classroomCollisionMeshes = [];
const collisionMeshes          = [];
const collisionRaycaster = new THREE.Raycaster();
collisionRaycaster.far = PLAYER_RADIUS + 0.2;

const COLLISION_DIRS = [
  new THREE.Vector3( 1, 0,  0),
  new THREE.Vector3(-1, 0,  0),
  new THREE.Vector3( 0, 0,  1),
  new THREE.Vector3( 0, 0, -1),
];
const _checkPos     = new THREE.Vector3();
const _rightVec     = new THREE.Vector3();
const _forwardVec   = new THREE.Vector3();
const _groundOrigin = new THREE.Vector3();
const _downVec      = new THREE.Vector3(0, -1, 0);
const groundRaycaster = new THREE.Raycaster();

// 씬 그룹
const boatGroup      = new THREE.Group();
const classroomGroup = new THREE.Group();
classroomGroup.visible = false;
scene.add(boatGroup);
scene.add(classroomGroup);

let currentScene  = 'boat';
let transitioning = false;

// 포털 판 (투명, 클릭 시 선박 내부로 이동)
const portalGeom = new THREE.PlaneGeometry(5, 5);
const portalMat  = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
const portalMesh = new THREE.Mesh(portalGeom, portalMat);
portalMesh.position.set(-0.03, 16.94, -37.47);
boatGroup.add(portalMesh);

// UI 요소
const loadingEl    = document.getElementById('loading');
const loadingText  = document.getElementById('loading-text');
const loadingBar   = document.getElementById('loading-bar');
const clickHintEl  = document.getElementById('click-hint');
const transitionEl  = document.getElementById('transition-overlay');
const transitionMsg = document.getElementById('transition-msg');
const transitionPct = document.getElementById('transition-pct');
const coordsEl     = document.getElementById('coords');

let _pendingLoadReveal = false;

const loadingManager = new THREE.LoadingManager();
loadingManager.onLoad = () => {
  // 실제 렌더 완료 후 숨기도록 플래그만 세팅
  _pendingLoadReveal = true;
};

function setLoadingProgress(pct) {
  loadingText.textContent = `로딩 중... ${pct}%`;
  loadingBar.style.width  = `${pct}%`;
}

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/libs/draco/');

// 초기 로딩용 (boat만 추적)
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);

// 교실 지연 로딩용 (LoadingManager 없음)
const classroomLoader = new GLTFLoader();
classroomLoader.setDRACOLoader(dracoLoader);

let classroomReady   = false;
let classroomLoading = false;

// ===== 모델 로드 =====

// Boat만 초기 로딩 (바이트 단위 진행률 표시)
gltfLoader.load(
  assetUrl('models/boat.glb'),
  (gltf) => {
    gltf.scene.traverse((node) => {
      node.matrixAutoUpdate = false;
      node.updateMatrix();
      if (node.isMesh) {
        node.castShadow    = true;
        node.receiveShadow = true;
        boatCollisionMeshes.push(node);
      }
    });
    boatGroup.add(gltf.scene);
    if (currentScene === 'boat') {
      collisionMeshes.length = 0;
      collisionMeshes.push(...boatCollisionMeshes);
    }
  },
  (event) => {
    // 바이트 단위 실제 다운로드 진행률
    if (event.total > 0) {
      setLoadingProgress(Math.round(event.loaded / event.total * 100));
    }
  },
  (error) => {
    console.error('boat.glb 로드 오류:', error);
    loadingText.textContent = '로딩 오류 — 새로고침 해주세요';
  }
);

// ===== 교실 지연 로딩 =====
function loadClassroomAssets(onComplete, onProgress) {
  if (classroomReady)   { onComplete(); return; }
  if (classroomLoading) { return; }
  classroomLoading = true;

  let loaded = 0;
  const total = 4;
  const check = () => {
    loaded++;
    if (onProgress) onProgress(Math.round(loaded / total * 100));
    if (loaded === total) { classroomReady = true; classroomLoading = false; onComplete(); }
  };

  classroomLoader.load(assetUrl('models/classroom.glb'), (gltf) => {
    gltf.scene.position.set(2.7, -0.02, 4.83);
    gltf.scene.traverse((node) => {
      node.matrixAutoUpdate = false;
      node.updateMatrix();
      if (node.isMesh) {
        node.castShadow    = true;
        node.receiveShadow = true;
        classroomCollisionMeshes.push(node);
      }
    });
    classroomGroup.add(gltf.scene);
    check();
  });

  classroomLoader.load(assetUrl('models/door1.glb'), (gltf) => {
    const door1 = gltf.scene;
    door1.position.set(6.35, 0.99, 1.18);
    door1.userData.isOpen = false;
    door1.userData.openRotationY = -Math.PI / 2;
    door1.userData.targetRotation = 0;
    door1.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    interactableDoors.push(door1);
    classroomGroup.add(door1);
    check();
  });

  classroomLoader.load(assetUrl('models/door2.glb'), (gltf) => {
    const door2 = gltf.scene;
    door2.position.set(4.66, 0.96, 3.8);
    door2.userData.isOpen = false;
    door2.userData.targetRotation = 0;
    door2.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    interactableDoors.push(door2);
    classroomGroup.add(door2);
    check();
  });

  classroomLoader.load(assetUrl('models/door3.glb'), (gltf) => {
    const door3 = gltf.scene;
    door3.position.set(2.68, 1.02, 3.8);
    door3.userData.isOpen = false;
    door3.userData.targetRotation = 0;
    door3.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    interactableDoors.push(door3);
    classroomGroup.add(door3);
    check();
  });
}

// ===== XR 조이스틱 입력 =====
let xrMoveX = 0, xrMoveZ = 0, xrSnapActive = false;

function updateXRInput() {
  const session = renderer.xr.getSession();
  if (!session) { xrMoveX = 0; xrMoveZ = 0; return; }
  xrMoveX = 0; xrMoveZ = 0;
  for (const src of session.inputSources) {
    if (!src.gamepad) continue;
    const ax = src.gamepad.axes;
    if (src.handedness === 'left') {
      if (Math.abs(ax[2]) > 0.15) xrMoveX = ax[2];
      if (Math.abs(ax[3]) > 0.15) xrMoveZ = ax[3];
    }
    if (src.handedness === 'right') {
      // 우측 조이스틱: 30도 스냅 턴
      if (Math.abs(ax[2]) > 0.7 && !xrSnapActive) {
        playerRig.rotation.y -= Math.sign(ax[2]) * (Math.PI / 6);
        xrSnapActive = true;
      } else if (Math.abs(ax[2]) < 0.3) {
        xrSnapActive = false;
      }
    }
  }
}

// XR 컨트롤러 0번 트리거 → 포털 클릭
const xrController0 = renderer.xr.getController(0);
scene.add(xrController0);
xrController0.addEventListener('selectstart', () => {
  if (currentScene !== 'boat' || transitioning) return;
  const tempMat = new THREE.Matrix4().extractRotation(xrController0.matrixWorld);
  const xrRay   = new THREE.Raycaster();
  xrRay.ray.origin.setFromMatrixPosition(xrController0.matrixWorld);
  xrRay.ray.direction.set(0, 0, -1).applyMatrix4(tempMat);
  if (xrRay.intersectObject(portalMesh, false).length > 0) switchScene('classroom');
});

// ===== 입력 =====
const move = { forward: false, backward: false, left: false, right: false, sprint: false };

const playerVel = new THREE.Vector2(0, 0);
const MAX_SPEED = 7;
const SPRINT_MULTIPLIER = 2.0;
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
    case 'ShiftLeft':
    case 'ShiftRight':
      move.sprint = true; break;
  }
});

document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': move.forward  = false; break;
    case 'KeyS': move.backward = false; break;
    case 'KeyA': move.left     = false; break;
    case 'KeyD': move.right    = false; break;
    case 'ShiftLeft':
    case 'ShiftRight':
      move.sprint = false; break;
  }
});

window.addEventListener('mousedown', (e) => {
  if (!fps.isLocked || e.button !== 0) return;
  raycaster.setFromCamera(centerPosition, camera);

  // 포털 클릭 (보트 씬에서만)
  if (currentScene === 'boat' && !transitioning) {
    const portalHit = raycaster.intersectObject(portalMesh, false);
    if (portalHit.length > 0) { switchScene('classroom'); return; }
  }

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

// 화면 클릭 → FPS 진입
renderer.domElement.addEventListener('click', () => {
  if (!fps.isLocked && !orbit.enabled && !transitioning) fps.lock();
});

fps.addEventListener('lock', () => {
  clickHintEl.style.display = 'none';
});

fps.addEventListener('unlock', () => {
  if (!orbit.enabled && !transitioning) {
    clickHintEl.style.display = 'flex';
  }
});

// ===== 씬 전환 =====
function switchScene(to) {
  transitioning = true;
  if (fps.isLocked) fps.unlock();
  orbit.enabled = false;
  clickHintEl.style.display = 'none';

  transitionEl.classList.add('active');

  if (to === 'classroom') {
    transitionMsg.textContent = '선박 내부로 이동 중...';
    if (!classroomReady) {
      transitionPct.style.display = 'block';
      transitionPct.textContent   = '0%';
    }
    loadClassroomAssets(() => {
      transitionPct.style.display = 'none';
      transitionMsg.textContent   = '이동 중...';
      boatGroup.visible      = false;
      classroomGroup.visible = true;
      currentScene = 'classroom';
      EYE_HEIGHT = CLASSROOM_EYE_HEIGHT;
      collisionMeshes.length = 0;
      collisionMeshes.push(...classroomCollisionMeshes);
      playerRig.position.copy(CLASSROOM_START);
      playerRig.rotation.y = -Math.PI / 2;  // 우측 90도
      camera.rotation.set(0, 0, 0);          // 수평 시선 초기화
      velocityY = 0;

      transitionEl.classList.remove('active');
      setTimeout(() => { transitioning = false; clickHintEl.style.display = 'flex'; }, 320);
    }, (pct) => { transitionPct.textContent = `${pct}%`; });
  } else {
    setTimeout(() => {
      classroomGroup.visible = false;
      boatGroup.visible      = true;
      currentScene = 'boat';
      EYE_HEIGHT = BOAT_EYE_HEIGHT;
      collisionMeshes.length = 0;
      collisionMeshes.push(...boatCollisionMeshes);
      playerRig.position.copy(BOAT_START);
      playerRig.rotation.y = 0;
      camera.rotation.set(0, 0, 0);
      velocityY = 0;

      transitionEl.classList.remove('active');
      setTimeout(() => { transitioning = false; clickHintEl.style.display = 'flex'; }, 320);
    }, 600);
  }
}


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== 바닥 감지 (하방 레이캐스트) =====
function getGroundY(pos) {
  _groundOrigin.set(pos.x, pos.y, pos.z);
  groundRaycaster.set(_groundOrigin, _downVec);
  groundRaycaster.far = EYE_HEIGHT + 1.5;
  const hits = groundRaycaster.intersectObjects(collisionMeshes, false);
  return hits.length > 0 ? hits[0].point.y + EYE_HEIGHT : -Infinity;
}

// ===== 충돌 체크 =====
function checkCollision(pos) {
  _checkPos.set(pos.x, pos.y - 1.0, pos.z);
  for (const dir of COLLISION_DIRS) {
    collisionRaycaster.set(_checkPos, dir);
    const hits = collisionRaycaster.intersectObjects(collisionMeshes, false);
    if (hits.length > 0 && hits[0].distance < PLAYER_RADIUS) return true;
  }
  return false;
}

// ===== 이동 + 벽 슬라이딩 =====
function updateMovement(delta) {
  const isXR = renderer.xr.isPresenting;
  if (!isXR && !fps.isLocked) return;

  const curAccel    = (move.sprint && !isXR) ? ACCEL * SPRINT_MULTIPLIER : ACCEL;
  const curMaxSpeed = (move.sprint && !isXR) ? MAX_SPEED * SPRINT_MULTIPLIER : MAX_SPEED;

  if (isXR) {
    // 조이스틱 → 직접 속도 설정
    playerVel.x = xrMoveX * curMaxSpeed;
    playerVel.y = -xrMoveZ * curMaxSpeed;
  } else {
    if (move.forward)  playerVel.y += curAccel * delta;
    if (move.backward) playerVel.y -= curAccel * delta;
    if (move.left)     playerVel.x -= curAccel * delta;
    if (move.right)    playerVel.x += curAccel * delta;
    const spd = Math.sqrt(playerVel.x ** 2 + playerVel.y ** 2);
    if (spd > curMaxSpeed) { const inv = curMaxSpeed / spd; playerVel.x *= inv; playerVel.y *= inv; }
    playerVel.multiplyScalar(Math.exp(-FRICTION * delta));
  }

  // 카메라 월드 방향 기준으로 이동 벡터 계산 (XR 헤드트래킹 + 스냅턴 모두 반영)
  _rightVec.setFromMatrixColumn(camera.matrixWorld, 0);
  _rightVec.y = 0;
  _rightVec.normalize();
  _forwardVec.crossVectors(camera.up, _rightVec);

  const dx = (_rightVec.x * playerVel.x + _forwardVec.x * playerVel.y) * delta;
  const dz = (_rightVec.z * playerVel.x + _forwardVec.z * playerVel.y) * delta;

  const pos  = playerRig.position;
  const oldX = pos.x;
  const oldZ = pos.z;

  if (collisionMeshes.length > 0 && Math.abs(dx) + Math.abs(dz) > 0.0001) {
    pos.x += dx; pos.z += dz;

    if (checkCollision(pos)) {
      pos.x = oldX + dx; pos.z = oldZ;
      if (checkCollision(pos)) pos.x = oldX;

      pos.z = oldZ + dz;
      if (checkCollision(pos)) pos.z = oldZ;
    }
  } else {
    pos.x += dx; pos.z += dz;
  }

  velocityY -= GRAVITY * delta;
  pos.y += velocityY * delta;

  const groundY = getGroundY(pos);
  if (groundY > -Infinity && pos.y <= groundY) {
    pos.y = groundY;
    velocityY = 0;
    canJump = true;
  } else if (currentScene === 'classroom' && pos.y <= CLASSROOM_FLOOR_Y) {
    pos.y = CLASSROOM_FLOOR_Y;
    velocityY = 0;
    canJump = true;
  }
}

// ===== 루프 =====
function animate() {
  const now   = performance.now();
  const delta = Math.min((now - _lastTime) / 1000, 0.05);
  _lastTime   = now;

  try {
    if (fps.isLocked || renderer.xr.isPresenting) {
      if (renderer.xr.isPresenting) updateXRInput();
      updateMovement(delta);
    } else if (orbit.enabled) {
      orbit.update();
    }
  } catch (e) {
    console.error('animate error:', e);
  }

  const p = playerRig.position;
  coordsEl.textContent = `X: ${p.x.toFixed(2)}  Y: ${p.y.toFixed(2)}  Z: ${p.z.toFixed(2)}`;

  const doorAlpha = 1 - Math.exp(-10 * delta);
  for (const door of interactableDoors) {
    door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, door.userData.targetRotation, doorAlpha);
  }

  renderer.render(scene, camera);

  // 렌더가 실제로 끝난 직후 로딩 화면 제거
  if (_pendingLoadReveal) {
    _pendingLoadReveal = false;
    loadingEl.style.display = 'none';
    clickHintEl.style.display = 'flex';
  }
}

renderer.setAnimationLoop(animate);
