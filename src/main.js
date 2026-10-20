import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// ==========================================
// 1. SETUP BASE: CENA, CÂMERA E RENDERIZADOR
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(0, 1.7, 5);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

document.body.appendChild(renderer.domElement);

// ==========================================
// 2. TERRENO DO PARQUE
// ==========================================

// Base de grama
const grassGeometry = new THREE.PlaneGeometry(50, 50);

const grassMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e8b57,
    roughness: 0.8
});

const grassMesh = new THREE.Mesh(
    grassGeometry,
    grassMaterial
);

grassMesh.rotation.x = -Math.PI / 2;
grassMesh.receiveShadow = true;

scene.add(grassMesh);

// Pavimentação central retangular
const pathGeometry = new THREE.PlaneGeometry(10, 20);

const pathMaterial = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.6
});

const pathMesh = new THREE.Mesh(
    pathGeometry,
    pathMaterial
);

pathMesh.rotation.x = -Math.PI / 2;
pathMesh.position.y = 0.01;
pathMesh.receiveShadow = true;

scene.add(pathMesh);

// ==========================================
// 3. FONTES DE ILUMINAÇÃO
// ==========================================

// Luz ambiente
const ambientLight = new THREE.AmbientLight(
    0xffffff,
    0.4
);

scene.add(ambientLight);

// Luz direcional: simula a luz solar
const dirLight = new THREE.DirectionalLight(
    0xffffff,
    1.2
);

dirLight.position.set(15, 25, 10);
dirLight.castShadow = true;

// Configuração das sombras
dirLight.shadow.mapSize.set(2048, 2048);

dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 80;

dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;

dirLight.shadow.normalBias = 0.02;

scene.add(dirLight);

// ==========================================
// 4. NAVEGAÇÃO EM PRIMEIRA PESSOA
// ==========================================

const controls = new PointerLockControls(
    camera,
    renderer.domElement
);

// Clique na tela para ativar o controle do mouse
renderer.domElement.addEventListener('click', () => {
    if (!controls.isLocked) {
        controls.lock();
    }
});

// Estado das teclas de movimento
const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

const moveSpeed = 5.0;

// Teclas pressionadas
window.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
            moveState.forward = true;
            break;

        case 'KeyS':
        case 'ArrowDown':
            moveState.backward = true;
            break;

        case 'KeyA':
        case 'ArrowLeft':
            moveState.left = true;
            break;

        case 'KeyD':
        case 'ArrowRight':
            moveState.right = true;
            break;
    }
});

// Teclas liberadas
window.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
            moveState.forward = false;
            break;

        case 'KeyS':
        case 'ArrowDown':
            moveState.backward = false;
            break;

        case 'KeyA':
        case 'ArrowLeft':
            moveState.left = false;
            break;

        case 'KeyD':
        case 'ArrowRight':
            moveState.right = false;
            break;
    }
});

// Evita movimento contínuo ao perder o foco
window.addEventListener('blur', () => {
    moveState.forward = false;
    moveState.backward = false;
    moveState.left = false;
    moveState.right = false;
});

// ==========================================
// 5. MOVIMENTO INDEPENDENTE DA TAXA DE QUADROS
// ==========================================

// THREE.Clock calcula o tempo entre os quadros
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);

    if (controls.isLocked) {
        const distance = moveSpeed * delta;

        if (moveState.forward) {
            controls.moveForward(distance);
        }

        if (moveState.backward) {
            controls.moveForward(-distance);
        }

        if (moveState.left) {
            controls.moveRight(-distance);
        }

        if (moveState.right) {
            controls.moveRight(distance);
        }
    }

    renderer.render(scene, camera);
}

// ==========================================
// 6. AJUSTE RESPONSIVO DA JANELA
// ==========================================

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );
});

// ==========================================
// 7. INICIALIZAÇÃO
// ==========================================

animate();

// ==========================================
// 8. EXPORTS PARA INTEGRAÇÃO COM A EQUIPE
// ==========================================

export {
    scene,
    camera,
    renderer,
    controls
};

import { loadModels } from './loadModels.js';

loadModels(scene);