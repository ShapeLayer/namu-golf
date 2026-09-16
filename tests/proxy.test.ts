import { afterAll, expect, test } from "bun:test";
import { createHandler, rewriteCookie } from "../server";

const upstream = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
  const url = new URL(req.url);
  if (url.pathname === "/empty") return new Response(null, { status: 204 });
  if (url.pathname === "/redirect") return new Response(null, { status: 302, headers: { location: `${url.origin}/w/test?q=1#s` } });
  if (url.pathname === "/verify") return Response.json({ method: req.method, body: await req.text(), cookie: req.headers.get("cookie"), origin: req.headers.get("origin") });
  return new Response('<h1>부적절한 요청</h1><form method="post"></form>', {
    status: 429,
    headers: { "content-type": "text/html", "x-frame-options": "DENY", "content-security-policy": "frame-ancestors 'none'", "set-cookie": "verification=abc; Domain=namu.wiki; Path=/; HttpOnly; Secure; SameSite=None", "etag": "old" },
  });
} });
const handle = createHandler(upstream.url.origin);
afterAll(() => upstream.stop(true));
test("challenge status and cookie survive; bridge injected even without head; private response", async () => {
  const res = await handle(new Request("http://game.test/challenge"));
  expect(res.status).toBe(429);
  expect(res.headers.get("x-frame-options")).toBeNull();
  expect(res.headers.get("content-security-policy")).toBeNull();
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("etag")).toBeNull();
  expect(res.headers.get("set-cookie")).toContain("verification=abc");
  expect(await res.text()).toContain('/__golf/bridge.js');
});
test("production cookie keeps Secure, HttpOnly and SameSite and drops upstream Domain", () => {
  expect(rewriteCookie("v=1; Domain=.namu.wiki; Secure; HttpOnly; SameSite=None", true)).toBe("v=1; Secure; HttpOnly; SameSite=None");
});
test("verification form POST body, session cookie, and mapped Origin reach upstream", async () => {
  const res = await handle(new Request("http://game.test/verify", { method: "POST", headers: { origin: "http://game.test", cookie: "verification=abc", "content-type": "application/x-www-form-urlencoded" }, body: "token=example" }));
  expect(await res.json()).toEqual({ method: "POST", body: "token=example", cookie: "verification=abc", origin: upstream.url.origin });
});
test("204 and HEAD have no body; redirects retain path, query and fragment", async () => {
  expect((await handle(new Request("http://game.test/empty"))).status).toBe(204);
  expect(await (await handle(new Request("http://game.test/challenge", { method: "HEAD" }))).text()).toBe("");
  expect((await handle(new Request("http://game.test/redirect"))).headers.get("location")).toBe("/w/test?q=1#s");
});
test("health endpoint never depends on upstream", async () => {
  expect(await (await handle(new Request("http://game.test/__golf/health"))).json()).toEqual({ status: "ok" });
});

test("manifest exposes the deployed commit without contacting upstream", async () => {
  const manifestHandler = createHandler(upstream.url.origin, "0123456789abcdef0123456789abcdef01234567");
  const response = await manifestHandler(new Request("http://game.test/manifest"));
  expect(await response.json()).toEqual({ commit: "0123456789abcdef0123456789abcdef01234567" });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
