import { GameEngine } from "./game.js";
import { chooseAiMove } from "./ai.js";
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
const settingsDialog = $("#settings-dialog");

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
    // O áudio é um aprimoramento opcional; a partida continua sem ele.
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function renderScore() {
  $("#score-player-one").textContent = score.player1;
  $("#score-player-two").textContent = score.player2;
  $("#score-draws").textContent = score.draws;

  const local = settings.mode === "local";
  $("#player-one-label").textContent = local ? "Jogador 1" : "Você";
  $("#player-two-label").textContent = local ? "Jogador 2" : "Inteligência Artificial";
  $("#player-one-mark").textContent = local ? "X" : humanSymbol();
  $("#player-two-mark").textContent = local ? "O" : aiSymbol();
  $("#meta-mode").textContent = local ? "Dois jogadores" : "Contra IA";
  $("#meta-difficulty").textContent = local ? "—" : difficultyNames[settings.difficulty];
}

function statusMessage() {
  const { result, currentPlayer } = engine;

  if (result.status === "draw") return "Empate — a estratégia falou mais alto";
  if (result.status === "won") {
    if (settings.mode === "local") {
      return `${result.winner === "X" ? "Jogador 1" : "Jogador 2"} venceu!`;
    }
    return result.winner === humanSymbol() ? "Você venceu! Excelente leitura." : "A IA venceu esta rodada.";
  }

  if (settings.mode === "local") {
    return `Vez do ${currentPlayer === "X" ? "Jogador 1" : "Jogador 2"} — símbolo ${currentPlayer}`;
  }
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
    cell.disabled = Boolean(value) || engine.result.status !== "playing" || aiThinking || isAiTurn();
    const row = Math.floor(index / 3) + 1;
    const column = (index % 3) + 1;
    cell.setAttribute("aria-label", `Linha ${row}, coluna ${column}${value ? `, marcado com ${value}` : ", vazio"}`);
  });

  status.textContent = statusMessage();
  turnDot.classList.toggle("thinking", aiThinking || isAiTurn());
  const hasHumanMove = engine.moves.some((move) => move.player === humanSymbol());
  undoButton.disabled = aiThinking || (settings.mode === "ai" ? !hasHumanMove : engine.moves.length === 0);
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
  $("#ai-insight").innerHTML = '<div class="insight-visual" aria-hidden="true">⌁</div><p>A análise aparecerá após a primeira jogada da inteligência artificial.</p>';
  $("#metric-strategy").textContent = "—";
  $("#metric-nodes").textContent = "0";
  $("#metric-prunes").textContent = "0";
  $("#metric-duration").textContent = "0 ms";
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

function playCell(index) {
  if (aiThinking || isAiTurn()) return;
  const move = engine.play(index);
  if (!move.accepted) return;

  beep(move.player === "X" ? 520 : 420);
  registerResult();
  renderBoard();
  makeAiMove();
}

function startRound({ announce = false } = {}) {
  clearTimeout(aiTimeout);
  aiThinking = false;
  roundScored = false;
  lastScoredPlayer = null;
  engine.reset(startingSymbol());
  resetInsight();
  renderScore();
  renderBoard();
  if (announce) showToast("Nova rodada iniciada");
  makeAiMove();
}

function undoMove() {
  if (!engine.moves.length || aiThinking) return;

  const lastHumanMove = engine.moves.map((move) => move.player).lastIndexOf(humanSymbol());
  if (settings.mode === "ai" && lastHumanMove < 0) return;

  if (roundScored && lastScoredPlayer) {
    score[lastScoredPlayer] = Math.max(0, score[lastScoredPlayer] - 1);
    saveScore(score);
    roundScored = false;
    lastScoredPlayer = null;
  }

  const remainingMoves = settings.mode === "ai"
    ? engine.moves.slice(0, lastHumanMove)
    : engine.moves.slice(0, -1);
  engine.reset(startingSymbol());
  remainingMoves.forEach(({ index }) => engine.play(index));
  resetInsight();
  renderScore();
  renderBoard();
  showToast("Última jogada desfeita");
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
  $("#difficulty-field").hidden = mode === "local";
  $("#symbol-field").hidden = mode === "local";
}

function saveSettingsFromForm() {
  for (const name of ["mode", "difficulty", "humanSymbol", "starter"]) {
    settings[name] = $(`input[name="${name}"]:checked`).value;
  }
  settings.explainAi = $("#explain-ai-setting").checked;
  saveSettings(settings);
  settingsDialog.close();
  startRound();
  showToast("Configurações atualizadas");
}

cells.forEach((cell) => cell.addEventListener("click", () => playCell(Number(cell.dataset.index))));
board.addEventListener("keydown", (event) => {
  const current = Number(document.activeElement?.dataset?.index);
  if (!Number.isInteger(current)) return;
  const movements = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
  if (!(event.key in movements)) return;
  event.preventDefault();
  const target = current + movements[event.key];
  if (target >= 0 && target <= 8 && !(event.key === "ArrowRight" && current % 3 === 2) && !(event.key === "ArrowLeft" && current % 3 === 0)) {
    cells[target].focus();
  }
});

$("#new-round").addEventListener("click", () => startRound({ announce: true }));
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

applyTheme();
$("#sound-toggle").textContent = settings.sound ? "♪" : "♩";
startRound();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}
