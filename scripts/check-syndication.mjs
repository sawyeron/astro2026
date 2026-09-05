#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { publishedArticles } from "./published-articles.mjs";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(projectRoot, "dist");
const failures = [];
const articleCount = (
  await publishedArticles(path.join(projectRoot, "src/content/blog"))
).length;

async function exists(relative) {
  try {
    await access(path.join(distRoot, relative));
    return true;
  } catch {
    return false;
  }
}

for (const file of [
  "rss.xml",
  "atom.xml",
  "robots.txt",
  "sitemap-index.xml",
  "404.html",
])
  if (!(await exists(file)))
    failures.push(`${file}: missing from static build`);

if (await exists("robots.txt")) {
  const robots = await readFile(path.join(distRoot, "robots.txt"), "utf8");
  if (!robots.includes("Sitemap: https://imouyang.com/sitemap-index.xml"))
    failures.push("robots.txt: canonical sitemap declaration missing");
}

for (const [file, expected] of [
  ["rss.xml", '<rss version="2.0">'],
  ["atom.xml", "http://www.w3.org/2005/Atom"],
]) {
  if (!(await exists(file))) continue;
  const text = await readFile(path.join(distRoot, file), "utf8");
  if (!text.includes(expected))
    failures.push(`${file}: feed signature missing`);
  const itemCount =
    file === "rss.xml"
      ? [...text.matchAll(/<item>/g)].length
      : [...text.matchAll(/<entry>/g)].length;
  if (itemCount !== articleCount)
    failures.push(
      `${file}: expected ${articleCount} entries, found ${itemCount}`,
    );
}

const htmlFiles = ["index.html", "404.html"];
for (const file of htmlFiles) {
  if (!(await exists(file))) continue;
  const text = await readFile(path.join(distRoot, file), "utf8");
  if (!text.includes('href="/rss.xml"'))
    failures.push(`${file}: RSS discovery link missing`);
  if (!text.includes('href="/atom.xml"'))
    failures.push(`${file}: Atom discovery link missing`);
}

if (failures.length) {
  console.error(
    `Syndication validation failed with ${failures.length} error(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Syndication valid: RSS and Atom each expose ${articleCount} articles; robots, sitemap discovery, and 404 output are present.`,
);
