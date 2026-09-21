"""Servidor autoritativo do modo multijogador do Jogo da Velha IA 2.0."""

from __future__ import annotations

import os
import secrets
import string
import threading
import time
from pathlib import Path
from typing import Any

from flask import Flask, abort, jsonify, request, send_from_directory
from flask_socketio import SocketIO, join_room, leave_room


BASE_DIR = Path(__file__).resolve().parent
ROOM_TTL_SECONDS = int(os.environ.get("ROOM_TTL_SECONDS", "7200"))
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
WINNING_LINES = (
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6),
)

app = Flask(__name__, static_folder=None)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", secrets.token_hex(32))
socketio = SocketIO(app, cors_allowed_origins=None, async_mode="threading")

rooms: dict[str, dict[str, Any]] = {}
rooms_lock = threading.RLock()


def sanitize_name(value: Any, fallback: str) -> str:
    if not isinstance(value, str):
        return fallback
    clean = " ".join(value.strip().split())[:24]
    return clean or fallback


def generate_room_code() -> str:
    for _ in range(20):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if code not in rooms:
            return code
    raise RuntimeError("Não foi possível gerar um código de sala único.")


def evaluate_board(board: list[str | None]) -> dict[str, Any]:
    for line in WINNING_LINES:
        a, b, c = line
        if board[a] and board[a] == board[b] == board[c]:
            return {"status": "won", "winner": board[a], "line": list(line)}
    if all(board):
        return {"status": "draw", "winner": None, "line": []}
    return {"status": "playing", "winner": None, "line": []}


def public_player(player: dict[str, Any] | None) -> dict[str, Any] | None:
    if not player:
        return None
    return {"name": player["name"], "connected": player["connected"]}


def room_state(room: dict[str, Any], symbol: str) -> dict[str, Any]:
    return {
        "roomCode": room["code"],
        "board": list(room["board"]),
        "currentPlayer": room["current_player"],
        "result": {**room["result"], "line": list(room["result"]["line"])},
        "scores": dict(room["scores"]),
        "roundNumber": room["round_number"],
        "status": "playing" if room["players"].get("O") else "waiting",
        "players": {
            "X": public_player(room["players"].get("X")),
            "O": public_player(room["players"].get("O")),
        },
        "you": {"symbol": symbol},
    }


def emit_room_state(room: dict[str, Any]) -> None:
    for symbol, player in room["players"].items():
        if player.get("sid") and player.get("connected"):
            socketio.emit("room_state", room_state(room, symbol), to=player["sid"])


def find_player_by_sid(room: dict[str, Any], sid: str) -> tuple[str, dict[str, Any]] | None:
    for symbol, player in room["players"].items():
        if player.get("sid") == sid:
            return symbol, player
    return None


def cleanup_expired_rooms() -> None:
    cutoff = time.time() - ROOM_TTL_SECONDS
    expired = [code for code, room in rooms.items() if room["last_activity"] < cutoff]
    for code in expired:
        rooms.pop(code, None)


def error(message: str, code: str) -> dict[str, Any]:
    return {"ok": False, "error": message, "code": code}


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/health")
def health():
    with rooms_lock:
        cleanup_expired_rooms()
        return jsonify({"status": "ok", "activeRooms": len(rooms)})


@app.get("/<path:asset_path>")
def static_assets(asset_path: str):
    allowed_files = {"manifest.webmanifest", "service-worker.js"}
    allowed_directories = ("assets/", "css/", "js/")
    if asset_path in allowed_files or asset_path.startswith(allowed_directories):
        return send_from_directory(BASE_DIR, asset_path)
    abort(404)


@socketio.on("create_game")
def create_game(data: Any = None):
    payload = data if isinstance(data, dict) else {}
    with rooms_lock:
        cleanup_expired_rooms()
        code = generate_room_code()
        token = secrets.token_urlsafe(24)
        now = time.time()
        room = {
            "code": code,
            "board": [None] * 9,
            "current_player": "X",
            "starter": "X",
            "result": {"status": "playing", "winner": None, "line": []},
            "scores": {"X": 0, "O": 0, "draws": 0},
            "round_number": 1,
            "players": {
                "X": {
                    "name": sanitize_name(payload.get("name"), "Jogador 1"),
                    "token": token,
                    "sid": request.sid,
                    "connected": True,
                }
            },
            "created_at": now,
            "last_activity": now,
        }
        rooms[code] = room
        join_room(code)
        emit_room_state(room)
        return {"ok": True, "roomCode": code, "token": token, "symbol": "X"}


@socketio.on("join_game")
def join_game(data: Any = None):
    payload = data if isinstance(data, dict) else {}
    code = str(payload.get("roomCode", "")).strip().upper()
    token = payload.get("token")

    with rooms_lock:
        cleanup_expired_rooms()
        room = rooms.get(code)
        if not room:
            return error("Sala não encontrada ou expirada.", "ROOM_NOT_FOUND")

        reconnect_symbol = next(
            (symbol for symbol, player in room["players"].items() if token and secrets.compare_digest(player["token"], str(token))),
            None,
        )

        if reconnect_symbol:
            symbol = reconnect_symbol
            player = room["players"][symbol]
            player.update({"sid": request.sid, "connected": True})
            if payload.get("name"):
                player["name"] = sanitize_name(payload["name"], player["name"])
        elif "O" not in room["players"]:
            symbol = "O"
            token = secrets.token_urlsafe(24)
            room["players"][symbol] = {
                "name": sanitize_name(payload.get("name"), "Jogador 2"),
                "token": token,
                "sid": request.sid,
                "connected": True,
            }
        else:
            return error("Esta sala já possui dois jogadores.", "ROOM_FULL")

        room["last_activity"] = time.time()
        join_room(code)
        emit_room_state(room)
        return {"ok": True, "roomCode": code, "token": token, "symbol": symbol}


@socketio.on("play_move")
def play_move(data: Any = None):
    payload = data if isinstance(data, dict) else {}
    code = str(payload.get("roomCode", "")).strip().upper()
    index = payload.get("index")

    with rooms_lock:
        room = rooms.get(code)
        if not room:
            return error("Sala não encontrada ou expirada.", "ROOM_NOT_FOUND")

        identity = find_player_by_sid(room, request.sid)
        if not identity:
            return error("Você não pertence a esta sala.", "NOT_A_PLAYER")
        symbol, _ = identity

        if "O" not in room["players"]:
            return error("Aguardando o segundo jogador.", "WAITING_OPPONENT")
        if room["result"]["status"] != "playing":
            return error("A rodada já terminou.", "ROUND_FINISHED")
        if room["current_player"] != symbol:
            return error("Aguarde a sua vez.", "NOT_YOUR_TURN")
        if not isinstance(index, int) or isinstance(index, bool) or index < 0 or index > 8:
            return error("Posição inválida.", "INVALID_MOVE")
        if room["board"][index] is not None:
            return error("Essa casa já está ocupada.", "CELL_OCCUPIED")

        room["board"][index] = symbol
        room["result"] = evaluate_board(room["board"])
        if room["result"]["status"] == "won":
            room["scores"][symbol] += 1
        elif room["result"]["status"] == "draw":
            room["scores"]["draws"] += 1
        else:
            room["current_player"] = "O" if symbol == "X" else "X"

        room["last_activity"] = time.time()
        emit_room_state(room)
        return {"ok": True}


@socketio.on("new_round")
def new_round(data: Any = None):
    payload = data if isinstance(data, dict) else {}
    code = str(payload.get("roomCode", "")).strip().upper()

    with rooms_lock:
        room = rooms.get(code)
        if not room:
            return error("Sala não encontrada ou expirada.", "ROOM_NOT_FOUND")
        if not find_player_by_sid(room, request.sid):
            return error("Você não pertence a esta sala.", "NOT_A_PLAYER")
        if room["result"]["status"] == "playing" and any(room["board"]):
            return error("A rodada atual ainda não terminou.", "ROUND_IN_PROGRESS")
        if "O" not in room["players"]:
            return error("Aguardando o segundo jogador.", "WAITING_OPPONENT")

        room["starter"] = "O" if room["starter"] == "X" else "X"
        room["current_player"] = room["starter"]
        room["board"] = [None] * 9
        room["result"] = {"status": "playing", "winner": None, "line": []}
        room["round_number"] += 1
        room["last_activity"] = time.time()
        emit_room_state(room)
        return {"ok": True}


@socketio.on("leave_game")
def leave_game_event(data: Any = None):
    payload = data if isinstance(data, dict) else {}
    code = str(payload.get("roomCode", "")).strip().upper()
    with rooms_lock:
        room = rooms.get(code)
        if not room:
            return {"ok": True}
        identity = find_player_by_sid(room, request.sid)
        if identity:
            _, player = identity
            player.update({"connected": False, "sid": None})
            room["last_activity"] = time.time()
            leave_room(code)
            emit_room_state(room)
        return {"ok": True}


@socketio.on("disconnect")
def disconnected():
    with rooms_lock:
        for room in rooms.values():
            identity = find_player_by_sid(room, request.sid)
            if identity:
                _, player = identity
                player.update({"connected": False, "sid": None})
                room["last_activity"] = time.time()
                emit_room_state(room)
                break


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    port = int(os.environ.get("PORT", "5000"))
    socketio.run(app, host="0.0.0.0", port=port, debug=debug, allow_unsafe_werkzeug=debug)
