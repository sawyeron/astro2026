#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { publishedArticles } from "./published-articles.mjs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const blogRoot = path.join(root, "src/content/blog");
const articles = await publishedArticles(blogRoot);
articles.sort((a, b) => a.date - b.date);
const failures = [];
for (let index = 0; index < articles.length; index += 1) {
  const article = articles[index];
  const output = path.join(
    root,
    "dist",
    article.legacyPath.replace(/^\//, ""),
    "index.html",
  );
  const html = await readFile(output, "utf8");
  const previous = articles[index - 1];
  const next = articles[index + 1];
  if (previous && !html.includes(`href="${previous.legacyPath}"`))
    failures.push(`${article.legacyPath}: previous article link missing`);
  if (next && !html.includes(`href="${next.legacyPath}"`))
    failures.push(`${article.legacyPath}: next article link missing`);
  if (!previous && html.includes("上一篇"))
    failures.push(`${article.legacyPath}: unexpected previous label`);
  if (!next && html.includes("下一篇"))
    failures.push(`${article.legacyPath}: unexpected next label`);
}
if (failures.length) {
  console.error(
    `Article navigation validation failed with ${failures.length} error(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Article navigation valid: chronological neighbors checked for ${articles.length} articles.`,
);
