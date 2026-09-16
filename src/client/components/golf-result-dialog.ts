/** 도달/포기 시 결과와 정답 경로를 보여주는 다이얼로그. */
import { StoreElement, esc, formatTime } from "./base";
import type { GameState } from "../store";

class GolfResultDialog extends StoreElement {
  private shownFor: string | null = null;

  protected mount(): void {
    this.root.innerHTML = `
      <style>
        dialog { border: 1px solid var(--border); border-radius: 14px; padding: 0; width: min(560px, 92vw); background: var(--card); color: var(--text); }
        dialog::backdrop { background: rgba(0,0,0,.35); }
        .head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); }
        h2 { margin: 0; font-size: 17px; }
        .body { padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .stat { padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; }
        .stat .k { font-size: 12px; color: var(--muted); }
        .stat .v { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .path { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 13px; }
        .path .arrow { color: var(--muted); }
        .node { padding: 2px 8px; border-radius: 999px; background: var(--gray-bg); }
        .node.start { background: var(--blue-bg); color: var(--blue-fg); }
        .node.end { background: var(--green-bg); color: var(--green-fg); }
        .section { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
        .foot { display: flex; justify-content: flex-end; gap: 6px; padding: 10px 16px; border-top: 1px solid var(--border); }
      </style>
      <dialog>
        <div class="head"><h2 id="title"></h2><golf-badge id="badge"></golf-badge></div>
        <div class="body">
          <div class="stats">
            <div class="stat"><div class="k">이동 횟수</div><div class="v" id="moves"></div></div>
            <div class="stat"><div class="k">경과 시간</div><div class="v" id="time"></div></div>
            <div class="stat"><div class="k">목표 깊이</div><div class="v" id="depth"></div></div>
          </div>
          <div><div class="section">생성된 정답 경로</div><div class="path" id="answer"></div></div>
          <div><div class="section">내 이동 경로</div><div class="path" id="route"></div></div>
        </div>
        <div class="foot">
          <button class="btn primary" id="close">확인</button>
        </div>
      </dialog>`;
    const dialog = this.q<HTMLDialogElement>("dialog");
    this.q("#close").addEventListener("click", () => dialog.close());
  }

  protected update(state: GameState): void {
    const dialog = this.q<HTMLDialogElement>("dialog");
    if (state.phase !== "won" && state.phase !== "gaveup") {
      this.shownFor = null;
      if (dialog.open) dialog.close();
      return;
    }
    const key = `${state.phase}:${state.from}:${state.to}:${state.moves}`;
    if (this.shownFor === key) return;
    this.shownFor = key;
    const won = state.phase === "won";
    this.q("#title").textContent = won ? "목표 문서에 도달했습니다!" : "포기했습니다";
    const badge = this.q<HTMLElement>("#badge");
    badge.setAttribute("tone", won ? "green" : "red");
    badge.textContent = won ? "성공" : "포기";
    this.q("#moves").textContent = `${state.moves}회`;
    this.q("#time").textContent = formatTime(state.elapsedMs);
    this.q("#depth").textContent = `${Math.max(0, state.answerPath.length - 1)}단계`;
    this.q("#answer").innerHTML = this.renderPath(state.answerPath);
    this.q("#route").innerHTML = this.renderPath(state.route);
    if (!dialog.open) dialog.showModal();
  }

  private renderPath(path: string[]): string {
    const last = path.length - 1;
    return path
      .map((t, i) => `<span class="node ${i === 0 ? "start" : i === last ? "end" : ""}">${esc(t)}</span>`)
      .join('<span class="arrow">&rarr;</span>');
  }
}
customElements.define("golf-result-dialog", GolfResultDialog);
