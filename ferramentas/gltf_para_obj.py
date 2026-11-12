"""Converte a lixeira do Poly Haven (glTF) para OBJ + MTL, que é o formato OBJ exigido pelo projeto.

Uso: python3 ferramentas/gltf_para_obj.py <arquivo.gltf> <pasta de saída>

Pega só as peças da lixeira limpa (nós 0 a 3: corpo, tampa e alças), aplica a posição e a rotação de cada
nó (o OBJ não tem hierarquia, então os vértices já saem no lugar final), centraliza na origem e escreve:
  - metal_trash_can.obj: vértices (v), coordenadas UV (vt), normais (vn) e faces (f v/vt/vn)
  - metal_trash_can.mtl: cor (map_Kd) e normal map (norm), que o MTLLoader do Three.js entende.
O mapa ARM (oclusão, rugosidade, metalicidade) não tem campo no MTL: é aplicado em src/loadModels.js.
Sem dependências: lê o .bin do glTF com struct.
"""
import json
import os
import struct
import sys

NOS = [0, 1, 2, 3]          # lixeira limpa (os nós 4 a 7 são a versão enferrujada)
CENTRO_X = 0.5              # o corpo está em x = 0.5: desloca para a origem


def ler_accessor(g, binario, idx):
    acc = g["accessors"][idx]
    view = g["bufferViews"][acc["bufferView"]]
    comps = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    fmt = {5126: "f", 5123: "H", 5125: "I"}[acc["componentType"]]
    tam = struct.calcsize(fmt)
    passo = view.get("byteStride", comps * tam)
    ini = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    return [struct.unpack_from("<" + fmt * comps, binario, ini + i * passo) for i in range(acc["count"])]


def girar(q, v):
    """Rotaciona o vetor v pelo quatérnio q = (x, y, z, w)."""
    x, y, z, w = q
    vx, vy, vz = v
    # v' = v + 2w(q×v) + 2 q×(q×v)
    cx, cy, cz = y * vz - z * vy, z * vx - x * vz, x * vy - y * vx
    cx2, cy2, cz2 = y * cz - z * cy, z * cx - x * cz, x * cy - y * cx
    return (vx + 2 * (w * cx + cx2), vy + 2 * (w * cy + cy2), vz + 2 * (w * cz + cz2))


def main(entrada, saida):
    g = json.load(open(entrada))
    pasta = os.path.dirname(entrada)
    binario = open(os.path.join(pasta, g["buffers"][0]["uri"]), "rb").read()
    os.makedirs(saida, exist_ok=True)

    linhas = ["# Lixeira de metal (Poly Haven, CC0), convertida de glTF por ferramentas/gltf_para_obj.py",
              "mtllib metal_trash_can.mtl", "usemtl metal_trash_can"]
    faces = []
    base = 0
    for n in NOS:
        no = g["nodes"][n]
        t = no.get("translation", [0, 0, 0])
        q = no.get("rotation", [0, 0, 0, 1])
        prim = g["meshes"][no["mesh"]]["primitives"][0]
        pos = ler_accessor(g, binario, prim["attributes"]["POSITION"])
        nor = ler_accessor(g, binario, prim["attributes"]["NORMAL"])
        uv = ler_accessor(g, binario, prim["attributes"]["TEXCOORD_0"])
        idx = [i[0] for i in ler_accessor(g, binario, prim["indices"])]
        for p in pos:
            x, y, z = girar(q, p)
            linhas.append(f"v {x + t[0] - CENTRO_X:.6f} {y + t[1]:.6f} {z + t[2]:.6f}")
        for u, v in uv:
            linhas.append(f"vt {u:.6f} {1 - v:.6f}")  # glTF tem a origem do UV em cima; OBJ, embaixo
        for nn in nor:
            linhas.append("vn %.6f %.6f %.6f" % girar(q, nn))
        for i in range(0, len(idx), 3):
            a, b, c = (base + k + 1 for k in idx[i:i + 3])  # OBJ conta a partir de 1
            faces.append(f"f {a}/{a}/{a} {b}/{b}/{b} {c}/{c}/{c}")
        base += len(pos)
    open(os.path.join(saida, "metal_trash_can.obj"), "w").write("\n".join(linhas + faces) + "\n")
    open(os.path.join(saida, "metal_trash_can.mtl"), "w").write(
        "# Material da lixeira: cor e normal map (rugosidade/metalicidade vêm do mapa ARM no código)\n"
        "newmtl metal_trash_can\n"
        "Kd 1.000 1.000 1.000\n"
        "map_Kd textures/metal_trash_can_diff_1k.jpg\n"
        "norm textures/metal_trash_can_nor_gl_1k.jpg\n")
    print(f"{base} vértices, {len(faces)} triângulos")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
