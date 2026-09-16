import { expect, test } from "bun:test";
import { isSameDocumentFragment } from "../src/shared/wiki";

test("same-document fragment detection includes an empty hash", () => {
  const base = "http://localhost/w/%EB%AC%B8%EC%84%9C?view=1";
  expect(isSameDocumentFragment("#", base)).toBe(true);
  expect(isSameDocumentFragment("#s-1", base)).toBe(true);
  expect(isSameDocumentFragment(`${base}#`, base)).toBe(true);
});

test("fragment detection rejects a different document or query", () => {
  const base = "http://localhost/w/current?view=1";
  expect(isSameDocumentFragment("/w/next#s-1", base)).toBe(false);
  expect(isSameDocumentFragment("/w/current?view=2#s-1", base)).toBe(false);
  expect(isSameDocumentFragment("/w/current", base)).toBe(false);
});
