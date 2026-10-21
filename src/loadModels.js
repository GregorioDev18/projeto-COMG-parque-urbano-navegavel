
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Carrega os três modelos 3D do parque.
export function loadModels(scene, onModelLoaded) {
    const loader = new GLTFLoader();

    function configurarModelo(modelo) {
        modelo.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // Mantém os materiais e as texturas originais.
                if (child.material) {
                    child.material.needsUpdate = true;
                }
            }
        });
    }

    // ==========================================
    // 1. BANCO DE PRAÇA
    // ==========================================

    loader.load(
        '/models/bench/bench.glb',
        (gltf) => {
            const bench = gltf.scene;

            bench.position.set(0, 0, 8);
            bench.scale.set(1.2, 1.2, 1.2);

            configurarModelo(bench);
            scene.add(bench);

            const bench2 = bench.clone(true);

            bench2.position.set(0, 0, -8);
            bench2.scale.set(1.2, 1.2, 1.2);

            scene.add(bench2);

            console.log('Bancos carregados!');
            if (onModelLoaded) onModelLoaded();
        },
        undefined,
        (error) => console.error('Erro ao carregar banco:', error)
    );

    // ==========================================
    // 2. ÁRVORE
    // ==========================================

    loader.load(
        '/models/tree/tree.glb',
        (gltf) => {
            const tree = gltf.scene;

            tree.position.set(-8, 0, -5);
            tree.scale.set(1.5, 1.5, 1.5);

            configurarModelo(tree);
            scene.add(tree);

            // Segunda árvore
            const tree2 = tree.clone(true);

            tree2.position.set(8, 0, -8);
            tree2.scale.set(1.5, 1.5, 1.5);

            scene.add(tree2);

            const tree3 = tree.clone(true);

            tree3.position.set(8, 0, 5);
            tree3.scale.set(1.5, 1.5, 1.5);

            scene.add(tree3);

            const tree4 = tree.clone(true);

            tree4.position.set(-8, 0, 4);
            tree4.scale.set(1.5, 1.5, 1.5);

            scene.add(tree4);

            const tree5 = tree.clone(true);

            tree5.position.set(-3, 0, 10);
            tree5.scale.set(1.5, 1.5, 1.5);

            scene.add(tree5);


            console.log('Árvores carregadas!');
            if (onModelLoaded) onModelLoaded();
        },
        undefined,
        (error) => console.error('Erro ao carregar árvore:', error)
    );

    // ==========================================
    // 3. CHAFARIZ
    // ==========================================

    loader.load(
        '/models/fountain/fountain.glb',
        (gltf) => {
            const fountain = gltf.scene;

            fountain.position.set(0, 0, 0);
            fountain.scale.set(1.2, 1.2, 1.2);

            configurarModelo(fountain);
            scene.add(fountain);

            console.log('Chafariz carregado!');
            if (onModelLoaded) onModelLoaded();
        },
        undefined,
        (error) => console.error('Erro ao carregar chafariz:', error)
    );
}
