import * as THREE from 'three';
import GUI from 'lil-gui';

/**
 * Módulo de Modo Diagnóstico do Pipeline Gráfico (Requisito 3.3)
 * 
 * Contempla os 5 itens exigidos:
 * 1. Alternar wireframe nos objetos da cena.
 * 2. Visualizar a profundidade da cena (MeshDepthMaterial / Z-Buffer).
 * 3. Ligar e desligar o back-face culling (propriedade side dos materiais).
 * 4. Exibir o frustum de uma segunda câmera com CameraHelper (Viewport dividida e visão de cima).
 * 5. Exibir contadores de renderer.info (chamadas de desenho e triângulos) com e sem frustum culling.
 */

export class DiagnosticsManager {
    constructor(scene, mainCamera, renderer) {
        this.scene = scene;
        this.mainCamera = mainCamera;
        this.renderer = renderer;

        // Materiais especiais para diagnóstico
        this.depthMaterial = new THREE.MeshDepthMaterial();

        // Câmera secundária para exibição de frustum (aponta para o chafariz central)
        this.secondCamera = new THREE.PerspectiveCamera(50, 1.0, 0.5, 14);
        this.secondCamera.position.set(6, 3, 6);
        this.secondCamera.lookAt(0, 0.5, 0);

        this.secondCameraHelper = new THREE.CameraHelper(this.secondCamera);
        this.secondCameraHelper.name = 'secondCameraHelper';
        this.secondCameraHelper.visible = true;
        this.scene.add(this.secondCameraHelper);

        // Helper da câmera principal (para visualização a partir da visão superior / dividida)
        this.mainCameraHelper = new THREE.CameraHelper(this.mainCamera);
        this.mainCameraHelper.name = 'mainCameraHelper';
        this.mainCameraHelper.visible = false;
        this.scene.add(this.mainCameraHelper);

        // Câmera de visão aérea superior (Top-Down / Diagnóstico)
        this.overviewCamera = new THREE.PerspectiveCamera(60, 1.0, 1, 150);
        this.overviewCamera.position.set(0, 32, 0.01);
        this.overviewCamera.lookAt(0, 0, 0);

        // Parâmetros do Painel lil-gui
        this.params = {
            // 1. Wireframe
            wireframe: false,

            // 2. Profundidade (Z-Buffer)
            depthMode: false,

            // 3. Back-face culling
            backfaceCulling: true,

            // 4. Frustum e Câmeras
            frustumHelper: true,
            viewMode: 'Primeira Pessoa', // 'Primeira Pessoa' | 'Viewport Dividida' | 'Visão de Cima'
            cameraNear: this.mainCamera.near,
            cameraFar: 60, // Ajuste padrão otimizado para o parque de 50x50m

            // 5. Frustum Culling e Métricas
            frustumCulling: true,

            // Métricas em tempo real (renderer.info)
            drawCalls: 0,
            triangles: 0,
            geometries: 0,
            textures: 0,
            fps: 0,

            // Ações / Comparações
            benchmarkInfo: 'Pressione "Testar Culling" para comparar'
        };

        // Aplica o ajuste inicial de far otimizado para o cenário
        this.mainCamera.far = this.params.cameraFar;
        this.mainCamera.updateProjectionMatrix();

        // Variáveis para cálculo de FPS e atualização suave de métricas
        this.fpsFrames = 0;
        this.fpsPrevTime = performance.now();
        this.lastUiUpdateTime = 0;

        // Inicializa o painel e os listeners
        this.createGUI();
        this.createHUD();
        this.setupKeyboardShortcuts();
        this.applyStateToScene();
    }

    /**
     * Aplica o estado atual (wireframe, side, frustumCulled) a todos os meshes da cena.
     * Pode ser chamado novamente quando modelos novos forem carregados assincronamente.
     */
    applyStateToScene() {
        this.scene.traverse((obj) => {
            if (obj.isMesh && !obj.isCameraHelper) {
                // Configuração de Frustum Culling no Mesh
                obj.frustumCulled = this.params.frustumCulling;

                // Configuração de Wireframe e Back-face Culling nos Materiais
                if (obj.material) {
                    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                    materials.forEach((mat) => {
                        // Guarda o side original para poder restaurar
                        if (mat.userData.originalSide === undefined) {
                            mat.userData.originalSide = mat.side;
                        }

                        // 1. Wireframe
                        mat.wireframe = this.params.wireframe;

                        // 3. Back-face culling (FrontSide = culling ativo, DoubleSide = culling desativado)
                        mat.side = this.params.backfaceCulling 
                            ? (mat.userData.originalSide ?? THREE.FrontSide) 
                            : THREE.DoubleSide;

                        mat.needsUpdate = true;
                    });
                }
            }
        });

        // 2. Modo de Profundidade (Z-Buffer com MeshDepthMaterial)
        if (this.params.depthMode) {
            this.depthMaterial.wireframe = this.params.wireframe;
            this.scene.overrideMaterial = this.depthMaterial;
        } else {
            this.scene.overrideMaterial = null;
        }

        // 4. Frustum Helper da Câmera Secundária
        this.secondCameraHelper.visible = this.params.frustumHelper;
    }

    /**
     * Alterna o modo Wireframe (Requisito 1)
     */
    setWireframe(enabled) {
        this.params.wireframe = enabled;
        this.applyStateToScene();
        if (this.wireframeCtrl) this.wireframeCtrl.updateDisplay();
    }

    /**
     * Alterna o modo de Profundidade / Z-Buffer (Requisito 2)
     */
    setDepthMode(enabled) {
        this.params.depthMode = enabled;
        this.applyStateToScene();
        if (this.depthCtrl) this.depthCtrl.updateDisplay();
    }

    /**
     * Alterna o Back-face Culling (Requisito 3)
     */
    setBackfaceCulling(enabled) {
        this.params.backfaceCulling = enabled;
        this.applyStateToScene();
        if (this.backfaceCtrl) this.backfaceCtrl.updateDisplay();
    }

    /**
     * Alterna a visibilidade do CameraHelper (Requisito 4)
     */
    setFrustumHelper(enabled) {
        this.params.frustumHelper = enabled;
        this.secondCameraHelper.visible = enabled;
        if (this.frustumHelperCtrl) this.frustumHelperCtrl.updateDisplay();
    }

    /**
     * Alterna o Frustum Culling da GPU (Requisito 5)
     */
    setFrustumCulling(enabled) {
        this.params.frustumCulling = enabled;
        this.applyStateToScene();
        if (this.frustumCullingCtrl) this.frustumCullingCtrl.updateDisplay();
    }

    /**
     * Alterna o modo de visualização da viewport
     */
    setViewMode(mode) {
        this.params.viewMode = mode;
        if (this.viewModeCtrl) this.viewModeCtrl.updateDisplay();
        this.onResize();
    }

    /**
     * Executa um teste rápido comparando o desempenho com e sem Frustum Culling
     */
    runCullingBenchmark() {
        const originalCulling = this.params.frustumCulling;

        // Mede com culling ligado
        this.setFrustumCulling(true);
        this.renderer.render(this.scene, this.mainCamera);
        const callsWith = this.renderer.info.render.calls;
        const triWith = this.renderer.info.render.triangles;

        // Mede com culling desligado
        this.setFrustumCulling(false);
        this.renderer.render(this.scene, this.mainCamera);
        const callsWithout = this.renderer.info.render.calls;
        const triWithout = this.renderer.info.render.triangles;

        // Restaura estado anterior
        this.setFrustumCulling(originalCulling);

        const pct = triWithout > 0 ? Math.round((1 - triWith / triWithout) * 100) : 0;
        this.params.benchmarkInfo = `Com: ${callsWith}c / ${triWith.toLocaleString()}t | Sem: ${callsWithout}c / ${triWithout.toLocaleString()}t (-${pct}% tris)`;
        if (this.benchmarkCtrl) this.benchmarkCtrl.updateDisplay();
    }

    /**
     * Constrói o Painel lil-gui organizado com os 5 requisitos
     */
    createGUI() {
        this.gui = new GUI({ title: '🛠️ Modo Diagnóstico (CG)' });
        this.gui.domElement.style.position = 'fixed';
        this.gui.domElement.style.top = '10px';
        this.gui.domElement.style.right = '10px';
        this.gui.domElement.style.zIndex = '9999';

        // Evita que cliques no painel travem o cursor no PointerLock
        const stopPropagation = (e) => e.stopPropagation();
        this.gui.domElement.addEventListener('pointerdown', stopPropagation);
        this.gui.domElement.addEventListener('mousedown', stopPropagation);
        this.gui.domElement.addEventListener('click', stopPropagation);

        // ==========================================
        // PASTA 1: PIPELINE DE RENDERIZAÇÃO
        // ==========================================
        const fPipeline = this.gui.addFolder('1. Pipeline Gráfico');

        this.wireframeCtrl = fPipeline.add(this.params, 'wireframe')
            .name('1. Wireframe [1]')
            .onChange(() => this.applyStateToScene());

        this.depthCtrl = fPipeline.add(this.params, 'depthMode')
            .name('2. Z-Buffer (Profundidade) [2]')
            .onChange(() => this.applyStateToScene());

        this.backfaceCtrl = fPipeline.add(this.params, 'backfaceCulling')
            .name('3. Back-Face Culling [3]')
            .onChange(() => this.applyStateToScene());

        fPipeline.open();

        // ==========================================
        // PASTA 2: CÂMERAS E FRUSTUM
        // ==========================================
        const fCamera = this.gui.addFolder('2. Câmeras & Frustum');

        this.viewModeCtrl = fCamera.add(this.params, 'viewMode', [
            'Primeira Pessoa',
            'Viewport Dividida',
            'Visão de Cima'
        ])
            .name('Viewport [V]')
            .onChange((val) => this.setViewMode(val));

        this.frustumHelperCtrl = fCamera.add(this.params, 'frustumHelper')
            .name('4. Exibir Frustum (Helper) [4]')
            .onChange((val) => this.setFrustumHelper(val));

        fCamera.add(this.params, 'cameraNear', 0.05, 5, 0.05)
            .name('Câmera Near')
            .onChange((val) => {
                this.mainCamera.near = val;
                this.mainCamera.updateProjectionMatrix();
                this.mainCameraHelper.update();
            });

        fCamera.add(this.params, 'cameraFar', 10, 200, 5)
            .name('Câmera Far')
            .onChange((val) => {
                this.mainCamera.far = val;
                this.mainCamera.updateProjectionMatrix();
                this.mainCameraHelper.update();
            });

        fCamera.open();

        // ==========================================
        // PASTA 3: OTIMIZAÇÃO & MÉTRICAS (renderer.info)
        // ==========================================
        const fMetrics = this.gui.addFolder('3. Métricas (renderer.info)');

        this.frustumCullingCtrl = fMetrics.add(this.params, 'frustumCulling')
            .name('5. Frustum Culling [5]')
            .onChange((val) => this.setFrustumCulling(val));

        this.drawCallsCtrl = fMetrics.add(this.params, 'drawCalls')
            .name('Draw Calls')
            .disable();

        this.trianglesCtrl = fMetrics.add(this.params, 'triangles')
            .name('Triângulos')
            .disable();

        this.geometriesCtrl = fMetrics.add(this.params, 'geometries')
            .name('Geometrias (VRAM)')
            .disable();

        this.texturesCtrl = fMetrics.add(this.params, 'textures')
            .name('Texturas (VRAM)')
            .disable();

        this.fpsCtrl = fMetrics.add(this.params, 'fps')
            .name('FPS')
            .disable();

        fMetrics.add({ run: () => this.runCullingBenchmark() }, 'run')
            .name('⚡ Testar Culling');

        this.benchmarkCtrl = fMetrics.add(this.params, 'benchmarkInfo')
            .name('Comparativo')
            .disable();

        fMetrics.open();
    }

    /**
     * Atalhos de teclado convenientes (Requisito 3.3)
     */
    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Ignora se estiver digitando em campos de texto
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.code) {
                case 'Digit1':
                    this.setWireframe(!this.params.wireframe);
                    break;
                case 'Digit2':
                    this.setDepthMode(!this.params.depthMode);
                    break;
                case 'Digit3':
                    this.setBackfaceCulling(!this.params.backfaceCulling);
                    break;
                case 'Digit4':
                    this.setFrustumHelper(!this.params.frustumHelper);
                    break;
                case 'Digit5':
                    this.setFrustumCulling(!this.params.frustumCulling);
                    break;
                case 'KeyV': {
                    const modes = ['Primeira Pessoa', 'Viewport Dividida', 'Visão de Cima'];
                    const nextIndex = (modes.indexOf(this.params.viewMode) + 1) % modes.length;
                    this.setViewMode(modes[nextIndex]);
                    break;
                }
                case 'KeyH':
                    this.gui.show(this.gui._hidden);
                    break;
            }
        });
    }

    /**
     * Cria um banner discreto na tela com instruções de atalhos e controle do mouse
     */
    createHUD() {
        const hud = document.createElement('div');
        hud.id = 'diagnostics-hud';
        hud.style.position = 'fixed';
        hud.style.bottom = '12px';
        hud.style.left = '12px';
        hud.style.padding = '8px 14px';
        hud.style.background = 'rgba(0, 0, 0, 0.75)';
        hud.style.color = '#ffffff';
        hud.style.fontFamily = 'monospace';
        hud.style.fontSize = '12px';
        hud.style.borderRadius = '6px';
        hud.style.pointerEvents = 'none';
        hud.style.zIndex = '9998';
        hud.style.lineHeight = '1.5';
        hud.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';

        hud.innerHTML = `
            <div><strong>[ESC]</strong> Liberar cursor para lil-gui | <strong>Clique</strong> para navegar (WASD + Mouse)</div>
            <div style="color: #ffd700; margin-top: 2px;">
                [1] Wireframe &nbsp;|&nbsp; [2] Z-Buffer &nbsp;|&nbsp; [3] Back-Face &nbsp;|&nbsp; [4] Frustum &nbsp;|&nbsp; [5] Culling &nbsp;|&nbsp; [V] Dividir Tela &nbsp;|&nbsp; [H] Painel
            </div>
        `;

        document.body.appendChild(hud);
    }

    /**
     * Ajusta as câmeras quando a janela é redimensionada
     */
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        if (this.params.viewMode === 'Viewport Dividida') {
            const halfWidth = Math.floor(width / 2);
            this.mainCamera.aspect = halfWidth / height;
            this.overviewCamera.aspect = (width - halfWidth) / height;
        } else {
            this.mainCamera.aspect = width / height;
            this.overviewCamera.aspect = width / height;
        }

        this.mainCamera.updateProjectionMatrix();
        this.overviewCamera.updateProjectionMatrix();
        this.mainCameraHelper.update();
        this.secondCameraHelper.update();

        this.renderer.setSize(width, height);
    }

    /**
     * Loop de renderização com suporte a Viewport Dividida e coleta de métricas
     */
    render() {
        const now = performance.now();

        // 1. Atualização do CameraHelper
        if (this.secondCameraHelper.visible) {
            this.secondCameraHelper.update();
        }
        this.mainCameraHelper.update();

        const width = window.innerWidth;
        const height = window.innerHeight;

        // 2. Renderização conforme o modo de visualização
        if (this.params.viewMode === 'Primeira Pessoa') {
            this.renderer.setScissorTest(false);
            this.renderer.setViewport(0, 0, width, height);

            // Garante que o helper da câmera principal não seja visto por ela mesma
            this.mainCameraHelper.visible = false;
            this.renderer.render(this.scene, this.mainCamera);

            // Coleta métricas da visão principal
            this.collectMetrics();
        } 
        else if (this.params.viewMode === 'Visão de Cima') {
            this.renderer.setScissorTest(false);
            this.renderer.setViewport(0, 0, width, height);

            // Na visão aérea, exibe o frustum da câmera do jogador
            this.mainCameraHelper.visible = this.params.frustumHelper;
            this.renderer.render(this.scene, this.overviewCamera);

            this.collectMetrics();
        } 
        else if (this.params.viewMode === 'Viewport Dividida') {
            this.renderer.setScissorTest(true);
            const halfWidth = Math.floor(width / 2);

            // Lado Esquerdo: Primeira Pessoa (Jogador)
            this.renderer.setViewport(0, 0, halfWidth, height);
            this.renderer.setScissor(0, 0, halfWidth, height);

            this.mainCamera.aspect = halfWidth / height;
            this.mainCamera.updateProjectionMatrix();
            this.mainCameraHelper.visible = false;

            this.renderer.render(this.scene, this.mainCamera);

            // Captura as métricas exclusivas da visão do jogador em 1ª pessoa
            this.collectMetrics();

            // Lado Direito: Visão de Cima (Top-Down com Frustum observável)
            this.renderer.setViewport(halfWidth, 0, width - halfWidth, height);
            this.renderer.setScissor(halfWidth, 0, width - halfWidth, height);

            this.overviewCamera.aspect = (width - halfWidth) / height;
            this.overviewCamera.updateProjectionMatrix();

            // Exibe o frustum em tempo real do jogador visto de cima!
            this.mainCameraHelper.visible = this.params.frustumHelper;

            this.renderer.render(this.scene, this.overviewCamera);
        }

        // 3. Cálculo de FPS e atualização periódica do painel (evita gargalo de DOM)
        this.fpsFrames++;
        if (now - this.fpsPrevTime >= 1000) {
            this.params.fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsPrevTime));
            this.fpsFrames = 0;
            this.fpsPrevTime = now;
        }

        if (now - this.lastUiUpdateTime > 150) {
            this.lastUiUpdateTime = now;
            this.drawCallsCtrl.updateDisplay();
            this.trianglesCtrl.updateDisplay();
            this.geometriesCtrl.updateDisplay();
            this.texturesCtrl.updateDisplay();
            this.fpsCtrl.updateDisplay();
        }
    }

    /**
     * Coleta as métricas de desenho da GPU através do renderer.info (Requisito 5)
     */
    collectMetrics() {
        this.params.drawCalls = this.renderer.info.render.calls;
        this.params.triangles = this.renderer.info.render.triangles;
        this.params.geometries = this.renderer.info.memory.geometries;
        this.params.textures = this.renderer.info.memory.textures;
    }
}
