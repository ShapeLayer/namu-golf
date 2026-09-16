/** namu.wiki 문서 경로/제목 관련 규칙. 서버, 브리지, 클라이언트가 공유한다. */

/** 게임에서 이동이 금지되는 네임스페이스(제목이 `이름:`으로 시작하는 문서). */
export const FORBIDDEN_NAMESPACES: readonly string[] = [
  "분류", "틀", "파일", "사용자", "특수기능", "나무위키", "토론", "휴지통", "투표",
  "파일휴지통", "위키운영", "템플릿", "시스템", "특정판", "삭제된사용자", "아이피사용자", "편집필터",
];

/** `/w/<제목>` 경로에서 디코딩된 제목을 돌려준다. 문서 경로가 아니면 null. */
export function docTitleFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/w/")) return null;
  const raw = pathname.slice(3);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 특수 네임스페이스가 아닌 일반 문서인지. */
export function isPlayableTitle(title: string): boolean {
  const idx = title.indexOf(":");
  if (idx <= 0) return true;
  const ns = title.slice(0, idx).trim();
  return !FORBIDDEN_NAMESPACES.includes(ns);
}

/** 제목을 namu.wiki 스타일의 `/w/...` 경로로 인코딩한다. `/`와 `:`는 그대로 둔다. */
export function docHref(title: string): string {
  return "/w/" + encodeURIComponent(title).replace(/%2F/gi, "/").replace(/%3A/gi, ":");
}

/** `#` 조각만 지정해 현재 문서 안에서 이동하는 링크인지. 빈 조각(`href="#"`)도 포함한다. */
export function isSameDocumentFragment(href: string, base: string): boolean {
  if (!href.includes("#")) return false;
  try {
    const target = new URL(href, base);
    const current = new URL(base);
    return target.origin === current.origin &&
      target.pathname === current.pathname &&
      target.search === current.search;
  } catch {
    return false;
  }
}

/** 같은 출처의 `/w/` 일반 문서 링크면 제목을, 아니면 null을 돌려준다. */
export function playableTitleFromHref(href: string, base: string): string | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.origin !== new URL(base).origin) return null;
  const title = docTitleFromPath(url.pathname);
  if (!title || !isPlayableTitle(title)) return null;
  return title;
}
