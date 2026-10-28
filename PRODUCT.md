# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

HTML, CSS e JavaScript puro (ES modules, SVG para o mapa), sem framework e sem build, publicado no GitHub Pages. Definido no briefing.

## Users

Recrutadores e clientes, sem priorizar um. Recrutadores avaliam o nível técnico de Lucas Marques para vagas e estágio; clientes avaliam sistemas já entregues para negócios antes de chamá-lo para um projeto. Desenvolvedores também passam para ver o código.

## Product Purpose

Portfólio interativo dos projetos de programação de Lucas Marques (GitHub `KSKluc4`) em forma de mapa de metrô: cada projeto é uma estação e cada linguagem é uma linha. Sucesso: o visitante entende rápido o que ele já construiu e com quais tecnologias, e chega ao código (GitHub) ou à demo.

## Positioning

O mapa é gerado a partir dos dados reais do GitHub (repositórios com o topic `portfolio` e a fatia de cada linguagem no código). Um projeto novo vira estação sozinho e estende a linha da sua linguagem; a ordem cronológica mostra a evolução.

## Operating Context

Visitantes chegam por link (currículo, GitHub, conversas), no desktop e no celular. Lucas mantém o portfólio adicionando o topic `portfolio` aos repositórios e ajustando o `config.js`.

## Capabilities and Constraints

- Dados da API pública do GitHub (sem login: 60 requisições por hora por IP), cache de 1 hora no localStorage e fallback em `projects.json`.
- Só entram repositórios com o topic `portfolio`.
- Layout do mapa gerado automaticamente para qualquer quantidade de projetos.
- Ajustes por projeto no `config.js`: título, descrição, tecnologias, print, link de demo, linhas e data de inauguração.
- Conteúdo em português do Brasil.
- Contato: só o GitHub por enquanto.

## Brand Commitments

Tema "mapa de metrô" fixado no briefing (inspirado nos mapas de Londres e São Paulo): linhas coloridas, curvas de 45°, estações em círculos brancos de borda grossa, fundo claro com modo noturno, fonte de sinalização (Inter ou Roboto Condensed), cabeçalho como placa de metrô com o nome, legenda das linhas no canto, botões "EMBARCAR" e "VER CÓDIGO", selo "NOVA ESTAÇÃO" piscando. Nada de portfólio padrão com cards e grid.

## Evidence on Hand

- `fivem-pvp-trainer`: app desktop para treino de PvP no FiveM (React, Flask, Supabase, Electron), demo em fivem-pvp-trainer.vercel.app.
- `pilates-studio`: gestão de um estúdio de pilates (Next.js, Express, MongoDB, JWT), demo em pilates-studio-three.vercel.app.
- `mon-petit-sistema-demo`: versão pública do sistema de gestão de um pet shop real; o projeto começou em 26/07/2026. O sistema em produção é de um cliente: o link de produção nunca aparece (`demo: null`).
- Ainda não há prints dos projetos (`assets/prints/` vazio), depoimentos nem métricas: nada disso deve ser inventado.

## Product Principles

1. Os dados mandam: o mapa reflete o GitHub e nunca inventa projetos, números ou clientes.
2. Crescer sem reorganizar: projeto novo estende a linha; o que já existe não muda de lugar.
3. Explorar é o conteúdo: o mapa é a interface, não enfeite em volta de cards.
4. Funcionar com 3 ou com 30 projetos, no celular e no desktop.
