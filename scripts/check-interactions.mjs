#!/usr/bin/env node
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const failures = [];
const warnings = [];
const metrics = {
  htmlFiles: 0,
  fragmentLinks: 0,
  uniqueTargets: 0,
  footnoteReferences: 0,
  footnoteBacklinks: 0,
  tables: 0,
  codeBlocks: 0,
  inlineSvg: 0,
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    }),
  );
  return nested.flat();
}

function decode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    );
}

function idsIn(html) {
  return [...html.matchAll(/\bid=(['"])(.*?)\1/gi)].map((match) =>
    decode(match[2]),
  );
}

function hrefsIn(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref=(['"])(.*?)\1[^>]*>/gi)].map(
    (match) => ({
      tag: match[0],
      href: decode(match[2]),
    }),
  );
}

function htmlPathToRoute(file) {
  const relative = path.relative(dist, file).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  return `/${relative.replace(/index\.html$/, "").replace(/\.html$/, "")}`;
}

const files = (await walk(dist)).filter((file) => file.endsWith(".html"));
const documents = new Map();
const documentsByRoute = new Map();
for (const file of files) {
  const relative = path.relative(dist, file);
  if (relative === "google3756ddc34336b7b9.html") continue;
  const html = await readFile(file, "utf8");
  const ids = idsIn(html);
  const document = {
    html,
    ids: new Set(ids),
    route: htmlPathToRoute(file),
  };
  documents.set(file, document);
  documentsByRoute.set(document.route, document);
  metrics.htmlFiles += 1;
  metrics.uniqueTargets += ids.length;
  metrics.tables += (html.match(/<table\b/gi) ?? []).length;
  metrics.codeBlocks += (html.match(/<pre\b/gi) ?? []).length;
  metrics.inlineSvg += (html.match(/<svg\b/gi) ?? []).length;
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicates))
    failures.push(`${relative}: duplicate id "${id}"`);
}

for (const [file, document] of documents) {
  const relative = path.relative(dist, file);
  for (const { tag, href } of hrefsIn(document.html)) {
    if (!href.includes("#")) continue;
    if (/^(?:mailto:|tel:|javascript:)/i.test(href)) continue;
    let url;
    try {
      url = new URL(href, `https://imouyang.com${document.route}`);
    } catch {
      failures.push(`${relative}: malformed anchor href "${href}"`);
      continue;
    }
    if (url.origin !== "https://imouyang.com" || !url.hash) continue;
    metrics.fragmentLinks += 1;
    const targetDocument = documentsByRoute.get(decodeURI(url.pathname));
    let targetId;
    try {
      targetId = decodeURIComponent(url.hash.slice(1));
    } catch {
      failures.push(`${relative}: malformed fragment encoding "${href}"`);
      continue;
    }
    if (!targetDocument)
      failures.push(`${relative}: fragment target page missing for "${href}"`);
    else if (!targetDocument.ids.has(targetId))
      failures.push(
        `${relative}: fragment target #${targetId} missing for "${href}"`,
      );
    if (/href=["']#dfref-footnote-/i.test(tag)) metrics.footnoteReferences += 1;
    if (/href=["']#ref-footnote-/i.test(tag)) metrics.footnoteBacklinks += 1;
  }

  const articleMatch = document.html.match(
    /<div class="article-body"[^>]*>([\s\S]*?)<\/div>\s*<aside class="disclaimer"/i,
  );
  const article = articleMatch?.[1] ?? "";
  for (const pattern of [
    {
      regex: /\[[^\]\n]+\]\(#[^)\n]+\)/g,
      label: "unrendered Markdown fragment link",
    },
    { regex: /\[\^[^\]\n]+\]/g, label: "unrendered Markdown footnote marker" },
    { regex: /\{%(?:[^%]|%(?!}))*%\}/g, label: "unrendered Hexo tag" },
  ]) {
    for (const match of article.matchAll(pattern.regex))
      failures.push(`${relative}: ${pattern.label}: ${match[0].slice(0, 100)}`);
  }
  const hasScrollableTableStyle =
    /\.article-body\s+(?::global\()?table\)?\s*\{[^}]*overflow-x:\s*auto/is.test(
      document.html,
    );
  const hasScrollableCodeStyle =
    /\.article-body\s+(?::global\()?pre\)?\s*\{[^}]*overflow-x:\s*auto/is.test(
      document.html,
    );
  if (/<table\b/i.test(article) && !hasScrollableTableStyle)
    warnings.push(
      `${relative}: table found without detected horizontal overflow styling`,
    );
  if (/<pre\b/i.test(article) && !hasScrollableCodeStyle)
    warnings.push(
      `${relative}: code block found without detected horizontal overflow styling`,
    );
}

if (metrics.footnoteReferences !== metrics.footnoteBacklinks)
  failures.push(
    `footnote direction count mismatch: ${metrics.footnoteReferences} references, ${metrics.footnoteBacklinks} backlinks`,
  );

const report = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? "failed" : "passed",
  metrics,
  failures,
  warnings,
};
await writeFile(
  path.join(root, "docs/audit/interaction-audit-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

if (failures.length) {
  console.error(`Interaction audit failed with ${failures.length} error(s):`);
  for (const failure of failures.slice(0, 100)) console.error(`- ${failure}`);
  if (failures.length > 100) console.error(`- … ${failures.length - 100} more`);
  process.exit(1);
}
console.log(
  `Interaction audit valid: ${metrics.htmlFiles} HTML pages, ${metrics.fragmentLinks} fragment links, ${metrics.footnoteReferences} bidirectional footnotes, ${metrics.tables} tables, ${metrics.codeBlocks} code blocks, and ${metrics.inlineSvg} inline SVG element(s) checked.`,
);
if (warnings.length)
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
