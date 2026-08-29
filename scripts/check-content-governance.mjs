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
      item.candidate.timeSensitive &&
      JSON.stringify(data.timeSensitivityKind) !==
        JSON.stringify(item.candidate.timeSensitivityKind)
    )
      failures.push(
        `${item.source}: approved timeSensitivityKind is not applied to front matter`,
      );
    if (!item.candidate.timeSensitive && data.timeSensitivityKind)
      failures.push(
        `${item.source}: non-time-sensitive article must not retain timeSensitivityKind`,
      );
    if (!data.topics?.length)
      failures.push(
        `${item.source}: approved article must have at least one topic`,
      );
    if (data.timeSensitive && !data.timeSensitivityKind)
      failures.push(
        `${item.source}: time-sensitive article needs timeSensitivityKind`,
      );
    if (data.contentKind === "technical" && data.legalDisclaimer)
      failures.push(
        `${item.source}: technical content must not enable legalDisclaimer`,
      );
    if (
      data.timeSensitivityKind === "software-version" &&
      !["technical", "mixed"].includes(data.contentKind)
    )
      failures.push(
        `${item.source}: software-version requires technical or mixed content`,
      );
    if (data.timeSensitivityKind === "annual-data" && !data.timeSensitive)
      failures.push(`${item.source}: annual-data must be time-sensitive`);
    if (data.timeSensitivityKind === "legal-rule" && !data.legalDisclaimer)
      failures.push(`${item.source}: legal-rule must enable legalDisclaimer`);
    if (
      data.timeSensitivityKind === "historical-material" &&
      data.legalDisclaimer
    )
      failures.push(
        `${item.source}: historical material should not enable legalDisclaimer`,
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
