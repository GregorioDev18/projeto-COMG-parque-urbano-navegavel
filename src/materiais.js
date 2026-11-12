import * as THREE from 'three';

// ==========================================
// MATERIAIS E TEXTURAS (M3)
// ==========================================
// Todas as texturas são do Poly Haven (CC0), em 1K. Cada material PBR usa três mapas:
//   - cor (diff): em sRGB, porque é uma imagem feita para ser vista;
//   - normal map (nor_gl, convenção OpenGL, a mesma do Three.js): dados lineares, não é cor;
//   - rugosidade (rough): dados lineares; branco = áspero (reflexo espalhado), preto = liso (reflexo nítido).
// O "repeat" define quantas vezes a textura se repete na superfície, usando as coordenadas UV da geometria
// (PlaneGeometry já gera UV de 0 a 1; com RepeatWrapping, UV 0..1 vira 0..repeat).

const loader = new THREE.TextureLoader();
const maxAnisotropy = { valor: 1 }; // preenchido em configurarAnisotropia(renderer)

export function configurarAnisotropia(renderer) {
    // Filtragem anisotrópica: deixa o chão nítido quando visto em ângulo raso (o caso da 1ª pessoa)
    maxAnisotropy.valor = Math.min(8, renderer.capabilities.getMaxAnisotropy());
}

function carregar(caminho, { cor = false, repeat = 1 } = {}) {
    const tex = loader.load(caminho);
    tex.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = maxAnisotropy.valor;
    return tex;
}

/**
 * Material PBR a partir de uma textura do Poly Haven em public/textures/<nome>/.
 * @param {string} nome pasta e prefixo dos arquivos (ex.: 'leafy_grass')
 * @param {number} repeat repetições da textura na superfície
 * @param {object} extra parâmetros extras do MeshStandardMaterial
 */
export function materialPBR(nome, repeat, extra = {}) {
    const base = `/textures/${nome}/${nome}`;
    return new THREE.MeshStandardMaterial({
        map: carregar(`${base}_diff_1k.jpg`, { cor: true, repeat }),
        normalMap: carregar(`${base}_nor_gl_1k.jpg`, { repeat }),
        roughnessMap: carregar(`${base}_rough_1k.jpg`, { repeat }),
        roughness: 1.0, // multiplica o mapa: 1 = usa o mapa como está
        metalness: 0.0, // grama, pedra e granito são dielétricos (não metálicos)
        ...extra,
    });
}

/**
 * Normal map de água gerado no código (sem arquivo externo): soma de ondas senoidais.
 * A altura h(x, y) vira normal pela derivada: n = normalize(-dh/dx, -dh/dy, 1), guardada em RGB.
 */
export function normalMapAgua(tamanho = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = tamanho;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(tamanho, tamanho);
    const ondas = [
        [3, 2, 0.6], [5, -4, 0.35], [-7, 6, 0.2], [11, 9, 0.12],
    ]; // [frequência x, frequência y, amplitude]: frequências inteiras para a textura emendar sem costura
    for (let y = 0; y < tamanho; y++) {
        for (let x = 0; x < tamanho; x++) {
            let dx = 0, dy = 0;
            for (const [fx, fy, a] of ondas) {
                const fase = 2 * Math.PI * (fx * x + fy * y) / tamanho;
                dx += a * fx * Math.cos(fase) * 0.08;
                dy += a * fy * Math.cos(fase) * 0.08;
            }
            const len = Math.hypot(dx, dy, 1);
            const i = (y * tamanho + x) * 4;
            img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
            img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
            img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
}
