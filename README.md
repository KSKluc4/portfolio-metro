# 🚇 Portfólio Metrô

**▶ Embarque aqui: https://kskluc4.github.io/portfolio-metro/**

Portfólio interativo em forma de mapa de metrô. Cada **linha** é uma linguagem de
programação e cada **estação** é um projeto, em ordem cronológica. Projetos com mais
de uma linguagem viram **estações de baldeação**, onde as linhas se cruzam.

Um trem circula pela rede. Ao clicar numa estação, ele vai até lá e abre a placa da
estação com o painel de embarque: descrição, linguagens, tecnologias, estrelas, data
de criação e da última atualização, e os botões **EMBARCAR** (demo) e **VER CÓDIGO**.

HTML, CSS e JavaScript puro, sem framework e sem build: é só publicar a pasta.

## Estrutura

```
portfolio-metro/
├── index.html
├── config.js         ← o que você edita no dia a dia (textos, cores das linhas, projetos)
├── projects.json     ← reserva, usada quando a API do GitHub falha
├── PRODUCT.md        notas de produto (público, objetivo, o que não inventar)
├── DESIGN.md         sistema visual: cores, tipografia, componentes e regras
├── assets/
│   ├── favicon.svg
│   └── prints/       ← prints dos projetos (opcional)
├── css/
│   ├── base.css      cores, cabeçalho (placa), legenda e controles
│   ├── map.css       linhas, estações, nomes e o trem
│   └── panel.css     painel da estação (lateral no PC, gaveta no celular)
└── js/
    ├── main.js       ponto de entrada: liga todas as peças
    ├── data.js       API do GitHub, cache, reserva e ajustes do config
    ├── network.js    projetos → linhas (linguagens) e estações
    ├── layout.js     gera o mapa: posição das estações e traçado das linhas
    ├── path.js       curvas dos trilhos (o trem anda sobre as mesmas curvas)
    ├── render.js     desenha o SVG do mapa
    ├── train.js      o trem: passeio e viagem até a estação clicada
    ├── viewport.js   arrastar, zoom e centralizar
    ├── panel.js      placa da estação e painel de embarque
    ├── ui.js         cabeçalho, legenda, dica, avisos
    ├── theme.js      modo noturno
    ├── icons.js      ícones em SVG
    └── utils.js      funções pequenas usadas por todo lado
```

## Como o mapa é gerado

Nada é desenhado à mão: o mapa sai dos dados toda vez, para qualquer quantidade de
projetos.

1. **Linhas.** Uma linguagem vira linha numa estação quando tem pelo menos 10% do
   código do projeto (`minLanguageShare`). A principal sempre conta. Por isso um
   projeto 99% TypeScript com um pouco de CSS não vira baldeação. As linhas são
   numeradas na ordem em que aparecem (a linha 1 é a do projeto mais antigo).
2. **Estação Central.** Todas as linhas partem dela, então o trem chega em qualquer
   estação pelos trilhos.
3. **Estações.** Entram em ordem de criação do repositório. Cada uma é colocada logo
   depois da última estação das suas linhas: um projeto novo estica a linha e as
   estações antigas não saem do lugar.
4. **Trilhos.** Só horizontal, vertical e diagonal de 45°, traçados por busca A* numa
   grade: curvas suaves custam pouco, linhas nunca correm uma por cima da outra e só
   se cruzam em "X".
5. **Em obras.** A ponta tracejada de cada linha é onde o próximo projeto entra.

No celular em pé, o mesmo algoritmo gera a rede crescendo na vertical.

## De onde vêm os projetos

O site lê `https://api.github.com/users/KSKluc4/repos?per_page=100`, fica **só com os
repositórios que têm o topic `portfolio`** e busca as linguagens de cada um em
`/repos/KSKluc4/NOME/languages`.

Ordem de tentativa:

1. **Cache** no `localStorage`, se tiver menos de 1 hora (`cacheMinutes`). Sem login,
   a API aceita só 60 requisições por hora por IP, e cada visita sem cache gasta
   1 + uma por projeto.
2. **API do GitHub.** Se a linguagem de um repo falhar, usa a do `projects.json`.
3. **Cache vencido**, se a API falhar.
4. **`projects.json`**, se nada acima funcionar ou se nenhum repo tiver o topic.

A legenda mostra qual fonte foi usada (ex.: `Dados: GitHub · ao vivo`).

O `projects.json` usa os mesmos campos da API, então dá para copiar de lá:

```json
{
  "name": "nome-do-repo",
  "description": "Texto curto",
  "html_url": "https://github.com/KSKluc4/nome-do-repo",
  "homepage": "https://demo.com",
  "language": "JavaScript",
  "languages": { "JavaScript": 12000, "CSS": 800 },
  "topics": ["portfolio"],
  "stargazers_count": 0,
  "created_at": "2026-01-01T00:00:00Z",
  "pushed_at": "2026-10-01T00:00:00Z"
}
```

## Personalizar (`config.js`)

Tudo está comentado no próprio arquivo. O principal:

| Campo | Para quê |
| --- | --- |
| `githubUser` / `topic` | de onde e quais repos viram estação |
| `name` / `subtitle` | textos da placa do cabeçalho |
| `hubName` | nome da estação de onde as linhas partem |
| `cacheMinutes` | validade do cache da API |
| `minLanguageShare` | fatia mínima para uma linguagem virar linha (0.1 = 10%) |
| `maxLinesPerStation` | máximo de linhas numa estação |
| `ignoreLanguages` | linguagens que nunca viram linha |
| `lineColors` | cor (e nome da cor) de cada linha |
| `links` | links extras no painel da Estação Central |
| `projects` | ajustes por repositório, veja abaixo |

Ajustes por projeto (a chave é o nome do repositório; tudo opcional e vence a API):

```js
projects: {
  'pilates-studio': {
    title: 'Pilates Studio',                     // nome da estação
    description: 'Texto próprio...',             // útil quando a do GitHub está vazia
    tech: ['Next.js', 'Express'],                // tecnologias (sem isso, usa os topics)
    image: 'assets/prints/pilates-studio.png',   // print no painel da estação
    demo: 'https://...',                         // botão EMBARCAR (null esconde)
    lines: ['JavaScript'],                       // força as linhas da estação
    createdAt: '2026-06-16',                     // data de inauguração (muda a ordem)
  },
},
```

Cor de linha: `lineColors: { Lua: { color: '#f2b700', name: 'Amarela' } }`, ou só a cor
(`Lua: '#f2b700'`). Linguagens sem cor no config ganham uma cor livre automaticamente.

## Rodar localmente

Os módulos JavaScript não carregam abrindo o `index.html` com dois cliques
(`file://`), então use um servidor local:

```bash
cd portfolio-metro
python3 -m http.server 8000
# abra http://localhost:8000
```

Alternativas: `npx serve .` ou a extensão **Live Server** do VS Code.

Dica: `http://localhost:8000/?refresh` ignora o cache e busca a API na hora.

## Publicar no GitHub Pages

1. Crie um repositório público no GitHub, por exemplo `portfolio-metro`.
2. Suba os arquivos:

   ```bash
   cd portfolio-metro
   git init -b main
   git add .
   git commit -m "Portfólio metrô"
   git remote add origin git@github.com:KSKluc4/portfolio-metro.git
   git push -u origin main
   ```

3. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a
   branch**, escolha `main` e a pasta `/ (root)` e clique em **Save**.
4. Em 1 ou 2 minutos o site fica em `https://kskluc4.github.io/portfolio-metro/`.

O arquivo `.nojekyll` avisa o GitHub Pages para servir os arquivos como estão.

## Adicionar o topic `portfolio` num repositório

**Pelo site:** abra o repositório → clique na engrenagem ⚙️ ao lado de **About** (coluna
da direita) → em **Topics** digite `portfolio` e aperte Enter → **Save changes**.

**Pelo terminal** (com o [GitHub CLI](https://cli.github.com/)):

```bash
gh repo edit KSKluc4/nome-do-repo --add-topic portfolio
```

A estação nova aparece quando o cache vencer (até 1 hora), ou na hora com `?refresh`.
Na mesma tela do **About**, o campo **Website** vira o botão **EMBARCAR**.

## Controles

| Ação | Como |
| --- | --- |
| Ver o nome de uma estação | passar o mouse (ou Tab até ela) |
| Embarcar | clicar / tocar na estação, ou Enter |
| Mover o mapa | arrastar, ou as setas com o mapa em foco |
| Zoom | roda do mouse, pinça com dois dedos, botões + e −, ou as teclas + e − |
| Centralizar | botão ⌖ ou tecla 0 |
| Fechar o painel | Esc, botão ×, ou arrastar a gaveta para baixo no celular |
| Destacar uma linha | passar o mouse (ou clicar) nela na legenda |

Link direto para uma estação: `https://kskluc4.github.io/portfolio-metro/#pilates-studio`.

Quem ativa "reduzir movimento" no sistema recebe o mapa sem o trem circulando e sem
animações.
