import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine, evaluateBoard } from "../js/game.js";
import { chooseAiMove } from "../js/ai.js";

test("detecta vitória em linha", () => {
  assert.deepEqual(evaluateBoard(["X", "X", "X", null, "O", null, "O", null, null]), {
    status: "won",
    winner: "X",
    line: [0, 1, 2],
  });
});

test("detecta empate", () => {
  const result = evaluateBoard(["X", "O", "X", "X", "O", "O", "O", "X", "X"]);
  assert.equal(result.status, "draw");
});

test("impede jogada em célula ocupada", () => {
  const game = new GameEngine();
  assert.equal(game.play(4).accepted, true);
  assert.equal(game.play(4).accepted, false);
  assert.equal(game.snapshot().currentPlayer, "O");
});

test("IA difícil conclui uma vitória imediata", () => {
  const board = ["O", "O", null, "X", "X", null, null, null, null];
  assert.equal(chooseAiMove(board, "O", "hard", () => 0).index, 2);
});

test("IA difícil bloqueia uma derrota imediata", () => {
  const board = ["X", "X", null, null, "O", null, null, null, null];
  assert.equal(chooseAiMove(board, "O", "hard", () => 0).index, 2);
});

test("IA fácil seleciona apenas células livres", () => {
  const board = ["X", "O", "X", "O", null, "X", "O", "X", null];
  const move = chooseAiMove(board, "O", "easy", () => 0.99);
  assert.equal(move.index, 8);
});

test("IA difícil nunca permite uma vitória na árvore completa", () => {
  const human = "X";
  const ai = "O";

  function explore(board, turn) {
    const result = evaluateBoard(board);
    assert.notEqual(result.winner, human);
    if (result.status !== "playing") return;

    if (turn === ai) {
      const move = chooseAiMove(board, ai, "hard", () => 0);
      const next = [...board];
      next[move.index] = ai;
      explore(next, human);
      return;
    }

    board.forEach((cell, index) => {
      if (cell) return;
      const next = [...board];
      next[index] = human;
      explore(next, ai);
    });
  }

  explore(Array(9).fill(null), human);
});
