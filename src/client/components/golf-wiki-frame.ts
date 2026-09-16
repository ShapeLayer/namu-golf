/** 가운데: 프록시된 나무위키 iframe. 게임 중이 아닐 때는 오버레이(시작 패널 슬롯)로 덮는다. */
import { StoreElement } from "./base";
import type { GameState } from "../store";

class GolfWikiFrame extends StoreElement {
  get iframe(): HTMLIFrameElement {
    return this.q<HTMLIFrameElement>("iframe");
  }

  protected mount(): void {
    this.root.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; position: relative; height: 100%; }
        iframe { min-height: 0; flex: 1; display: block; width: 100%; height: 100%; border: 0; background: #fff; }
        .overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; background: color-mix(in srgb, var(--card) 85%, transparent); backdrop-filter: blur(6px); }
        .verification { padding: 14px 18px; background: var(--orange-bg, #fff4dc); color: var(--fg, #272727); border-bottom: 1px solid var(--border); font-size: 14px; line-height: 1.6; }
        .verification strong { display: block; }
        .verification p { margin: 4px 0 10px; }
        .verification[hidden] { display: none; }
        .overlay[hidden] { display: none; }
        .overlay.solid { background: var(--card); backdrop-filter: none; }
      </style>
      <section class="verification" id="verification" role="status" aria-live="polite" hidden>
        <strong>나무위키 보안 인증이 필요합니다</strong>
        <p>아래 인증 화면에서 리캡차 등 사람 확인 절차를 직접 완료해 주세요. 인증 중에는 문제 생성과 게임 시간이 일시 정지됩니다. 문서가 다시 표시되면 자동으로 이어집니다.</p>
        <details><summary>인증 화면이 안 보이거나 오류가 발생하나요?</summary>
          <p>도메인 오류 또는 반복 인증은 이 서비스에서 해결하지 못할 수 있습니다. 잠시 후 다시 시도하거나 운영자에게 알려 주세요. 나무위키를 별도 탭에서 인증해도 이 게임의 서버 연결에는 적용되지 않을 수 있습니다.</p>
        </details>
        <button class="btn" id="retry">인증 화면 새로고침</button>
        <button class="btn" id="stop">게임 취소</button>
      </section>
      <iframe title="나무위키" sandbox="allow-same-origin allow-scripts allow-forms"></iframe>
      <div class="overlay" id="overlay"><slot name="overlay"></slot></div>`;
    this.q("#retry").addEventListener("click", () => this.dispatchEvent(new CustomEvent("retry-verification")));
    this.q("#stop").addEventListener("click", () => this.dispatchEvent(new CustomEvent("cancel-game")));
  }

  protected update(state: GameState): void {
    const overlay = this.q<HTMLElement>("#overlay");
    const generating = state.phase === "generating";
    overlay.hidden = state.phase === "playing" || state.challenge;
    this.q<HTMLElement>("#verification").hidden = !state.challenge;
    // 생성 중에는 탐색 경로가 보이지 않도록 프레임을 완전히 가린다.
    overlay.classList.toggle("solid", generating || state.phase === "idle");
    this.iframe.style.visibility = generating && !state.challenge ? "hidden" : "";
  }
}
customElements.define("golf-wiki-frame", GolfWikiFrame);
