export const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function evaluateBoard(board) {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { status: "won", winner: board[a], line };
    }
  }

  if (board.every(Boolean)) {
    return { status: "draw", winner: null, line: [] };
  }

  return { status: "playing", winner: null, line: [] };
}

export class GameEngine {
  constructor(startingPlayer = "X") {
    this.reset(startingPlayer);
  }

  reset(startingPlayer = "X") {
    if (!["X", "O"].includes(startingPlayer)) {
      throw new Error("O jogador inicial deve ser X ou O.");
    }

    this.board = Array(9).fill(null);
    this.currentPlayer = startingPlayer;
    this.result = { status: "playing", winner: null, line: [] };
    this.moves = [];
    return this.snapshot();
  }

  play(index) {
    if (!Number.isInteger(index) || index < 0 || index > 8) {
      throw new RangeError("A posição deve estar entre 0 e 8.");
    }

    if (this.result.status !== "playing") {
      return { accepted: false, reason: "finished", state: this.snapshot() };
    }

    if (this.board[index]) {
      return { accepted: false, reason: "occupied", state: this.snapshot() };
    }

    const player = this.currentPlayer;
    this.board[index] = player;
    this.moves.push({ index, player });
    this.result = evaluateBoard(this.board);

    if (this.result.status === "playing") {
      this.currentPlayer = player === "X" ? "O" : "X";
    }

    return { accepted: true, player, state: this.snapshot() };
  }

  snapshot() {
    return {
      board: [...this.board],
      currentPlayer: this.currentPlayer,
      result: { ...this.result, line: [...this.result.line] },
      moves: this.moves.map((move) => ({ ...move })),
    };
  }
}
