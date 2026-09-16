import { expect, test } from "bun:test";
import { isChallengeDocument } from "../src/shared/challenge";
function page({ title = "나무위키", heading = "일반 문서", text = "", links = true, widget = false, hidden = false } = {}): Document {
  return {
    title, body: { innerText: text },
    defaultView: { getComputedStyle: () => ({ display: hidden ? "none" : "block", visibility: "visible" }) },
    querySelectorAll: () => widget ? [{ getClientRects: () => hidden ? [] : [{}] }] : [],
    querySelector: (selector: string) => selector === "h1" ? { textContent: heading } : links ? {} : null,
  } as unknown as Document;
}
test("rendered challenge title or visible CAPTCHA triggers verification", () => {
  expect(isChallengeDocument(page({ heading: "부적절한 요청" }))).toBe(true);
  expect(isChallengeDocument(page({ title: "Just a moment..." }))).toBe(true);
  expect(isChallengeDocument(page({ widget: true }))).toBe(true);
  expect(isChallengeDocument(page({ heading: "", links: false, text: "사람인지 확인해 주세요" }))).toBe(true);
});
test("ordinary CAPTCHA article, footer mention and hidden widget do not pause game", () => {
  expect(isChallengeDocument(page({ heading: "reCAPTCHA", text: "부적절한 요청을 방지합니다." }))).toBe(false);
  expect(isChallengeDocument(page({ text: "This site is protected by reCAPTCHA", widget: true, hidden: true }))).toBe(false);
});
