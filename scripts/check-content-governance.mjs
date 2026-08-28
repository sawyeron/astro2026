#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse as parseYaml } from "yaml";

const root = path.resolve(import.meta.dirname, "..");
const report = JSON.parse(
  await readFile(
    path.join(root, "docs/audit/content-governance-candidates-v1.json"),
    "utf8",
  ),
);
const validStatuses = new Set(["pending", "approved", "rejected"]);
const failures = [];
const counts = { pending: 0, approved: 0, rejected: 0 };

for (const item of report.candidates) {
  if (!validStatuses.has(item.reviewStatus)) {
    failures.push(`${item.source}: invalid reviewStatus ${item.reviewStatus}`);
    continue;
  }
  counts[item.reviewStatus] += 1;
  const text = await readFile(path.join(root, item.source), "utf8");
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) {
    failures.push(`${item.source}: front matter missing`);
    continue;
  }
  const data = parseYaml(match[1]);
  if (item.reviewStatus === "approved") {
    for (const field of [
      "contentKind",
      "topics",
      "timeSensitive",
      "legalDisclaimer",
    ])
      if (JSON.stringify(data[field]) !== JSON.stringify(item.candidate[field]))
        failures.push(
          `${item.source}: approved ${field} is not applied to front matter`,
        );
    if (
      (data.contentKind === "legal" || data.contentKind === "mixed") &&
      !data.legalDisclaimer
    )
      failures.push(
        `${item.source}: legal or mixed content must enable legalDisclaimer`,
      );
  }
}

if (report.candidates.length !== 84)
  failures.push(
    `expected 84 governance candidates, found ${report.candidates.length}`,
  );
if (failures.length) {
  console.error(
    `Content governance validation failed with ${failures.length} error(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Content governance valid: ${counts.approved} approved, ${counts.pending} pending, ${counts.rejected} rejected.`,
);
