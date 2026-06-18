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

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.xr.enabled = true;
renderer.xr.setFramebufferScaleFactor(0.75);
renderer.xr.setFoveation(0.0);
renderer.xr.setReferenceSpaceType('local'); // local-floor 대신 local: 카메라가 playerRig 위치에서 시작
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// EffectComposer + OutlinePass (데스크톱 호버 강조)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const outlinePass = new OutlinePass(new THREE.Vector2(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2)), scene, camera);
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
  // sessionstart는 첫 XR 프레임보다 먼저 실행됨 (JS 싱글스레드 보장)
  // → 동기 compile이 안전: XR 프레임 시작 전 모든 셰이더 준비 완료
  _enableVRLights();
  renderer.compile(scene, camera);
  renderer.xr.setFoveation(0.5); // 1.0은 엣지 아티팩트 발생, 0.5로 완화
  if (fps.isLocked) fps.unlock();
  clickHintEl.style.display = 'none';
  crosshairEl.style.display = 'none';
  document.body.style.cursor = 'none';
});
// VR 세션 종료: 그림자 복원 + 클릭힌트 표시
renderer.xr.addEventListener('sessionend', () => {
  renderer.shadowMap.enabled = true;
  _disableVRLights();
  renderer.shadowMap.needsUpdate = true;
  renderer.xr.setFoveation(0.0);
  if (!transitioning) clickHintEl.style.display = 'flex';
  crosshairEl.style.display = '';
  document.body.style.cursor = '';
});

const hemiLight = new THREE.HemisphereLight(0xddeeff, 0xd4c9b0, 0.1);
scene.add(hemiLight);

const roomLight1 = new THREE.SpotLight(0xfff5e0, 6.0, 12, Math.PI/2.3, 0.25);
roomLight1.position.set(0, 2.2, 1.18);
roomLight1.target.position.set(0, 0, 1.18);
roomLight1.castShadow = true;
roomLight1.shadow.mapSize.set(512, 512);
roomLight1.shadow.camera.near = 0.3;
roomLight1.shadow.camera.far = 8;
roomLight1.shadow.camera.updateProjectionMatrix();
roomLight1.shadow.bias = -0.003;
scene.add(roomLight1);
scene.add(roomLight1.target);

const roomLight2 = new THREE.SpotLight(0xfff5e0, 6.0, 12, Math.PI/2.3, 0.25);
roomLight2.position.set(5.5, 2.2, 1.18);
roomLight2.target.position.set(5.5, 0, 1.18);
scene.add(roomLight2);
scene.add(roomLight2.target);

const roomLight3 = new THREE.SpotLight(0xfff5e0, 6.0, 12, Math.PI/2.3, 0.25);
roomLight3.position.set(1.36, 2.2, 8.15);
roomLight3.target.position.set(1.36, 0, 8.15);
roomLight3.castShadow = true;
roomLight3.shadow.mapSize.set(512, 512);
roomLight3.shadow.camera.near = 0.3;
roomLight3.shadow.camera.far = 8;
roomLight3.shadow.camera.updateProjectionMatrix();
roomLight3.shadow.bias = -0.003;
scene.add(roomLight3);
scene.add(roomLight3.target);

const roomLight4 = new THREE.SpotLight(0xfff5e0, 6.0, 12, Math.PI/2.3, 0.25);
roomLight4.position.set(6.55, 2.2, 8.42);
roomLight4.target.position.set(6.55, 0, 8.42);
scene.add(roomLight4);
scene.add(roomLight4.target);

const roomLight5 = new THREE.SpotLight(0xfff5e0, 7.8, 12, Math.PI/2.3, 0.25);
roomLight5.position.set(9.6, 2.2, 4.7);
roomLight5.target.position.set(9.6, 0, 4.7);
roomLight5.castShadow = true;
roomLight5.shadow.mapSize.set(512, 512);
roomLight5.shadow.camera.near = 0.3;
roomLight5.shadow.camera.far = 8;
roomLight5.shadow.camera.updateProjectionMatrix();
roomLight5.shadow.bias = -0.003;
scene.add(roomLight5);
scene.add(roomLight5.target);

const roomLight6 = new THREE.SpotLight(0xfff5e0, 7.8, 12, Math.PI/2.3, 0.25);
roomLight6.position.set(-2.64, 2.2, 4.94);
roomLight6.target.position.set(-2.64, 0, 4.94);
scene.add(roomLight6);
scene.add(roomLight6.target);

const roomLight7 = new THREE.SpotLight(0xfff5e0, 8.0, 12, Math.PI/2.3, 0.25);
roomLight7.position.set(14.06, 2.2, 6.91);
roomLight7.target.position.set(14.06, 0, 6.91);
roomLight7.castShadow = true;
roomLight7.shadow.mapSize.set(512, 512);
roomLight7.shadow.camera.near = 0.3;
roomLight7.shadow.camera.far = 8;
roomLight7.shadow.camera.updateProjectionMatrix();
roomLight7.shadow.bias = -0.003;
scene.add(roomLight7);
scene.add(roomLight7.target);

const roomLight8 = new THREE.SpotLight(0xfff5e0, 8.0, 12, Math.PI/2.3, 0.25);
roomLight8.position.set(13.89, 2.2, -0.33);
roomLight8.target.position.set(13.89, 0, -0.33);
roomLight8.castShadow = true;
roomLight8.shadow.mapSize.set(512, 512);
roomLight8.shadow.camera.near = 0.3;
roomLight8.shadow.camera.far = 8;
roomLight8.shadow.camera.updateProjectionMatrix();
roomLight8.shadow.bias = -0.003;
scene.add(roomLight8);
scene.add(roomLight8.target);

// VR 전용 조명 (8개 SpotLight → 1 HemiLight + 1 DirLight)
// SpotLight는 per-fragment마다 atan2/sqrt/dot 연산 → Quest GPU 예산 초과
const _vrHemiLight = new THREE.HemisphereLight(0xfff5e0, 0x9090a0, 2.5);
const _vrDirLight  = new THREE.DirectionalLight(0xfffaed, 1.2);
_vrDirLight.position.set(0.5, 1.0, 0.3).normalize();
const _vrRoomLights = [roomLight1,roomLight2,roomLight3,roomLight4,roomLight5,
                       roomLight6,roomLight7,roomLight8];
function _enableVRLights() {
  _vrRoomLights.forEach(function(l) { l.visible = false; });
  if (!scene.children.includes(_vrHemiLight)) scene.add(_vrHemiLight);
  if (!scene.children.includes(_vrDirLight))  scene.add(_vrDirLight);
}
function _disableVRLights() {
  scene.remove(_vrHemiLight);
  scene.remove(_vrDirLight);
  _vrRoomLights.forEach(function(l) { l.visible = true; });
}

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enabled = false;

const fps = new PointerLockControls(camera, document.body);

// playerRig: 이동의 기준점. camera는 rig 안에 있어 XR/데스크톱 모두 동작
const playerRig = new THREE.Group();
const vrFadeMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false, side: THREE.FrontSide });
const vrFadePlane = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), vrFadeMat);
vrFadePlane.position.set(0, 0, -1);
vrFadePlane.renderOrder = 9999;
vrFadePlane.visible = false;
let _vrFadeFrames = 0;
playerRig.add(camera);
camera.add(vrFadePlane);
scene.add(playerRig);

// VR 전용 3D 로딩 패널 (카메라 자식, CSS 오버레이 대체)
const _vrInfoCanvas = document.createElement('canvas');
_vrInfoCanvas.width = 512; _vrInfoCanvas.height = 160;
const _vrInfoCtx = _vrInfoCanvas.getContext('2d');
const _vrInfoTex = new THREE.CanvasTexture(_vrInfoCanvas);
const _vrInfoMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(0.48, 0.15),
  new THREE.MeshBasicMaterial({map: _vrInfoTex, transparent: true, depthTest: false, depthWrite: false, side: THREE.FrontSide})
);
_vrInfoMesh.position.set(0, -0.06, -0.55);
_vrInfoMesh.renderOrder = 10000;
_vrInfoMesh.visible = false;
camera.add(_vrInfoMesh);

function _vrSetInfo(line1, line2) {
  var ctx = _vrInfoCtx, W = 512, H = 160;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(15, 20, 35, 0.95)';
  ctx.beginPath();
  try { ctx.roundRect(6, 6, W-12, H-12, 18); } catch(e) { ctx.rect(6, 6, W-12, H-12); }
  ctx.fill();
  ctx.strokeStyle = '#58a6ff'; ctx.lineWidth = 2;
  ctx.beginPath();
  try { ctx.roundRect(6, 6, W-12, H-12, 18); } catch(e) { ctx.rect(6, 6, W-12, H-12); }
  ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(line1 || '', W/2, line2 ? 54 : H/2);
  if (line2) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '30px Arial';
    ctx.fillText(line2, W/2, 110);
  }
  _vrInfoTex.needsUpdate = true;
  _vrInfoMesh.visible = true;
}
function _vrClearInfo() { _vrInfoMesh.visible = false; }

const BOAT_FLOOR_Y = 35.0;
const CLASSROOM_FLOOR_Y = 1.7;
const BOAT_EYE_HEIGHT      = 6; // 4.42 * 2
const CLASSROOM_EYE_HEIGHT = 1.7;
let EYE_HEIGHT = BOAT_EYE_HEIGHT;

const BOAT_START      = new THREE.Vector3(-0.3, 25.47, 53.14);
const CLASSROOM_START = new THREE.Vector3(1.71, 1.70, 5);

playerRig.position.copy(BOAT_START);
camera.rotation.set(0, 0, 0);

const raycaster = new THREE.Raycaster();
const centerPosition = new THREE.Vector2(0, 0);
const interactableDoors = [];

const PLAYER_RADIUS = 0.3;

const boatCollisionMeshes      = [];
const classroomCollisionMeshes = [];
const collisionMeshes          = [];
const collisionRaycaster = new THREE.Raycaster();
collisionRaycaster.far = PLAYER_RADIUS + 0.2;
collisionRaycaster.firstHitOnly = true;

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
groundRaycaster.firstHitOnly = true;
const ceilingRaycaster  = new THREE.Raycaster();
ceilingRaycaster.firstHitOnly = true;

// 씬 그룹
const boatGroup      = new THREE.Group();
const classroomGroup = new THREE.Group();
classroomGroup.visible = false;
scene.add(boatGroup);

// ===== 보트 씬 태양광 (그림자용) =====
const sunLight = new THREE.DirectionalLight(0xfff8e7, 2.5);
sunLight.position.set(120, 180, 80);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 800;
sunLight.shadow.camera.left = -200;
sunLight.shadow.camera.right = 200;
sunLight.shadow.camera.top = 200;
sunLight.shadow.camera.bottom = -200;
sunLight.shadow.bias = -0.0005;
boatGroup.add(sunLight);

// ===== 포털 방향 안내 화살표 =====
var arrowGroup = new THREE.Group();
arrowGroup.matrixAutoUpdate = true;
var arrowMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffee00, emissiveIntensity: 3, roughness: 0.2, metalness: 0 });
var shaftGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.8, 12);
var shaft = new THREE.Mesh(shaftGeo, arrowMat);
shaft.rotation.x = Math.PI / 2;
shaft.matrixAutoUpdate = true;
arrowGroup.add(shaft);
var headGeo = new THREE.ConeGeometry(0.22, 0.6, 12);
var head = new THREE.Mesh(headGeo, arrowMat);
head.rotation.x = Math.PI / 2;
head.position.z = 1.2;
head.matrixAutoUpdate = true;
arrowGroup.add(head);
boatGroup.add(arrowGroup);
var _arrowTime = 0;
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
const transitionPct = document.getElementById('transition-pct');
const transitionBar  = document.getElementById('transition-bar');
const coordsEl     = document.getElementById('coords');
const crosshairEl  = document.getElementById('crosshair');
const boatEntryPopupEl = document.getElementById('boat-entry-popup');
const portalTooltipEl  = document.getElementById('portal-tooltip');
let _boatEntryPopupTimer = null;

let _pendingLoadReveal = false;
let _hoverTick = 0;
let _shadowMoveTick = 0;
let _coordsTick = 0;
let _portalRayTick = 0;
let _vrPhysTick = 0;
let _hoverTargets = [];
const _camFwdVec   = new THREE.Vector3();
const _toPortalVec = new THREE.Vector3();
const _arrowWpVec  = new THREE.Vector3();
const _portalWpVec = new THREE.Vector3();
function _rebuildHoverTargets() { _hoverTargets = [...interactableDoors, ...grabbableObjects]; }
let _nearColliders = collisionMeshes;
const _nearBase = new THREE.Vector3(Infinity, 0, Infinity);
function _refreshNear(pos) {
  _nearBase.copy(pos);
  _nearColliders = collisionMeshes.length < 40 ? collisionMeshes :
    collisionMeshes.filter(function(m) {
      var wp = m.userData._wpos;
      return !wp || (Math.abs(wp.x - pos.x) < 6 && Math.abs(wp.z - pos.z) < 6);
    });
}

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
    renderer.shadowMap.needsUpdate = true;
    if (currentScene === 'boat') {
      collisionMeshes.length = 0;
      collisionMeshes.push(...boatCollisionMeshes);
      _nearColliders = collisionMeshes; _nearBase.set(Infinity,0,Infinity);
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
    if (loaded === total) {
      classroomReady = true;
      classroomLoading = false;
      // Pre-warm: compile shaders + upload textures before scene switch
      // VR: pre-warm 블로킹 전 fade 확실히 켬 + UI 업데이트
      classroomGroup.visible = true;
      // 텍스처 업로드 + onComplete 공통 처리
      function _finalizePrewarm() {
        classroomGroup.traverse(function(n) {
          if (!n.isMesh || !n.material) return;
          var mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach(function(m) {
            ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'].forEach(function(k) {
              if (m[k]) renderer.initTexture(m[k]);
            });
          });
        });
        classroomGroup.visible = false;
        onComplete();
      }
      if (renderer.xr.isPresenting) {
        // VR: compileAsync → XR 루프 차단 없이 비동기 셰이더 컴파일
        vrFadePlane.visible = true; _vrFadeFrames = 0;
        _vrSetInfo('GPU 준비 중...', '쉐이더 컴파일 중...');
        renderer.compileAsync(scene, camera).then(function() {
          _vrSetInfo('준비 완료', '씬이 곧 나타납니다');
          _finalizePrewarm();
        });
      } else {
        renderer.compile(scene, camera);
        _finalizePrewarm();
      }
    }
  };

  classroomLoader.load(assetUrl('models/classroom.glb'), (gltf) => {
    try {
      gltf.scene.position.set(2.7, -0.02, 4.83);

      // Kit 도어 메시를 충돌 배열에서 제외하기 위해 먼저 수집
      const KIT_DOOR_NAMES = new Set(['Kit_Door_Left', 'Kit_Door_Right', 'Kit_Door', 'Kit_Door2']);
      const kitDoorMeshes = new Set();
      gltf.scene.traverse((node) => {
        if (KIT_DOOR_NAMES.has(node.name)) node.traverse(n => kitDoorMeshes.add(n));
      });
      // grabbable 오브젝트도 충돌 배열에서 제외 (이동 가능 오브젝트는 불필요)
      const _GRAB_TMP = new Set(['Stool_Left','Stool_Right','Book','chair1','chair2','chair3','Cousion1','Cousion2','Cousion3','Dish','Jigger1','Jigger2','Kit_Bottle','Kit_Chair','Bar_Chair_1','Bar_Chair_2','Bar_Chair_3','Bar_Chair_4','Bar_Chair_5','Bar_Chair_6','Bar_Chair_7','Bar_Chair_8','Cacktale','Ice_Can','RH_Highball','RH_RoundDecanter','Wine','Wine_Met']);
      gltf.scene.traverse((node) => {
        if (_GRAB_TMP.has(node.name)) node.traverse(n => kitDoorMeshes.add(n));
      });

      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((node) => {
        node.matrixAutoUpdate = false;
        node.updateMatrix();
        if (node.isMesh && !kitDoorMeshes.has(node)) {
          node.receiveShadow = true;
          if (node.geometry) {
            node.geometry.computeBoundingBox();
            const _bs = node.geometry.boundingBox.getSize(new THREE.Vector3()).length();
            node.castShadow = _bs > 0.4;
          }
          node.userData._wpos = new THREE.Vector3();
          node.getWorldPosition(node.userData._wpos);
          classroomCollisionMeshes.push(node);
        }
      });

      // 잡을 수 있는 오브젝트 / Kit 도어 등록
      const GRABBABLE_NAMES = new Set(['Stool_Left', 'Stool_Right', 'Book', 'chair1', 'chair2', 'chair3', 'Cousion1', 'Cousion2', 'Cousion3', 'Dish', 'Jigger1', 'Jigger2', 'Kit_Bottle', 'Kit_Chair', 'Bar_Chair_1', 'Bar_Chair_2', 'Bar_Chair_3', 'Bar_Chair_4', 'Bar_Chair_5', 'Bar_Chair_6', 'Bar_Chair_7', 'Bar_Chair_8', 'Cacktale', 'Ice_Can', 'RH_Highball', 'RH_RoundDecanter', 'Wine', 'Wine_Met']);
      const kitDoorPair = [];
      gltf.scene.traverse((node) => {
        if (GRABBABLE_NAMES.has(node.name)) {
          node.userData.isGrabbable = true;
          node.traverse(n => {
            n.matrixAutoUpdate = true;
            n.receiveShadow = true;
            if (n.isMesh && n.geometry) {
              if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
              var _gsz = n.geometry.boundingBox.getSize(new THREE.Vector3()).length();
              if (_gsz > 0.15) n.castShadow = true;
            }
          });
          grabbableObjects.push(node);
        }
        if (KIT_DOOR_NAMES.has(node.name)) {
          const closedRot = node.rotation.y; // GLB 원래 위치
          node.userData.isOpen = false;
          node.userData.closedRotation = closedRot;
          node.userData.openRotationY = node.name === 'Kit_Door_Right' || node.name === 'Kit_Door' || node.name === 'Kit_Door2'
            ? closedRot + Math.PI / 2   // Right: 오른쪽으로 90도
            : closedRot - Math.PI / 2;  // Left: 왼쪽으로 90도
          node.userData.targetRotation = closedRot;
          node.traverse(n => { n.matrixAutoUpdate = true; n.castShadow = true; n.receiveShadow = true; });
          interactableDoors.push(node);
          kitDoorPair.push(node);
        }
      });
      // 두 Kit 도어 연결 — 한 쪽 클릭 시 양쪽 동시 작동
      var _kLeft = kitDoorPair.find(function(d){return d.name==='Kit_Door_Left';});
      var _kRight = kitDoorPair.find(function(d){return d.name==='Kit_Door_Right';});
      if (_kLeft && _kRight) {
        _kLeft.userData.linkedDoor = _kRight;
        _kRight.userData.linkedDoor = _kLeft;
      }

      classroomGroup.add(gltf.scene);
      if (!dartboardMesh) initDartGame();
      _rebuildHoverTargets();
    } catch (e) {
      console.error('classroom.glb 처리 오류:', e);
    }
    check();
  }, (event) => {
    if (event.loaded > 0) {
      const mb = (event.loaded / 1024 / 1024).toFixed(0);
      const total = event.total > 0 ? `/ ${(event.total / 1024 / 1024).toFixed(0)}MB` : '';
    }
  }, (err) => {
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
_physicsRaycaster.firstHitOnly = true;
const _physDown   = new THREE.Vector3(0, -1, 0);
const _physOrigin = new THREE.Vector3();
const _physRayH   = [0, 0, 0];
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
    _physRayH[0] = baseY + 0.05; _physRayH[1] = baseY + 0.2; _physRayH[2] = baseY + 0.4;
    for (const dir of COLLISION_DIRS) {
      const hVel = dir.x !== 0 ? vel.x : vel.z;
      if (Math.sign(hVel) !== Math.sign(dir.x + dir.z)) continue;
      let minDist = Infinity;
      const castFar = Math.abs(hVel) * delta + OBJ_R + 0.1;
      for (const ry of _physRayH) {
        _physOrigin.set(obj.position.x, ry, obj.position.z);
        _physicsRaycaster.set(_physOrigin, dir);
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
      _physOrigin.copy(obj.position);
      _physicsRaycaster.set(_physOrigin, _upVec);
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


// ===== DART GAME =====
const DART_SECTORS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
let dartThrowsLeft = 3;
let dartRoundScore = 0;
const dartObjects = [];
let dartboardMesh = null;
let scorePanelCanvas = null, scorePanelCtx = null, scorePanelTexture = null;
let _dartStartBtnMesh = null;
let _dartArcLine = null;
let _dartState = 'idle'; // idle|ready|charging|flying|done
let _dartChargeX = 0, _dartChargeY = 0;
let _dartFlight = null; // {pos,vel,mesh}
const _DART_WX = 15.85, _DART_WY = 1.7, _DART_WZ = 7.95;
const _DART_R = 0.525;
const _DART_GRAVITY = 9.8;

function _drawDartboard() {
  const SIZE = 512;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  const cx = SIZE/2, cy = SIZE/2, R = SIZE/2;
  const SEG = Math.PI*2/20;
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();
  const rings = [
    [1.0, 0.95, function(i){ return i%2===0?'#cc2200':'#00881a'; }],
    [0.95, 0.855, function(i){ return i%2===0?'#f0e6c8':'#111'; }],
    [0.855, 0.63, function(i){ return i%2===0?'#cc2200':'#00881a'; }],
    [0.63, 0.535, function(i){ return i%2===0?'#f0e6c8':'#111'; }],
  ];
  for (var ri=0; ri<rings.length; ri++) {
    var outer=rings[ri][0], inner=rings[ri][1], colorFn=rings[ri][2];
    for (var i=0; i<20; i++) {
      var a0=-Math.PI/2+i*SEG-SEG/2, a1=a0+SEG;
      ctx.beginPath();
      ctx.arc(cx,cy,R*outer,a0,a1);
      ctx.arc(cx,cy,R*inner,a1,a0,true);
      ctx.closePath();
      ctx.fillStyle=colorFn(i); ctx.fill();
    }
  }
  ctx.beginPath(); ctx.arc(cx,cy,R*0.085,0,Math.PI*2); ctx.fillStyle='#00881a'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx,cy,R*0.04,0,Math.PI*2);  ctx.fillStyle='#cc2200'; ctx.fill();
  ctx.fillStyle='#fff';
  ctx.font='bold '+Math.round(R*0.095)+'px Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for (var i=0;i<20;i++) {
    var a=-Math.PI/2+i*SEG;
    ctx.fillText(DART_SECTORS[i], cx+R*0.975*Math.cos(a), cy+R*0.975*Math.sin(a));
  }
  var tex=new THREE.CanvasTexture(c);
  tex.flipY=false;
  return tex;
}

function _calcDartScore(u, v) {
  var dx=u-0.5, dy=v-0.5;
  var dist=Math.sqrt(dx*dx+dy*dy);
  if (dist>0.475) return 0;
  if (dist<0.02)  return 50;
  if (dist<0.0425) return 25;
  var SEG=Math.PI*2/20;
  var angle=Math.atan2(dy,dx); if(angle<0) angle+=Math.PI*2;
  var norm=(angle-(1.5*Math.PI-SEG/2)+4*Math.PI)%(Math.PI*2);
  var val=DART_SECTORS[Math.floor(norm/SEG)%20];
  if (dist<0.2675) return val;
  if (dist<0.315)  return val*3;
  if (dist<0.4275) return val;
  return val*2;
}

function _updateScorePanel() {
  var ctx=scorePanelCtx, W=scorePanelCanvas.width, H=scorePanelCanvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='rgba(10,15,25,0.93)';
  ctx.beginPath(); ctx.roundRect(2,2,W-4,H-4,14); ctx.fill();
  ctx.fillStyle='#58a6ff'; ctx.font='bold 30px Arial'; ctx.textAlign='center';
  ctx.fillText('DARTS',W/2,40);
  ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.font='22px Arial';
  ctx.fillText('●'.repeat(dartThrowsLeft)+'○'.repeat(3-dartThrowsLeft),W/2,80);
  ctx.fillStyle='#79c0ff'; ctx.font='bold 60px Arial';
  ctx.fillText(dartRoundScore,W/2,152);
  ctx.fillStyle='rgba(255,255,255,0.38)'; ctx.font='15px Arial';
  var hint='';
  if(_dartState==='idle'||_dartState==='done') hint='Aim at START & click';
  else if(_dartState==='ready') hint='Hold & drag to throw';
  else if(_dartState==='charging'){
    var pwr=Math.round(Math.min(1,Math.sqrt(_dartChargeX*_dartChargeX+_dartChargeY*_dartChargeY)/150)*100);
    hint='Power '+pwr+'%  Release!';
  } else if(_dartState==='flying') hint='...';
  ctx.fillText(hint,W/2,210);
  scorePanelTexture.needsUpdate=true;
}

function _dartLaunch() {
  if (dartThrowsLeft===0 || _dartState!=='charging') return;
  _dartState='flying';
  var camPos=new THREE.Vector3();
  camera.getWorldPosition(camPos);
  var dx=_DART_WX-camPos.x, dz_=_DART_WZ-camPos.z, dy0=_DART_WY-camPos.y;
  var horiz=Math.sqrt(dx*dx+dz_*dz_);
  var FT=Math.max(0.35,Math.min(0.7,horiz/20));
  var vx=dx/FT, vz_=dz_/FT;
  var vy=dy0/FT+0.5*_DART_GRAVITY*FT;
  // drag: chargeY negative=drag up=aim higher; chargeX right=aim +Z
  var SENS=0.04;
  vy+=-_dartChargeY*SENS;
  vz_+=_dartChargeX*SENS;
  var mesh=new THREE.Mesh(
    new THREE.CylinderGeometry(0.006,0.002,0.24,8),
    new THREE.MeshStandardMaterial({color:0xd4aa70,metalness:0.5,roughness:0.4})
  );
  mesh.matrixAutoUpdate=true;
  mesh.position.copy(camPos);
  scene.add(mesh);
  _dartFlight={pos:camPos.clone(),vel:new THREE.Vector3(vx,vy,vz_),mesh:mesh};
  dartThrowsLeft--;
  _updateScorePanel();
  if(_dartArcLine){scene.remove(_dartArcLine);_dartArcLine.geometry.dispose();_dartArcLine=null;}
}

function _dartUpdate(delta) {
  if (!_dartFlight) return;
  _dartFlight.vel.y-=_DART_GRAVITY*delta;
  _dartFlight.pos.addScaledVector(_dartFlight.vel,delta);
  var m=_dartFlight.mesh;
  m.position.copy(_dartFlight.pos);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),_dartFlight.vel.clone().normalize());
  // Board plane check (dart crossed X = _DART_WX from left)
  if(_dartFlight.pos.x>=_DART_WX-0.05){
    var wy=_dartFlight.pos.y, wz=_dartFlight.pos.z;
    var dz=wz-_DART_WZ, dy=wy-_DART_WY;
    var dist=Math.sqrt(dz*dz+dy*dy);
    scene.remove(m);
    if(dist<=_DART_R){
      // Embed dart in board
      var stk=new THREE.Mesh(
        new THREE.CylinderGeometry(0.006,0.002,0.18,8),
        new THREE.MeshStandardMaterial({color:0xd4aa70,metalness:0.5,roughness:0.4})
      );
      stk.matrixAutoUpdate=true;
      stk.position.set(_DART_WX,wy,wz);
      stk.rotation.z=Math.PI/2; // axis → -X (dart tail toward player)
      scene.add(stk); dartObjects.push(stk);
      // Score from UV
      var u=0.5+dz/(2*_DART_R), v=0.5+dy/(2*_DART_R);
      var score=_calcDartScore(u,v);
      dartRoundScore+=score;
      // Popup sprite
      var popC=document.createElement('canvas'); popC.width=160; popC.height=72;
      var pc=popC.getContext('2d');
      pc.fillStyle=score>=50?'#ff4040':score>=25?'#ffaa00':'#58a6ff';
      pc.font='bold 44px Arial'; pc.textAlign='center'; pc.textBaseline='middle';
      pc.fillText(score===0?'Miss!':'+'+score,80,36);
      var popTex=new THREE.CanvasTexture(popC);
      var popSpr=new THREE.Sprite(new THREE.SpriteMaterial({map:popTex,depthTest:false}));
      popSpr.scale.set(0.36,0.16,1);
      popSpr.position.set(_DART_WX,wy+0.15,wz);
      scene.add(popSpr); dartObjects.push(popSpr);
      setTimeout(function(){scene.remove(popSpr);popTex.dispose();popSpr.material.dispose();},1800);
    }
    m.geometry.dispose(); m.material.dispose();
    _dartFlight=null;
    _updateScorePanel();
    _dartState=dartThrowsLeft>0?'ready':'done';
  }
  // Fell below floor or far past board
  if(_dartFlight&&(_dartFlight.pos.y<-1||_dartFlight.pos.x>_DART_WX+2)){
    scene.remove(_dartFlight.mesh);
    _dartFlight.mesh.geometry.dispose(); _dartFlight.mesh.material.dispose();
    _dartFlight=null;
    _updateScorePanel();
    _dartState=dartThrowsLeft>0?'ready':'done';
  }
}

function _dartUpdateArc() {
  if(_dartState!=='charging'){
    if(_dartArcLine){scene.remove(_dartArcLine);_dartArcLine.geometry.dispose();_dartArcLine=null;}
    return;
  }
  var camPos=new THREE.Vector3();
  camera.getWorldPosition(camPos);
  var dx=_DART_WX-camPos.x, dz_=_DART_WZ-camPos.z, dy0=_DART_WY-camPos.y;
  var horiz=Math.sqrt(dx*dx+dz_*dz_);
  var FT=Math.max(0.35,Math.min(0.7,horiz/20));
  var vx=dx/FT, vz_=dz_/FT+_dartChargeX*0.04;
  var vy=dy0/FT+0.5*_DART_GRAVITY*FT-_dartChargeY*0.04;
  var pts=[], p=camPos.clone(), v=new THREE.Vector3(vx,vy,vz_), dt=0.03;
  for(var i=0;i<40;i++){
    pts.push(p.x,p.y,p.z);
    v.y-=_DART_GRAVITY*dt;
    p.x+=v.x*dt; p.y+=v.y*dt; p.z+=v.z*dt;
    if(p.x>=_DART_WX){pts.push(_DART_WX,p.y,p.z);break;}
  }
  if(!_dartArcLine){
    _dartArcLine=new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({color:0xffee00,transparent:true,opacity:0.8,depthTest:false})
    );
    _dartArcLine.renderOrder=999;
    scene.add(_dartArcLine);
  }
  var arr=new Float32Array(pts);
  _dartArcLine.geometry.setAttribute('position',new THREE.BufferAttribute(arr,3));
  _dartArcLine.geometry.setDrawRange(0,pts.length/3);
  _dartArcLine.geometry.computeBoundingSphere();
}

function _resetDartGame() {
  dartThrowsLeft=3; dartRoundScore=0;
  dartObjects.forEach(function(d){scene.remove(d);}); dartObjects.length=0;
  _dartState='idle'; _dartFlight=null;
  if(_dartArcLine){scene.remove(_dartArcLine);_dartArcLine.geometry.dispose();_dartArcLine=null;}
  _updateScorePanel();
}

function initDartGame() {
  var dbTex=_drawDartboard();
  dartboardMesh=new THREE.Mesh(
    new THREE.CircleGeometry(0.525,64),
    new THREE.MeshStandardMaterial({map:dbTex,roughness:0.8})
  );
  dartboardMesh.userData.isDartboard=true;
  dartboardMesh.matrixAutoUpdate=true;
  dartboardMesh.position.set(_DART_WX,_DART_WY,_DART_WZ);
  dartboardMesh.rotation.y=-Math.PI/2;
  classroomGroup.add(dartboardMesh);
  // Score panel
  scorePanelCanvas=document.createElement('canvas');
  scorePanelCanvas.width=scorePanelCanvas.height=256;
  scorePanelCtx=scorePanelCanvas.getContext('2d');
  scorePanelTexture=new THREE.CanvasTexture(scorePanelCanvas);
  var panelMesh=new THREE.Mesh(
    new THREE.PlaneGeometry(0.6,0.6),
    new THREE.MeshBasicMaterial({map:scorePanelTexture,transparent:true,side:THREE.DoubleSide})
  );
  panelMesh.matrixAutoUpdate=true;
  panelMesh.position.set(_DART_WX,_DART_WY+0.82,_DART_WZ);
  panelMesh.rotation.y=-Math.PI/2;
  classroomGroup.add(panelMesh);
  // Start button
  var btnC=document.createElement('canvas'); btnC.width=256; btnC.height=96;
  var bc=btnC.getContext('2d');
  bc.fillStyle='#1a4a2a'; bc.roundRect(4,4,248,88,12); bc.fill();
  bc.fillStyle='#55ee77'; bc.font='bold 38px Arial';
  bc.textAlign='center'; bc.textBaseline='middle';
  bc.fillText('▶  START',128,48);
  _dartStartBtnMesh=new THREE.Mesh(
    new THREE.PlaneGeometry(0.5,0.19),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(btnC),transparent:true,side:THREE.DoubleSide})
  );
  _dartStartBtnMesh.userData.isDartStart=true;
  _dartStartBtnMesh.matrixAutoUpdate=true;
  _dartStartBtnMesh.position.set(_DART_WX,_DART_WY-0.68,_DART_WZ);
  _dartStartBtnMesh.rotation.y=-Math.PI/2;
  classroomGroup.add(_dartStartBtnMesh);
  _updateScorePanel();
}


function _toggleDoor(door) {
  door.userData.isOpen = !door.userData.isOpen;
  const open = door.userData.openRotationY ?? Math.PI / 2;
  const closed = door.userData.closedRotation ?? 0;
  door.userData.targetRotation = door.userData.isOpen ? open : closed;
  const linked = door.userData.linkedDoor;
  if (linked) {
    linked.userData.isOpen = door.userData.isOpen;
    linked.userData.targetRotation = door.userData.isOpen
      ? (linked.userData.openRotationY ?? Math.PI / 2)
      : (linked.userData.closedRotation ?? 0);
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

  if (_dartStartBtnMesh && hit.object===_dartStartBtnMesh && (_dartState==='idle'||_dartState==='done')){ _resetDartGame(); _dartState='ready'; _updateScorePanel(); return; }
  // VR에서 ready 상태: 트리거 → 즉시 발사 (drag 없이 보드 중심 방향)
  if (_dartState==='ready') { _dartChargeX=0; _dartChargeY=0; _dartState='charging'; _dartLaunch(); return; }
  let obj = hit.object;
  while (!Object.prototype.hasOwnProperty.call(obj.userData, 'isOpen') && obj.parent) obj = obj.parent;
  if (Object.prototype.hasOwnProperty.call(obj.userData, 'isOpen')) {
    _toggleDoor(obj);


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

  // 다트 던지기: ready 상태에서 마우스 홀드 시작
  if (currentScene==='classroom' && _dartState==='ready' && !heldObject) {
    _dartChargeX=0; _dartChargeY=0;
    _dartState='charging';
    fps.enabled=false;
    _updateScorePanel();
    return;
  }
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

  if (_dartStartBtnMesh && currentScene==='classroom') {
    var _ds=raycaster.intersectObject(_dartStartBtnMesh,false);
    if(_ds.length>0&&(_dartState==='idle'||_dartState==='done')){_resetDartGame();_dartState='ready';_updateScorePanel();return;}
  }
  const intersects = raycaster.intersectObjects(interactableDoors, true);
  if (intersects.length > 0) {
    let clicked = intersects[0].object;
    while (!Object.prototype.hasOwnProperty.call(clicked.userData, 'isOpen') && clicked.parent) {
      clicked = clicked.parent;
    }
    if (Object.prototype.hasOwnProperty.call(clicked.userData, 'isOpen')) {
      _toggleDoor(clicked);


    }
  }
});

// 다트 drag accumulation
window.addEventListener('mousemove', function(e) {
  if (_dartState==='charging') {
    _dartChargeX+=e.movementX||0;
    _dartChargeY+=e.movementY||0;
    _dartChargeX=Math.max(-200,Math.min(200,_dartChargeX));
    _dartChargeY=Math.max(-200,Math.min(200,_dartChargeY));
    _updateScorePanel();
  }
});
window.addEventListener('mouseup', function(e) {
  if (e.button===0 && _dartState==='charging') {
    fps.enabled=true;
    _dartLaunch();
  }
});
// 화면 클릭 or 키 입력 → 데스크톱 FPS 진입 (VR 모드가 아닐 때만)
function tryLockFPS() {
  if (!fps.isLocked && !orbit.enabled && !transitioning && !renderer.xr.isPresenting) fps.lock();
}
renderer.domElement.addEventListener('click', tryLockFPS);

fps.addEventListener('lock', () => {
  clickHintEl.style.display = 'none';
  crosshairEl.style.display = 'none';
  document.body.style.cursor = 'none';
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

  // VR: 클릭 즉시 블랙아웃 + 3D 로딩 UI 표시
  if (renderer.xr.isPresenting) {
    vrFadePlane.visible = true;
    _vrFadeFrames = 0;
    _vrSetInfo('씬 전환 중...', to === 'classroom' ? '요트 내부로 이동합니다' : '요트 외부로 이동합니다');
  }

  transitionEl.classList.add('active');

  if (to === 'classroom') {
    if (!classroomReady) {
    }
    loadClassroomAssets(() => {
      // VR: 이미 블랙아웃 중; 씬 전환 후 카운트다운 시작
      if (renderer.xr.isPresenting) { _vrSetInfo('진입 중...', '잠시만 기다려 주세요'); _vrFadeFrames = 150; }
      boatGroup.visible      = false;
      classroomGroup.visible = true;
      if (arrowGroup) arrowGroup.visible = false;
      renderer.shadowMap.needsUpdate = true;
      currentScene = 'classroom';
      EYE_HEIGHT = CLASSROOM_EYE_HEIGHT;
      collisionMeshes.length = 0;
      collisionMeshes.push(...classroomCollisionMeshes);
      _nearColliders = collisionMeshes; _nearBase.set(Infinity,0,Infinity);
      playerRig.position.copy(CLASSROOM_START);
      playerRig.rotation.y = -Math.PI / 2;  // 우측 90도
      camera.rotation.set(0, 0, 0);          // 수평 시선 초기화
      velocityY = 0;

      transitionEl.classList.remove('active');
      setTimeout(function() {
        transitioning = false;
        clickHintEl.style.display = 'flex';
        if (boatEntryPopupEl) {
          boatEntryPopupEl.style.display = 'flex';
          clearTimeout(_boatEntryPopupTimer);
          _boatEntryPopupTimer = setTimeout(function() { boatEntryPopupEl.style.display = 'none'; }, 4000);
        }
      }, 320);
    }, (pct) => {
      transitionBar.style.width = pct + '%'; transitionPct.textContent = pct + '%';
      if (renderer.xr.isPresenting) _vrSetInfo('로딩 중...', pct + '%  (' + pct + '/100)');
    });
  } else {
    setTimeout(() => {
      // VR: compileAsync → 셰이더 준비 완료 후 fade-in 시작
      if (renderer.xr.isPresenting) {
        classroomGroup.visible = false;
        boatGroup.visible = true;
        _enableVRLights();
        _vrSetInfo('쉐이더 준비 중...', '잠시만 기다려 주세요');
        renderer.compileAsync(scene, camera).then(function() {
          _vrSetInfo('이동 완료!', '요트가 곧 나타납니다');
          _vrFadeFrames = 90;
        });
      } else {
        classroomGroup.visible = false;
        boatGroup.visible = true;
      }
      renderer.shadowMap.needsUpdate = true;
      currentScene = 'boat';
      EYE_HEIGHT = BOAT_EYE_HEIGHT;
      collisionMeshes.length = 0;
      collisionMeshes.push(...boatCollisionMeshes);
      playerRig.position.copy(BOAT_START);
      playerRig.rotation.y = 0;
      camera.rotation.set(0, 0, 0);
      if (arrowGroup) arrowGroup.visible = true;
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
  outlinePass.resolution.set(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2));
});

// ===== 바닥 감지 (하방 레이캐스트) =====
function getGroundY(pos) {
  _groundOrigin.set(pos.x, pos.y, pos.z);
  groundRaycaster.set(_groundOrigin, _downVec);
  groundRaycaster.far = EYE_HEIGHT + 1.5;
  const hits = groundRaycaster.intersectObjects(_nearColliders, false);
  return hits.length > 0 ? hits[0].point.y + EYE_HEIGHT : -Infinity;
}

// ===== 충돌 체크 =====
function checkCollision(pos) {
  _checkPos.set(pos.x, pos.y - 1.0, pos.z);
  for (const dir of COLLISION_DIRS) {
    collisionRaycaster.set(_checkPos, dir);
    const hits = collisionRaycaster.intersectObjects(_nearColliders, false);
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
  if (Math.abs(pos.x - _nearBase.x) > 1.5 || Math.abs(pos.z - _nearBase.z) > 1.5) _refreshNear(pos);
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
    const ceilHits = ceilingRaycaster.intersectObjects(_nearColliders, false);
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
      const hits = raycaster.intersectObjects(_hoverTargets, true);
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

  if (_vrFadeFrames > 0) { _vrFadeFrames--; if (_vrFadeFrames === 0) { vrFadePlane.visible = false; _vrClearInfo(); } }
  const p = playerRig.position;
  if (++_coordsTick % 6 === 0) coordsEl.textContent = `X: ${p.x.toFixed(2)}  Y: ${p.y.toFixed(2)}  Z: ${p.z.toFixed(2)}`;
  if (currentScene==='boat' && arrowGroup) {    _arrowTime += delta * 2.5;    camera.getWorldDirection(_camFwdVec);    _camFwdVec.y = 0; _camFwdVec.normalize();    arrowGroup.position.copy(playerRig.position);    arrowGroup.position.y = playerRig.position.y - 1.0;    arrowGroup.position.addScaledVector(_camFwdVec, 2.5);    arrowGroup.position.y += Math.sin(_arrowTime) * 0.12;    var _px = arrowGroup.position.x, _pz = arrowGroup.position.z;    _toPortalVec.set(-0.03 - _px, 0, -37.47 - _pz);    arrowGroup.rotation.y = Math.atan2(_toPortalVec.x, _toPortalVec.z);    if (boatEntryPopupEl && boatEntryPopupEl.style.display === 'flex') {      _arrowWpVec.copy(arrowGroup.position); _arrowWpVec.project(camera);      if (_arrowWpVec.z < 1) {        boatEntryPopupEl.style.left = ((_arrowWpVec.x * 0.5 + 0.5) * window.innerWidth) + 'px';        boatEntryPopupEl.style.top = ((1 - (_arrowWpVec.y * 0.5 + 0.5)) * window.innerHeight - 70) + 'px';      }    }  }

  if (currentScene === 'classroom') {
    if (!renderer.xr.isPresenting || ++_vrPhysTick%2===0) updatePhysics(delta);
    _dartUpdate(delta);
    if (!renderer.xr.isPresenting) _dartUpdateArc();
  }

  const doorAlpha = 1 - Math.exp(-10 * delta);
  for (const door of interactableDoors) {
    door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, door.userData.targetRotation, doorAlpha);
  }

  if (++_hoverTick % 3 === 0) updateHoverHighlight();

  if (currentScene==='classroom') {
    var _doorMoved=interactableDoors.some(function(d){
      var prev=d.userData._lastShadowRot??d.rotation.y;
      var moved=Math.abs(d.rotation.y-prev)>0.03;
      if(moved) d.userData._lastShadowRot=d.rotation.y;
      return moved;
    });
    var _objMoving=heldObject||grabbableObjects.some(function(o){return o.userData.physicsActive;});
    if(_doorMoved) renderer.shadowMap.needsUpdate=true;
    else if(_objMoving && ++_shadowMoveTick%3===0) renderer.shadowMap.needsUpdate=true;
  }
  if (currentScene === 'boat' && portalTooltipEl && !renderer.xr.isPresenting) {
    if (++_portalRayTick % 3 === 0) {
      raycaster.setFromCamera(centerPosition, camera);
      var _ph = raycaster.intersectObject(portalMesh, false);
      if (_ph.length > 0) {
        portalTooltipEl.style.display = 'flex';
        portalMesh.getWorldPosition(_portalWpVec); _portalWpVec.project(camera);
        if (_portalWpVec.z < 1) {
          portalTooltipEl.style.left = ((_portalWpVec.x * 0.5 + 0.5) * window.innerWidth) + 'px';
          portalTooltipEl.style.top = ((1 - (_portalWpVec.y * 0.5 + 0.5)) * window.innerHeight - 70) + 'px';
        }
      } else {
        portalTooltipEl.style.display = 'none';
      }
    }
  } else if (portalTooltipEl && currentScene !== 'boat') {
    portalTooltipEl.style.display = 'none';
  }
  if (renderer.xr.isPresenting) {
    renderer.render(scene, camera);
  } else if (outlinePass.selectedObjects.length > 0) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }

  // 렌더가 실제로 끝난 직후 로딩 화면 제거
  if (_pendingLoadReveal) {
    _pendingLoadReveal = false;
    loadingEl.style.display = 'none';
    clickHintEl.style.display = 'flex';
    if (currentScene === 'boat' && boatEntryPopupEl) {
      boatEntryPopupEl.style.display = 'flex';
      clearTimeout(_boatEntryPopupTimer);
      _boatEntryPopupTimer = setTimeout(function() { boatEntryPopupEl.style.display = 'none'; }, 4000);
    }
  }
}

renderer.setAnimationLoop(animate);
