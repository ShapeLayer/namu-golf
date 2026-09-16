/** Local-only verification fixtures. Never imported by the production entrypoint. */
import { createHandler } from "../server";

const challenge = `<h1>부적절한 요청</h1><p>로컬 모의 인증 화면입니다. 실제 CAPTCHA가 아닙니다.</p>
<form method="POST"><button>모의 인증 완료</button></form>`;
const upstream = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
  const url = new URL(req.url);
  const verified = req.headers.get("cookie")?.includes("fixture_verified=1");
  const headers = new Headers({ "content-type": "text/html; charset=utf-8", "x-frame-options": "SAMEORIGIN" });
  if (!verified && req.method !== "POST") {
    return new Response(`<!doctype html><html><head><title>보안 확인</title></head><body>${challenge}</body></html>`, { status: 429, headers });
  }
  if (req.method === "POST") headers.append("set-cookie", "fixture_verified=1; Path=/; HttpOnly; SameSite=Lax");
  const title = decodeURIComponent(url.pathname.slice(3)) || "문서0";
  const heading = url.pathname === "/RandomPage" ? "RandomPage" : title;
  const next = url.pathname === "/RandomPage" ? 0 : Number(title.replace("문서", "")) + 1;
  return new Response(`<!doctype html><html><head><title>${heading}</title></head><body>
    <main><div><div><h1>${heading}</h1></div></div><article><a href="/w/문서${next}">문서${next}</a></article></main>
    <button id="challenge">플레이 중 모의 인증 표시</button>
    <script>document.querySelector('#challenge').onclick=()=>{document.body.innerHTML=${JSON.stringify(challenge)}};</script>
    </body></html>`, { headers });
} });
const app = Bun.serve({ hostname: "127.0.0.1", port: 3301, fetch: createHandler(upstream.url.origin) });
console.log(`모의 인증 테스트 (외부 요청 없음): ${app.url}`);
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { void app.stop(); void upstream.stop(); });
