#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const failures = [];
async function exists(target) {
  try {
    await access(path.join(root, target));
    return true;
  } catch {
    return false;
  }
}
for (const target of [
  "dist/topics/index.html",
  "dist/index.html",
  "dist/movies/index.html",
])
  if (!(await exists(target))) failures.push(`${target}: missing`);

if (await exists("dist/index.html")) {
  const html = await readFile(path.join(root, "dist/index.html"), "utf8");
  for (const marker of [
    "专题阅读",
    "最近更新",
    "/topics/",
    "/archives/",
    "/search/",
  ])
    if (!html.includes(marker)) failures.push(`homepage: ${marker} missing`);
}
if (await exists("dist/movies/index.html")) {
  const html = await readFile(
    path.join(root, "dist/movies/index.html"),
    "utf8",
  );
  for (const marker of [
    'data-theme="cinema"',
    'id="recent"',
    "<screening-carousel",
    'id="movies"',
    'id="shows"',
    'class="media-rail"',
    'loading="lazy"',
    'decoding="async"',
  ])
    if (!html.includes(marker)) failures.push(`movies: ${marker} missing`);
  if ((html.match(/class="media-rail"/g) ?? []).length !== 2)
    failures.push("movies: expected exactly two collection media rails");
  if (/image\.tmdb\.org|media\.trakt\.tv|apiz\.trakt\.tv/.test(html))
    failures.push("movies: direct Trakt or TMDB resource reference found");
  if (/TMDB_PROXY_API_KEY|api_key=/.test(html))
    failures.push("movies: API credential marker found in rendered HTML");
}

const report = JSON.parse(
  await readFile(
    path.join(root, "docs/audit/content-governance-candidates-v1.json"),
    "utf8",
  ),
);
const approvedTopics = new Set(
  report.candidates
    .filter((item) => item.reviewStatus === "approved")
    .flatMap((item) => item.candidate.topics),
);
for (const topic of approvedTopics)
  if (!(await exists(`dist/topics/${topic}/index.html`)))
    failures.push(`topic route missing: ${topic}`);

if (failures.length) {
  console.error(
    `Editorial structure validation failed with ${failures.length} error(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Editorial structure valid: homepage, cinema media rails, and ${approvedTopics.size} approved topic route(s) checked.`,
);
