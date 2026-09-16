/** 프록시된 namu.wiki 페이지(브리지)와 게임 페이지 사이의 통신 규약. */

export type NavKind = "load" | "push" | "replace" | "pop";

export type BlockReason = "external" | "namespace" | "not-doc" | "outside-content" | "form" | "popup";

export type BridgeEvent =
  | { type: "nav"; kind: NavKind; href: string }
  | { type: "blocked"; reason: BlockReason; href: string };

export interface PageInfo {
  href: string;
  pathname: string;
  /** 문서 제목(h1). 아직 렌더링되지 않았으면 null. */
  heading: string | null;
  /** 본문 영역 안의 `/w/` 링크 수. */
  linkCount: number;
}

export interface ChallengePayload {
  from: string;
  to: string;
  answerPath: string[];
}

/** 브리지가 iframe window에 노출하는 동기 API. 같은 출처이므로 부모가 직접 호출한다. */
export interface BridgeApi {
  pageInfo(): PageInfo;
  /** 본문 안의 이동 가능한 문서 제목 목록(중복 제거, 현재 문서 제외). */
  collectLinks(): string[];
  /** 본문에서 해당 제목의 링크를 찾아 클릭한다. 못 찾으면 false. */
  clickLink(title: string): boolean;
}

export const BRIDGE_MARK = "__namuGolf" as const;

export type BridgeMessage = BridgeEvent & { [BRIDGE_MARK]: true };

export function isBridgeMessage(data: unknown): data is BridgeMessage {
  return typeof data === "object" && data !== null && (data as Record<string, unknown>)[BRIDGE_MARK] === true;
}

declare global {
  interface Window {
    [BRIDGE_MARK]?: BridgeApi;
  }
}
