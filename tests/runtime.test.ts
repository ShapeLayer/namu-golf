import { expect, test } from "bun:test";
import { assertSafeBun } from "../src/server/runtime";

test("rejects vulnerable or unverified Bun releases", () => {
  for (const version of ["1.3.12", "1.4.3", "1.4.4-canary", "garbage"]) {
    expect(() => assertSafeBun(version)).toThrow("CVE-2026-111497");
  }
});
test("accepts patched stable Bun releases", () => {
  for (const version of ["1.4.4", "1.4.10", "1.5.0", "2.0.0"]) {
    expect(() => assertSafeBun(version)).not.toThrow();
  }
});
