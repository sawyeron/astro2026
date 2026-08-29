#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format as formatWithPrettier } from "prettier";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(
  root,
  "docs/audit/content-governance-candidates-v1.json",
);
const report = JSON.parse(await readFile(source, "utf8"));
const priority = (item) => {
  const c = item.candidate;
  if (c.timeSensitive && c.legalDisclaimer) return 1;
  if (c.legalDisclaimer) return 2;
  if (c.timeSensitive) return 3;
  return 4;
};
const grouped = new Map();
for (const item of [...report.candidates].sort(
  (a, b) => priority(a) - priority(b),
)) {
  const key = priority(item);
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(item);
}
const labels = {
  1: "P1 · 法律且时效敏感",
  2: "P2 · 法律内容",
  3: "P3 · 技术或数据时效敏感",
  4: "P4 · 一般内容",
};
let markdown = `# 内容治理人工复核工作表\n\n更新时间由生成脚本决定。请以 JSON 清单为权威来源。修改审核状态时，将对应项目的 \`reviewStatus\` 改为 \`approved\` 或 \`rejected\`；如候选不准确，先修订 \`candidate\` 再批准。\n\n`;
for (const [key, items] of grouped) {
  markdown += `## ${labels[key]}（${items.length} 篇）\n\n`;
  markdown += `| 状态 | 日期 | 文章 | 类型 | 专题 | 时效 | 时效类型 | 免责 | 置信度 | 人工复核理由 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const item of items) {
    const c = item.candidate;
    const reasons = (c.reasons ?? [])
      .join("；")
      .replaceAll("|", "\\|")
      .replaceAll("\n", " ");
    markdown += `| ${item.reviewStatus} | ${String(item.date).slice(0, 10)} | [${String(item.title).replaceAll("|", "\\|")}](${item.legacyPath}) | ${c.contentKind} | ${c.topics.join("、") || "—"} | ${c.timeSensitive ? "是" : "否"} | ${c.timeSensitivityKind || "—"} | ${c.legalDisclaimer ? "是" : "否"} | ${c.confidence} | ${reasons || "—"} |\n`;
  }
  markdown += "\n";
}
markdown += `## 安全应用流程\n\n\`npm run governance:dry\` 只显示将发生的变更；\`npm run governance:apply\` 只应用状态为 \`approved\` 的项目；\`npm run check:governance\` 验证已批准值与 Front Matter 完全一致。\n`;
const formatted = await formatWithPrettier(markdown, { parser: "markdown" });
await writeFile(
  path.join(root, "docs/audit/content-governance-review-sheet.md"),
  formatted,
);
console.log(`Generated review sheet for ${report.candidates.length} articles.`);
