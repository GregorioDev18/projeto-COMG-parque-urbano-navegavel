import * as THREE from 'three';

// ==========================================
// ILUMINAÇÃO (M2)
// ==========================================
// Três tipos de luz, cada um com um papel:
//
// 1. DirectionalLight (sol): raios paralelos, como os do sol, que está tão longe que todos os raios
//    chegam na mesma direção. É a única que projeta sombra: a sombra direcional usa UM mapa de sombra
//    (câmera ortográfica), o mais barato. O frustum dessa câmera foi ajustado ao parque (±26 m) em vez de
//    ficar enorme: com 2048 x 2048 pixels sobre 52 m, cada texel cobre ~2,5 cm, o que deixa a sombra do
//    banco e do poste nítida. bias/normalBias evitam o "shadow acne" (listras da superfície sombreando a
//    si mesma por falta de precisão).
//
// 2. HemisphereLight (céu + chão): no lugar da AmbientLight (cor única, deixa tudo chapado). Ela ilumina
//    de cima com a cor do céu e de baixo com a cor da grama, imitando a luz que o céu e o chão rebatem
//    nas laterais dos objetos. É uma aproximação barata de iluminação global.
//
// 3. PointLight (lâmpadas dos postes): luz que sai de um ponto em todas as direções e enfraquece com a
//    distância (decay = 2, o decaimento físico do inverso do quadrado). Cor quente (~2700 K, lâmpada de
//    sódio/LED quente). NÃO projetam sombra de propósito: a sombra de uma PointLight precisa de 6 mapas
//    (um cubo), ou seja, 6 renderizações a mais por poste. Com 4 postes seriam 24 por quadro.
//
// Os presets (Dia, Entardecer, Noite) mudam juntos o sol, o céu, a luz hemisférica, a neblina e os postes.

const PRESETS = {
    Dia: { elevacao: 50, azimute: 135, sol: 3.0, corSol: 0xfff4e5, hemi: 0.9, ceu: 0xbfd9ff, chao: 0x4b6b32, postes: 0, neblina: 0xcfe3f2, exposicao: 0.6 },
    Entardecer: { elevacao: 6, azimute: 250, sol: 2.0, corSol: 0xffa25e, hemi: 0.45, ceu: 0xf3b98a, chao: 0x3d4a2a, postes: 6, neblina: 0xd9a77f, exposicao: 0.55 },
    Noite: { elevacao: -4, azimute: 250, sol: 0.15, corSol: 0x9fb4ff, hemi: 0.35, ceu: 0x3a4f8a, chao: 0x141c10, postes: 25, neblina: 0x10182c, exposicao: 1.2 },
};

export function criarIluminacao(scene, renderer, sky) {
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4b6b32, 0.9);
    scene.add(hemi);

    const sol = new THREE.DirectionalLight(0xfff4e5, 3.0);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.camera.near = 1;
    sol.shadow.camera.far = 120;
    sol.shadow.camera.left = -26;
    sol.shadow.camera.right = 26;
    sol.shadow.camera.top = 26;
    sol.shadow.camera.bottom = -26;
    sol.shadow.bias = -0.0005;
    sol.shadow.normalBias = 0.02;
    sol.shadow.radius = 3; // raio do filtro PCF: penumbra um pouco mais larga, como a do sol de verdade
    scene.add(sol);
    scene.add(sol.target); // o sol mira o centro do parque (0, 0, 0)

    const ajudanteSombra = new THREE.CameraHelper(sol.shadow.camera);
    ajudanteSombra.visible = false;
    scene.add(ajudanteSombra);

    const postes = []; // PointLights criadas quando os postes carregam

    const params = { preset: 'Dia', ...PRESETS.Dia, sombras: true, verSombraCamera: false };

    function posicionarSol() {
        // posição do sol a partir de elevação/azimute (coordenadas esféricas), a 60 m do centro
        const dir = new THREE.Vector3().setFromSphericalCoords(
            1,
            THREE.MathUtils.degToRad(90 - params.elevacao),
            THREE.MathUtils.degToRad(params.azimute),
        );
        sol.position.copy(dir).multiplyScalar(60);
        sky.material.uniforms.sunPosition.value.copy(dir);
        sol.shadow.camera.updateProjectionMatrix();
        ajudanteSombra.update();
    }

    function aplicar() {
        posicionarSol();
        sol.intensity = params.sol;
        sol.color.set(params.corSol);
        sol.castShadow = params.sombras && params.elevacao > 0; // sol abaixo do horizonte não faz sombra
        hemi.intensity = params.hemi;
        hemi.color.set(params.ceu);
        hemi.groundColor.set(params.chao);
        for (const p of postes) p.intensity = params.postes;
        if (scene.fog) scene.fog.color.set(params.neblina);
        renderer.toneMappingExposure = params.exposicao;
        ajudanteSombra.visible = params.verSombraCamera;
    }

    function usarPreset(nome) {
        Object.assign(params, PRESETS[nome], { preset: nome });
        aplicar();
        guiCtrls.forEach((c) => c.updateDisplay());
    }

    /** Cria a PointLight de um poste; pos é a posição da lâmpada no mundo. */
    function adicionarLuzPoste(pos) {
        const luz = new THREE.PointLight(0xffb46b, params.postes, 14, 2);
        luz.position.copy(pos);
        luz.castShadow = false; // ver comentário no topo: 6 renderizações extras por poste
        scene.add(luz);
        postes.push(luz);
    }

    const guiCtrls = [];
    function criarGUI(gui) {
        const f = gui.addFolder('4. Iluminação');
        guiCtrls.push(
            f.add(params, 'preset', Object.keys(PRESETS)).name('Momento do dia [L]').onChange(usarPreset),
            f.add(params, 'elevacao', -10, 90, 1).name('Sol: elevação (°)').onChange(aplicar),
            f.add(params, 'azimute', 0, 360, 1).name('Sol: azimute (°)').onChange(aplicar),
            f.add(params, 'sol', 0, 6, 0.05).name('Sol: intensidade').onChange(aplicar),
            f.addColor(params, 'corSol').name('Sol: cor').onChange(aplicar),
            f.add(params, 'hemi', 0, 2, 0.01).name('Hemisférica: intensidade').onChange(aplicar),
            f.addColor(params, 'ceu').name('Hemisférica: céu').onChange(aplicar),
            f.addColor(params, 'chao').name('Hemisférica: chão').onChange(aplicar),
            f.add(params, 'postes', 0, 40, 0.5).name('Postes: intensidade').onChange(aplicar),
            f.add(params, 'sombras').name('Sombras do sol').onChange(aplicar),
            f.add(params, 'verSombraCamera').name('Ver câmera de sombra').onChange(aplicar),
            f.add(params, 'exposicao', 0.1, 2, 0.01).name('Exposição (tone mapping)').onChange(aplicar),
        );
        f.close();
    }

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyL') {
            const nomes = Object.keys(PRESETS);
            usarPreset(nomes[(nomes.indexOf(params.preset) + 1) % nomes.length]);
        }
    });

    aplicar();
    return { sol, hemi, postes, adicionarLuzPoste, criarGUI, aplicar, usarPreset };
}
