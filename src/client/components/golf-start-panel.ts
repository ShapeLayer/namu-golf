/** 가운데 시작 패널: 게임이 진행 중이 아닐 때 난이도를 고르고 시작한다. 생성 중에는 진행 표시와 취소만 보여준다. */
import { StoreElement, esc } from "./base";
import { DIFFICULTIES, type DifficultyKey, type GameState } from "../store";
import type { Game } from "../game";

class GolfStartPanel extends StoreElement {
  game!: Game;

  protected mount(): void {
    const chips = (Object.keys(DIFFICULTIES) as (keyof typeof DIFFICULTIES)[])
      .map((k) => `<button class="chip" data-key="${k}">${esc(DIFFICULTIES[k].label)}</button>`)
      .join("");
    this.root.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; max-width: 420px; }
        .title { font-size: 18px; font-weight: 700; }
        .sub { font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0; }
        .label { align-self: stretch; text-align: left; }
        .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
        .chip { padding: 6px 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--card); font-size: 13px; font-weight: 600; }
        .chip.active { border-color: var(--primary); background: var(--blue-bg); color: var(--blue-fg); }
        .custom { display: none; align-items: center; gap: 8px; font-size: 13px; }
        .custom.show { display: flex; }
        input[type=number] { width: 64px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 8px; font: inherit; background: var(--card); color: inherit; }
        .btn.wide { padding: 8px 28px; font-size: 14px; }
        .error { font-size: 12px; color: var(--red-fg); background: var(--red-bg); padding: 6px 10px; border-radius: 8px; }
        .error:empty { display: none; }
        .spinner { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        [hidden] { display: none !important; }
      </style>
      <div id="pick">
        <div class="title" id="title"></div>
        <p class="sub" id="sub"></p>
        <div class="chips">${chips}<button class="chip" data-key="custom">직접</button></div>
        <label class="custom">Targeted Depth <input type="number" min="1" max="30" step="1" /></label>
        <div class="error" id="error"></div>
        <button class="btn primary wide" id="new">새 게임</button>
      </div>
      <div id="busy" hidden>
        <div class="spinner"></div>
        <div class="title">문제 생성 중</div>
        <p class="sub">시작 문서와 목표 문서를 정하고 있습니다. 잠시 기다려 주세요.</p>
        <button class="btn" id="cancel">취소</button>
      </div>`;
    for (const id of ["pick", "busy"]) {
      const el = this.q<HTMLElement>(`#${id}`);
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.alignItems = "center";
      el.style.gap = "14px";
    }
    this.root.querySelectorAll<HTMLButtonElement>(".chip").forEach((b) =>
      b.addEventListener("click", () => this.store.set({ difficulty: b.dataset["key"] as DifficultyKey })),
    );
    const input = this.q<HTMLInputElement>("input[type=number]");
    input.addEventListener("change", () => {
      const v = Math.min(30, Math.max(1, Math.round(Number(input.value) || 1)));
      input.value = String(v);
      this.store.set({ customDepth: v });
    });
    this.q("#new").addEventListener("click", () => void this.game.newGame());
    this.q("#cancel").addEventListener("click", () => this.game.cancel());
  }

  protected update(state: GameState): void {
    const busy = state.phase === "generating";
    this.q<HTMLElement>("#pick").hidden = busy;
    this.q<HTMLElement>("#busy").hidden = !busy;
    this.root.querySelectorAll<HTMLButtonElement>(".chip").forEach((b) => b.classList.toggle("active", b.dataset["key"] === state.difficulty));
    this.q<HTMLElement>(".custom").classList.toggle("show", state.difficulty === "custom");
    const input = this.q<HTMLInputElement>("input[type=number]");
    if (this.root.activeElement !== input) input.value = String(state.customDepth);
    this.q("#error").textContent = state.error ?? "";
    const titles: Record<GameState["phase"], [string, string]> = {
      idle: ["난이도를 고르고 시작하세요", ""],
      won: ["목표 문서에 도달했습니다", "다음 판의 난이도를 고르세요."],
      gaveup: ["포기했습니다", "다음 판의 난이도를 고르세요."],
      generating: ["", ""],
      playing: ["", ""],
    };
    const [title, sub] = titles[state.phase];
    this.q("#title").textContent = title;
    this.q("#sub").textContent = sub;
  }
}
customElements.define("golf-start-panel", GolfStartPanel);
