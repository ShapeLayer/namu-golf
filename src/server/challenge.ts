import { parseHTML } from "linkedom";
import { docHref, docTitleFromPath, isPlayableTitle } from "../shared/wiki";

export interface GeneratedChallenge {
  from: string;
  to: string;
  answerPath: string[];
}

interface PageLinks {
  title: string | null;
  links: string[];
}

interface FetchContext {
  cookie?: string;
  userAgent?: string;
  acceptLanguage?: string;
}

const CACHE_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 500;
const MAX_ATTEMPTS = 6;
const linkCache = new Map<string, { expiresAt: number; page: PageLinks }>();

function shuffled<T>(items: readonly T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

/** 브리지와 같은 DOM 범위를 사용해 사이드바가 아닌 문서 본문의 링크만 수집한다. */
export function extractPageLinks(html: string, pageUrl: string): PageLinks {
  const { document } = parseHTML(html);
  const heading = document.querySelector("h1");
  if (!heading) return { title: docTitleFromPath(new URL(pageUrl).pathname), links: [] };

  let root: Element = heading;
  let titleBlock: Element = heading;
  for (let i = 0; i < 3; i++) {
    if (!root.parentElement) break;
    root = root.parentElement;
    if (i === 1) titleBlock = root;
  }

  const current = docTitleFromPath(new URL(pageUrl).pathname);
  const seen = new Set<string>();
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href^="/w/"]')) {
    if (titleBlock.contains(anchor)) continue;
    let title: string | null = null;
    try {
      title = docTitleFromPath(new URL(anchor.getAttribute("href") ?? "", pageUrl).pathname);
    } catch {
      continue;
    }
    if (!title || title === current || !isPlayableTitle(title)) continue;
    seen.add(title);
  }
  return { title: current, links: Array.from(seen) };
}

async function fetchLinks(upstreamOrigin: string, pathname: string, context: FetchContext, cacheable = true): Promise<PageLinks> {
  const cached = cacheable ? linkCache.get(pathname) : undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.page;
  if (cached) linkCache.delete(pathname);

  const headers = new Headers({
    accept: "text/html,application/xhtml+xml",
    "accept-language": context.acceptLanguage ?? "ko-KR,ko;q=0.9",
    "user-agent": context.userAgent ?? "Mozilla/5.0 (namu-golf)",
  });
  if (context.cookie) headers.set("cookie", context.cookie);
  const response = await fetch(upstreamOrigin + pathname, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) {
    throw new Error(`문서 요청 실패 (${response.status})`);
  }
  const page = extractPageLinks(await response.text(), response.url || upstreamOrigin + pathname);
  if (!page.links.length) throw new Error("본문 링크를 찾지 못했습니다.");

  if (cacheable) {
    if (linkCache.size >= MAX_CACHE_ENTRIES) linkCache.delete(linkCache.keys().next().value!);
    linkCache.set(pathname, { expiresAt: Date.now() + CACHE_TTL_MS, page });
  }
  return page;
}

/** 렌더링 없이 HTML만 받아 문제 경로를 생성한다. */
export async function generateChallenge(
  upstreamOrigin: string,
  depth: number,
  context: FetchContext = {},
): Promise<GeneratedChallenge> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let random: PageLinks;
    try {
      random = await fetchLinks(upstreamOrigin, "/RandomPage", context, false);
    } catch {
      continue;
    }
    for (const candidate of shuffled(random.links).slice(0, 4)) {
      let first: PageLinks;
      try {
        first = await fetchLinks(upstreamOrigin, docHref(candidate), context);
      } catch {
        continue;
      }
      const start = first.title ?? candidate;
      if (!isPlayableTitle(start)) continue;

      const path = [start];
      const visited = new Set(path);
      let page = first;
      while (path.length < depth + 1) {
        const next = shuffled(page.links).find((title) => !visited.has(title));
        if (!next) break;
        let nextPage: PageLinks;
        try {
          nextPage = await fetchLinks(upstreamOrigin, docHref(next), context);
        } catch {
          break;
        }
        const resolved = nextPage.title ?? next;
        if (visited.has(resolved) || !isPlayableTitle(resolved)) break;
        path.push(resolved);
        visited.add(resolved);
        page = nextPage;
      }
      if (path.length === depth + 1) {
        return { from: path[0]!, to: path[path.length - 1]!, answerPath: path };
      }
    }
  }
  throw new Error("문제를 만들지 못했습니다. 다시 시도해 주세요.");
}
