#!/usr/bin/env node
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { format as formatWithPrettier } from "prettier";

const projectRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(projectRoot, "src/content/blog");

function frontMatter(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  return parseYaml(match?.[1] ?? "") ?? {};
}

function includesAny(values, candidates) {
  return candidates.some((candidate) =>
    values.some((value) => value.includes(candidate)),
  );
}

function classify(data) {
  const categories = (data.categories ?? []).map(String);
  const tags = (data.tags ?? []).map(String);
  const title = String(data.title);
  const evidence = [title, ...categories, ...tags];
  const topics = [];
  const reasons = [];

  const legal =
    categories.includes("法学") ||
    includesAny(evidence, [
      "法",
      "司法",
      "法院",
      "犯罪",
      "合同",
      "破产",
      "著作权",
      "版权",
      "交通事故",
      "赔偿",
      "产假",
      "工资",
      "律师",
      "行政",
      "代理权",
    ]);
  const technical = includesAny(evidence, [
    "macOS",
    "iOS",
    "APP",
    "Homebrew",
    "LaTeX",
    "PDF",
    "HTML",
    "Node",
    "AppleScript",
    "Rime",
    "Hexo",
    "Python",
    "键盘",
    "云盘",
    "Workflow",
  ]);
  const culture = includesAny(evidence, ["电影", "观后感", "读书笔记", "教育"]);
  const personal =
    includesAny(evidence, ["碎碎念", "乱弹", "成长"]) ||
    title.includes("流水账");

  if (includesAny(evidence, ["劳动", "工资", "产假", "用工"]))
    topics.push("labor-social-security");
  if (includesAny(evidence, ["交通事故", "人身损害", "赔偿标准", "侵权"]))
    topics.push("tort-traffic");
  if (
    includesAny(evidence, ["公司法", "合同", "破产", "民法", "物权", "代理权"])
  )
    topics.push("civil-commercial");
  if (legal) topics.push("legal-practice-research");
  if (technical) topics.push("technology-digital-life");
  if (
    includesAny(evidence, ["效率工具", "PDF", "排版", "思维导图", "Workflow"])
  )
    topics.push("lawyer-toolbox");
  if (culture || personal) topics.push("notes-observations");

  let contentKind = "note";
  if (legal && technical) contentKind = "mixed";
  else if (legal) contentKind = "legal";
  else if (technical) contentKind = "technical";
  else if (culture) contentKind = "culture";
  else if (personal) contentKind = "personal";

  const timeSensitive =
    includesAny(evidence, [
      "标准",
      "通知",
      "新规",
      "产假",
      "最低工资",
      "赔偿",
      "司法解释",
      "服务协议",
      "安装",
      "升级",
      "报错",
      "设置",
      "APP",
      "Homebrew",
      "Node",
    ]) || /^20\d{2}/.test(title);
  const legalDisclaimer = legal;

  if (legal) reasons.push("旧分类或标题/标签包含明确法律主题");
  if (technical) reasons.push("标题/标签包含软件、系统或效率工具主题");
  if (timeSensitive)
    reasons.push("包含年度、标准、通知、软件版本或现行规则线索");
  if (!reasons.length) reasons.push("未发现高强度法律或技术线索，暂归一般记录");

  return {
    contentKind,
    topics: [...new Set(topics)],
    timeSensitive,
    legalDisclaimer,
    confidence:
      legal || technical ? "high" : culture || personal ? "medium" : "low",
    reasons,
  };
}

const files = (await readdir(contentRoot))
  .filter((name) => name.endsWith(".md"))
  .sort();
const candidates = [];
for (const file of files) {
  const data = frontMatter(
    await readFile(path.join(contentRoot, file), "utf8"),
  );
  candidates.push({
    source: `src/content/blog/${file}`,
    title: data.title,
    legacyPath: data.legacyPath,
    date: data.date,
    current: {
      topics: data.topics ?? [],
      contentKind: data.contentKind ?? null,
      timeSensitive: data.timeSensitive ?? false,
      legalDisclaimer: data.legalDisclaimer ?? false,
    },
    candidate: classify(data),
    reviewStatus: "pending",
  });
}

const summary = {
  total: candidates.length,
  legal: candidates.filter((item) => item.candidate.contentKind === "legal")
    .length,
  technical: candidates.filter(
    (item) => item.candidate.contentKind === "technical",
  ).length,
  mixed: candidates.filter((item) => item.candidate.contentKind === "mixed")
    .length,
  timeSensitive: candidates.filter((item) => item.candidate.timeSensitive)
    .length,
  legalDisclaimer: candidates.filter((item) => item.candidate.legalDisclaimer)
    .length,
};
const output = {
  schemaVersion: 1,
  policy:
    "Candidates only. Do not publish or write to front matter without owner review.",
  topicLabels: {
    "civil-commercial": "民商事与公司法",
    "labor-social-security": "劳动与社会保障",
    "tort-traffic": "侵权与交通事故",
    "legal-practice-research": "法律实务与研究方法",
    "lawyer-toolbox": "律师工具箱",
    "technology-digital-life": "技术、效率与数字生活",
    "notes-observations": "随笔与观察",
  },
  summary,
  candidates,
};
const rendered = await formatWithPrettier(
  `${JSON.stringify(output, null, 2)}\n`,
  {
    parser: "json",
  },
);
await writeFile(
  path.join(projectRoot, "docs/audit/content-governance-candidates-v1.json"),
  rendered,
);
console.log(
  `Generated governance candidates for ${summary.total} articles: ${summary.legal} legal, ${summary.technical} technical, ${summary.mixed} mixed, ${summary.timeSensitive} time-sensitive.`,
);
