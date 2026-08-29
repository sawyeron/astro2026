#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { stringify as stringifyYaml } from "yaml";

const root = path.resolve(import.meta.dirname, "..");
const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('Usage: npm run new:post -- "文章标题"');
  process.exit(1);
}
const date = new Date().toISOString().slice(0, 10);
const safe =
  title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "untitled";
const directory = path.join(root, "src/content/drafts");
const file = path.join(directory, `${date}-${safe}.md`);
const frontMatter = {
  title,
  date,
  categories: [],
  tags: [],
  draft: true,
};
try {
  await readFile(file, "utf8");
  console.error(`Draft already exists: ${path.relative(root, file)}`);
  process.exit(1);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
await writeFile(
  file,
  `---\n${stringifyYaml(frontMatter).trim()}\n---\n\n在这里开始写作。\n`,
);
console.log(`Created ${path.relative(root, file)}`);
console.log(
  "Drafts are Git-tracked but never routed, indexed, or included in feeds.",
);
