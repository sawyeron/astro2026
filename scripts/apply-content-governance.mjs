#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { format as formatWithPrettier } from "prettier";

const root = path.resolve(import.meta.dirname, "..");
const reportPath = path.join(
  root,
  "docs/audit/content-governance-candidates-v1.json",
);
const apply = process.argv.includes("--apply");
const report = JSON.parse(await readFile(reportPath, "utf8"));
const approved = report.candidates.filter(
  (item) => item.reviewStatus === "approved",
);
const failures = [];
const changes = [];

function parseDocument(text, source) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) throw new Error(`${source}: missing front matter`);
  return { data: parseYaml(match[1]), body: text.slice(match[0].length) };
}

for (const item of approved) {
  const sourcePath = path.join(root, item.source);
  const original = await readFile(sourcePath, "utf8");
  const { data, body } = parseDocument(original, item.source);
  const candidate = item.candidate;
  for (const field of [
    "contentKind",
    "topics",
    "timeSensitive",
    "timeSensitivityKind",
    "legalDisclaimer",
  ])
    if (candidate[field] === undefined)
      failures.push(`${item.source}: approved candidate missing ${field}`);
  if (failures.length) continue;

  const nextData = {
    ...data,
    topics: candidate.topics,
    contentKind: candidate.contentKind,
    timeSensitive: candidate.timeSensitive,
    timeSensitivityKind: candidate.timeSensitivityKind,
    legalDisclaimer: candidate.legalDisclaimer,
  };
  const raw = `---\n${stringifyYaml(nextData, { lineWidth: 0 }).trim()}\n---\n${body}`;
  const rendered = await formatWithPrettier(raw, { parser: "markdown" });
  if (rendered !== original) {
    changes.push({ source: item.source, title: item.title });
    if (apply) await writeFile(sourcePath, rendered);
  }
}

if (failures.length) {
  console.error(
    `Governance application blocked with ${failures.length} error(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const mode = apply ? "Applied" : "Dry run";
console.log(
  `${mode}: ${approved.length} approved candidate(s), ${changes.length} article file(s) would change.`,
);
if (changes.length)
  for (const change of changes)
    console.log(`- ${change.source}: ${change.title}`);
if (!apply && changes.length)
  console.log("Run npm run governance:apply after reviewing the diff above.");
