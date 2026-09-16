/** 최소화된 상단 바: 로고, 나무위키 링크, 테마 토글. */
import { StoreElement } from "./base";
import type { GameState } from "../store";

class GolfTopbar extends StoreElement {
  private colorSchemeQuery: MediaQueryList | null = null;
  private readonly syncSystemTheme = (event: MediaQueryListEvent | MediaQueryList): void => {
    document.documentElement.dataset["theme"] = event.matches ? "dark" : "light";
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.watchSystemTheme();
  }

  protected mount(): void {
    this.root.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          gap: 12px;
          box-sizing: border-box;
          width: max-content;
          height: 38px;
          padding: 0 8px 0 10px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius) var(--radius) 0 0;
        }
        .logo { display: flex; align-items: center; gap: 7px; min-width: 0; white-space: nowrap; font-size: 18px; letter-spacing: -0.02em; }
        .logo svg { flex: 0 0 auto; width: 24px; height: 24px; }
        .spacer { flex: 1; }
        .icon { width: 32px; height: 32px; padding: 0; border: 0; border-radius: 999px; background: transparent; display: grid; place-items: center; }
        .icon:hover { background: var(--hover); }
        .icon svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; }
        a { color: var(--muted); font-size: 13px; text-decoration: none; }
        a:hover { color: var(--text); }
        @media (max-width: 900px) {
          :host { width: 100%; height: 32px; padding: 0 4px 0 6px; gap: 6px; }
          .logo { gap: 4px; font-size: 14px; }
          .logo svg { width: 19px; height: 19px; }
          .icon { width: 26px; height: 26px; }
          .icon svg { width: 16px; height: 16px; }
          a { font-size: 12px; }
        }
      </style>
      <div class="logo">
        <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="var(--green-bg)"/><path d="M14 24V7l9 4-9 4" fill="none" stroke="var(--green-fg)" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="15" cy="25" rx="7" ry="2" fill="var(--green-fg)" opacity=".5"/></svg>
        <span>namu golf</span>
      </div>
      <div class="spacer"></div>
      <a href="https://namu.wiki" target="_blank" rel="noreferrer">나무위키</a>
      <button class="icon" id="theme" title="테마 전환" aria-label="테마 전환">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>`;
    this.q<HTMLButtonElement>("#theme").addEventListener("click", () => {
      const next = document.documentElement.dataset["theme"] === "dark" ? "light" : "dark";
      document.documentElement.dataset["theme"] = next;
    });

    this.watchSystemTheme();
  }

  disconnectedCallback(): void {
    this.colorSchemeQuery?.removeEventListener("change", this.syncSystemTheme);
    this.colorSchemeQuery = null;
    super.disconnectedCallback();
  }

  private watchSystemTheme(): void {
    if (this.colorSchemeQuery) return;
    this.colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.syncSystemTheme(this.colorSchemeQuery);
    this.colorSchemeQuery.addEventListener("change", this.syncSystemTheme);
  }

  protected update(_state: GameState): void {}
}
customElements.define("golf-topbar", GolfTopbar);
