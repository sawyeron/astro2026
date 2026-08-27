# 内容治理候选清单（v1）

本清单由 `scripts/generate-content-governance-candidates.mjs` 根据历史标题、分类和标签生成，供站主复核。候选值**尚未写入公开文章 Front Matter**，不会在未审核的情况下触发法律免责声明或时效提示。

## 汇总

- 公开文章：84 篇
- 法律类候选：40 篇
- 技术类候选：20 篇
- 法律与技术混合候选：4 篇
- 时效敏感候选：34 篇
- 建议展示法律免责声明：44 篇

机器可读清单：`docs/audit/content-governance-candidates-v1.json`。

## 建议审核顺序

### 第一优先级：年度数据和现行规则

优先核对标题中含“年度”“标准”“通知”“新规”“产假”“最低工资”“赔偿”的文章。这些内容最容易因法规、统计口径或政策更新而失效。

建议默认值：

```yaml
contentKind: legal
timeSensitive: true
legalDisclaimer: true
```

### 第二优先级：法律分析与案例评析

包括民商事、劳动、刑法、知识产权、行政法和司法解释文章。它们通常应展示一般法律信息免责声明；是否标记时效敏感，应结合引用法条是否已修改或废止判断。

建议默认值：

```yaml
contentKind: legal
legalDisclaimer: true
```

### 第三优先级：软件和操作笔记

涉及 macOS、Homebrew、Node、App、插件、安装与报错的文章通常具有明显版本时效性，但不应展示法律免责声明。

建议默认值：

```yaml
contentKind: technical
timeSensitive: true
legalDisclaimer: false
```

### 第四优先级：随笔、文化和个人记录

一般无需免责声明或时效提示。若同时包含明确法律分析，应调整为 `mixed` 或 `legal`。

## 审核方式

在 JSON 清单中逐项确认后，将 `reviewStatus` 从 `pending` 改为 `approved` 或 `rejected`，必要时修订 `candidate` 字段。后续再运行专门的应用脚本，将**仅已批准**的候选值写入 Front Matter。

为避免覆盖人工决定，当前阶段不提供自动批量落库命令。
