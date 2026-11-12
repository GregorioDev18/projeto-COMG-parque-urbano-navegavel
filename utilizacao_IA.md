# Nota de transparência de IA

## Ferramentas usadas

- **Gemini** (Google): principalmente no planejamento, antes de programar: discutir a arquitetura da cena
  (módulos, grafo de cena, como organizar o modo diagnóstico) e as opções de luz e material.
- **Claude** (Anthropic): como assistente de programação nas etapas de iluminação, texturas, integração e
  documentação.

A cena base, a navegação em primeira pessoa e o painel do modo diagnóstico (M1) foram programados pela equipe.

## O que foi pedido à IA

- Organizar o código em módulos (`ambiente.js`, `iluminacao.js`, `materiais.js`, `loadModels.js`, `tour.js`).
- Sugerir modelos e texturas com licença livre (CC0) no Poly Haven que combinassem com o tema do parque.
- Escrever o script que converte a lixeira de glTF para OBJ + MTL (`ferramentas/gltf_para_obj.py`).
- Implementar as luzes e os presets (dia, entardecer, noite), os materiais PBR, a água com normal map procedural,
  o caso de z-fighting no modo diagnóstico e o laço de animação com `THREE.Timer`.
- Escrever o tour automático e o gravador usados para gerar o vídeo, e revisar o README.

## O que foi validado ou alterado

- O projeto foi executado (`npm install`, `npm run dev`, `npm run build`) e conferido em tela: os três formatos de
  modelo carregam, as sombras aparecem e os presets de luz e os itens do diagnóstico funcionam.
- Escolhas da IA trocadas depois de ver o resultado: a textura de granito do chafariz ficou escura demais e foi
  substituída por arenito; a grama ficou marrom e recebeu uma cor verde multiplicando a textura; o preset da noite
  foi clareado; o enquadramento do poste no vídeo foi refeito; o trecho de profundidade do vídeo passou a comparar
  near 0,1 m e 2 m para o gradiente aparecer.
- Os parâmetros de luz, sombra e câmera foram conferidos e estão justificados no README e nos comentários do
  código, que todos os integrantes revisaram juntos para a arguição.

## O que foi descartado

- `PCFSoftShadowMap`, removido no three r186: trocado por `PCFShadowMap` com `shadow.radius`.
- Sombras nas luzes dos postes: descartadas por custo (6 renderizações extras por poste).
- A textura de granito no chafariz.
