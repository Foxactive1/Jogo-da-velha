import random
import tkinter as tk
from tkinter import messagebox

def check_winner(board, player):
    for row in board:
        if all([cell == player for cell in row]):
            return True
    for col in range(3):
        if all([board[row][col] == player for row in range(3)]):
            return True
    if all([board[i][i] == player for i in range(3)]) or all([board[i][2 - i] == player for i in range(3)]):
        return True
    return False

def is_full(board):
    return all([cell != " " for row in board for cell in row])

def make_move(board, player, row, col):
    if board[row][col] == " ":
        board[row][col] = player
        return True
    else:
        return False

def ai_move_easy(board):
    empty_cells = [(row, col) for row in range(3) for col in range(3) if board[row][col] == " "]
    return random.choice(empty_cells)

def ai_move_hard(board, player):
    best_score = -float('inf')
    best_move = None
    for row in range(3):
        for col in range(3):
            if board[row][col] == " ":
                board[row][col] = player
                score = minimax(board, False, player)
                board[row][col] = " "
                if score > best_score:
                    best_score = score
                    best_move = (row, col)
    return best_move

def minimax(board, is_maximizing, player):
    opponent = "O" if player == "X" else "X"
    if check_winner(board, player):
        return 1
    if check_winner(board, opponent):
        return -1
    if is_full(board):
        return 0

    if is_maximizing:
        best_score = -float('inf')
        for row in range(3):
            for col in range(3):
                if board[row][col] == " ":
                    board[row][col] = player
                    score = minimax(board, False, player)
                    board[row][col] = " "
                    best_score = max(score, best_score)
        return best_score
    else:
        best_score = float('inf')
        for row in range(3):
            for col in range(3):
                if board[row][col] == " ":
                    board[row][col] = opponent
                    score = minimax(board, True, player)
                    board[row][col] = " "
                    best_score = min(score, best_score)
        return best_score

class Game:
    def __init__(self, root, difficulty):
        self.root = root
        self.root.title("Jogo da Velha")
        self.board = [[" " for _ in range(3)] for _ in range(3)]
        self.current_player = "X"
        self.difficulty = difficulty
        self.create_board_buttons()

    def create_board_buttons(self):
        self.buttons = [[None for _ in range(3)] for _ in range(3)]
        for i in range(3):
            for j in range(3):
                button = tk.Button(self.root, text=" ", font=("Arial", 16), width=5, height=2, command=lambda row=i, col=j: self.on_button_click(row, col))
                button.grid(row=i, column=j)
                self.buttons[i][j] = button

    def on_button_click(self, row, col):
        if make_move(self.board, self.current_player, row, col):
            self.buttons[row][col].config(text=self.current_player)
            if check_winner(self.board, self.current_player):
                self.show_result(f"Jogador {self.current_player} venceu!")
                return
            if is_full(self.board):
                self.show_result("Empate!")
                return
            self.switch_player()
            self.make_ai_move()

    def switch_player(self):
        self.current_player = "O" if self.current_player == "X" else "X"

    def make_ai_move(self):
        if self.current_player == "O":
            if self.difficulty == "easy":
                ai_row, ai_col = ai_move_easy(self.board)
            else:
                ai_row, ai_col = ai_move_hard(self.board, self.current_player)
            make_move(self.board, self.current_player, ai_row, ai_col)
            self.buttons[ai_row][ai_col].config(text=self.current_player)
            if check_winner(self.board, self.current_player):
                self.show_result(f"Jogador {self.current_player} venceu!")
                return
            if is_full(self.board):
                self.show_result("Empate!")
                return
            self.switch_player()

    def show_result(self, message):
        messagebox.showinfo("Fim de Jogo", message)
        self.root.quit()

def main():
    def start_game(difficulty):
        root.destroy()
        game_root = tk.Tk()
        Game(game_root, difficulty)
        game_root.mainloop()

    root = tk.Tk()
    root.title("Jogo da Velha - Seleção de Nível")
    tk.Label(root, text="Selecione o nível de dificuldade", font=("Arial", 14)).pack(pady=10)
    tk.Button(root, text="Fácil", font=("Arial", 12), command=lambda: start_game("easy")).pack(pady=5)
    tk.Button(root, text="Difícil", font=("Arial", 12), command=lambda: start_game("hard")).pack(pady=5)
    root.mainloop()

if __name__ == "__main__":
    main()
