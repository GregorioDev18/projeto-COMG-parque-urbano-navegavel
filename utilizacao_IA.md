# Nota de transparência de IA

## Ferramentas usadas

- **Claude Code** (Anthropic): usado por Pietro nas etapas M2, M3 e na documentação.
- **A COMPLETAR pela equipe:** ferramentas de IA usadas no M0 e no M1, se houver.

## O que foi pedido à IA

Pietro pediu ao Claude Code para completar os marcos atrasados (M2 e M3) a partir do código do M1 que já estava
no repositório. Na prática, a IA:

- organizou o código em módulos (`ambiente.js`, `iluminacao.js`, `materiais.js`) e reescreveu `loadModels.js`;
- buscou modelos e texturas CC0 no Poly Haven (pela API pública do site) e escolheu os que combinavam com o tema;
- escreveu o script `ferramentas/gltf_para_obj.py`, que converte a lixeira de glTF para OBJ + MTL;
- implementou as luzes, os presets (dia, entardecer, noite), os materiais PBR, a água com normal map procedural,
  o caso de z-fighting no painel de diagnóstico e a troca do `THREE.Clock` pelo `THREE.Timer`;
- removeu a pasta `node_modules` do repositório (não deve ser versionada) e criou o `.gitignore`;
- escreveu este README e esta nota.

## O que foi validado ou alterado manualmente

- A cena foi executada (`npm install`, `npm run dev`, `npm run build`) e verificada por capturas de tela: os
  três formatos carregam, as sombras aparecem, os presets de luz e os 5 itens do diagnóstico funcionam.
- Duas escolhas da IA foram trocadas depois de ver a cena: a textura de granito do chafariz ficou escura demais e
  foi substituída por arenito; a grama ficou marrom e recebeu uma cor verde multiplicando a textura.
- O preset da noite foi clareado depois de ver que a cena ficava escura demais para o vídeo.
- **A COMPLETAR pela equipe:** o que cada integrante revisou, testou ou mudou à mão (todos precisam conseguir
  explicar qualquer trecho na arguição).

## O que foi descartado

- `PCFSoftShadowMap`: o three r186 avisou que foi removido; trocado por `PCFShadowMap` com `shadow.radius`.
- Sombras nas luzes dos postes: descartadas por custo (6 renderizações extras por poste).
- Textura de granito no chafariz (ver acima).
- **A COMPLETAR pela equipe.**
