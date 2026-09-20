import { evaluateBoard } from "./game.js";

const emptyCells = (board) => board
  .map((cell, index) => (cell ? null : index))
  .filter((index) => index !== null);

const randomItem = (items, random = Math.random) => (
  items[Math.floor(random() * items.length)]
);

function terminalScore(board, aiSymbol, depth) {
  const result = evaluateBoard(board);
  if (result.status === "playing") return null;
  if (result.status === "draw") return 0;
  return result.winner === aiSymbol ? 10 - depth : depth - 10;
}

function minimax(board, turn, aiSymbol, depth, alpha, beta, metrics) {
  metrics.nodes += 1;
  const score = terminalScore(board, aiSymbol, depth);
  if (score !== null) return score;

  const maximizing = turn === aiSymbol;
  let best = maximizing ? -Infinity : Infinity;

  for (const index of emptyCells(board)) {
    board[index] = turn;
    const nextTurn = turn === "X" ? "O" : "X";
    const value = minimax(board, nextTurn, aiSymbol, depth + 1, alpha, beta, metrics);
    board[index] = null;

    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }

    if (beta <= alpha) {
      metrics.prunes += 1;
      break;
    }
  }

  return best;
}

export function analyzeMoves(board, aiSymbol) {
  const startedAt = globalThis.performance?.now?.() ?? Date.now();
  const metrics = { nodes: 0, prunes: 0 };
  const moves = emptyCells(board).map((index) => {
    const simulation = [...board];
    simulation[index] = aiSymbol;
    const opponent = aiSymbol === "X" ? "O" : "X";
    const score = minimax(simulation, opponent, aiSymbol, 1, -Infinity, Infinity, metrics);
    return { index, score };
  });

  const finishedAt = globalThis.performance?.now?.() ?? Date.now();
  return {
    moves,
    nodes: metrics.nodes,
    prunes: metrics.prunes,
    durationMs: Math.max(0, finishedAt - startedAt),
  };
}

export function chooseAiMove(board, aiSymbol, difficulty = "hard", random = Math.random) {
  const available = emptyCells(board);
  if (!available.length) return null;

  if (difficulty === "easy") {
    return {
      index: randomItem(available, random),
      analysis: { strategy: "Aleatória", moves: [], nodes: 0, prunes: 0, durationMs: 0 },
    };
  }

  const analysis = analyzeMoves([...board], aiSymbol);
  const sorted = [...analysis.moves].sort((a, b) => b.score - a.score);
  const bestScore = sorted[0].score;
  const bestMoves = sorted.filter((move) => move.score === bestScore);

  let candidates = bestMoves;
  let strategy = "Minimax otimizado";

  if (difficulty === "medium" && random() < 0.35) {
    const acceptable = sorted.filter((move) => move.score >= 0);
    candidates = acceptable.length ? acceptable : sorted;
    strategy = "Estratégia híbrida";
  }

  const selected = randomItem(candidates, random);
  return {
    index: selected.index,
    analysis: { ...analysis, strategy, selectedScore: selected.score },
  };
}
