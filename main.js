import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

/** GitHub Pages 등 서브경로(/repo/) 배포 시 올바른 URL (루트 절대경로 `/models` 방지) */
function assetUrl(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// HDR 톤 매핑 설정 
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; // 밝기 (필요시 조절)
document.body.appendChild(renderer.domElement);

// 조명
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);

// 360도 EXR 배경 로드
const exrLoader = new EXRLoader();
exrLoader.load(assetUrl('textures/sky.exr'), (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture; // 창문에 하늘이 반사됨!
});

// 컨트롤 설정 
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enabled = true;

const fps = new PointerLockControls(camera, document.body);
scene.add(fps.getObject());

// 시점 높이 설정
const FIXED_Y = 1.7; 
fps.getObject().position.set(-5, FIXED_Y, 10); 

// 상호작용 및 물리 변수
const raycaster = new THREE.Raycaster();
const centerPosition = new THREE.Vector2(0, 0); 
const interactableDoors = []; 

// 벽 충돌 방지용
const collisionRaycaster = new THREE.Raycaster();
const mapObjects = []; 

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

// 교실 모델
gltfLoader.load(assetUrl('models/classroom.glb'), (gltf) => {
  mapObjects.push(gltf.scene); 
  scene.add(gltf.scene);
});


// 첫 번째 문 모델
gltfLoader.load(assetUrl('models/door1.glb'), (gltf) => {
  const door1 = gltf.scene;
  door1.position.set(6.38, 0.99, 1.13);
  door1.userData.isOpen = false;
  door1.userData.openRotationY = -Math.PI / 2;
  door1.userData.targetRotation = 0; 
  interactableDoors.push(door1);
  scene.add(door1);
});

// 두 번째 문 모델
gltfLoader.load(assetUrl('models/door2.glb'), (gltf) => {
  const door2 = gltf.scene;
  door2.position.set(4.66, 0.96, 3.75
  ); 
  door2.userData.isOpen = false;
  door2.userData.targetRotation = 0;
  interactableDoors.push(door2);
  scene.add(door2);
});

// 세 번째 문 모델
gltfLoader.load(assetUrl('models/door3.glb'), (gltf) => {
  const door3 = gltf.scene;
  door3.position.set(0.7, 1.02, 3.75);
  door3.userData.isOpen = false;
  door3.userData.targetRotation = 0;
  interactableDoors.push(door3);
  scene.add(door3);
});

// ===== 입력 변수 =====
const move = { forward: false, backward: false, left: false, right: false };
const speed = 0.117; // 걷는 속도 (현재값에서 30% 증가)

let velocityY = 0;
const gravity = 0.015;
const jumpForce = 0.24;
let canJump = true;

// ===== 키보드/마우스 이벤트 =====
document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': move.forward = true; break;
    case 'KeyS': move.backward = true; break;
    case 'KeyA': move.left = true; break;
    case 'KeyD': move.right = true; break;
    case 'Space': 
      if (canJump && fps.isLocked) {
        velocityY = jumpForce;
        canJump = false;
      }
      break;
  }
});

document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': move.forward = false; break;
    case 'KeyS': move.backward = false; break;
    case 'KeyA': move.left = false; break;
    case 'KeyD': move.right = false; break;
  }
});

// 문 클릭 열기/닫기
window.addEventListener('mousedown', (e) => {
  if (!fps.isLocked || e.button !== 0) return;

  raycaster.setFromCamera(centerPosition, camera);
  const intersects = raycaster.intersectObjects(interactableDoors, true);

  if (intersects.length > 0) {
    let clickedDoor = intersects[0].object;
    while (!clickedDoor.userData.hasOwnProperty('isOpen') && clickedDoor.parent) {
      clickedDoor = clickedDoor.parent;
    }

    if (clickedDoor.userData.hasOwnProperty('isOpen')) {
      clickedDoor.userData.isOpen = !clickedDoor.userData.isOpen;
      const openAngle = clickedDoor.userData.openRotationY ?? Math.PI / 2;
      clickedDoor.userData.targetRotation = clickedDoor.userData.isOpen ? openAngle : 0;
    }
  }
});

// 시점 변환 버튼
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

// ===== 이동 및 충돌 물리 함수 =====
function updateMovement() {
  if (!fps.isLocked) return;

  const pos = fps.getObject().position;
  const oldX = pos.x;
  const oldZ = pos.z;

  if (move.forward) fps.moveForward(speed);
  if (move.backward) fps.moveForward(-speed);
  if (move.left) fps.moveRight(-speed);
  if (move.right) fps.moveRight(speed);

  // 🧱 벽 충돌 검사
  const checkPos = new THREE.Vector3(pos.x, FIXED_Y - 1.0, pos.z);
  const directions = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 1).normalize(), new THREE.Vector3(-1, 0, -1).normalize(),
    new THREE.Vector3(1, 0, -1).normalize(), new THREE.Vector3(-1, 0, 1).normalize()
  ];

  let isColliding = false;
  const playerRadius = 0.3; 

  for (let i = 0; i < directions.length; i++) {
    collisionRaycaster.set(checkPos, directions[i]);
    const intersects = collisionRaycaster.intersectObjects(mapObjects, true);
    
    if (intersects.length > 0 && intersects[0].distance < playerRadius) {
      isColliding = true;
      break; 
    }
  }

  // 충돌 시 이동 취소
  if (isColliding) {
    pos.x = oldX;
    pos.z = oldZ;
  }

  // 중력/바닥 고정
  velocityY -= gravity;
  pos.y += velocityY;

  if (pos.y <= FIXED_Y) {
    pos.y = FIXED_Y;
    velocityY = 0;
    canJump = true;
  }
}

// ===== 루프 =====
function animate() {
  requestAnimationFrame(animate);
  
  if (fps.isLocked) {
    updateMovement();
  } else if (orbit.enabled) {
    orbit.update(); 
  }

  // 문 부드럽게 회전 애니메이션
  interactableDoors.forEach((door) => {
    door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, door.userData.targetRotation, 0.1);
  });

  renderer.render(scene, camera);
}

animate();