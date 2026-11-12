import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// ==========================================
// CARREGAMENTO DOS MODELOS 3D (três formatos)
// ==========================================
// - glTF/GLB: banco, árvore e chafariz. É o formato "nativo" da web: já traz materiais PBR, texturas e
//   hierarquia num arquivo só.
// - OBJ + MTL: lixeira. O OBJ guarda só geometria (vértices, UV, normais); o MTL descreve o material
//   (cor e normal map). O MTLLoader gera MeshPhongMaterial, que trocamos por MeshStandardMaterial para a
//   lixeira reagir à luz como o resto da cena (PBR), e somamos o mapa ARM (rugosidade e metalicidade),
//   que o MTL não tem como descrever.
// - FBX: poste de rua. Formato comum em ferramentas 3D (Blender, Maya); traz a hierarquia e referências
//   às texturas. Também convertemos para MeshStandardMaterial.
// Créditos e licenças de cada modelo: README.md.

const texLoader = new THREE.TextureLoader();

function textura(caminho, cor = false) {
    const t = texLoader.load(caminho);
    t.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
}

/** Sombras em todas as malhas do modelo (projeta e recebe). */
function configurarSombras(modelo) {
    modelo.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}

/** Escala o modelo para ter a altura indicada (em metros) e apoia a base no chão (y = 0). */
function ajustarAltura(modelo, altura) {
    const caixa = new THREE.Box3().setFromObject(modelo);
    const tamanho = caixa.getSize(new THREE.Vector3());
    modelo.scale.multiplyScalar(altura / tamanho.y);
    const caixa2 = new THREE.Box3().setFromObject(modelo);
    modelo.position.y -= caixa2.min.y;
}

/**
 * Carrega os modelos e os coloca no parque.
 * @param {THREE.Scene} scene
 * @param {object} ambiente materiais do chafariz (pedra e água), de ambiente.js
 * @param {(pos: THREE.Vector3) => void} adicionarLuzPoste cria a luz de cada poste (iluminacao.js)
 * @param {() => void} onModelLoaded chamado a cada modelo carregado (reaplica o estado do diagnóstico)
 */
export function loadModels(scene, ambiente, adicionarLuzPoste, onModelLoaded) {
    const gltfLoader = new GLTFLoader();
    const avisar = (nome) => {
        console.log(`${nome} carregado`);
        if (onModelLoaded) onModelLoaded();
    };
    const erro = (nome) => (e) => console.error(`Erro ao carregar ${nome}:`, e);

    // ==========================================
    // 1. BANCO DE PRAÇA (GLB, com textura de madeira e metal)
    // ==========================================
    gltfLoader.load('/models/bench/bench.glb', (gltf) => {
        const bench = gltf.scene;
        bench.position.set(0, 0, 8);
        bench.scale.set(1.2, 1.2, 1.2);
        configurarSombras(bench);
        scene.add(bench);

        const bench2 = bench.clone(true);
        bench2.position.set(0, 0, -8);
        bench2.rotation.y = Math.PI; // de frente para o chafariz
        scene.add(bench2);
        avisar('Banco (GLB)');
    }, undefined, erro('banco'));

    // ==========================================
    // 2. ÁRVORES (GLB, cores por vértice)
    // ==========================================
    gltfLoader.load('/models/tree/tree.glb', (gltf) => {
        const tree = gltf.scene;
        tree.scale.set(1.5, 1.5, 1.5);
        configurarSombras(tree);
        const posicoes = [[-8, -5], [8, -8], [8, 5], [-8, 4], [-3, 10], [12, -1], [-12, -10], [-13, 9], [13, 12]];
        posicoes.forEach(([x, z], i) => {
            const t = i === 0 ? tree : tree.clone(true);
            t.position.set(x, 0, z);
            t.rotation.y = i * 1.7; // variação: nem toda árvore igual
            scene.add(t);
        });
        avisar('Árvores (GLB)');
    }, undefined, erro('árvore'));

    // ==========================================
    // 3. CHAFARIZ (GLB) com pedra e água texturizadas
    // ==========================================
    gltfLoader.load('/models/fountain/fountain.glb', (gltf) => {
        const fountain = gltf.scene;
        fountain.scale.set(1.2, 1.2, 1.2);
        fountain.traverse((child) => {
            if (!child.isMesh) return;
            const nome = child.material?.name ?? '';
            // o modelo original só tem cores; usamos as coordenadas UV dele para aplicar granito e água
            if (nome.startsWith('path beige')) child.material = ambiente.pedra;
            else if (nome === 'pond blue' || nome === 'warm white') child.material = ambiente.agua;
        });
        configurarSombras(fountain);
        scene.add(fountain);
        avisar('Chafariz (GLB)');
    }, undefined, erro('chafariz'));

    // ==========================================
    // 4. LIXEIRA (OBJ + MTL)
    // ==========================================
    new MTLLoader().setPath('/models/trash_can/').load('metal_trash_can.mtl', (materiais) => {
        materiais.preload();
        new OBJLoader().setMaterials(materiais).setPath('/models/trash_can/').load('metal_trash_can.obj', (obj) => {
            const arm = textura('/models/trash_can/textures/metal_trash_can_arm_1k.jpg');
            obj.traverse((child) => {
                if (!child.isMesh) return;
                const phong = child.material;
                // ARM: R = oclusão, G = rugosidade, B = metalicidade. O Three.js lê a rugosidade do canal G
                // e a metalicidade do canal B, então a mesma imagem serve aos dois mapas.
                child.material = new THREE.MeshStandardMaterial({
                    map: phong.map,
                    normalMap: phong.normalMap,
                    roughnessMap: arm,
                    metalnessMap: arm,
                    roughness: 1,
                    metalness: 1,
                    name: 'lixeira',
                });
                phong.dispose();
            });
            configurarSombras(obj);
            ajustarAltura(obj, 0.95);
            obj.position.set(2.4, obj.position.y, 8);
            scene.add(obj);
            const obj2 = obj.clone(true);
            obj2.position.set(-2.4, obj.position.y, -8);
            obj2.rotation.y = 2.4;
            scene.add(obj2);
            avisar('Lixeira (OBJ)');
        }, undefined, erro('lixeira'));
    }, undefined, erro('material da lixeira'));

    // ==========================================
    // 5. POSTES DE LUZ (FBX)
    // ==========================================
    // O FBX do Poly Haven aponta para mapas .exr, que o FBXLoader não lê; o LoadingManager troca a extensão
    // para as versões .jpg que baixamos (as mesmas imagens, em 8 bits).
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => url.replace(/\.exr$/, '.jpg'));
    new FBXLoader(manager).load('/models/street_lamp/street_lamp_01_1k.fbx', (fbx) => {
        const dir = '/models/street_lamp/textures/street_lamp_01_';
        const material = new THREE.MeshStandardMaterial({
            map: textura(`${dir}diff_1k.jpg`, true),
            normalMap: textura(`${dir}nor_gl_1k.jpg`),
            roughnessMap: textura(`${dir}rough_1k.jpg`),
            metalnessMap: textura(`${dir}metal_1k.jpg`),
            alphaMap: textura(`${dir}opacity_1k.png`), // recorta as partes vazadas da luminária
            alphaTest: 0.5,
            roughness: 1,
            metalness: 1,
            name: 'poste',
        });
        fbx.traverse((child) => {
            if (child.isMesh) child.material = material;
        });
        configurarSombras(fbx);
        ajustarAltura(fbx, 3.9);
        const altura = fbx.position.y;
        // quatro postes nas bordas do caminho (que vai de x = -5 a 5 e de z = -10 a 10)
        [[-5.6, -6], [5.6, -6], [-5.6, 6], [5.6, 6]].forEach(([x, z], i) => {
            const poste = i === 0 ? fbx : fbx.clone(true);
            poste.position.set(x, altura, z);
            poste.rotation.y = x < 0 ? 0 : Math.PI; // braço da luminária voltado para o caminho
            scene.add(poste);
            adicionarLuzPoste(new THREE.Vector3(x, 3.15, z)); // lâmpada a ~3,2 m de altura
        });
        avisar('Postes (FBX)');
    }, undefined, erro('poste'));
}
