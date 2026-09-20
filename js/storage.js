const SCORE_KEY = "jogo-da-velha:score:v2";
const SETTINGS_KEY = "jogo-da-velha:settings:v2";

const defaultScore = { player1: 0, player2: 0, draws: 0 };
const defaultSettings = {
  mode: "ai",
  difficulty: "hard",
  humanSymbol: "X",
  starter: "human",
  theme: "dark",
  sound: true,
  explainAi: true,
};

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" ? { ...fallback, ...value } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

export const loadScore = () => read(SCORE_KEY, defaultScore);
export const saveScore = (score) => localStorage.setItem(SCORE_KEY, JSON.stringify(score));
export const clearScore = () => localStorage.removeItem(SCORE_KEY);

export const loadSettings = () => read(SETTINGS_KEY, defaultSettings);
export const saveSettings = (settings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

export { defaultScore, defaultSettings };
