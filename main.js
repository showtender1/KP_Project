import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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
renderer.xr.setFramebufferScaleFactor(0.75);
renderer.xr.setFoveation(0.0);
renderer.xr.setReferenceSpaceType('local'); // local-floor 대신 local: 카메라가 playerRig 위치에서 시작
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// EffectComposer + OutlinePass (데스크톱 호버 강조)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
outlinePass.edgeStrength   = 5.0;
outlinePass.edgeGlow       = 0.8;
outlinePass.edgeThickness  = 2.0;
outlinePass.visibleEdgeColor.set('#ffff00');
outlinePass.hiddenEdgeColor.set('#999900');
composer.addPass(outlinePass);
composer.addPass(new OutputPass());

// VR 세션 시작: 그림자 끄기 + 포인터락 해제 + 클릭힌트 숨기기
renderer.xr.addEventListener('sessionstart', () => {
  renderer.shadowMap.enabled = false;
  if (fps.isLocked) fps.unlock();
  clickHintEl.style.display = 'none';
});
// VR 세션 종료: 그림자 복원 + 클릭힌트 표시
renderer.xr.addEventListener('sessionend', () => {
  renderer.shadowMap.enabled = true;
  if (!transitioning) clickHintEl.style.display = 'flex';
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
const CLASSROOM_START = new THREE.Vector3(1.71, 1.70, 5);

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
const _upVec        = new THREE.Vector3(0,  1, 0);
const groundRaycaster   = new THREE.Raycaster();
const ceilingRaycaster  = new THREE.Raycaster();

// 씬 그룹
const boatGroup      = new THREE.Group();
const classroomGroup = new THREE.Group();
classroomGroup.visible = false;
scene.add(boatGroup);
scene.add(classroomGroup);

let currentScene  = 'boat';
let transitioning = false;

const grabbableObjects = [];
let heldObject     = null;
let heldController = null;

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
  setLoadingProgress(100);
  _pendingLoadReveal = true;
};

new THREE.TextureLoader(loadingManager).load(assetUrl('textures/autumn_field_puresky.jpg'), (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
});

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
      setLoadingProgress(Math.min(99, Math.round(event.loaded / event.total * 100)));
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
    try {
      gltf.scene.position.set(2.7, -0.02, 4.83);

      // Kit 도어 메시를 충돌 배열에서 제외하기 위해 먼저 수집
      const KIT_DOOR_NAMES = new Set(['Kit_Door_Left', 'Kit_Door_Right']);
      const kitDoorMeshes = new Set();
      gltf.scene.traverse((node) => {
        if (KIT_DOOR_NAMES.has(node.name)) node.traverse(n => kitDoorMeshes.add(n));
      });

      gltf.scene.traverse((node) => {
        node.matrixAutoUpdate = false;
        node.updateMatrix();
        if (node.isMesh && !kitDoorMeshes.has(node)) {
          node.castShadow    = false;
          node.receiveShadow = false;
          classroomCollisionMeshes.push(node);
        }
      });

      // 잡을 수 있는 오브젝트 / Kit 도어 등록
      const GRABBABLE_NAMES = new Set(['Stool_Left', 'Stool_Right', 'Book']);
      gltf.scene.traverse((node) => {
        if (GRABBABLE_NAMES.has(node.name)) {
          node.userData.isGrabbable = true;
          node.traverse(n => { n.matrixAutoUpdate = true; });
          grabbableObjects.push(node);
        }
        if (KIT_DOOR_NAMES.has(node.name)) {
          node.userData.isOpen = false;
          node.userData.openRotationY = Math.PI / 2;
          node.userData.targetRotation = 0;
          node.traverse(n => { n.matrixAutoUpdate = true; n.castShadow = true; n.receiveShadow = true; });
          interactableDoors.push(node);
        }
      });

      classroomGroup.add(gltf.scene);
    } catch (e) {
      console.error('classroom.glb 처리 오류:', e);
    }
    check();
  }, undefined, (err) => {
    console.error('classroom.glb 로드 실패:', err);
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
  }, undefined, (err) => { console.error('door1.glb 로드 실패:', err); check(); });

  classroomLoader.load(assetUrl('models/door2.glb'), (gltf) => {
    const door2 = gltf.scene;
    door2.position.set(4.66, 0.96, 3.8);
    door2.userData.isOpen = false;
    door2.userData.targetRotation = 0;
    door2.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    interactableDoors.push(door2);
    classroomGroup.add(door2);
    check();
  }, undefined, (err) => { console.error('door2.glb 로드 실패:', err); check(); });

  classroomLoader.load(assetUrl('models/door3.glb'), (gltf) => {
    const door3 = gltf.scene;
    door3.position.set(2.68, 1.02, 3.8);
    door3.userData.isOpen = false;
    door3.userData.targetRotation = 0;
    door3.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    interactableDoors.push(door3);
    classroomGroup.add(door3);
    check();
  }, undefined, (err) => { console.error('door3.glb 로드 실패:', err); check(); });
}

// ===== 오브젝트 물리 =====
const _physicsRaycaster = new THREE.Raycaster();
const _physDown = new THREE.Vector3(0, -1, 0);
const PHYS_GRAVITY  = 20;
const PHYS_BOUNCE   = 0.22;
const PHYS_FRICTION = 7;

function _physAddToCollision(obj) {
  obj.traverse(n => {
    if (!n.isMesh) return;
    if (!classroomCollisionMeshes.includes(n)) classroomCollisionMeshes.push(n);
    if (currentScene === 'classroom' && !collisionMeshes.includes(n)) collisionMeshes.push(n);
  });
}

function _physRemoveFromCollision(obj) {
  obj.traverse(n => {
    const i1 = classroomCollisionMeshes.indexOf(n);
    if (i1 !== -1) classroomCollisionMeshes.splice(i1, 1);
    const i2 = collisionMeshes.indexOf(n);
    if (i2 !== -1) collisionMeshes.splice(i2, 1);
  });
}

function updatePhysics(delta) {
  for (const obj of grabbableObjects) {
    if (!obj.userData.physicsActive) continue;

    const vel = obj.userData.physicsVelocity;
    const btm = obj.userData.physicsBottomOffset ?? -0.1;

    vel.y -= PHYS_GRAVITY * delta;

    // 수평 벽 충돌: 이동 전 사전 체크 (하/중/상 3개 높이 레이캐스트)
    const OBJ_R = 0.25;
    const baseY = obj.position.y + btm;
    const rayHeights = [baseY + 0.05, baseY + 0.2, baseY + 0.4];
    for (const dir of COLLISION_DIRS) {
      const hVel = dir.x !== 0 ? vel.x : vel.z;
      if (Math.sign(hVel) !== Math.sign(dir.x + dir.z)) continue;
      let minDist = Infinity;
      const castFar = Math.abs(hVel) * delta + OBJ_R + 0.1;
      for (const ry of rayHeights) {
        _physicsRaycaster.set(new THREE.Vector3(obj.position.x, ry, obj.position.z), dir);
        _physicsRaycaster.far = castFar;
        const wh = _physicsRaycaster.intersectObjects(classroomCollisionMeshes, false);
        if (wh.length > 0 && wh[0].distance < minDist) minDist = wh[0].distance;
      }
      if (minDist < OBJ_R + 0.05) {
        // 벽 반대 방향으로 밀어냄 (부호: -=)
        obj.position.x -= dir.x * (OBJ_R - minDist + 0.01);
        obj.position.z -= dir.z * (OBJ_R - minDist + 0.01);
        if (dir.x !== 0) vel.x = -vel.x * PHYS_BOUNCE;
        if (dir.z !== 0) vel.z = -vel.z * PHYS_BOUNCE;
      }
    }

    // 천장 충돌: 이동 전 사전 체크
    if (vel.y > 0) {
      const proposedUp = vel.y * delta;
      _physicsRaycaster.set(new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z), _upVec);
      _physicsRaycaster.far = proposedUp + 0.1;
      const ch = _physicsRaycaster.intersectObjects(classroomCollisionMeshes, false);
      if (ch.length > 0 && ch[0].distance <= proposedUp + 0.05) {
        obj.position.y += Math.max(0, ch[0].distance - 0.1);
        vel.y = -vel.y * PHYS_BOUNCE;
      } else {
        obj.position.y += proposedUp;
      }
    } else {
      obj.position.y += vel.y * delta;
    }
    obj.position.x += vel.x * delta;
    obj.position.z += vel.z * delta;

    // 바닥 감지: 오브젝트 하단 위쪽에서 충분히 긴 거리로 레이캐스트
    const objBottomY = obj.position.y + btm;
    _physicsRaycaster.set(
      new THREE.Vector3(obj.position.x, objBottomY + 0.3, obj.position.z),
      _physDown
    );
    _physicsRaycaster.far = 5.0; // 방 전체 높이 커버
    const hits = _physicsRaycaster.intersectObjects(classroomCollisionMeshes, false);

    let landed = false;
    if (hits.length > 0) {
      const floorY = hits[0].point.y;
      if (objBottomY <= floorY + 0.02) {
        obj.position.y = floorY - btm;
        if (Math.abs(vel.y) > 1.2) {
          vel.y = Math.abs(vel.y) * PHYS_BOUNCE;
        } else {
          vel.y = 0;
          landed = true;
        }
        vel.x *= Math.exp(-PHYS_FRICTION * delta);
        vel.z *= Math.exp(-PHYS_FRICTION * delta);
      }
    }

    // 절대 안전망 (실제 교실 바닥 Y ≈ 0, CLASSROOM_FLOOR_Y는 플레이어 눈높이라 사용 금지)
    if (objBottomY < -0.5) {
      obj.position.y = -0.5 - btm;
      vel.set(0, 0, 0);
      landed = true;
    }

    // 정지 판정
    if (landed && vel.lengthSq() < 0.002) {
      vel.set(0, 0, 0);
      obj.userData.physicsActive = false;
      _physAddToCollision(obj);
    }

    obj.updateMatrix();
  }
}

// ===== 오브젝트 잡기/놓기 =====
function grabObject(obj, attachTo) {
  if (heldObject) dropObject();
  obj.userData.physicsActive = false;
  _physRemoveFromCollision(obj);
  attachTo.attach(obj);
  if (attachTo === camera) {
    obj.position.set(0, -0.25, -0.7);
  } else {
    obj.position.set(0, 0, -0.08);
  }
  obj.quaternion.set(0, 0, 0, 1);
  heldObject     = obj;
  heldController = attachTo;
}

function dropObject() {
  if (!heldObject) return;
  const obj = heldObject;
  heldObject = null; heldController = null;

  classroomGroup.attach(obj);

  // 오브젝트 하단 오프셋 계산
  const box = new THREE.Box3().setFromObject(obj);
  const wp  = new THREE.Vector3();
  obj.getWorldPosition(wp);
  obj.userData.physicsBottomOffset = box.min.y - wp.y;

  // 투척 속도: 플레이어 이동 방향 + 위쪽
  if (!obj.userData.physicsVelocity) obj.userData.physicsVelocity = new THREE.Vector3();
  obj.userData.physicsVelocity.set(
    _rightVec.x * playerVel.x + _forwardVec.x * playerVel.y,
    0.8,
    _rightVec.z * playerVel.x + _forwardVec.z * playerVel.y
  );
  obj.userData.physicsActive = true;
  // 물리 중에는 충돌 제외 (정지 후 재등록)
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
      if (Math.abs(ax[2]) > 0.7 && !xrSnapActive) {
        playerRig.rotation.y -= Math.sign(ax[2]) * (Math.PI / 6);
        xrSnapActive = true;
      } else if (Math.abs(ax[2]) < 0.3) {
        xrSnapActive = false;
      }
    }
  }
}

// ===== XR 컨트롤러 포인터 =====
const _xrRaycaster = new THREE.Raycaster();
const _xrTempMat   = new THREE.Matrix4();

// 컨트롤러 레이 (얇은 실린더 — WebXR에서 Line보다 안정적)
function buildControllerRay() {
  const geom = new THREE.CylinderGeometry(0.002, 0.002, 1, 6);
  geom.rotateX(Math.PI / 2);
  geom.translate(0, 0, -0.5);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.scale.z = 5;
  return mesh;
}

// 컨트롤러 몸체 (단순 박스 — 외부 CDN 없이 즉시 표시)
function buildControllerBody() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.1), mat);
  body.position.z = -0.03;
  return body;
}

const xrController0 = renderer.xr.getController(0);
const xrController1 = renderer.xr.getController(1);
const ray0 = buildControllerRay();
const ray1 = buildControllerRay();
xrController0.add(ray0);
xrController1.add(ray1);
playerRig.add(xrController0);
playerRig.add(xrController1);

const grip0 = renderer.xr.getControllerGrip(0);
const grip1 = renderer.xr.getControllerGrip(1);
grip0.add(buildControllerBody());
grip1.add(buildControllerBody());
playerRig.add(grip0);
playerRig.add(grip1);

function getXRRayHit(controller) {
  _xrTempMat.extractRotation(controller.matrixWorld);
  _xrRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  _xrRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(_xrTempMat);
  _xrRaycaster.far = 10;
  const targets = [portalMesh, ...interactableDoors, ...grabbableObjects];
  const hits = _xrRaycaster.intersectObjects(targets, true);
  return hits.length > 0 ? hits[0] : null;
}

function updateXRPointers() {
  for (const [ctrl, ray] of [[xrController0, ray0], [xrController1, ray1]]) {
    const hit = getXRRayHit(ctrl);
    if (hit) {
      ray.material.color.setHex(0x00ff88);
      ray.scale.setScalar(1);
      ray.scale.z = hit.distance;
    } else {
      ray.material.color.setHex(0xffffff);
      ray.scale.setScalar(1);
      ray.scale.z = 5;
    }
  }
}

function handleXRSelect(controller) {
  if (transitioning) return;

  // 이미 이 컨트롤러로 잡고 있으면 놓기
  if (heldObject && heldController === controller) { dropObject(); return; }

  const hit = getXRRayHit(controller);
  if (!hit) return;

  // 잡기 가능 오브젝트 체크
  let grabbable = hit.object;
  while (grabbable && !grabbable.userData.isGrabbable) grabbable = grabbable.parent;
  if (grabbable && grabbable.userData.isGrabbable) {
    // 벽 차단 체크: 컨트롤러→오브젝트 사이에 벽이 있으면 잡기 불가
    _xrRaycaster.far = hit.distance - 0.05;
    const wallBlocked = _xrRaycaster.intersectObjects(collisionMeshes, false).length > 0;
    if (!wallBlocked) {
      const grip = controller === xrController0 ? grip0 : grip1;
      grabObject(grabbable, grip);
    }
    return;
  }

  if (hit.object === portalMesh && currentScene === 'boat') {
    switchScene('classroom');
    return;
  }

  let obj = hit.object;
  while (!Object.prototype.hasOwnProperty.call(obj.userData, 'isOpen') && obj.parent) obj = obj.parent;
  if (Object.prototype.hasOwnProperty.call(obj.userData, 'isOpen')) {
    obj.userData.isOpen = !obj.userData.isOpen;
    const openAngle = obj.userData.openRotationY ?? Math.PI / 2;
    obj.userData.targetRotation = obj.userData.isOpen ? openAngle : 0;
  }
}

xrController0.addEventListener('selectstart', () => handleXRSelect(xrController0));
xrController1.addEventListener('selectstart', () => handleXRSelect(xrController1));

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
  // WASD 키 입력으로도 FPS 모드 진입
  if (['KeyW','KeyA','KeyS','KeyD'].includes(e.code)) tryLockFPS();
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

  // 잡기/놓기 (교실에서만)
  if (currentScene === 'classroom') {
    if (heldObject) { dropObject(); return; }
    const grabHits = raycaster.intersectObjects(grabbableObjects, true);
    if (grabHits.length > 0) {
      const wallHits = raycaster.intersectObjects(collisionMeshes, false);
      const blocked  = wallHits.length > 0 && wallHits[0].distance < grabHits[0].distance - 0.05;
      if (!blocked) {
        let obj = grabHits[0].object;
        while (obj && !obj.userData.isGrabbable) obj = obj.parent;
        if (obj && obj.userData.isGrabbable) { grabObject(obj, camera); return; }
      }
    }
  }

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

// 화면 클릭 or 키 입력 → 데스크톱 FPS 진입 (VR 모드가 아닐 때만)
function tryLockFPS() {
  if (!fps.isLocked && !orbit.enabled && !transitioning && !renderer.xr.isPresenting) fps.lock();
}
renderer.domElement.addEventListener('click', tryLockFPS);

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
  if (heldObject) dropObject();
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
  composer.setSize(window.innerWidth, window.innerHeight);
  outlinePass.resolution.set(window.innerWidth, window.innerHeight);
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
  const sceneSpeed  = currentScene === 'classroom' ? MAX_SPEED * 0.7 : MAX_SPEED;
  const curMaxSpeed = (move.sprint && !isXR) ? sceneSpeed * SPRINT_MULTIPLIER : sceneSpeed;

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
  const proposedDY = velocityY * delta;

  // 천장 충돌: 이동 전 사전 체크 (빠른 속도에서도 관통 방지)
  if (proposedDY > 0 && collisionMeshes.length > 0) {
    ceilingRaycaster.set(pos, _upVec);
    ceilingRaycaster.far = proposedDY + 0.25;
    const ceilHits = ceilingRaycaster.intersectObjects(collisionMeshes, false);
    if (ceilHits.length > 0) {
      pos.y += Math.max(0, ceilHits[0].distance - 0.25);
      velocityY = 0;
    } else {
      pos.y += proposedDY;
    }
  } else {
    pos.y += proposedDY;
  }

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

// ===== 호버 강조 =====
function _findInteractableRoot(obj) {
  let o = obj;
  while (o) {
    if (interactableDoors.includes(o) || grabbableObjects.includes(o)) return o;
    o = o.parent;
  }
  return null;
}

const _vrHighlighted = new Set();

function _setVRHighlight(obj, on) {
  obj.traverse(n => {
    if (!n.isMesh || !n.material || !('emissive' in n.material)) return;
    if (!n.userData.hlMat) {
      const cloned = n.material.clone();
      cloned.emissive.setRGB(0.5, 0.45, 0);
      cloned.emissiveIntensity = 1.0;
      n.userData.hlMat  = cloned;
      n.userData.origMat = n.material;
    }
    n.material = on ? n.userData.hlMat : n.userData.origMat;
  });
}

function updateHoverHighlight() {
  if (renderer.xr.isPresenting) {
    for (const o of _vrHighlighted) _setVRHighlight(o, false);
    _vrHighlighted.clear();
    for (const ctrl of [xrController0, xrController1]) {
      const hit = getXRRayHit(ctrl);
      if (!hit) continue;
      // 벽 차단 체크
      _xrRaycaster.far = hit.distance - 0.05;
      if (_xrRaycaster.intersectObjects(collisionMeshes, false).length > 0) continue;
      const root = _findInteractableRoot(hit.object);
      if (root && !_vrHighlighted.has(root)) {
        _setVRHighlight(root, true);
        _vrHighlighted.add(root);
      }
    }
  } else {
    if (fps.isLocked) {
      raycaster.setFromCamera(centerPosition, camera);
      const hits = raycaster.intersectObjects([...interactableDoors, ...grabbableObjects], true);
      let root = null;
      if (hits.length > 0) {
        const wallHits = raycaster.intersectObjects(collisionMeshes, false);
        const blocked  = wallHits.length > 0 && wallHits[0].distance < hits[0].distance - 0.05;
        if (!blocked) root = _findInteractableRoot(hits[0].object);
      }
      outlinePass.selectedObjects = root ? [root] : [];
    } else {
      outlinePass.selectedObjects = [];
    }
  }
}

// ===== 루프 =====
function animate() {
  const now   = performance.now();
  const delta = Math.min((now - _lastTime) / 1000, 0.05);
  _lastTime   = now;

  try {
    if (fps.isLocked || renderer.xr.isPresenting) {
      if (renderer.xr.isPresenting) { updateXRInput(); updateXRPointers(); }
      updateMovement(delta);
    } else if (orbit.enabled) {
      orbit.update();
    }
  } catch (e) {
    console.error('animate error:', e);
  }

  const p = playerRig.position;
  coordsEl.textContent = `X: ${p.x.toFixed(2)}  Y: ${p.y.toFixed(2)}  Z: ${p.z.toFixed(2)}`;

  if (currentScene === 'classroom') updatePhysics(delta);

  const doorAlpha = 1 - Math.exp(-10 * delta);
  for (const door of interactableDoors) {
    door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, door.userData.targetRotation, doorAlpha);
  }

  updateHoverHighlight();

  if (renderer.xr.isPresenting) {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }

  // 렌더가 실제로 끝난 직후 로딩 화면 제거
  if (_pendingLoadReveal) {
    _pendingLoadReveal = false;
    loadingEl.style.display = 'none';
    clickHintEl.style.display = 'flex';
  }
}

renderer.setAnimationLoop(animate);
