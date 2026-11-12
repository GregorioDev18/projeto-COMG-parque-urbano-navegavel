import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { DiagnosticsManager } from './diagnostics.js';
import { criarAmbiente } from './ambiente.js';
import { criarIluminacao } from './iluminacao.js';
import { configurarAnisotropia } from './materiais.js';
import { loadModels } from './loadModels.js';
import { criarTour } from './tour.js';

// ==========================================
// 1. SETUP BASE: CENA, CÂMERA E RENDERIZADOR
// ==========================================

const scene = new THREE.Scene();

// Câmera em primeira pessoa: FOV vertical de 75° (próximo da visão humana sem distorcer as bordas),
// olhos a 1,7 m. near = 0,1 m: perto o bastante para não cortar o banco quando se chega junto dele, e longe
// o bastante para não desperdiçar a precisão do z-buffer (que se concentra perto do near). O far fica em
// 60 m (ajustado no diagnóstico), suficiente para enxergar o parque de 50 m de ponta a ponta.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.7, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
// PCF filtra o mapa de sombra (média de várias amostras): bordas suaves em vez de serrilhadas.
// (O PCFSoftShadowMap foi removido no three r186; a suavidade agora vem do shadow.radius, em iluminacao.js.)
renderer.shadowMap.type = THREE.PCFShadowMap;
// Tone mapping ACES: as luzes são físicas (o sol passa de 1), então a cena tem mais brilho do que a tela
// mostra; o tone mapping comprime isso sem estourar o branco. A exposição é ajustada por preset.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
configurarAnisotropia(renderer);

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(renderer.domElement);

// Modo diagnóstico (lil-gui e métricas): o painel é compartilhado com iluminação e materiais
const diagnostics = new DiagnosticsManager(scene, camera, renderer);

// ==========================================
// 2. AMBIENTE, ILUMINAÇÃO E MODELOS
// ==========================================

const ambiente = criarAmbiente(scene);
const iluminacao = criarIluminacao(scene, renderer, ambiente.sky);
diagnostics.adicionarCasoProfundidade(ambiente.materialCaminho);
iluminacao.criarGUI(diagnostics.gui);
criarGUIMateriais(diagnostics.gui);

window.modelosCarregados = 0; // o gravador do vídeo espera os 5 modelos (ver tour.js)
loadModels(scene, ambiente, iluminacao.adicionarLuzPoste, () => {
    diagnostics.applyStateToScene();
    window.modelosCarregados++;
});

// ==========================================
// 3. NAVEGAÇÃO EM PRIMEIRA PESSOA
// ==========================================

const controls = new PointerLockControls(camera, renderer.domElement);

// Clique na tela para ativar o controle do mouse
renderer.domElement.addEventListener('click', () => {
    if (!controls.isLocked) controls.lock();
});

const moveState = { forward: false, backward: false, left: false, right: false, turnLeft: false, turnRight: false, run: false };

// Velocidades em unidades por segundo (1 unidade = 1 metro): andando 3 m/s, correndo 6 m/s, girando 90°/s.
const VELOCIDADE = 3.0;
const VELOCIDADE_CORRENDO = 6.0;
const GIRO = THREE.MathUtils.degToRad(90);

const teclas = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'backward', ArrowDown: 'backward',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyQ: 'turnLeft', KeyE: 'turnRight',
    ShiftLeft: 'run', ShiftRight: 'run',
};
window.addEventListener('keydown', (e) => { if (teclas[e.code]) moveState[teclas[e.code]] = true; });
window.addEventListener('keyup', (e) => { if (teclas[e.code]) moveState[teclas[e.code]] = false; });
// Evita movimento contínuo ao perder o foco
window.addEventListener('blur', () => { for (const k in moveState) moveState[k] = false; });

// ==========================================
// 4. MOVIMENTO INDEPENDENTE DA TAXA DE QUADROS
// ==========================================
// THREE.Timer: .update() uma vez por quadro, antes de ler .getDelta() (segundos desde o quadro anterior).
// Deslocamento = velocidade (m/s) x delta (s): a 30 ou a 144 quadros por segundo, 1 s de tecla apertada
// anda os mesmos 3 m. O delta é limitado a 0,1 s para uma travada (aba em segundo plano) não "teleportar".
const timer = new THREE.Timer();
timer.connect(document); // pausa o tempo quando a aba fica oculta

function animate(timestamp) {
    requestAnimationFrame(animate);
    timer.update(timestamp);
    const delta = Math.min(timer.getDelta(), 0.1);

    if (controls.isLocked) {
        const distancia = (moveState.run ? VELOCIDADE_CORRENDO : VELOCIDADE) * delta;
        if (moveState.forward) controls.moveForward(distancia);
        if (moveState.backward) controls.moveForward(-distancia);
        if (moveState.left) controls.moveRight(-distancia);
        if (moveState.right) controls.moveRight(distancia);
        // giro pelo teclado (Q/E) em radianos por segundo, em torno do eixo vertical do mundo
        const giro = ((moveState.turnLeft ? 1 : 0) - (moveState.turnRight ? 1 : 0)) * GIRO * delta;
        if (giro) camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), giro);
        camera.position.y = 1.7; // anda no plano: altura dos olhos fixa
    }

    ambiente.atualizar(delta);
    // Renderiza através do gerenciador de diagnóstico (viewport dividida e métricas)
    diagnostics.render();
}

// ==========================================
// 5. MATERIAIS NO PAINEL (para comparar o efeito dos mapas)
// ==========================================

function criarGUIMateriais(gui) {
    const params = { normalMaps: true, rugosidade: 1.0 };
    const originais = new Map(); // material -> normalMap original
    const aplicar = () => {
        scene.traverse((obj) => {
            if (!obj.isMesh || !obj.material?.isMeshStandardMaterial) return;
            const m = obj.material;
            if (!originais.has(m)) originais.set(m, { normal: m.normalMap, rugosidade: m.roughness });
            const o = originais.get(m);
            m.normalMap = params.normalMaps ? o.normal : null;
            m.roughness = Math.min(1, o.rugosidade * params.rugosidade);
            m.needsUpdate = true;
        });
    };
    const f = gui.addFolder('5. Materiais');
    f.add(params, 'normalMaps').name('Normal maps [N]').onChange(aplicar);
    f.add(params, 'rugosidade', 0, 1, 0.01).name('Multiplicador de rugosidade').onChange(aplicar);
    f.close();
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyN') {
            params.normalMaps = !params.normalMaps;
            aplicar();
            f.controllers[0].updateDisplay();
        }
    });
}

// ==========================================
// 6. AJUSTE RESPONSIVO DA JANELA
// ==========================================

window.addEventListener('resize', () => diagnostics.onResize());

// ==========================================
// 7. PARÂMETROS DE URL (usados para gerar as imagens do README)
// ==========================================
// Ex.: ?preset=Noite  ?zfight=0&pos=0,1.7,-3&olhar=0,0,-12  ?depth=1  ?view=dividida&frustum=1  ?wire=1
const q = new URLSearchParams(location.search);
const vetor = (s) => new THREE.Vector3(...s.split(',').map(Number));
if (q.has('pos')) camera.position.copy(vetor(q.get('pos')));
if (q.has('olhar')) camera.lookAt(vetor(q.get('olhar')));
if (q.has('preset')) iluminacao.usarPreset(q.get('preset'));
if (q.get('zfight') === '0') diagnostics.setCorrecaoZFighting(false);
if (q.get('depth') === '1') diagnostics.setDepthMode(true);
if (q.get('wire') === '1') diagnostics.setWireframe(true);
if (q.get('frustum') === '1') diagnostics.setFrustumHelper(true);
if (q.get('view') === 'dividida') diagnostics.setViewMode('Viewport Dividida');
if (q.get('view') === 'cima') diagnostics.setViewMode('Visão de Cima');
if (q.get('painel') === '0') diagnostics.gui.hide();

// ==========================================
// 8. INICIALIZAÇÃO
// ==========================================

if (q.get('tour') === '1') {
    // Tour do vídeo: quem desenha os quadros é o gravador, chamando window.tour.irPara(t)
    window.tour = criarTour({ camera, iluminacao, diagnostics, ambiente, gui: diagnostics.gui });
} else {
    requestAnimationFrame(animate);
}

export { scene, camera, renderer, controls, diagnostics };
