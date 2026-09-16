/** iframe 안의 프록시된 namu.wiki 페이지를 제어한다(같은 출처). */
import { isChallengeDocument } from "../shared/challenge";
import { BRIDGE_MARK, isBridgeMessage, type BridgeApi, type BridgeEvent, type PageInfo } from "../shared/protocol";
import { docTitleFromPath, isPlayableTitle } from "../shared/wiki";

export class NavigationCancelledError extends Error {
  constructor() { super("이동이 취소되었습니다."); }
}

export interface WaitOptions {
  /** 이 경로에서 벗어날 때까지 기다린다(이동 직후에 사용). */
  leavePathname?: string;
  /** 정확히 이 경로에 도착해야 한다. */
  pathname?: string;
  /** 이 load 세대보다 뒤의 전체 문서 로드를 기다린다. */
  afterLoad?: number;
  timeoutMs?: number;
}

export function isDocumentReady(info: PageInfo, stableFor: number): boolean {
  const isRandomPage = info.pathname === "/RandomPage";
  const expected = isRandomPage ? "RandomPage" : docTitleFromPath(info.pathname);
  const headingMatches = expected !== null && info.heading === expected;
  const enoughLinks = !isRandomPage || info.linkCount > 0;
  // RandomPage is the source of game candidates, so the generic stability
  // fallback must never accept it before at least one document link exists.
  return (headingMatches && enoughLinks && stableFor >= 300) ||
    (!isRandomPage && stableFor >= 2500);
}

export class WikiFrame extends EventTarget {
  private sequence = 0;
  private loadSequence = 0;
  private challenged = false;
  private resumeSince = 0;

  get challenge(): boolean { return this.challenged; }

  private checkChallenge(): void {
    try {
      const doc = this.iframe.contentDocument;
      if (!doc || doc.URL === "about:blank") return;
      if (isChallengeDocument(doc)) {
        this.resumeSince = 0;
        this.setChallenge(true);
      } else if (this.challenged) {
        // Do not treat a blank loading page or a missing widget as successful verification.
        const info = this.pageInfo();
        if (!info?.heading || !(info.pathname === "/RandomPage" || docTitleFromPath(info.pathname))) {
          this.resumeSince = 0;
          return;
        }
        if (!this.resumeSince) this.resumeSince = performance.now();
        if (performance.now() - this.resumeSince >= 500) {
          this.setChallenge(false);
          this.dispatchEvent(new CustomEvent("bridge", { detail: { type: "nav", kind: "load", href: info.href } }));
        }
      }
    } catch { /* Keep verification UI open if an external challenge cannot be inspected. */ }
  }

  private setChallenge(active: boolean): void {
    if (this.challenged === active) return;
    this.challenged = active;
    this.dispatchEvent(new CustomEvent("challenge", { detail: active }));
  }

  cancel(): void {
    this.sequence++;
    this.iframe.src = "about:blank";
    this.resumeSince = 0;
    this.setChallenge(false);
  }

  retry(): void {
    // Explicit user action only; stay paused until a real document has returned.
    this.iframe.contentWindow?.location.reload();
  }

  constructor(readonly iframe: HTMLIFrameElement) {
    super();
    this.iframe.addEventListener("load", () => {
      this.loadSequence++;
      this.checkChallenge();
    });
    window.setInterval(() => this.checkChallenge(), 250);
    window.addEventListener("message", (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== this.iframe.contentWindow || !isBridgeMessage(e.data)) return;
      this.checkChallenge();
      if (this.challenged) return;
      const { [BRIDGE_MARK]: _mark, ...event } = e.data;
      this.dispatchEvent(new CustomEvent<BridgeEvent>("bridge", { detail: event as BridgeEvent }));
    });
  }

  get api(): BridgeApi | null {
    try {
      return this.iframe.contentWindow?.[BRIDGE_MARK] ?? null;
    } catch {
      return null;
    }
  }

  private documentLinks(): string[] {
    try {
      const doc = this.iframe.contentDocument;
      const heading = doc?.querySelector("h1");
      if (!doc || !heading) return [];
      let root: Element = heading;
      let titleBlock: Element = heading;
      for (let i = 0; i < 3; i++) {
        if (!root.parentElement) break;
        root = root.parentElement;
        if (i === 1) titleBlock = root;
      }
      const current = docTitleFromPath(doc.location.pathname);
      const seen = new Set<string>();
      for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href^="/w/"]')) {
        if (titleBlock.contains(anchor)) continue;
        const title = docTitleFromPath(new URL(anchor.getAttribute("href") ?? "", doc.location.href).pathname);
        if (!title || title === current || !isPlayableTitle(title)) continue;
        seen.add(title);
      }
      return Array.from(seen);
    } catch {
      return [];
    }
  }

  collectLinks(): string[] {
    try {
      const bridged = this.api?.collectLinks() ?? [];
      if (bridged.length > 0) return bridged;
    } catch {
      // Fall back to the same-origin iframe DOM below.
    }
    return this.documentLinks();
  }

  pageInfo(): PageInfo | null {
    try {
      const bridged = this.api?.pageInfo();
      if (bridged) return bridged;
      const doc = this.iframe.contentDocument;
      if (!doc || doc.URL === "about:blank") return null;
      const heading = doc.querySelector("h1")?.textContent?.trim() || null;
      return { href: doc.location.href, pathname: doc.location.pathname, heading, linkCount: this.documentLinks().length };
    } catch {
      return null;
    }
  }

  /** 전체 페이지 로드로 이동한다. */
  go(href: string): number {
    this.sequence++;
    const afterLoad = this.loadSequence;
    // Setting src from the parent forces a real iframe navigation. Calling
    // contentWindow.location.assign() can be swallowed by the proxied
    // NamuWiki runtime without issuing a /w/... request in production.
    this.iframe.src = href;
    return afterLoad;
  }

  back(): void {
    this.iframe.contentWindow?.history.back();
  }

  /**
   * 문서가 렌더링될 때까지 폴링한다.
   * 준비 조건: 제목(h1)이 경로의 문서 제목과 일치하고, 본문 링크 수가 300ms 동안 변하지 않을 것.
   * 제목이 끝내 일치하지 않는 문서를 위해, 경로와 링크 수가 2.5초 동안 안정되면 준비된 것으로 본다.
   */
  waitForDoc(options: WaitOptions = {}): Promise<PageInfo> {
    const timeoutMs = options.timeoutMs ?? 20000;
    let remaining = timeoutMs;
    let previousTick = performance.now();
    const seq = this.sequence;
    return new Promise((resolve, reject) => {
      let last: PageInfo | null = null;
      let stableSince = 0;
      const tick = (): void => {
        if (seq !== this.sequence) return reject(new NavigationCancelledError());
        const now = performance.now();
        this.checkChallenge();
        const delta = now - previousTick;
        previousTick = now;
        if (this.challenged) {
          last = null;
          return void setTimeout(tick, 100);
        }
        remaining -= delta;
        if (remaining <= 0) return reject(new Error("문서 로딩 시간이 초과되었습니다."));
        const info = this.pageInfo();
        if (
          (options.afterLoad !== undefined && this.loadSequence <= options.afterLoad) ||
          !info ||
          !info.heading ||
          (options.leavePathname !== undefined && info.pathname === options.leavePathname) ||
          (options.pathname !== undefined && info.pathname !== options.pathname)
        ) {
          last = null;
          return void setTimeout(tick, 100);
        }
        if (!last || last.pathname !== info.pathname || last.linkCount !== info.linkCount || last.heading !== info.heading) {
          last = info;
          stableSince = now;
          return void setTimeout(tick, 100);
        }
        const stableFor = now - stableSince;
        if (isDocumentReady(info, stableFor)) return resolve(info);
        setTimeout(tick, 100);
      };
      tick();
    });
  }
}
