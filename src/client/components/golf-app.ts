/** 루트 컴포넌트: 레이아웃을 그리고 store·frame·game을 하위 컴포넌트에 연결한다. */
import { StoreElement } from "./base";
import { GameStore, type GameState } from "../store";
import { WikiFrame } from "../frame";
import { Game } from "../game";

class GolfApp extends StoreElement {
  private game!: Game;

  constructor() {
    super();
    this.store = new GameStore();
  }

  protected mount(): void {
    this.root.innerHTML = `
      <style>
        :host { display: block; height: 100vh; min-height: 0; }
        .toast { position: fixed; top: 16px; left: 50%; z-index: 10000; transform: translateX(-50%); width: max-content; max-width: min(720px, calc(100vw - 32px)); padding: 10px 14px; border: 1px solid color-mix(in srgb, var(--orange-fg) 28%, var(--border)); border-radius: 10px; background: var(--orange-bg); color: var(--orange-fg); box-shadow: 0 8px 28px rgb(0 0 0 / 18%); font-size: 14px; font-weight: 600; line-height: 1.45; text-align: center; pointer-events: none; }
        .toast[hidden] { display: none; }
        .main { display: grid; grid-template-columns: max-content minmax(0, 1fr) 300px; gap: 12px; height: 100%; padding: 12px; min-height: 0; }
        .main[hidden] { display: none; }
        .left { display: flex; flex-direction: column; align-self: start; width: max-content; min-width: 0; }
        .left golf-card { contain: inline-size; width: 100%; height: auto; border-top: 0; border-radius: 0 0 var(--radius) var(--radius); }
        golf-card { height: 100%; }
        @media (max-width: 1100px) { .main { grid-template-columns: max-content minmax(0, 1fr) 260px; } }
        @media (max-width: 900px) {
          :host { height: auto; }
          .main { grid-template-columns: 1fr; height: auto; padding: 4px; gap: 4px; }
          .left { position: sticky; z-index: 50; top: 4px; width: 100%; }
          .left golf-card { contain: none; }
          golf-card.center { height: 70vh; }
        }
      </style>
      <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
      <div class="main">
        <div class="left">
          <golf-topbar></golf-topbar>
          <golf-card><golf-controls></golf-controls></golf-card>
        </div>
        <golf-card class="center" flush><golf-wiki-frame><golf-start-panel slot="overlay"></golf-start-panel></golf-wiki-frame></golf-card>
        <golf-card><golf-status></golf-status></golf-card>
      </div>
      <golf-result-dialog></golf-result-dialog>`;

    const frameEl = this.q<HTMLElement & { iframe: HTMLIFrameElement }>("golf-wiki-frame");
    const children = this.root.querySelectorAll<StoreElement>("golf-topbar, golf-controls, golf-start-panel, golf-wiki-frame, golf-status, golf-result-dialog");
    children.forEach((c) => (c.store = this.store));
    const frame = new WikiFrame(frameEl.iframe);
    this.game = new Game(this.store, frame);
    frameEl.addEventListener("retry-verification", () => frame.retry());
    frameEl.addEventListener("cancel-game", () => this.game.cancel());
    for (const tag of ["golf-controls", "golf-start-panel"]) {
      this.q<StoreElement & { game: Game }>(tag).game = this.game;
    }
  }

  protected update(state: GameState): void {
    const toast = this.q<HTMLElement>("#toast");
    toast.textContent = state.notice ?? "";
    toast.hidden = !state.notice;
  }
}
customElements.define("golf-app", GolfApp);
