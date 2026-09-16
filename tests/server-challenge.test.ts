import { expect, test } from "bun:test";
import { extractPageLinks } from "../src/server/challenge";

test("server parser extracts only playable document-body links", () => {
  const html = `
    <a href="/w/사이드바">sidebar</a>
    <main>
      <section>
        <header><div><h1>현재</h1><a href="/w/제목영역">title action</a></div></header>
        <article>
          <a href="/w/현재">current</a>
          <a href="/w/허용">allowed</a>
          <a href="/w/허용#s-1">duplicate</a>
          <a href="/w/분류:금지">namespace</a>
          <a href="/edit/현재">edit</a>
        </article>
      </section>
    </main>`;

  expect(extractPageLinks(html, "https://namu.wiki/w/%ED%98%84%EC%9E%AC")).toEqual({
    title: "현재",
    links: ["허용"],
  });
});

test("server parser tolerates pages without a rendered heading", () => {
  expect(extractPageLinks("<html><body></body></html>", "https://namu.wiki/w/test")).toEqual({
    title: "test",
    links: [],
  });
});
