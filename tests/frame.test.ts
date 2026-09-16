import { afterEach, beforeEach, expect, test } from "bun:test";
import { isDocumentReady, NavigationCancelledError, WikiFrame } from "../src/client/frame";

const originalWindow = globalThis.window;
beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), { setInterval: () => 0 }) as unknown as Window & typeof globalThis;
});
afterEach(() => { globalThis.window = originalWindow; });

function fixture() {
  let blocked = true;
  let heading = "문서";
  let assigned = false;
  const doc = {
    URL: "http://localhost/w/문서", title: "나무위키", body: { innerText: "" },
    querySelectorAll: () => [],
    querySelector: (selector: string) => selector === "h1" ? { textContent: blocked ? "부적절한 요청" : heading } : {},
  } as unknown as Document;
  const iframe = Object.assign(new EventTarget(), {
    src: "http://localhost/w/문서", contentDocument: doc,
    contentWindow: {
      location: { href: doc.URL, assign: () => { assigned = true; } },
      __namuGolf: { pageInfo: () => ({ href: doc.URL, pathname: "/w/문서", heading: blocked ? "부적절한 요청" : heading, linkCount: 1 }) },
    },
  }) as unknown as HTMLIFrameElement;
  const frame = new WikiFrame(iframe);
  return { frame, iframe, wasAssigned: () => assigned, unblock: () => { blocked = false; }, blank: () => { blocked = false; heading = ""; } };
}

test("RandomPage never becomes ready before document links appear", () => {
  const empty = { href: "http://localhost/RandomPage", pathname: "/RandomPage", heading: "RandomPage", linkCount: 0 };
  expect(isDocumentReady(empty, 10_000)).toBe(false);
  expect(isDocumentReady({ ...empty, linkCount: 1 }, 299)).toBe(false);
  expect(isDocumentReady({ ...empty, linkCount: 1 }, 300)).toBe(true);
});

test("ordinary documents retain the stability fallback", () => {
  const info = { href: "http://localhost/w/문서", pathname: "/w/문서", heading: "hydrating", linkCount: 0 };
  expect(isDocumentReady(info, 2499)).toBe(false);
  expect(isDocumentReady(info, 2500)).toBe(true);
});

test("link collection falls back to the same-origin iframe DOM", () => {
  const anchor = { getAttribute: () => "/w/다음%20문서" } as unknown as HTMLAnchorElement;
  const article = { parentElement: null, querySelectorAll: () => [anchor] } as unknown as Element;
  const titleContainer = { parentElement: article, contains: () => false } as unknown as Element;
  const headingContainer = { parentElement: titleContainer } as unknown as Element;
  const heading = { parentElement: headingContainer } as unknown as HTMLElement;
  const doc = {
    URL: "http://localhost/w/현재",
    location: { href: "http://localhost/w/현재", pathname: "/w/현재" },
    querySelector: (selector: string) => selector === "h1" ? heading : null,
  } as unknown as Document;
  const iframe = Object.assign(new EventTarget(), {
    contentDocument: doc,
    contentWindow: { __namuGolf: { collectLinks: () => [] } },
  }) as unknown as HTMLIFrameElement;

  expect(new WikiFrame(iframe).collectLinks()).toEqual(["다음 문서"]);
});

test("verification time is excluded from document timeout; resumes only after a document returns", async () => {
  const f = fixture();
  const states: boolean[] = [];
  f.frame.addEventListener("challenge", e => states.push((e as CustomEvent<boolean>).detail));
  const result = f.frame.waitForDoc({ timeoutMs: 650 });
  await Bun.sleep(800);
  expect(f.frame.challenge).toBe(true);
  f.blank();
  await Bun.sleep(300);
  expect(f.frame.challenge).toBe(true);
  // Return a normal heading, keeping the same document URL.
  Object.defineProperty(f.iframe.contentWindow!.__namuGolf!, "pageInfo", { value: () => ({ href: "http://localhost/w/문서", pathname: "/w/문서", heading: "문서", linkCount: 1 }) });
  const info = await result;
  expect(info.heading).toBe("문서");
  expect(states).toEqual([true, false]);
});

test("cancel interrupts a verification wait and clears the frame", async () => {
  const f = fixture();
  const result = f.frame.waitForDoc({ timeoutMs: 500 });
  f.frame.cancel();
  await expect(result).rejects.toBeInstanceOf(NavigationCancelledError);
  expect(f.frame.challenge).toBe(false);
  expect(f.iframe.src).toBe("about:blank");
});

test("same-path navigation waits for a new iframe load", async () => {
  const f = fixture();
  f.unblock();
  const afterLoad = f.frame.go("/w/문서");
  expect(f.iframe.src).toBe("/w/문서");
  expect(f.wasAssigned()).toBe(false);
  let settled = false;
  const result = f.frame.waitForDoc({ pathname: "/w/문서", afterLoad, timeoutMs: 1000 }).then((info) => {
    settled = true;
    return info;
  });
  await Bun.sleep(400);
  expect(settled).toBe(false);
  f.iframe.dispatchEvent(new Event("load"));
  expect((await result).pathname).toBe("/w/문서");
});
