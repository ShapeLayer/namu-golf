/**
 * 프록시가 모든 namu.wiki HTML에 주입하는 스크립트.
 * - 라우터(pushState/replaceState/popstate) 이동을 부모 창에 알린다.
 * - 외부 링크, 특수 네임스페이스, 문서가 아닌 경로, 폼 제출, 새 창 열기를 차단한다.
 * - 부모가 직접 호출할 수 있는 동기 API(window.__namuGolf)를 노출한다.
 */
import { isChallengeDocument } from "../shared/challenge";
import { docTitleFromPath, isPlayableTitle } from "../shared/wiki";
import { BRIDGE_MARK, type BlockReason, type BridgeApi, type BridgeEvent, type NavKind, type PageInfo } from "../shared/protocol";

if (window.parent !== window) install();

function install(): void {
  const send = (event: BridgeEvent): void => {
    window.parent.postMessage({ [BRIDGE_MARK]: true, ...event }, location.origin);
  };
  const nav = (kind: NavKind): void => {
    if (!isChallengeDocument(document)) send({ type: "nav", kind, href: location.href });
  };

  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);
  history.pushState = (...args: Parameters<History["pushState"]>): void => {
    originalPush(...args);
    nav("push");
  };
  history.replaceState = (...args: Parameters<History["replaceState"]>): void => {
    originalReplace(...args);
    nav("replace");
  };
  window.addEventListener("popstate", () => nav("pop"));

  window.open = (): null => {
    send({ type: "blocked", reason: "popup", href: location.href });
    return null;
  };

  const guardClick = (e: MouseEvent): void => {
    if (isChallengeDocument(document)) return;
    const target = e.target as Element | null;
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    const rawHref = anchor.getAttribute("href") ?? "";
    const block = (reason: BlockReason, href: string): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
      send({ type: "blocked", reason, href });
    };
    let url: URL;
    try {
      url = new URL(rawHref, location.href);
    } catch {
      block("not-doc", rawHref);
      return;
    }
    // 같은 문서 안의 앵커(#s-1 등)는 페이지 이동이 아니므로 자유롭게 허용한다.
    if (url.origin === location.origin && url.pathname === location.pathname && url.hash) return;
    const content = contentRoot();
    if (!content || !content.root.contains(anchor) || content.titleBlock.contains(anchor)) {
      block("outside-content", url.href);
      return;
    }
    if (url.origin !== location.origin) {
      block("external", url.href);
      return;
    }
    const title = docTitleFromPath(url.pathname);
    if (title === null) {
      block("not-doc", url.href);
      return;
    }
    if (!isPlayableTitle(title)) {
      block("namespace", url.href);
      return;
    }
    if (anchor.target && anchor.target !== "_self") anchor.target = "_self";
    // 새 탭/창으로 열리는 클릭은 같은 프레임 안의 전체 이동으로 바꾼다.
    if (e.type === "auxclick" || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === "auxclick" && e.button !== 1) return;
      location.assign(url.href);
    }
  };
  document.addEventListener("click", guardClick, true);
  document.addEventListener("auxclick", guardClick, true);
  document.addEventListener(
    "submit",
    (e) => {
      if (isChallengeDocument(document)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      send({ type: "blocked", reason: "form", href: location.href });
    },
    true,
  );

  window[BRIDGE_MARK] = createApi();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => nav("load"));
  } else {
    nav("load");
  }
}

/**
 * 본문 루트. 나무위키 SPA는 클래스명이 해시라서 구조로 찾는다:
 * h1(문서 제목)에서 3단계 위 조상이 제목 블록 + 본문을 감싸고, 그 위부터 사이드바가 섞인다.
 */
function contentRoot(): { root: Element; titleBlock: Element; heading: HTMLElement } | null {
  const heading = document.querySelector("h1");
  if (!heading) return null;
  let root: Element = heading;
  let titleBlock: Element = heading;
  for (let i = 0; i < 3; i++) {
    if (!root.parentElement) break;
    root = root.parentElement;
    if (i === 1) titleBlock = root;
  }
  return { root, titleBlock, heading };
}

function docLinks(): HTMLAnchorElement[] {
  const found = contentRoot();
  if (!found) return [];
  const { root, titleBlock } = found;
  return Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="/w/"]')).filter((a) => !titleBlock.contains(a));
}

function createApi(): BridgeApi {
  return {
    pageInfo(): PageInfo {
      const found = contentRoot();
      const headingText = found?.heading.textContent?.trim() ?? "";
      return {
        href: location.href,
        pathname: location.pathname,
        heading: headingText === "" ? null : headingText,
        linkCount: docLinks().length,
      };
    },
    collectLinks(): string[] {
      const current = docTitleFromPath(location.pathname);
      const seen = new Set<string>();
      for (const a of docLinks()) {
        const title = docTitleFromPath(new URL(a.getAttribute("href") ?? "", location.href).pathname);
        if (!title || title === current || !isPlayableTitle(title)) continue;
        seen.add(title);
      }
      return Array.from(seen);
    },
    clickLink(title: string): boolean {
      for (const a of docLinks()) {
        const t = docTitleFromPath(new URL(a.getAttribute("href") ?? "", location.href).pathname);
        if (t === title) {
          a.scrollIntoView({ block: "center" });
          a.click();
          return true;
        }
      }
      return false;
    },
  };
}
