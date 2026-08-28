#!/usr/bin/env node
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse as parseYaml } from "yaml";
import { format as formatWithPrettier } from "prettier";

const root = path.resolve(import.meta.dirname, "..");
const fixtures = [
  {
    source: "src/content/blog/2018-07-25-Vcard与二维码名片.md",
    features: ["table", "code", "footnotes"],
  },
  {
    source: "src/content/blog/2021-02-28-伪手写HTML排版公众号文章的几点笔记.md",
    features: ["rawHtml", "svg", "code"],
  },
  {
    source: "src/content/blog/cetrain-issues-iv-for-company-law.md",
    features: ["rawHtml"],
  },
  {
    source: "src/content/blog/software-reverse-engineering.md",
    features: ["footnotes"],
  },
];

function metadata(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) throw new Error("missing front matter");
  return parseYaml(match[1]);
}

const snapshots = [];
for (const fixture of fixtures) {
  const sourcePath = path.join(root, fixture.source);
  const data = metadata(await readFile(sourcePath, "utf8"));
  snapshots.push({
    ...fixture,
    title: data.title,
    legacyPath: data.legacyPath,
    output: `dist${data.legacyPath}index.html`,
    expectations: {
      articleTitle: data.title,
      hasTable: fixture.features.includes("table"),
      hasCodeBlock: fixture.features.includes("code"),
      hasFootnotes: fixture.features.includes("footnotes"),
      hasInlineSvg: fixture.features.includes("svg"),
      rawHtmlMarkers: fixture.features.includes("rawHtml")
        ? fixture.source.includes("cetrain")
          ? ["footnotes-area", "footnote-line"]
          : ["display: flex", "user-select:text"]
        : [],
    },
  });
}
const document = {
  schemaVersion: 1,
  purpose:
    "Deterministic render fixtures for migrated articles with complex Markdown or legacy HTML.",
  snapshots,
};
const output = await formatWithPrettier(
  `${JSON.stringify(document, null, 2)}\n`,
  {
    parser: "json",
  },
);
const outputPath = path.join(
  root,
  "docs/audit/render-snapshot-manifest-v1.json",
);
if (process.argv.includes("--check")) {
  try {
    const existing = await readFile(outputPath, "utf8");
    if (existing !== output)
      throw new Error("manifest is stale; run npm run generate:snapshots");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(
    `Render snapshot manifest valid: ${snapshots.length} complex articles covered.`,
  );
} else {
  await writeFile(outputPath, output);
  await access(outputPath);
  console.log(
    `Generated render snapshot manifest for ${snapshots.length} complex articles.`,
  );
}
