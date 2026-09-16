import { expect, test } from "bun:test";
import { Game } from "../src/client/game";
import type { WikiFrame } from "../src/client/frame";
import type { GameStore } from "../src/client/store";

test("generated path navigation uses a full load instead of a synthetic SPA click", async () => {
  const destinations: string[] = [];
  const waitOptions: unknown[] = [];
  const frame = Object.assign(new EventTarget(), {
    api: { clickLink: () => { throw new Error("synthetic click must not be used"); } },
    pageInfo: () => ({ href: "http://localhost/RandomPage", pathname: "/RandomPage", heading: "RandomPage", linkCount: 1 }),
    go: (href: string) => {
      destinations.push(href);
      return 7;
    },
    waitForDoc: async (options: unknown) => {
      waitOptions.push(options);
      return { href: "http://localhost/w/목표", pathname: "/w/목표", heading: "목표", linkCount: 1 };
    },
  }) as unknown as WikiFrame;
  const store = { state: { phase: "idle" }, set: () => undefined } as unknown as GameStore;
  const game = new Game(store, frame);

  const resolved = await (game as unknown as { navigateTo(title: string): Promise<string | null> }).navigateTo("목표");

  expect(destinations).toEqual(["/w/%EB%AA%A9%ED%91%9C"]);
  expect(waitOptions).toEqual([{ leavePathname: "/RandomPage", afterLoad: 7, timeoutMs: 15000 }]);
  expect(resolved).toBe("목표");
});

test("clicking a link outside document content adds two moves and stays on the current page", () => {
  const frame = Object.assign(new EventTarget(), {}) as unknown as WikiFrame;
  const state = {
    phase: "playing",
    challenge: false,
    moves: 4,
    current: "현재 문서",
    route: ["현재 문서"],
  };
  const store = {
    state,
    set(patch: Partial<typeof state>) { Object.assign(state, patch); },
  } as unknown as GameStore;
  const game = new Game(store, frame);
  (game as unknown as { notify(message: string): void }).notify = () => undefined;

  frame.dispatchEvent(new CustomEvent("bridge", {
    detail: { type: "blocked", reason: "outside-content", href: "http://localhost/w/메뉴문서" },
  }));

  expect(state.moves).toBe(6);
  expect(state.current).toBe("현재 문서");
  expect(state.route).toEqual(["현재 문서"]);
});
