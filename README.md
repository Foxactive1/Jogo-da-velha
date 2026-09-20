# Jogo da Velha IA 2.0

Uma releitura moderna do clássico Jogo da Velha, com interface responsiva, partidas locais e uma inteligência artificial baseada no algoritmo Minimax com poda alfa-beta.

## Destaques

- Modo jogador contra IA e modo local para duas pessoas.
- Três dificuldades: fácil, médio e impossível.
- Escolha do símbolo e de quem inicia a rodada.
- IA explicável com estratégia, posições avaliadas, podas e tempo de decisão.
- Placar persistente no navegador.
- Desfazer jogada e reiniciar rodada.
- Temas claro e escuro, sons opcionais e navegação por teclado.
- PWA com funcionamento offline e instalação no dispositivo.
- Testes automatizados da regra do jogo e da IA.
- Versão original em Python/Tkinter preservada em [`legacy/`](legacy/).

## Tecnologias

- HTML5 semântico
- CSS3 responsivo
- JavaScript ES Modules
- LocalStorage
- Service Worker e Web App Manifest
- Node.js Test Runner
- GitHub Actions

## Estrutura

```text
.
├── assets/icons/       # Ícone da aplicação
├── css/style.css       # Design system e responsividade
├── js/
│   ├── ai.js           # Minimax, poda alfa-beta e dificuldades
│   ├── app.js          # Interface e fluxo da partida
│   ├── game.js         # Regras independentes da interface
│   └── storage.js      # Placar e preferências locais
├── legacy/             # Primeira versão em Python/Tkinter
├── tests/              # Testes automatizados
├── index.html
├── manifest.webmanifest
└── service-worker.js
```

## Executar localmente

O projeto não precisa de instalação de dependências. Como utiliza módulos JavaScript e Service Worker, deve ser servido por HTTP:

```bash
npm start
```

Abra `http://localhost:8080`.

Alternativa sem npm:

```bash
python3 -m http.server 8080
```

## Testes

Requer Node.js 20 ou superior:

```bash
npm test
```

## Publicação

O projeto é estático e pode ser publicado diretamente no GitHub Pages ou na Vercel, sem etapa de build. Na Vercel, mantenha o diretório raiz como diretório de saída.

## Como funciona a IA

- **Fácil:** seleciona aleatoriamente uma casa livre.
- **Médio:** combina análise Minimax com variação estratégica.
- **Impossível:** percorre as possibilidades até o fim da partida e usa poda alfa-beta para eliminar ramos desnecessários. O fator de profundidade faz a IA priorizar vitórias rápidas e adiar derrotas inevitáveis.

## Versão original

A implementação inicial em Tkinter continua disponível:

```bash
python3 legacy/JogoDaVelha.py
```

---

Desenvolvido por **InNovaIdeia Assessoria em Tecnologia ®**.
