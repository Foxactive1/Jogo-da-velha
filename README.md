# Jogo da Velha IA 2.1

Uma releitura moderna do clássico Jogo da Velha, agora com inteligência artificial, partidas locais e salas multiplayer pela internet.

## Modos de jogo

- **Contra IA:** dificuldades fácil, médio e impossível, com Minimax e poda alfa-beta.
- **Dois jogadores:** partida local no mesmo dispositivo.
- **Online:** um jogador cria a sala e envia o código ou link de convite ao adversário.

## Multiplayer online

O servidor Flask-SocketIO é autoritativo: ele valida o participante, o turno, a posição escolhida, o resultado e o placar. O cliente apenas solicita a jogada e renderiza o estado recebido.

- Salas privadas com código de seis caracteres.
- Link de convite com preenchimento automático do código.
- Limite de dois jogadores por sala.
- Nomes personalizados e identificação de `X` e `O`.
- Placar e tabuleiro sincronizados em tempo real.
- Bloqueio de jogadas inválidas ou fora do turno.
- Alternância de quem inicia cada nova rodada.
- Reconexão automática por token mantido somente na sessão do navegador.
- Salas inativas removidas após duas horas por padrão.

> As salas são armazenadas em memória. A implantação deve usar um único processo. Para múltiplas instâncias, substitua o armazenamento por Redis e configure o gerenciador de mensagens do Flask-SocketIO.

## Outros recursos

- IA explicável com estratégia, posições avaliadas, podas e tempo de decisão.
- Escolha do símbolo e de quem inicia nos modos locais.
- Placar local persistente no navegador.
- Desfazer jogada nos modos offline.
- Temas claro e escuro, sons opcionais e navegação por teclado.
- PWA com funcionamento offline para os modos IA e local.
- Testes automatizados do motor e do servidor multiplayer.
- Versão original em Python/Tkinter preservada em [`legacy/`](legacy/).

## Tecnologias

- HTML5, CSS3 e JavaScript ES Modules
- Python 3.12, Flask e Flask-SocketIO
- WebSocket com fallback para HTTP long-polling
- LocalStorage e SessionStorage
- Service Worker e Web App Manifest
- Node.js Test Runner e Python `unittest`
- Docker, Gunicorn e GitHub Actions

## Estrutura

```text
.
├── assets/icons/
├── css/style.css
├── js/
│   ├── ai.js             # Minimax e níveis de dificuldade
│   ├── app.js            # Interface e fluxo dos três modos
│   ├── game.js           # Regras independentes da interface
│   ├── online.js         # Cliente Socket.IO e reconexão
│   └── storage.js        # Preferências e placar local
├── legacy/               # Primeira versão em Tkinter
├── tests/
│   ├── game.test.js
│   └── test_server.py
├── server.py             # API em tempo real e servidor estático
├── requirements.txt
├── Dockerfile
├── index.html
├── manifest.webmanifest
└── service-worker.js
```

## Executar no Windows, Linux ou macOS

```bash
python -m venv .venv
```

Ative o ambiente:

```bash
# Linux/macOS
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Instale e execute:

```bash
pip install -r requirements.txt
python server.py
```

Acesse `http://localhost:5000`.

## Executar no Termux

```bash
pkg update
pkg install python git
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Para testar entre aparelhos na mesma rede Wi-Fi, descubra o IP do celular e abra `http://IP_DO_CELULAR:5000` no segundo dispositivo. Para jogar realmente pela internet, publique o servidor em um provedor compatível com WebSocket.

## Testes

```bash
npm test
python -m unittest -v tests/test_server.py
```

Os testes cobrem regras, IA impossível, criação e lotação de salas, autorização de turno, sincronização de vitória, placar, reconexão e exposição segura de arquivos.

## Docker

```bash
docker build -t jogo-da-velha .
docker run --rm -p 5000:5000 -e SECRET_KEY="troque-em-producao" jogo-da-velha
```

## Publicação

Use um serviço que mantenha conexões WebSocket, como Render, Railway, Fly.io ou uma VPS. Configure:

- comando de build: `pip install -r requirements.txt`
- comando de inicialização: `gunicorn --worker-class gthread --workers 1 --threads 100 --bind 0.0.0.0:$PORT server:app`
- variável `SECRET_KEY` com um valor forte e exclusivo
- endpoint de saúde: `/health`

GitHub Pages e hospedagem puramente estática continuam adequados para IA/local, mas não hospedam o servidor das partidas online.

## Versão original

```bash
python legacy/JogoDaVelha.py
```

---

Desenvolvido por **InNovaIdeia Assessoria em Tecnologia ®**.
