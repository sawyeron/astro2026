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
  "dist/timeline/index.html",
  "dist/index.html",
])
  if (!(await exists(target))) failures.push(`${target}: missing`);

if (await exists("dist/index.html")) {
  const html = await readFile(path.join(root, "dist/index.html"), "utf8");
  for (const marker of [
    "精选专题",
    "最近文章",
    "/topics/",
    "/archives/",
    "/search/",
  ])
    if (!html.includes(marker)) failures.push(`homepage: ${marker} missing`);
}
if (await exists("dist/timeline/index.html")) {
  const html = await readFile(
    path.join(root, "dist/timeline/index.html"),
    "utf8",
  );
  const years = [...html.matchAll(/id="year-(\d{4})"/g)].map((match) =>
    Number(match[1]),
  );
  if (years.length < 5)
    failures.push("timeline: expected multiple year groups");
  if (years.some((year, index) => index > 0 && year >= years[index - 1]))
    failures.push("timeline: year groups are not descending");
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
  `Editorial structure valid: homepage, grouped timeline, and ${approvedTopics.size} approved topic route(s) checked.`,
);
