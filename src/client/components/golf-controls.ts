/** 왼쪽 패널: 목표 문서와 게임 중 조작(뒤로/포기). */
import { StoreElement } from "./base";
import type { GameState } from "../store";
import type { Game } from "../game";

class GolfControls extends StoreElement {
  game!: Game;

  protected mount(): void {
    this.root.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; gap: 14px; }
        .target { display: flex; flex-direction: column; gap: 4px; }
        .target-label { font-size: 12px; color: var(--muted); }
        .target-title { min-height: 20px; font-size: 14px; font-weight: 700; color: var(--green-fg); overflow-wrap: anywhere; }
        .actions { display: flex; flex-direction: row; gap: 6px; }
        .actions svg { width: 16px; height: 16px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .hint { font-size: 12px; color: var(--muted); line-height: 1.5; margin: 0; }
        @media (max-width: 900px) {
          :host { gap: 7px; }
          .target { gap: 2px; }
          .actions { justify-content: flex-end; gap: 4px; }
          .actions .btn { box-sizing: border-box; width: 30px; min-height: 28px; padding: 3px; }
          .actions svg { width: 16px; height: 16px; }
          .hint { font-size: 11px; line-height: 1.35; }
          .button-label { display: none; }
        }
      </style>
      <div class="target">
        <span class="target-label">목표 문서</span>
        <span class="target-title" id="target">-</span>
      </div>
      <div class="actions">
        <button class="btn" id="back" title="뒤로 (이동 횟수 +1)" aria-label="뒤로">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/><path d="M9 12h10"/></svg>
          <span class="button-label">뒤로</span>
        </button>
        <button class="btn danger" id="giveup" title="포기" aria-label="포기">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
          <span class="button-label">포기</span>
        </button>
      </div>
      <p class="hint">문서 본문의 내부 링크를 통해 목표 문서까지 이동하세요.</p>`;
    this.q("#back").addEventListener("click", () => this.game.goBack());
    this.q("#giveup").addEventListener("click", () => this.game.giveUp());
  }

  protected update(state: GameState): void {
    this.q("#target").textContent = state.to ?? "-";
    this.q<HTMLButtonElement>("#back").disabled = state.challenge || state.phase !== "playing" || state.route.length < 2;
    this.q<HTMLButtonElement>("#giveup").disabled = state.challenge || state.phase !== "playing";
  }
}
customElements.define("golf-controls", GolfControls);
