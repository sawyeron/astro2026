#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const legacyFile =
  process.env.LEGACY_MOVIES_HTML ??
  "/Users/otis/Documents/hexoblog/blog/public/movies/index.html";
const output = path.join(root, "src/data/movies-legacy.json");
const source = await readFile(legacyFile, "utf8");

function clean(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function section(id, nextId) {
  const startToken = `<div id="hexo-douban-item${id}">`;
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Legacy movie section ${id} missing`);
  const bodyStart = start + startToken.length;
  const end = nextId
    ? source.indexOf(`<div id="hexo-douban-item${nextId}">`, bodyStart)
    : source.indexOf("</main>", bodyStart);
  return source.slice(bodyStart, end);
}

function parseItems(fragment, status) {
  const starts = [...fragment.matchAll(/<div class="hexo-douban-item">/g)].map(
    (match) => match.index,
  );
  return starts.map((start, index) => {
    const block = fragment.slice(start, starts[index + 1] ?? fragment.length);
    const title = block.match(
      /class="hexo-douban-title"><a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/,
    );
    const image = block.match(/data-src="([^"]+)"/);
    const metas = [
      ...block.matchAll(/class="hexo-douban-meta">(.*?)<\/div>/g),
    ].map((match) => clean(match[1]));
    const comment = clean(
      block.match(/class="hexo-douban-comments">(.*?)<\/div>/)?.[1] ?? "",
    );
    if (!title) throw new Error(`Movie title missing near item ${index + 1}`);
    const seenDate = status === "watched" ? metas.at(-1) || null : null;
    return {
      title: clean(title[2]),
      url: title[1],
      image: image?.[1] ?? null,
      metadata:
        status === "watched"
          ? metas.slice(0, -1).join(" · ")
          : metas.join(" · "),
      seenDate,
      comment: comment || null,
      status,
    };
  });
}

const watchlist = parseItems(section(2, 3), "watchlist");
const watched = parseItems(section(3), "watched");
const data = {
  generatedAt: new Date().toISOString(),
  source: "legacy Hexo /movies/ generated page",
  notice:
    "Historical snapshot imported from the legacy site. Poster images remain remote references and are not loaded by the Astro page.",
  watchlist,
  watched,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(data, null, 2)}\n`);
console.log(
  `Imported ${watchlist.length} watchlist and ${watched.length} watched entries into ${path.relative(root, output)}.`,
);
