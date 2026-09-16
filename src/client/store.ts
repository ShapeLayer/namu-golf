/** 게임 상태와 단순한 구독형 저장소. */

export type Phase = "idle" | "generating" | "playing" | "won" | "gaveup";
export type DifficultyKey = "easy" | "normal" | "hard" | "custom";

export const DIFFICULTIES: Record<Exclude<DifficultyKey, "custom">, { label: string; depth: number }> = {
  easy: { label: "쉬움", depth: 5 },
  normal: { label: "기본", depth: 7 },
  hard: { label: "어려움", depth: 10 },
};

export interface GameState {
  phase: Phase;
  challenge: boolean;
  difficulty: DifficultyKey;
  customDepth: number;
  from: string | null;
  to: string | null;
  answerPath: string[];
  current: string | null;
  moves: number;
  elapsedMs: number;
  route: string[];
  error: string | null;
  notice: string | null;
}

export function depthOf(state: Pick<GameState, "difficulty" | "customDepth">): number {
  return state.difficulty === "custom" ? state.customDepth : DIFFICULTIES[state.difficulty].depth;
}

const SETTINGS_KEY = "namu-golf.settings";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as object) } as T : fallback;
  } catch {
    return fallback;
  }
}

export class GameStore extends EventTarget {
  state: GameState;

  constructor() {
    super();
    const settings = load<{ difficulty: DifficultyKey; customDepth: number }>(SETTINGS_KEY, { difficulty: "normal", customDepth: 7 });
    this.state = {
      phase: "idle",
      challenge: false,
      difficulty: settings.difficulty,
      customDepth: settings.customDepth,
      from: null,
      to: null,
      answerPath: [],
      current: null,
      moves: 0,
      elapsedMs: 0,
      route: [],
      error: null,
      notice: null,
    };
  }

  set(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch };
    if ("difficulty" in patch || "customDepth" in patch) {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ difficulty: this.state.difficulty, customDepth: this.state.customDepth }));
      } catch {
        /* 저장 실패는 무시 */
      }
    }
    this.dispatchEvent(new CustomEvent("change"));
  }

  subscribe(fn: (state: GameState) => void): () => void {
    const handler = (): void => fn(this.state);
    this.addEventListener("change", handler);
    fn(this.state);
    return () => this.removeEventListener("change", handler);
  }
}
