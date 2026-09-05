import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

export async function publishedArticles(directory) {
  const articles = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      articles.push(...(await publishedArticles(file)));
      continue;
    }
    if (!entry.isFile() || !/\.mdx?$/.test(entry.name)) continue;
    const text = await readFile(file, "utf8");
    const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
    if (!match) throw new Error(`${file}: missing front matter`);
    const data = parse(match[1]);
    if (data.draft === true)
      throw new Error(`${file}: drafts belong in the drafts collection`);
    const href = data.legacyPath ?? (data.slug ? `/posts/${data.slug}/` : null);
    const date = new Date(data.date);
    if (!href || !data.title || Number.isNaN(date.valueOf()))
      throw new Error(
        `${file}: published article needs title, date and stable path`,
      );
    articles.push({ title: data.title, legacyPath: href, date });
  }
  const paths = new Set();
  for (const article of articles) {
    if (paths.has(article.legacyPath))
      throw new Error(`Duplicate published path: ${article.legacyPath}`);
    paths.add(article.legacyPath);
  }
  return articles;
}
