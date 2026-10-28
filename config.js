/* =====================================================================
 *  CONFIGURAÇÃO DO MAPA DE METRÔ
 * ---------------------------------------------------------------------
 *  É aqui que você mexe no dia a dia. O resto do código lê tudo deste
 *  arquivo, então não precisa tocar em JS/CSS para trocar textos, cores
 *  das linhas ou ajustar um projeto.
 * ===================================================================== */

export const CONFIG = {
  // Usuário do GitHub de onde os repositórios são lidos.
  githubUser: 'KSKluc4',

  // Só viram estação os repositórios que tiverem este topic.
  topic: 'portfolio',

  // Placa do cabeçalho.
  name: 'Lucas Marques',
  subtitle: 'Rede de projetos',

  // Estação de onde todas as linhas partem (fica no centro do mapa).
  hubName: 'Estação Central',

  // Por quantos minutos os dados da API ficam guardados no navegador.
  // Sem login, a API do GitHub aceita só 60 requisições por hora por IP,
  // e cada visita sem cache gasta 1 + uma por projeto (as linguagens).
  cacheMinutes: 60,

  // -------------------------------------------------------------------
  //  LINHAS — cada linguagem é uma linha do metrô
  // -------------------------------------------------------------------

  // Uma linguagem só vira linha numa estação se tiver pelo menos esta
  // fatia do código do projeto (0.1 = 10%). A principal sempre conta.
  // Sem isso, um projeto 99% TypeScript com um pouco de CSS viraria
  // baldeação por causa do CSS.
  minLanguageShare: 0.1,

  // Máximo de linhas numa mesma estação.
  maxLinesPerStation: 3,

  // Linguagens que nunca viram linha, ex.: ['Dockerfile', 'Shell'].
  ignoreLanguages: [],

  // Cor de cada linha. Pode ser só a cor ('#1d5fbf') ou { color, name },
  // em que name é o nome da cor mostrado na legenda ("Linha Azul").
  // Linguagens que não estão aqui ganham uma cor livre automaticamente.
  lineColors: {
    JavaScript: { color: '#1d5fbf', name: 'Azul' },
    Lua: { color: '#f2b700', name: 'Amarela' },
    TypeScript: { color: '#8b3fb0', name: 'Lilás' },
    Python: { color: '#00804f', name: 'Verde' },
    HTML: { color: '#d42f25', name: 'Vermelha' },
    CSS: { color: '#00a3a3', name: 'Turquesa' },
    Java: { color: '#f26a1b', name: 'Laranja' },
    'C#': { color: '#6a2c91', name: 'Uva' },
    'C++': { color: '#c2185b', name: 'Rubi' },
    C: { color: '#5d6b78', name: 'Grafite' },
    PHP: { color: '#4b5aa8', name: 'Safira' },
    Go: { color: '#2aa7df', name: 'Celeste' },
    Rust: { color: '#9a5b2e', name: 'Bronze' },
    Shell: { color: '#7c8a96', name: 'Prata' },
  },

  // Links extras no painel da Estação Central (o do GitHub já entra). Ex.:
  //   { label: 'LinkedIn', url: 'https://www.linkedin.com/in/seu-perfil' }
  links: [],

  // -------------------------------------------------------------------
  //  Ajustes por projeto. A chave é o NOME DO REPOSITÓRIO no GitHub.
  //  Tudo é opcional, e o que estiver aqui vence o que vem da API.
  //
  //   title        nome da estação (padrão: nome do repo).
  //   description  descrição personalizada (ótima quando a do GitHub
  //                está vazia).
  //   tech         lista de tecnologias. Sem ela, usamos os topics do repo.
  //   image        print do projeto, ex.: 'assets/prints/meu-projeto.png'.
  //   demo         link do botão EMBARCAR (padrão: campo "Website" do repo).
  //                Use null para esconder o botão.
  //   lines        força as linhas da estação, ex.: ['Lua', 'JavaScript'].
  //   createdAt    data de inauguração (padrão: criação do repositório),
  //                ex.: '2026-07-26'. Define a posição na ordem cronológica.
  // -------------------------------------------------------------------
  projects: {
    'fivem-pvp-trainer': {
      title: 'FiveM PvP Trainer',
      tech: ['React', 'Flask', 'Supabase', 'Electron'],
    },
    'mon-petit-sistema-demo': {
      title: 'Mon Petit Sistema',
      description:
        'Sistema de gestão de um pet shop: clientes, pets, agenda, atendimento, histórico, caixa e dashboard. Usado no dia a dia no tablet do balcão e no celular.',
      tech: ['Next.js', 'Tailwind', 'Prisma', 'Postgres'],
      demo: null, // sem EMBARCAR: o sistema em produção é de um cliente
      createdAt: '2026-07-26', // início do projeto original (o repo demo é de 27/10/2026)
    },
    'pilates-studio': {
      title: 'Pilates Studio',
      description:
        'App web fullstack para gerenciar um estúdio de pilates: cadastro de pacientes, agendamento de aulas e controle de pagamentos, com autenticação segura e dois níveis de acesso.',
      tech: ['Next.js', 'Express', 'MongoDB', 'JWT'],
    },
  },
};
