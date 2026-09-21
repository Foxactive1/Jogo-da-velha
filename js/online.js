const SESSION_KEY = "jogo-da-velha:online-session:v1";

function loadSocketRuntime() {
  if (typeof window.io === "function") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-socket-runtime]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("O servidor online não está disponível nesta execução.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "/js/vendor/socket.io.min.js";
    script.dataset.socketRuntime = "true";
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error("O servidor online não está disponível nesta execução."));
    };
    document.head.append(script);
  });
}

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) ?? null;
  } catch {
    return null;
  }
}

export class OnlineGameClient {
  constructor({ onState, onConnection, onError } = {}) {
    this.onState = onState ?? (() => {});
    this.onConnection = onConnection ?? (() => {});
    this.onError = onError ?? (() => {});
    this.session = loadSession();
    this.socket = null;
    this.connectPromise = null;
  }

  get currentSession() {
    return this.session ? { ...this.session } : null;
  }

  async connect() {
    await loadSocketRuntime();
    if (this.socket?.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.socket ??= window.io({ autoConnect: false, reconnection: true });
    this.bindEvents();
    this.connectPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("O servidor demorou para responder.")), 7000);
      this.socket.once("connect", () => {
        clearTimeout(timeout);
        resolve();
      });
      this.socket.once("connect_error", (connectionError) => {
        clearTimeout(timeout);
        reject(new Error(connectionError?.message || "Falha ao conectar ao servidor."));
      });
      this.socket.connect();
    }).finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  bindEvents() {
    if (this.socket.__gameEventsBound) return;
    this.socket.__gameEventsBound = true;
    this.socket.on("room_state", (state) => this.onState(state));
    this.socket.on("connect", () => {
      this.onConnection(true);
      if (this.session) {
        this.emitAck("join_game", {
          roomCode: this.session.roomCode,
          token: this.session.token,
          name: this.session.name,
        }).catch((connectionError) => this.onError(connectionError.message));
      }
    });
    this.socket.on("disconnect", () => this.onConnection(false));
    this.socket.on("connect_error", () => this.onConnection(false));
  }

  emitAck(event, payload) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error("Sem conexão com o servidor."));
        return;
      }
      const timeout = setTimeout(() => reject(new Error("O servidor não respondeu a tempo.")), 7000);
      this.socket.emit(event, payload, (response) => {
        clearTimeout(timeout);
        if (!response?.ok) {
          reject(new Error(response?.error || "Não foi possível concluir a operação."));
          return;
        }
        resolve(response);
      });
    });
  }

  saveSession(session) {
    this.session = session;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async create(name) {
    this.clearSession();
    await this.connect();
    const response = await this.emitAck("create_game", { name });
    this.saveSession({ roomCode: response.roomCode, token: response.token, name });
    return response;
  }

  async join(roomCode, name) {
    const normalizedCode = roomCode.trim().toUpperCase();
    const previousToken = this.session?.roomCode === normalizedCode ? this.session.token : null;
    if (this.session && this.session.roomCode !== normalizedCode) this.clearSession();
    await this.connect();
    const response = await this.emitAck("join_game", { roomCode: normalizedCode, name, token: previousToken });
    this.saveSession({ roomCode: response.roomCode, token: response.token, name });
    return response;
  }

  play(index) {
    return this.emitAck("play_move", { roomCode: this.session?.roomCode, index });
  }

  newRound() {
    return this.emitAck("new_round", { roomCode: this.session?.roomCode });
  }

  async leave() {
    if (this.socket?.connected && this.session) {
      await this.emitAck("leave_game", { roomCode: this.session.roomCode }).catch(() => {});
    }
    this.clearSession();
    this.socket?.disconnect();
  }

  clearSession() {
    this.session = null;
    sessionStorage.removeItem(SESSION_KEY);
  }
}
