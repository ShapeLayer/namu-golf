/** 컴포넌트 공용 유틸리티와 공통 스타일시트. */
import type { GameStore } from "../store";

export function esc(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function pluralMoves(n: number): string {
  return `${n}회`;
}

const shared = new CSSStyleSheet();
shared.replaceSync(`
  :host { box-sizing: border-box; font-family: inherit; color: var(--text); }
  *, *::before, *::after { box-sizing: inherit; }
  button { font: inherit; color: inherit; cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .5; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--card); font-size: 13px; font-weight: 600; line-height: 1.2;
    transition: background .12s, border-color .12s;
  }
  .btn:hover:not(:disabled) { background: var(--hover); }
  .btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
  .btn.primary:hover:not(:disabled) { background: var(--primary-hover); }
  .btn.danger { color: var(--red-fg); border-color: var(--red-border); }
  .btn.danger:hover:not(:disabled) { background: var(--red-bg); }
  .btn.block { width: 100%; }
  .muted { color: var(--muted); }
  .label { font-size: 12px; color: var(--muted); }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`);

/** store 프로퍼티를 받아 구독하는 컴포넌트의 공통 부모. */
export abstract class StoreElement extends HTMLElement {
  private unsubscribe: (() => void) | null = null;
  private storeValue: GameStore | null = null;
  private mounted = false;
  protected root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.root.adoptedStyleSheets = [shared];
  }

  set store(store: GameStore) {
    this.storeValue = store;
    if (this.mounted) this.bind();
  }
  get store(): GameStore {
    if (!this.storeValue) throw new Error(`${this.tagName}: store가 설정되지 않았습니다.`);
    return this.storeValue;
  }

  connectedCallback(): void {
    if (!this.mounted) {
      this.mounted = true;
      this.mount();
    }
    this.bind();
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private bind(): void {
    if (!this.storeValue || this.unsubscribe) return;
    this.unsubscribe = this.storeValue.subscribe((state) => this.update(state));
  }

  /** 최초 렌더링(한 번). */
  protected abstract mount(): void;
  /** 상태 변화마다 호출. */
  protected abstract update(state: GameStore["state"]): void;

  protected q<T extends Element>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) throw new Error(`${this.tagName}: ${selector} 없음`);
    return el;
  }
}
