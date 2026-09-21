import { GameEngine } from "./game.js";
import { chooseAiMove } from "./ai.js";
import { OnlineGameClient } from "./online.js";
import {
  clearScore,
  defaultScore,
  loadScore,
  loadSettings,
  saveScore,
  saveSettings,
} from "./storage.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const difficultyNames = { easy: "Fácil", medium: "Médio", hard: "Impossível" };
const positionNames = [
  "superior esquerda", "superior central", "superior direita",
  "central esquerda", "centro", "central direita",
  "inferior esquerda", "inferior central", "inferior direita",
];

let settings = loadSettings();
let score = loadScore();
let engine = new GameEngine();
let onlineState = null;
let onlineConnected = false;
let aiTimeout = null;
let aiThinking = false;
let roundScored = false;
let lastScoredPlayer = null;
let toastTimeout = null;

const cells = $$(".cell");
const board = $("#game-board");
const status = $("#game-status");
const turnDot = $("#turn-dot");
const undoButton = $("#undo-move");
const newRoundButton = $("#new-round");
const settingsDialog = $("#settings-dialog");
const onlineDialog = $("#online-dialog");

const online = new OnlineGameClient({
  onState: applyOnlineState,
  onConnection: (connected) => {
    onlineConnected = connected;
    if (settings.mode === "online") renderAll();
  },
  onError: showToast,
});

function humanSymbol() {
  return settings.mode === "local" ? "X" : settings.humanSymbol;
}

function aiSymbol() {
  return settings.humanSymbol === "X" ? "O" : "X";
}

function startingSymbol() {
  if (settings.mode === "local") return settings.starter === "human" ? "X" : "O";
  return settings.starter === "human" ? humanSymbol() : aiSymbol();
}

function isAiTurn() {
  return settings.mode === "ai"
    && engine.result.status === "playing"
    && engine.currentPlayer === aiSymbol();
}

function isOnlineTurn() {
  return settings.mode === "online"
    && onlineConnected
    && onlineState?.status === "playing"
    && onlineState.result.status === "playing"
    && onlineState.currentPlayer === onlineState.you.symbol;
}

function beep(frequency = 440, duration = .07) {
  if (!settings.sound) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch {
    // O som é opcional e nunca deve interromper a partida.
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function renderScore() {
  const onlineMode = settings.mode === "online";
  const localMode = settings.mode === "local";

  if (onlineMode && onlineState) {
    $("#score-player-one").textContent = onlineState.scores.X;
    $("#score-player-two").textContent = onlineState.scores.O;
    $("#score-draws").textContent = onlineState.scores.draws;
    $("#player-one-label").textContent = `${onlineState.players.X?.name ?? "Jogador 1"}${onlineState.you.symbol === "X" ? " (você)" : ""}`;
    $("#player-two-label").textContent = `${onlineState.players.O?.name ?? "Aguardando…"}${onlineState.you.symbol === "O" ? " (você)" : ""}`;
    $("#player-one-mark").textContent = "X";
    $("#player-two-mark").textContent = "O";
    $("#meta-mode").textContent = "Online";
    $("#meta-difficulty").textContent = `Sala ${onlineState.roomCode}`;
  } else {
    $("#score-player-one").textContent = score.player1;
    $("#score-player-two").textContent = score.player2;
    $("#score-draws").textContent = score.draws;
    $("#player-one-label").textContent = localMode ? "Jogador 1" : "Você";
    $("#player-two-label").textContent = localMode ? "Jogador 2" : "Inteligência Artificial";
    $("#player-one-mark").textContent = localMode ? "X" : humanSymbol();
    $("#player-two-mark").textContent = localMode ? "O" : aiSymbol();
    $("#meta-mode").textContent = onlineMode ? "Online" : localMode ? "Dois jogadores" : "Contra IA";
    $("#meta-difficulty").textContent = onlineMode ? "Sem sala" : localMode ? "—" : difficultyNames[settings.difficulty];
  }

  $("#score-reset").hidden = onlineMode;
  $("#online-open").hidden = !onlineMode;
}

function onlineStatusMessage() {
  if (!onlineState) return "Crie uma sala ou entre com um código";
  if (!onlineConnected) return "Reconectando ao servidor…";
  if (onlineState.status === "waiting") return "Aguardando o segundo jogador entrar…";

  const opponent = onlineState.you.symbol === "X" ? onlineState.players.O : onlineState.players.X;
  if (opponent && !opponent.connected) return "O adversário está reconectando…";
  if (onlineState.result.status === "draw") return "Empate — nova rodada disponível";
  if (onlineState.result.status === "won") {
    return onlineState.result.winner === onlineState.you.symbol ? "Você venceu a rodada!" : "O adversário venceu a rodada.";
  }
  return isOnlineTurn() ? `Sua vez — você joga com ${onlineState.you.symbol}` : "Vez do adversário…";
}

function statusMessage() {
  if (settings.mode === "online") return onlineStatusMessage();
  const { result, currentPlayer } = engine;
  if (result.status === "draw") return "Empate — a estratégia falou mais alto";
  if (result.status === "won") {
    if (settings.mode === "local") return `${result.winner === "X" ? "Jogador 1" : "Jogador 2"} venceu!`;
    return result.winner === humanSymbol() ? "Você venceu! Excelente leitura." : "A IA venceu esta rodada.";
  }
  if (settings.mode === "local") return `Vez do ${currentPlayer === "X" ? "Jogador 1" : "Jogador 2"} — símbolo ${currentPlayer}`;
  if (isAiTurn()) return "A IA está calculando a melhor resposta…";
  return `Sua vez — você joga com ${humanSymbol()}`;
}

function renderBoard() {
  cells.forEach((cell, index) => {
    const value = engine.board[index];
    cell.textContent = value ?? "";
    cell.classList.toggle("x", value === "X");
    cell.classList.toggle("o", value === "O");
    cell.classList.toggle("winner", engine.result.line.includes(index));

    const blockedOnline = settings.mode === "online" && (!isOnlineTurn() || !onlineState?.players.X?.connected || !onlineState?.players.O?.connected);
    cell.disabled = Boolean(value) || engine.result.status !== "playing" || aiThinking || isAiTurn() || blockedOnline;
    const row = Math.floor(index / 3) + 1;
    const column = (index % 3) + 1;
    cell.setAttribute("aria-label", `Linha ${row}, coluna ${column}${value ? `, marcado com ${value}` : ", vazio"}`);
  });

  status.textContent = statusMessage();
  const waiting = settings.mode === "online" ? !isOnlineTurn() && onlineState?.result.status === "playing" : aiThinking || isAiTurn();
  turnDot.classList.toggle("thinking", Boolean(waiting));

  const hasHumanMove = engine.moves.some((move) => move.player === humanSymbol());
  undoButton.hidden = settings.mode === "online";
  undoButton.disabled = aiThinking || (settings.mode === "ai" ? !hasHumanMove : engine.moves.length === 0);
  newRoundButton.disabled = settings.mode === "online"
    && (!onlineState || onlineState.status !== "playing" || onlineState.result.status === "playing");
}

function renderOnlineInsight() {
  $("#insight-title").textContent = "Conexão da sala";
  $("#insight-badge").innerHTML = `<i></i> ${onlineConnected ? "Online" : "Reconectando"}`;
  $("#insight-badge").classList.toggle("connection-offline", !onlineConnected);
  $(".metrics").hidden = true;

  const content = $("#ai-insight");
  content.innerHTML = '<div class="insight-visual" aria-hidden="true">◎</div><p id="online-insight-text"></p>';
  const message = !onlineState
    ? "Crie uma sala privada e envie o link de convite para o outro jogador."
    : onlineState.status === "waiting"
      ? `Sala ${onlineState.roomCode} criada. Compartilhe o convite para começar.`
      : `Rodada ${onlineState.roundNumber}. As jogadas e o placar são validados pelo servidor.`;
  $("#online-insight-text").textContent = message;
}

function updateAiInsight(analysis, index) {
  if (!settings.explainAi) {
    $("#ai-insight").innerHTML = '<div class="insight-visual" aria-hidden="true">◌</div><p>A explicação das decisões está desativada nas configurações.</p>';
    return;
  }
  const quality = analysis.strategy === "Aleatória"
    ? "foi selecionada aleatoriamente neste nível"
    : analysis.selectedScore > 0
      ? "cria uma rota de vitória"
      : analysis.selectedScore === 0
        ? "preserva o melhor resultado possível"
        : "reduz o risco nesta posição";
  $("#ai-insight").innerHTML = `<div class="insight-visual" aria-hidden="true">⌁</div><p>A IA escolheu a casa <strong>${positionNames[index]}</strong>, pois essa jogada ${quality}.</p>`;
  $("#metric-strategy").textContent = analysis.strategy;
  $("#metric-nodes").textContent = analysis.nodes.toLocaleString("pt-BR");
  $("#metric-prunes").textContent = analysis.prunes.toLocaleString("pt-BR");
  $("#metric-duration").textContent = `${analysis.durationMs.toFixed(2)} ms`;
}

function resetInsight() {
  if (settings.mode === "online") {
    renderOnlineInsight();
    return;
  }
  $("#insight-title").textContent = "Leitura da IA";
  $("#insight-badge").innerHTML = "<i></i> Ativo";
  $("#insight-badge").classList.remove("connection-offline");
  $(".metrics").hidden = false;
  $("#ai-insight").innerHTML = settings.mode === "local"
    ? '<div class="insight-visual" aria-hidden="true">◇</div><p>Partida local para dois jogadores no mesmo dispositivo.</p>'
    : '<div class="insight-visual" aria-hidden="true">⌁</div><p>A análise aparecerá após a primeira jogada da inteligência artificial.</p>';
  $("#metric-strategy").textContent = "—";
  $("#metric-nodes").textContent = "0";
  $("#metric-prunes").textContent = "0";
  $("#metric-duration").textContent = "0 ms";
}

function renderAll() {
  renderScore();
  renderBoard();
  if (settings.mode === "online") renderOnlineInsight();
  updateOnlineDialog();
}

function registerResult() {
  if (roundScored || engine.result.status === "playing") return;
  if (engine.result.status === "draw") {
    score.draws += 1;
    lastScoredPlayer = "draws";
    beep(320, .16);
  } else {
    const firstPlayerWon = settings.mode === "local"
      ? engine.result.winner === "X"
      : engine.result.winner === humanSymbol();
    lastScoredPlayer = firstPlayerWon ? "player1" : "player2";
    score[lastScoredPlayer] += 1;
    beep(firstPlayerWon ? 720 : 220, .22);
  }
  roundScored = true;
  saveScore(score);
  renderScore();
}

function makeAiMove() {
  if (!isAiTurn()) return;
  aiThinking = true;
  renderBoard();
  aiTimeout = setTimeout(() => {
    const decision = chooseAiMove(engine.board, aiSymbol(), settings.difficulty);
    if (!decision || !isAiTurn()) {
      aiThinking = false;
      renderBoard();
      return;
    }
    engine.play(decision.index);
    aiThinking = false;
    beep(360);
    updateAiInsight(decision.analysis, decision.index);
    registerResult();
    renderBoard();
  }, 460);
}

async function playCell(index) {
  if (settings.mode === "online") {
    if (!isOnlineTurn()) return;
    try {
      await online.play(index);
    } catch (onlineError) {
      showToast(onlineError.message);
    }
    return;
  }
  if (aiThinking || isAiTurn()) return;
  const move = engine.play(index);
  if (!move.accepted) return;
  beep(move.player === "X" ? 520 : 420);
  registerResult();
  renderBoard();
  makeAiMove();
}

function startLocalRound({ announce = false } = {}) {
  clearTimeout(aiTimeout);
  aiThinking = false;
  roundScored = false;
  lastScoredPlayer = null;
  engine.reset(startingSymbol());
  resetInsight();
  renderAll();
  if (announce) showToast("Nova rodada iniciada");
  makeAiMove();
}

async function requestNewRound() {
  if (settings.mode !== "online") {
    startLocalRound({ announce: true });
    return;
  }
  try {
    await online.newRound();
    showToast("Nova rodada iniciada");
  } catch (onlineError) {
    showToast(onlineError.message);
  }
}

function undoMove() {
  if (!engine.moves.length || aiThinking || settings.mode === "online") return;
  const lastHumanMove = engine.moves.map((move) => move.player).lastIndexOf(humanSymbol());
  if (settings.mode === "ai" && lastHumanMove < 0) return;
  if (roundScored && lastScoredPlayer) {
    score[lastScoredPlayer] = Math.max(0, score[lastScoredPlayer] - 1);
    saveScore(score);
    roundScored = false;
    lastScoredPlayer = null;
  }
  const remainingMoves = settings.mode === "ai" ? engine.moves.slice(0, lastHumanMove) : engine.moves.slice(0, -1);
  engine.reset(startingSymbol());
  remainingMoves.forEach(({ index }) => engine.play(index));
  resetInsight();
  renderAll();
  showToast("Última jogada desfeita");
}

function applyOnlineState(state) {
  const previousFilled = onlineState?.board.filter(Boolean).length ?? 0;
  const previousStatus = onlineState?.result.status;
  onlineState = state;
  engine.board = [...state.board];
  engine.currentPlayer = state.currentPlayer;
  engine.result = { ...state.result, line: [...state.result.line] };
  engine.moves = state.board.flatMap((player, index) => player ? [{ index, player }] : []);

  const currentFilled = state.board.filter(Boolean).length;
  if (currentFilled > previousFilled) beep(state.currentPlayer === "X" ? 420 : 520);
  if (previousStatus === "playing" && state.result.status !== "playing") {
    beep(state.result.winner === state.you.symbol ? 720 : 260, .22);
  }
  renderAll();
}

function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  $("#theme-toggle").textContent = settings.theme === "dark" ? "☼" : "☾";
  $("#theme-toggle").setAttribute("aria-label", settings.theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
  document.querySelector('meta[name="theme-color"]').content = settings.theme === "dark" ? "#080d19" : "#f3f6f9";
}

function syncSettingsForm() {
  ["mode", "difficulty", "humanSymbol", "starter"].forEach((name) => {
    const input = $(`input[name="${name}"][value="${settings[name]}"]`);
    if (input) input.checked = true;
  });
  $("#explain-ai-setting").checked = settings.explainAi;
  updateSettingsVisibility();
}

function updateSettingsVisibility() {
  const mode = $('input[name="mode"]:checked')?.value ?? settings.mode;
  const aiMode = mode === "ai";
  $("#difficulty-field").hidden = !aiMode;
  $("#symbol-field").hidden = !aiMode;
  $("#starter-field").hidden = mode === "online";
  $("#explain-field").hidden = !aiMode;
}

async function saveSettingsFromForm() {
  const previousMode = settings.mode;
  for (const name of ["mode", "difficulty", "humanSymbol", "starter"]) {
    settings[name] = $(`input[name="${name}"]:checked`).value;
  }
  settings.explainAi = $("#explain-ai-setting").checked;
  saveSettings(settings);
  settingsDialog.close();

  if (previousMode === "online" && settings.mode !== "online") {
    await online.leave();
    onlineState = null;
    removeRoomFromUrl();
  }
  if (settings.mode === "online") {
    enterOnlineMode();
  } else {
    startLocalRound();
    showToast("Configurações atualizadas");
  }
}

function inviteUrl(code = onlineState?.roomCode ?? online.currentSession?.roomCode) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  if (code) url.searchParams.set("room", code);
  return url.toString();
}

function setRoomInUrl(code) {
  history.replaceState(null, "", inviteUrl(code));
}

function removeRoomFromUrl() {
  const url = new URL(location.href);
  url.searchParams.delete("room");
  history.replaceState(null, "", url);
}

function updateOnlineDialog() {
  const session = online.currentSession;
  const hasRoom = Boolean(session || onlineState);
  $("#online-entry").hidden = hasRoom;
  $("#online-room").hidden = !hasRoom;
  if (!hasRoom) return;

  const code = onlineState?.roomCode ?? session.roomCode;
  $("#online-room-code").textContent = code;
  $("#online-room-status").textContent = !onlineConnected
    ? "Reconectando ao servidor…"
    : onlineState?.status === "playing"
      ? "Os dois jogadores estão na sala."
      : "Aguardando o outro jogador…";
}

function openOnlineDialog() {
  updateOnlineDialog();
  if (!onlineDialog.open) onlineDialog.showModal();
}

async function enterOnlineMode() {
  clearTimeout(aiTimeout);
  aiThinking = false;
  engine.reset("X");
  resetInsight();
  renderAll();

  if (online.currentSession) {
    try {
      await online.connect();
      setRoomInUrl(online.currentSession.roomCode);
    } catch (onlineError) {
      showToast(onlineError.message);
      openOnlineDialog();
    }
  } else {
    openOnlineDialog();
  }
}

async function createOnlineRoom() {
  const name = $("#online-name").value.trim() || "Jogador 1";
  const button = $("#online-create");
  button.disabled = true;
  button.textContent = "Criando sala…";
  try {
    const response = await online.create(name);
    setRoomInUrl(response.roomCode);
    updateOnlineDialog();
    showToast("Sala criada. Agora envie o convite!");
  } catch (onlineError) {
    showToast(onlineError.message);
  } finally {
    button.disabled = false;
    button.textContent = "Criar uma nova sala";
  }
}

async function joinOnlineRoom() {
  const name = $("#online-name").value.trim() || "Jogador 2";
  const code = $("#online-code").value.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) {
    showToast("Digite um código de sala válido com 6 caracteres.");
    return;
  }
  const button = $("#online-join");
  button.disabled = true;
  button.textContent = "Entrando…";
  try {
    await online.join(code, name);
    setRoomInUrl(code);
    updateOnlineDialog();
    onlineDialog.close();
    showToast("Você entrou na sala!");
  } catch (onlineError) {
    showToast(onlineError.message);
  } finally {
    button.disabled = false;
    button.textContent = "Entrar na sala";
  }
}

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteUrl());
    showToast("Link de convite copiado");
  } catch {
    showToast("Não foi possível copiar. Use o código exibido.");
  }
}

async function shareInvite() {
  if (!navigator.share) {
    await copyInvite();
    return;
  }
  try {
    await navigator.share({ title: "Jogo da Velha IA", text: "Entre na minha sala para jogar!", url: inviteUrl() });
  } catch (shareError) {
    if (shareError.name !== "AbortError") showToast("Não foi possível compartilhar o convite.");
  }
}

async function leaveOnlineRoom() {
  await online.leave();
  onlineState = null;
  onlineConnected = false;
  settings.mode = "ai";
  saveSettings(settings);
  removeRoomFromUrl();
  onlineDialog.close();
  startLocalRound();
  showToast("Você saiu da sala online");
}

cells.forEach((cell) => cell.addEventListener("click", () => playCell(Number(cell.dataset.index))));
board.addEventListener("keydown", (event) => {
  const current = Number(document.activeElement?.dataset?.index);
  if (!Number.isInteger(current)) return;
  const movements = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
  if (!(event.key in movements)) return;
  event.preventDefault();
  const target = current + movements[event.key];
  if (target >= 0 && target <= 8 && !(event.key === "ArrowRight" && current % 3 === 2) && !(event.key === "ArrowLeft" && current % 3 === 0)) cells[target].focus();
});

newRoundButton.addEventListener("click", requestNewRound);
undoButton.addEventListener("click", undoMove);
$("#score-reset").addEventListener("click", () => {
  clearScore();
  score = { ...defaultScore };
  renderScore();
  showToast("Placar zerado");
});
$("#theme-toggle").addEventListener("click", () => {
  settings.theme = settings.theme === "dark" ? "light" : "dark";
  saveSettings(settings);
  applyTheme();
});
$("#sound-toggle").addEventListener("click", () => {
  settings.sound = !settings.sound;
  saveSettings(settings);
  $("#sound-toggle").textContent = settings.sound ? "♪" : "♩";
  $("#sound-toggle").setAttribute("aria-label", settings.sound ? "Desativar sons" : "Ativar sons");
  showToast(settings.sound ? "Sons ativados" : "Sons desativados");
});
$("#settings-open").addEventListener("click", () => {
  syncSettingsForm();
  settingsDialog.showModal();
});
$$('input[name="mode"]').forEach((input) => input.addEventListener("change", updateSettingsVisibility));
$("#settings-save").addEventListener("click", saveSettingsFromForm);
settingsDialog.addEventListener("click", (event) => {
  if (event.target === settingsDialog) settingsDialog.close();
});

$("#online-open").addEventListener("click", openOnlineDialog);
$("#online-close").addEventListener("click", () => onlineDialog.close());
$("#online-create").addEventListener("click", createOnlineRoom);
$("#online-join").addEventListener("click", joinOnlineRoom);
$("#online-copy").addEventListener("click", copyInvite);
$("#online-share").addEventListener("click", shareInvite);
$("#online-leave").addEventListener("click", leaveOnlineRoom);
$("#online-code").addEventListener("input", (event) => {
  event.target.value = event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
});
onlineDialog.addEventListener("click", (event) => {
  if (event.target === onlineDialog) onlineDialog.close();
});

applyTheme();
$("#sound-toggle").textContent = settings.sound ? "♪" : "♩";

const invitedCode = new URLSearchParams(location.search).get("room")?.trim().toUpperCase();
if (invitedCode && /^[A-Z2-9]{6}$/.test(invitedCode)) {
  settings.mode = "online";
  saveSettings(settings);
  $("#online-code").value = invitedCode;
  if (online.currentSession?.roomCode !== invitedCode) online.clearSession();
  enterOnlineMode();
} else if (settings.mode === "online") {
  enterOnlineMode();
} else {
  startLocalRound();
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}
