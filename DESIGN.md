---
name: Portfólio Metrô
description: Rede de projetos de Lucas Marques desenhada como um mapa de metrô gerado a partir do GitHub.
colors:
  map-ink: "#14213d"
  map-ink-soft: "#47557a"
  map-ground: "#fbfcfe"
  map-ground-raised: "#ffffff"
  map-ground-sunk: "#edf1f7"
  map-rule: "#d3dbe7"
  river: "#d5e8f5"
  signal-red: "#d1262c"
  board-black: "#101317"
  board-tile: "#20252d"
  board-ink: "#f6f3ea"
  board-key: "#aab2bf"
  board-amber: "#ffcf4a"
  night-ground: "#0b1120"
  night-ground-raised: "#111a2d"
  night-ink: "#e8edf7"
  night-plate: "#172a52"
  night-river: "#10233b"
  line-javascript: "#1d5fbf"
  line-python: "#00804f"
  line-typescript: "#8b3fb0"
  line-lua: "#f2b700"
typography:
  sign-title:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "31px"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.005em"
  plate-name:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "25px"
    fontWeight: 800
    lineHeight: 1
  station-label:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  label-caps:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.14em"
  board-flap:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    fontFeature: "tnum"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  tag: "3px"
  chip: "6px"
  control: "8px"
  card: "12px"
  sheet: "18px"
spacing:
  map-unit: "34px"
  overlay-inset: "16px"
  panel-gutter: "22px"
components:
  button-board:
    backgroundColor: "{colors.line-javascript}"
    textColor: "{colors.map-ground-raised}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 18px"
  button-code:
    backgroundColor: "{colors.map-ground-raised}"
    textColor: "{colors.map-ink}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 18px"
  button-code-hover:
    backgroundColor: "{colors.map-ink}"
    textColor: "{colors.map-ground}"
  plate:
    backgroundColor: "{colors.map-ink}"
    textColor: "{colors.map-ground-raised}"
    rounded: "{rounded.control}"
    padding: "10px 24px 15px 13px"
  station-sign:
    backgroundColor: "{colors.map-ink}"
    textColor: "{colors.map-ground-raised}"
    padding: "26px 64px 20px 22px"
  flap-tile:
    backgroundColor: "{colors.board-tile}"
    textColor: "{colors.board-ink}"
    typography: "{typography.board-flap}"
    rounded: "{rounded.tag}"
    width: "17px"
    height: "26px"
  legend:
    backgroundColor: "{colors.map-ground-raised}"
    textColor: "{colors.map-ink}"
    rounded: "{rounded.card}"
    width: "270px"
  tag-signal:
    backgroundColor: "{colors.signal-red}"
    textColor: "{colors.map-ground-raised}"
    rounded: "{rounded.tag}"
    height: "17px"
  tooltip:
    backgroundColor: "{colors.map-ink}"
    textColor: "{colors.map-ground-raised}"
    typography: "{typography.station-label}"
    rounded: "7px"
---

# Design System: Portfólio Metrô

## Overview

**Creative North Star: "A Planta da Rede"**

O site é um diagrama de metrô de verdade, não uma vitrine enfeitada com trilhos. Tudo que o
visitante vê nasce dos dados do GitHub: cada linguagem é uma linha colorida, cada projeto uma
estação, e o traçado octilinear (horizontal, vertical e 45°) é gerado por algoritmo. O desenho
fica a serviço da leitura: chão branco frio, tinta azul-marinho, cor só onde ela significa uma
linha, e a sinalização condensada dos mapas impressos.

A peça de interface é a sinalização do sistema: a placa esmaltada com o nome no cabeçalho, a
placa da estação no topo do painel e o painel de partidas de palhetas pretas. O movimento tem
um papel: o trem circula, vai até a estação escolhida trocando de cor nas baldeações, e o painel
"vira" as palhetas quando abre. No modo noturno o mesmo mapa passa para um chão azul-noite com
as estações como anéis acesos.

**Key Characteristics:**
- Mapa ocupa a tela inteira; a interface flutua por cima nos cantos.
- Cor é informação: cada cor de linha pertence a uma linguagem.
- Sinalização em Roboto Condensed; só os parágrafos usam Inter.
- Superfícies chapadas, contorno de 1,5 px em tinta; sombra só no que flutua sobre o mapa.
- Vermelho reservado para os dois avisos do sistema.

## Colors

Chão frio e quase branco, tinta azul-marinho e uma paleta de linhas saturadas que vem dos dados.

### Primary
- **Cores das linhas** (JavaScript `line-javascript`, Python `line-python`, TypeScript `line-typescript`, Lua `line-lua` e as demais do `config.js`): pintam o trilho, o número da linha, o anel da estação de uma linha só, a faixa da placa e o botão EMBARCAR da estação. O texto sobre elas é branco ou azul-marinho, o que tiver mais contraste.

### Secondary
- **Vermelho de Aviso** (`signal-red`): só nos selos "Você está aqui" e "Nova estação".

### Neutral
- **Tinta do Mapa** (`map-ink`): nomes das estações, contornos de baldeação, placas, tooltip e bordas dos elementos flutuantes.
- **Tinta Suave** (`map-ink-soft`): textos de apoio e rótulos de seção.
- **Chão do Mapa** (`map-ground`) e **Chão Elevado** (`map-ground-raised`): o fundo do mapa e das superfícies flutuantes.
- **Chão Rebaixado** (`map-ground-sunk`): hover de itens de lista e botões discretos.
- **Filete** (`map-rule`): divisórias finas.
- **Rio** (`river`): a faixa de rio que atravessa o mapa por trás das linhas.
- **Painel de Partidas** (`board-black`, `board-tile`, `board-ink`, `board-key`, `board-amber`): o quadro preto de palhetas; o âmbar marca título e destaques do quadro.
- **Noite** (`night-ground`, `night-ground-raised`, `night-ink`, `night-plate`, `night-river`): os mesmos papéis no modo noturno.

### Named Rules
**The Line Owns Its Color Rule.** A cor de uma linha só aparece em coisas daquela linha: trilho, número, anel, faixa e o EMBARCAR da estação. Nada decorativo usa cor de linha.

**The Signal Rule.** Vermelho existe para dois avisos ("Você está aqui" e "Nova estação"). Um terceiro uso dilui os dois.

**The Night Brightening Rule.** No modo noturno os trilhos misturam 22% de branco na cor da linha (`color-mix(in oklab, cor 78%, white)`) e as estações viram anéis sobre o chão escuro.

## Typography

**Display Font:** Roboto Condensed (com Arial Narrow)
**Body Font:** Inter (com system-ui)

**Character:** a Roboto Condensed é a voz da sinalização: estreita, firme, cabe muito nome num mapa. A Inter fica só onde se lê corrido.

### Hierarchy
- **Sign Title** (800, 31px, 1.04): nome da estação na placa do painel (27px no celular).
- **Plate Name** (800, 25px, 1): o nome na placa do cabeçalho (19px no celular).
- **Station Label** (700, 15px): nomes no mapa, com contorno da cor do chão para ler sobre trilhos e rio.
- **Label Caps** (700, 11–13px, 0.1–0.15em, maiúsculas): rótulos de seção, chaves do painel de partidas, botões e contagens.
- **Board Flap** (700, 16px, números tabulares): uma letra por palheta no painel de partidas.
- **Body** (400, 15px, 1.6, até 62ch): descrições do projeto e da Estação Central.

### Named Rules
**The Signage Rule.** Tudo que se lê de relance (nomes, rótulos, botões, painel) é Roboto Condensed. Inter só em parágrafo.

**The Eleven Pixel Floor.** Nenhum texto funcional abaixo de 11px.

## Layout

O mapa é a página: ocupa a tela toda abaixo do cabeçalho (72px no computador) e, no celular, a
tela inteira, com a placa flutuando no topo. Legenda no canto inferior esquerdo (270px), controles
de zoom no inferior direito, ambos a 16px das bordas (10px no celular). O painel da estação entra
pela direita com 420px; no celular vira gaveta de baixo para cima com até 72% da altura.

A geometria do mapa usa uma grade de 34px (`map-unit`): estações a 4 quadradinhos na reta (3 na
diagonal), curvas com raio de 0,75 quadradinho. Com a tela em pé, o layout é gerado na vertical.
O enquadramento ("centralizar") desconta legenda e painel, e não aproxima além de 1,5×.

Dentro do painel o respiro é de 22px nas laterais (18px no celular), com blocos separados por
20–26px.

## Elevation & Depth

Sistema chapado. Profundidade vem de sobreposição: a linha de cima abre um vão da cor do chão na
de baixo (como ponte), e as linhas passam por cima do rio. Superfícies sobre o mapa (legenda,
controles) usam contorno de 1,5px em tinta, não sombra.

### Shadow Vocabulary
- **Flutuante** (`box-shadow: 0 14px 34px -16px rgb(0 0 0 / 0.32), 0 2px 6px -2px rgb(0 0 0 / 0.12)`): tooltip, dica de primeira visita, placa e botões flutuantes no celular, gaveta do painel.
- **Trem** (`filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.28))`): o vagão, para descolar do trilho.

### Named Rules
**The Border-Or-Shadow Rule.** Cada superfície declara elevação uma vez: contorno (legenda, controles, painel no computador) ou sombra (o que flutua sem contorno). Nunca os dois.

## Shapes

Círculos para estações (10px de raio, 13px na baldeação, 20px na Central) e para os números de
linha; cápsula para o trem. Cantos levemente arredondados na interface: 3px nos selos e palhetas,
6px nos chips, 8px em botões e placas, 12px em legenda e controles, 18px no topo da gaveta.
Trilhos com pontas e junções arredondadas; "em obras" é tracejado (7/6) na cor da linha.

## Components

### Placa (cabeçalho)
Placa esmaltada azul-marinho com filete branco por dentro (1,5px, a 4px da borda), pictograma
de linha com estação, o nome em Plate Name, o subtítulo em Label Caps embaixo e uma faixa com as
cores das linhas na base.

### Placa da estação (topo do painel)
Fundo azul-marinho com faixas no topo, uma por linha da estação; título em Sign Title, linhas
como número + nome em maiúsculas, "Baldeação" em contorno branco e o selo "Nova estação" quando
for o caso. O botão fechar é um quadrado contornado em branco.

### Painel de partidas
Quadro preto de cantos 10px com linhas chave/valor. A chave em Label Caps cinza; o valor em
palhetas (17×26px, duas metades e uma dobra escura no meio) que giram letras aleatórias até parar
no valor certo ao abrir. Na Estação Central vira a lista "Próximas partidas", com título em âmbar.

### Buttons
- **Shape:** cantos de 8px, altura 48px, Label Caps 15px com 0.1em.
- **EMBARCAR:** fundo na cor da linha principal da estação, seta à direita; escurece 14% no hover.
- **VER CÓDIGO:** contorno de 1,5px em tinta; no hover vira chapado em tinta com texto claro.
- **Estação anterior / próxima:** sem contorno, nome da estação primeiro e o rótulo pequeno embaixo; fundo rebaixado no hover.

### Chips
Tecnologias: contorno de 1,5px no filete, cantos de 6px, Roboto Condensed 14px.

### Legenda
Cartão branco com contorno em tinta e cantos de 12px; cabeçalho que recolhe; cada linha é um botão
(número, amostra do trilho, linguagem e "Linha Azul · 2 estações") que destaca a linha no mapa.

### Controles do mapa
Coluna de três quadrados de 44px (aproximar, afastar, centralizar) num contorno único de 12px.

### Navigation
Ferramentas do cabeçalho: botões de 40px com contorno no filete, ícone e rótulo em Label Caps; no
celular viram só ícone, com sombra Flutuante.

## Do's and Don'ts

### Do:
- **Do** deixar o mapa sair dos dados: posição, traçado e cores vêm do layout gerado, nunca de ajuste manual.
- **Do** usar a cor da linha só em coisas daquela linha (The Line Owns Its Color Rule).
- **Do** manter os nomes do mapa com o contorno da cor do chão (4px) para ler sobre trilhos e rio.
- **Do** usar ícones em SVG com traço de 1.75 e pontas arredondadas, como os de `js/icons.js`.
- **Do** respeitar "reduzir movimento": trem parado, sem palhetas girando, sem animação de entrada.

### Don't:
- **Don't** pôr rótulo pequeno acima de um título (eyebrow); o rótulo vem depois do nome.
- **Don't** usar vermelho fora dos dois avisos (The Signal Rule).
- **Don't** usar contorno e sombra na mesma superfície.
- **Don't** usar emoji ou caracteres como ícone.
- **Don't** trocar o chão branco frio por creme, nem o azul-noite por preto puro.
