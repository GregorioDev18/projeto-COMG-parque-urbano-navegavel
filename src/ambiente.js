import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { materialPBR, normalMapAgua } from './materiais.js';

// ==========================================
// AMBIENTE: CÉU, CHÃO, CAMINHO E ÁGUA
// ==========================================

export function criarAmbiente(scene) {
    // Céu físico (espalhamento atmosférico de Preetham): a cor muda com a posição do sol, então o céu
    // combina com a luz direcional (a iluminação move o sol dos dois juntos, ver iluminacao.js).
    const sky = new Sky();
    sky.scale.setScalar(450);
    sky.material.uniforms.turbidity.value = 6;
    sky.material.uniforms.rayleigh.value = 1.5;
    scene.add(sky);

    // Neblina leve: esconde a borda do terreno de 50 m e ajuda na sensação de profundidade.
    scene.fog = new THREE.Fog(0xcfe3f2, 30, 90);

    // Grama: 50 x 50 m, textura repetida 12x (cerca de 4 m por repetição, o tamanho real da foto).
    // A foto tem muita folha seca; a "color" do material multiplica a cor da textura e puxa para o verde de
    // um gramado de parque cuidado, sem perder o detalhe (o normal map e a rugosidade continuam os mesmos).
    const grama = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), materialPBR('leafy_grass', 12, { color: 0x9ccc6e }));
    grama.rotation.x = -Math.PI / 2;
    grama.receiveShadow = true;
    grama.name = 'grama';
    scene.add(grama);

    // Caminho de pedra: 10 x 20 m. A textura repete na proporção do retângulo (3 x 6) para a pedra não
    // ficar esticada: o UV vai de 0 a 1 nos dois eixos, então o repeat corrige a proporção.
    const materialCaminho = materialPBR('cobblestone_floor_01', 1);
    for (const m of [materialCaminho.map, materialCaminho.normalMap, materialCaminho.roughnessMap]) m.repeat.set(3, 6);
    // CASO DE DIAGNÓSTICO DE PROFUNDIDADE (ver README): o caminho fica exatamente no mesmo plano da
    // grama (y = 0). Sem correção, os dois têm a mesma profundidade e o z-buffer "sorteia" qual aparece em
    // cada pixel (z-fighting: listras que piscam ao andar). A correção é o polygonOffset: empurra a
    // profundidade do caminho um pouco para perto da câmera só no teste de profundidade, sem mexer na
    // geometria. O painel de diagnóstico liga/desliga essa correção.
    materialCaminho.polygonOffset = true;
    materialCaminho.polygonOffsetFactor = -1;
    materialCaminho.polygonOffsetUnits = -4;
    const caminho = new THREE.Mesh(new THREE.PlaneGeometry(10, 20), materialCaminho);
    caminho.rotation.x = -Math.PI / 2;
    caminho.position.y = 0;
    caminho.receiveShadow = true;
    caminho.name = 'caminho';
    scene.add(caminho);

    // Materiais do chafariz (aplicados quando o modelo carrega, em loadModels.js):
    // pedra: arenito em blocos com normal map (o chafariz original era bege); água: azulada, lisa
    // (rugosidade baixa = reflexo do céu nítido) e
    // com normal map procedural que se move com o tempo, imitando a superfície ondulando.
    const pedra = materialPBR('large_sandstone_blocks_01', 1);
    const normalAgua = normalMapAgua();
    normalAgua.repeat.set(3, 3);
    const agua = new THREE.MeshStandardMaterial({
        color: 0x3f8fb0,
        roughness: 0.08,
        metalness: 0.0,
        normalMap: normalAgua,
        normalScale: new THREE.Vector2(0.6, 0.6),
        transparent: true,
        opacity: 0.85,
    });

    function atualizar(delta) {
        // velocidade em unidades de textura por segundo (independente da taxa de quadros)
        normalAgua.offset.x += 0.03 * delta;
        normalAgua.offset.y += 0.02 * delta;
    }

    return { sky, caminho, materialCaminho, pedra, agua, atualizar };
}
