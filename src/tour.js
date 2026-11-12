import * as THREE from 'three';

// ==========================================
// TOUR AUTOMÁTICO (?tour=1) — usado para gravar o vídeo de apresentação
// ==========================================
// Um roteiro de ~80 s: cada trecho define a câmera (de onde para onde, olhando para onde), o momento do dia,
// o diagnóstico ligado e a legenda. irPara(t) monta a cena do instante t e desenha um quadro; o vídeo é
// gravado chamando irPara(0), irPara(1/24), irPara(2/24)... e capturando cada quadro
// (ver ferramentas/gravar_video.py). Assim o vídeo sai igual em qualquer máquina, sem depender da taxa de
// quadros do computador que grava.

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// [início, fim, câmera de, câmera até, olhar de, olhar até, legenda]
const TRECHOS = [
    [0, 8, v(0, 7, 27), v(0, 1.7, 16), v(0, 1, 0), v(0, 1, 0),
        'Parque Urbano Navegável<br><small>Three.js + Vite · Computação Gráfica · IFSP São João da Boa Vista</small>'],
    [8, 18, v(0, 1.7, 16), v(1.5, 1.7, 9.5), v(0, 1, 0), v(0, 1, 0),
        'Navegação em 1ª pessoa<br><small>3 m/s com THREE.Timer: a mesma distância em qualquer taxa de quadros</small>'],
    [18, 28, v(3.4, 1.3, 4.6), v(2.6, 1.1, 3.6), v(0, 0.6, 0), v(0, 0.5, 0),
        'Texturas PBR: cor + normal map + rugosidade<br><small>chafariz em arenito, água com normal map animado</small>'],
    [28, 34, v(4.2, 1.4, 11), v(3.6, 1.2, 10.2), v(2.4, 0.5, 8), v(1.5, 0.5, 8),
        'Três formatos de modelo<br><small>lixeira em OBJ + MTL · banco em GLB</small>'],
    [34, 40, v(3.6, 1.6, -10), v(4.2, 1.8, -9.2), v(5.6, 2.2, -6), v(5.6, 2.6, -6), // sol atrás, à direita
        'Poste de rua em FBX<br><small>cor, normal, rugosidade, metalicidade e alphaMap</small>'],
    [40, 55, v(-9, 1.8, 13), v(-6, 1.8, 11), v(0, 1.2, 0), v(0, 1.2, 0), null], // legenda vem da luz
    [55, 72, v(0, 1.7, 13), v(0, 1.7, 12), v(0, 1, 0), v(0, 1, 0), null], // legenda vem do diagnóstico
    [72, 80, v(0, 1.7, 12), v(0, 9, 24), v(0, 1, 0), v(0, 0, 0),
        'Obrigado!<br><small>créditos e decisões técnicas no README do repositório</small>'],
];

const suave = (k) => k * k * (3 - 2 * k); // smoothstep: começa e termina devagar

export function criarTour({ camera, iluminacao, diagnostics, ambiente, gui }) {
    gui.hide();
    document.getElementById('diagnostics-hud')?.remove();
    const legenda = document.createElement('div');
    legenda.style.cssText = 'position:fixed;left:50%;bottom:6%;transform:translateX(-50%);padding:14px 26px;'
        + 'background:rgba(10,12,20,.72);color:#fff;font:600 30px/1.3 system-ui,sans-serif;text-align:center;'
        + 'border-radius:10px;max-width:80%;';
    document.body.appendChild(legenda);

    const estado = { modo: '' };
    function diagnostico(modo) {
        if (modo === estado.modo) return;
        estado.modo = modo;
        diagnostics.setWireframe(modo === 'wire');
        diagnostics.setDepthMode(modo === 'depth');
        diagnostics.setFrustumHelper(modo === 'dividida');
        diagnostics.setViewMode(modo === 'dividida' ? 'Viewport Dividida' : 'Primeira Pessoa');
        diagnostics.setCorrecaoZFighting(modo !== 'zfight');
    }

    let ultimo = 0;
    function irPara(t) {
        const trecho = TRECHOS.find(([a, b]) => t >= a && t < b) ?? TRECHOS[TRECHOS.length - 1];
        const [a, b, de, ate, olhaDe, olhaAte, texto] = trecho;
        const k = suave(Math.min(1, (t - a) / (b - a)));
        camera.position.lerpVectors(de, ate, k);
        camera.lookAt(new THREE.Vector3().lerpVectors(olhaDe, olhaAte, k));
        let txt = texto;

        // Luz: dia o tempo todo, menos no trecho 40–55 s (dia → entardecer → noite) e na volta ao dia no fim
        if (t >= 40 && t < 47) iluminacao.misturar('Dia', 'Entardecer', suave((t - 40) / 7));
        else if (t >= 47 && t < 55) iluminacao.misturar('Entardecer', 'Noite', suave(Math.min(1, (t - 47) / 5)));
        else iluminacao.misturar('Dia', 'Dia', 0);
        if (t >= 40 && t < 55) {
            txt = t < 47
                ? 'Iluminação: sol (com sombra) + hemisférica<br><small>o céu acompanha a posição do sol</small>'
                : 'Noite: PointLights quentes nos postes<br><small>sem sombra de propósito: 6 renderizações a mais por poste</small>';
        }

        // Normal maps: desligados no meio do trecho das texturas, para comparar
        const semNormal = t >= 22 && t < 25;
        if (semNormal !== estado.semNormal) {
            estado.semNormal = semNormal;
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }));
        }
        if (t >= 18 && t < 28) txt += semNormal ? '<br><small>(normal maps DESLIGADOS)</small>' : '';

        // Diagnóstico do pipeline: 55–72 s
        if (t >= 55 && t < 59) { diagnostico('wire'); txt = 'Modo diagnóstico: wireframe [1]'; }
        else if (t >= 59 && t < 63) {
            diagnostico('depth');
            // near 0,1 m: quase tudo escuro (precisão concentrada perto da câmera); near 2 m: gradiente visível
            camera.near = t < 61 ? 0.1 : 2;
            camera.updateProjectionMatrix();
            txt = t < 61
                ? 'Profundidade (MeshDepthMaterial) [2]<br><small>near = 0,1 m: o z-buffer não é linear, a precisão fica perto do near</small>'
                : 'Profundidade (MeshDepthMaterial) [2]<br><small>near = 2 m: a precisão se espalha e o gradiente aparece</small>';
        }
        else if (t >= 63 && t < 68) { diagnostico('dividida'); txt = 'Viewport dividida + frustum (CameraHelper) [4] [V]'; }
        else if (t >= 68 && t < 72) {
            const corrigido = t >= 70;
            diagnostico(corrigido ? 'zcorrigido' : 'zfight');
            camera.position.set(1, 1.7, -12);
            camera.lookAt(3, 0, -3);
            txt = corrigido
                ? 'Caso de profundidade: com polygonOffset [Z]<br><small>o caminho vence o teste de profundidade</small>'
                : 'Caso de profundidade: z-fighting [Z]<br><small>caminho e grama no mesmo plano: o caminho some</small>';
        } else diagnostico('');
        if (!(t >= 59 && t < 63) && camera.near !== 0.1) {
            camera.near = 0.1;
            camera.updateProjectionMatrix();
        }

        legenda.innerHTML = txt;
        ambiente.atualizar(Math.max(0, t - ultimo));
        ultimo = t;
        diagnostics.render();
    }

    return { irPara, duracao: TRECHOS[TRECHOS.length - 1][1] };
}
