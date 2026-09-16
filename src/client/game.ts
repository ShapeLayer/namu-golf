/** 게임 엔진: 문제 생성(랜덤 워크), 이동 판정, 타이머. */
import type { BridgeEvent, ChallengePayload } from "../shared/protocol";
import { docHref, docTitleFromPath, isPlayableTitle, isSameDocumentFragment } from "../shared/wiki";
import { NavigationCancelledError, type WikiFrame } from "./frame";
import { depthOf, type GameStore } from "./store";

const MAX_WALK_OPS = 80;
const MAX_START_ATTEMPTS = 5;
const INVALID_LINK_NOTICE = "이 페이지는 본문의 내부 링크가 아닙니다. +2 (이동 시도 +1, 뒤로가기 +1)";

function pick<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

export class Game {
  private timer: number | null = null;
  private startedAt = 0;
  private pausedAt: number | null = null;
  private generation = 0;
  /** 되돌리기(history.back) 중이면 다음 nav 이벤트를 이동으로 세지 않는다. */
  private reverting = false;
  private lastPushAt = 0;
  private noticeTimer: number | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly frame: WikiFrame,
  ) {
    frame.addEventListener("challenge", (event) => {
      const active = (event as CustomEvent<boolean>).detail;
      if (active && this.store.state.phase === "playing") this.pausedAt = performance.now();
      if (!active && this.pausedAt !== null) {
        this.startedAt += performance.now() - this.pausedAt;
        this.pausedAt = null;
      }
      this.store.set({ challenge: active });
    });
    frame.addEventListener("bridge", (e) => this.onBridge((e as CustomEvent<BridgeEvent>).detail));
  }

  async newGame(): Promise<void> {
    const gen = ++this.generation;
    const depth = depthOf(this.store.state);
    this.stopTimer();
    this.frame.cancel();
    this.pausedAt = null;
    this.store.set({
      phase: "generating",
      from: null,
      to: null,
      answerPath: [],
      current: null,
      moves: 0,
      elapsedMs: 0,
      route: [],
      error: null,
      notice: null,
    });
    try {
      const path = await this.generatePath(depth, gen);
      if (gen !== this.generation) return;
      const from = path[0]!;
      const to = path[path.length - 1]!;
      const afterLoad = this.frame.go(docHref(from));
      await this.frame.waitForDoc({ pathname: docHref(from), afterLoad });
      if (gen !== this.generation) return;
      this.startedAt = performance.now();
      this.store.set({ phase: "playing", from, to, answerPath: path, current: from, route: [from], moves: 0, elapsedMs: 0 });
      this.timer = window.setInterval(() => this.store.set({ elapsedMs: (this.pausedAt ?? performance.now()) - this.startedAt }), 200);
    } catch (err) {
      if (gen !== this.generation) return;
      this.store.set({ phase: "idle", error: err instanceof Error ? err.message : String(err) });
    }
  }

  /** 빠른 서버 생성을 우선하고, upstream 제한 등이 있으면 기존 iframe 생성으로 폴백한다. */
  private async generatePath(depth: number, gen: number): Promise<string[]> {
    try {
      const response = await fetch(`/__golf/challenge?depth=${depth}`, { signal: AbortSignal.timeout(45_000) });
      if (!response.ok) throw new Error(`서버 문제 생성 실패 (${response.status})`);
      const challenge = await response.json() as ChallengePayload;
      if (challenge.answerPath.length !== depth + 1 || challenge.from !== challenge.answerPath[0] || challenge.to !== challenge.answerPath.at(-1)) {
        throw new Error("잘못된 문제 응답입니다.");
      }
      if (gen !== this.generation) throw new Error("취소되었습니다.");
      return challenge.answerPath;
    } catch (error) {
      if (gen !== this.generation) throw error;
      console.warn("[namu-golf] 서버 문제 생성 실패, iframe 방식으로 전환합니다.", error);
      return this.walk(depth, gen);
    }
  }

  /** RandomPage에서 시작 문서를 뽑고, 본문 링크를 따라 depth단계 내려간 경로를 돌려준다. */
  private async walk(depth: number, gen: number): Promise<string[]> {
    const assertAlive = (): void => {
      if (gen !== this.generation) throw new Error("취소되었습니다.");
    };
    for (let attempt = 0; attempt < MAX_START_ATTEMPTS; attempt++) {
      assertAlive();
      const afterLoad = this.frame.go("/RandomPage");
      await this.frame.waitForDoc({ pathname: "/RandomPage", afterLoad });
      const candidates = this.links();
      const path: string[] = [];
      const visited = new Set<string>();
      for (const start of candidates.sort(() => Math.random() - 0.5).slice(0, 3)) {
        assertAlive();
        const resolved = await this.navigateTo(start);
        assertAlive();
        if (resolved && isPlayableTitle(resolved)) {
          path.push(resolved);
          visited.add(resolved);
          break;
        }
      }
      if (path.length === 0) continue;

      const deadEnds = new Set<string>();
      let ops = 0;
      while (path.length < depth + 1 && ops < MAX_WALK_OPS) {
        assertAlive();
        ops++;
        const current = path[path.length - 1]!;
        const options = this.links().filter((t) => !visited.has(t) && !deadEnds.has(t));
        const next = pick(options);
        if (!next) {
          deadEnds.add(path.pop()!);
          if (path.length === 0) break;
          await this.returnTo(path[path.length - 1]!);
          continue;
        }
        const resolved = await this.navigateTo(next);
        assertAlive();
        if (!resolved || visited.has(resolved) || !isPlayableTitle(resolved)) {
          deadEnds.add(next);
          if (resolved) deadEnds.add(resolved);
          await this.returnTo(current);
          continue;
        }
        visited.add(resolved);
        path.push(resolved);
      }
      if (path.length === depth + 1) return path;
    }
    throw new Error("문제를 만들지 못했습니다. 다시 시도해 주세요.");
  }

  private links(): string[] {
    return this.frame.collectLinks();
  }

  /** 전체 문서 로드로 이동하고, 리다이렉트까지 반영된 최종 제목을 돌려준다. */
  private async navigateTo(title: string): Promise<string | null> {
    const before = this.frame.pageInfo()?.pathname;
    // 배포 환경에서는 NamuWiki SPA가 합성 anchor.click()을 가로챈 뒤 실제
    // 이동을 완료하지 않아도 브리지의 clickLink()가 true를 반환할 수 있다.
    // 문제 생성은 결정적인 전체 로드를 사용하고 새 load 세대까지 확인한다.
    const afterLoad = this.frame.go(docHref(title));
    try {
      const info = await this.frame.waitForDoc({ leavePathname: before, afterLoad, timeoutMs: 15000 });
      return docTitleFromPath(info.pathname);
    } catch (error) {
      if (error instanceof NavigationCancelledError) throw error;
      return null;
    }
  }

  private async returnTo(title: string): Promise<void> {
    const href = docHref(title);
    this.frame.back();
    try {
      await this.frame.waitForDoc({ pathname: href, timeoutMs: 6000 });
    } catch (error) {
      if (error instanceof NavigationCancelledError) throw error;
      const afterLoad = this.frame.go(href);
      await this.frame.waitForDoc({ pathname: href, afterLoad });
    }
  }

  private onBridge(event: BridgeEvent): void {
    if (event.type === "blocked") {
      if (this.store.state.phase === "playing") {
        // 브리지보다 먼저 등록된 사이트 핸들러 등에서 같은 문서의 바로가기가
        // blocked로 전달되더라도 실제 문서 이동이 아니므로 점수에 반영하지 않는다.
        const currentHref = this.frame.pageInfo()?.href;
        if (event.reason === "outside-content" && currentHref && isSameDocumentFragment(event.href, currentHref)) return;
        const reasons: Record<typeof event.reason, string> = {
          external: "외부 링크는 이용할 수 없습니다.",
          namespace: "분류·틀 등 특수 문서로는 이동할 수 없습니다.",
          "not-doc": "문서 본문 링크만 이용할 수 있습니다.",
          "outside-content": INVALID_LINK_NOTICE,
          form: "검색은 이용할 수 없습니다.",
          popup: "새 창 열기는 차단됩니다.",
        };
        if (event.reason === "outside-content") {
          this.store.set({ moves: this.store.state.moves + 2 });
        }
        this.notify(reasons[event.reason]);
      }
      return;
    }
    if (this.store.state.phase !== "playing" || this.store.state.challenge) return;
    const url = new URL(event.href);
    const title = docTitleFromPath(url.pathname);
    const { current, to, moves, route } = this.store.state;

    if (this.reverting) {
      this.reverting = false;
      if (title && isPlayableTitle(title)) this.store.set({ current: title });
      return;
    }
    if (!title || !isPlayableTitle(title)) {
      this.reverting = true;
      this.store.set({ moves: moves + 2 });
      this.notify(INVALID_LINK_NOTICE);
      this.frame.back();
      return;
    }
    if (title === current) return;

    const now = performance.now();
    if (event.kind === "replace" && now - this.lastPushAt < 1500) {
      // 리다이렉트: 이동 횟수는 그대로 두고 현재 문서만 갱신한다.
      this.store.set({ current: title, route: [...route.slice(0, -1), title] });
    } else {
      if (event.kind === "push" || event.kind === "load") this.lastPushAt = now;
      this.store.set({ current: title, moves: moves + 1, route: [...route, title] });
    }
    if (title === to) this.finish("won");
  }

  goBack(): void {
    if (this.store.state.challenge || this.store.state.phase !== "playing" || this.store.state.route.length < 2) return;
    this.frame.back();
  }

  giveUp(): void {
    if (this.store.state.challenge || this.store.state.phase !== "playing") return;
    this.finish("gaveup");
  }

  cancel(): void {
    this.generation++;
    this.stopTimer();
    this.frame.cancel();
    this.pausedAt = null;
    this.store.set({ phase: "idle", challenge: false });
  }

  private finish(result: "won" | "gaveup"): void {
    this.stopTimer();
    const elapsedMs = performance.now() - this.startedAt;
    this.store.set({ phase: result, elapsedMs });
  }

  private notify(message: string): void {
    this.store.set({ notice: message });
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => this.store.set({ notice: null }), 2500);
  }

  private stopTimer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
