#!/usr/bin/env node
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(root, "src/content/blog");
const files = (await readdir(contentRoot)).filter((file) =>
  file.endsWith(".md"),
);
const findings = [];
const patterns = [
  {
    kind: "control-character",
    test: (text) =>
      [...text].filter((character) => {
        const code = character.codePointAt(0);
        return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
      }),
  },
  { kind: "unrendered-hexo-tag", regex: /\{%[\s\S]*?%\}/g },
  { kind: "empty-link", regex: /\[[^\]]*\]\(\s*\)/g },
  { kind: "http-link", regex: /\bhttp:\/\/[^\s)<]+/g },
  {
    kind: "null-taxonomy",
    regex: /^(?:categories|tags):\s*(?:\[?['"]?null['"]?\]?|null)\s*$/gim,
  },
];
for (const file of files) {
  const text = await readFile(path.join(contentRoot, file), "utf8");
  for (const pattern of patterns) {
    if (pattern.test) {
      for (const match of pattern.test(text))
        findings.push({
          file: `src/content/blog/${file}`,
          kind: pattern.kind,
          sample: JSON.stringify(match),
        });
      continue;
    }
    for (const match of text.matchAll(pattern.regex))
      findings.push({
        file: `src/content/blog/${file}`,
        kind: pattern.kind,
        sample: match[0].slice(0, 180),
      });
  }
}
const counts = findings.reduce((result, item) => {
  result[item.kind] = (result[item.kind] ?? 0) + 1;
  return result;
}, {});
const blockingKinds = new Set([
  "control-character",
  "unrendered-hexo-tag",
  "empty-link",
  "null-taxonomy",
]);
const failures = findings.filter((item) => blockingKinds.has(item.kind));
const report = {
  generatedAt: new Date().toISOString(),
  files: files.length,
  counts,
  failures,
  findings,
};
await writeFile(
  path.join(root, "docs/audit/content-quality-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
if (failures.length) {
  console.error(
    `Content quality audit failed with ${failures.length} blocking finding(s):`,
  );
  for (const item of failures.slice(0, 100))
    console.error(`- ${item.file}: ${item.kind}: ${item.sample}`);
  process.exit(1);
}
console.log(
  `Content quality valid: ${files.length} articles checked; ${findings.length} non-blocking legacy HTTP link finding(s) recorded.`,
);
