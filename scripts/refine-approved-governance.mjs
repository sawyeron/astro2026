#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const file = path.join(
  root,
  "docs/audit/content-governance-candidates-v1.json",
);
const report = JSON.parse(await readFile(file, "utf8"));

const technical = new Set([
  "Mackup 备份出错的临时解决办法",
  "iPhone Xʀ 与小型大写字母",
  "oh-my-zsh升级失败的解决方法",
  "双拼 VS 全拼",
]);
const historical = new Set([
  "2013年华中科技大学法学院考研真题",
  "2014年华中科技大学法学院考研真题",
  "2015年华中科技大学法学院考研真题",
  "2016年华中科技大学法学院考研真题",
]);
const annualPattern = /(?:年度|最低工资|产假)/;
const legalRulePattern = /(?:司法解释|司法厅|收费|公司法)/;
let changed = 0;

for (const item of report.candidates) {
  if (item.reviewStatus !== "approved") continue;
  const candidate = item.candidate;
  if (technical.has(item.title)) {
    Object.assign(candidate, {
      contentKind: "technical",
      topics: ["technology-digital-life"],
      timeSensitive: true,
      timeSensitivityKind: "software-version",
      legalDisclaimer: false,
    });
    candidate.reasons = [
      "人工复核：技术文章受软件、系统或输入方式版本变化影响，不构成法律内容。",
    ];
  } else if (historical.has(item.title)) {
    Object.assign(candidate, {
      contentKind: "legal",
      topics: ["legal-practice-research"],
      timeSensitive: true,
      timeSensitivityKind: "historical-material",
      legalDisclaimer: false,
    });
    candidate.reasons = [
      "人工复核：特定年份法学院考研历史资料，不代表当前招生政策或考试范围。",
    ];
  } else if (annualPattern.test(item.title)) {
    candidate.timeSensitivityKind = "annual-data";
  } else if (legalRulePattern.test(item.title)) {
    candidate.timeSensitivityKind = "legal-rule";
  } else {
    candidate.timeSensitivityKind = "general";
  }
  changed += 1;
}
await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Refined ${changed} approved governance candidates.`);
