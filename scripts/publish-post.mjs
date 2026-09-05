#!/usr/bin/env node
import { readFile, writeFile, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse, stringify } from "yaml";
import { publishedArticles } from "./published-articles.mjs";

const root = path.resolve(import.meta.dirname, "..");
const [filename, slug, description, ...extra] = process.argv.slice(2);
if (
  !filename ||
  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? "") ||
  !description?.trim() ||
  description.length > 320 ||
  extra.length
)
  throw new Error(
    'Usage: npm run publish:post -- draft-file.md stable-slug "摘要（1–320字）"',
  );
const drafts = await realpath(path.join(root, "src/content/drafts"));
const source = await realpath(path.resolve(drafts, filename));
if (!source.startsWith(drafts + path.sep) || !source.endsWith(".md"))
  throw new Error(
    "Source must be a Markdown file inside the drafts collection",
  );
const original = await readFile(source, "utf8");
const match = original.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
if (!match) throw new Error("Missing front matter");
const data = parse(match[1]);
if (
  data.draft !== true ||
  !data.title?.trim() ||
  !data.date ||
  Number.isNaN(new Date(data.date).valueOf())
)
  throw new Error("Draft must have draft=true, title and a valid date");
if (data.legacyPath || data.legacy)
  throw new Error("Historical drafts require manual migration review");
const articles = await publishedArticles(path.join(root, "src/content/blog"));
const href = `/posts/${slug}/`;
if (articles.some((article) => article.legacyPath === href))
  throw new Error(`Published path already exists: ${href}`);
const body = original.slice(match[0].length);
if (!body.trim()) throw new Error("Cannot publish empty content");
const output = path.join(root, "src/content/blog", `${slug}.md`);
const content = `---\n${stringify({ ...data, slug, description: description.trim(), draft: false }).trim()}\n---\n\n${body.trimStart()}`;
await writeFile(output, content, { flag: "wx" });
// Never delete a draft if another writer changed it during publication.
if ((await readFile(source, "utf8")) !== original)
  throw new Error(
    "Draft changed concurrently; both files retained for manual review",
  );
await unlink(source);
console.log(`Prepared ${path.relative(root, output)} → ${href}`);
console.log(
  "Local preparation only. Run npm run verify and review the Git diff before committing. No push or deployment performed.",
);
