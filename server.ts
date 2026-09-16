/**
 * namu golf 서버.
 * - `/`            : 게임 페이지
 * - `/manifest`    : 현재 배포 커밋 정보
 * - `/__golf/*`    : 게임 자산(클라이언트 번들, 브리지 번들, 스타일)
 * - 그 외 모든 경로: namu.wiki 리버스 프록시. 같은 출처가 되어 iframe 삽입과 DOM 접근이 가능해진다.
 *   HTML 응답에는 브리지 스크립트를 주입하고, 프레임 차단 헤더(X-Frame-Options, CSP)는 제거한다.
 */
import { generateChallenge } from "./src/server/challenge";

const UPSTREAM = "https://namu.wiki";
const PORT = Number(process.env["PORT"] ?? 3000);
const ROOT = import.meta.dir;
const PRODUCTION = process.env["NODE_ENV"] === "production";

async function resolveRevision(): Promise<string> {
  const fromEnvironment = process.env["APP_REVISION"]?.trim();
  if (fromEnvironment) return fromEnvironment;
  const revisionFile = Bun.file(`${ROOT}/.revision`);
  if (await revisionFile.exists()) {
    const fromFile = (await revisionFile.text()).trim();
    if (fromFile) return fromFile;
  }
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: ROOT });
    if (result.exitCode === 0) {
      const fromGit = result.stdout.toString().trim();
      if (fromGit) return fromGit;
    }
  } catch {
    // Production images do not need Git because deployment writes .revision.
  }
  return "unknown";
}

const REVISION = await resolveRevision();

const STRIPPED_RESPONSE_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "strict-transport-security",
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "alt-svc",
  "set-cookie",
]);

const FORWARDED_REQUEST_HEADERS = ["accept", "accept-language", "content-type", "cookie", "user-agent", "x-requested-with"];

async function bundle(entry: string): Promise<Response> {
  const result = await Bun.build({ entrypoints: [`${ROOT}/${entry}`], target: "browser", format: "esm", sourcemap: "inline" });
  if (!result.success || !result.outputs[0]) {
    const message = result.logs.map((l) => String(l)).join("\n");
    console.error(`[build] ${entry} 실패\n${message}`);
    return new Response(`console.error(${JSON.stringify("[namu-golf] 번들 실패:\n" + message)});`, {
      status: 500,
      headers: { "content-type": "text/javascript; charset=utf-8" },
    });
  }
  return new Response(await result.outputs[0].text(), {
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" },
  });
}

function serveFile(path: string, type: string): Response {
  return new Response(Bun.file(`${ROOT}/${path}`), { headers: { "content-type": type, "cache-control": "no-store" } });
}

export function rewriteCookie(cookie: string, secure = PRODUCTION): string {
  return cookie
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p && !/^domain=/i.test(p) && (secure || !/^secure$/i.test(p)))
    .map((p) => !secure && /^samesite=none$/i.test(p) ? "SameSite=Lax" : p)
    .join("; ");
}

async function proxy(req: Request, url: URL, upstreamOrigin: string): Promise<Response> {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("user-agent")) headers.set("user-agent", "Mozilla/5.0 (namu-golf)");
  // Referer는 그대로 넘긴다. namu.wiki 출처로 바꿔 보내면 서버가 본문 상태(INITIAL_STATE)가 없는
  // 껍데기 HTML을 돌려주고, SPA가 그 상태에서 새로고침을 반복한다.
  const referer = req.headers.get("referer");
  if (referer) headers.set("referer", referer);

  const origin = req.headers.get("origin");
  if (origin === url.origin) headers.set("origin", upstreamOrigin);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(upstreamOrigin + url.pathname + url.search, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(25000),
    });
  } catch (err) {
    console.error(`[proxy] ${req.method} ${url.pathname} 실패:`, err);
    return new Response("namu.wiki에 연결할 수 없습니다.", { status: 502 });
  }

  const out = new Headers();
  for (const [name, value] of upstream.headers) {
    if (STRIPPED_RESPONSE_HEADERS.has(name)) continue;
    out.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", rewriteCookie(cookie));
  const location = upstream.headers.get("location");
  if (location) out.set("location", new URL(location, upstreamOrigin).origin === upstreamOrigin ? new URL(location, upstreamOrigin).pathname + new URL(location, upstreamOrigin).search + new URL(location, upstreamOrigin).hash : location);

  if (!url.pathname.startsWith("/skins/")) console.log(`[proxy] ${upstream.status} ${req.method} ${url.pathname.slice(0, 80)}`);
  const type = upstream.headers.get("content-type") ?? "";
  if (req.method === "HEAD" || [204, 205, 304].includes(upstream.status)) {
    return new Response(null, { status: upstream.status, headers: out });
  }
  if (type.includes("text/html")) {
    out.set("cache-control", "private, no-store");
    out.delete("etag");
    out.delete("last-modified");
    const html = await upstream.text();
    const bridge = '<script src="/__golf/bridge.js"></script>';
    const injected = /<head(\s[^>]*)?>/i.test(html)
      ? html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${bridge}`)
      : bridge + html;
    return new Response(injected, { status: upstream.status, headers: out });
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

/** Tests can supply a local fixture upstream; production always uses namu.wiki. */
export function createHandler(upstreamOrigin = UPSTREAM, revision = REVISION): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const url = new URL(req.url);
    switch (url.pathname) {
      case "/__golf/health":
        return Response.json({ status: "ok" });
      case "/__golf/challenge": {
        const depth = Number(url.searchParams.get("depth"));
        if (!Number.isInteger(depth) || depth < 1 || depth > 20) {
          return Response.json({ error: "depth는 1~20 사이의 정수여야 합니다." }, { status: 400 });
        }
        try {
          const challenge = await generateChallenge(upstreamOrigin, depth, {
            cookie: req.headers.get("cookie") ?? undefined,
            userAgent: req.headers.get("user-agent") ?? undefined,
            acceptLanguage: req.headers.get("accept-language") ?? undefined,
          });
          return Response.json(challenge, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          console.error(`[challenge] ${depth}단계 생성 실패:`, error);
          return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
        }
      }
      case "/manifest":
        return Response.json({ commit: revision }, { headers: { "cache-control": "no-store" } });
      case "/":
        return serveFile("public/index.html", "text/html; charset=utf-8");
      case "/__golf/app.js":
        return PRODUCTION ? serveFile("dist/app.js", "text/javascript; charset=utf-8") : bundle("src/client/main.ts");
      case "/__golf/bridge.js":
        return PRODUCTION ? serveFile("dist/bridge.js", "text/javascript; charset=utf-8") : bundle("src/bridge/bridge.ts");
      case "/__golf/styles.css":
        return serveFile("public/styles.css", "text/css; charset=utf-8");
      default:
        return proxy(req, url, upstreamOrigin);
    }
  };
}

if (import.meta.main) {
  if (PRODUCTION) {
    for (const name of ["app", "bridge"]) {
      if (!await Bun.file(`${ROOT}/dist/${name}.js`).exists()) throw new Error("먼저 bun run build를 실행하세요.");
    }
  }
  const server = Bun.serve({ hostname: "0.0.0.0", port: PORT, idleTimeout: 60, fetch: createHandler() });
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { void server.stop(); });
  console.log(`namu golf: http://localhost:${server.port}`);
}
