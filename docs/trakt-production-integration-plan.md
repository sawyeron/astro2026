# Trakt 正式接入计划（尚未启用）

## 状态与边界

截至 2026-09-05，试验目标仍是 `automation/trakt-trial-data → ci/trakt-cloud-trial`（PR #6）。不合并、不改目标为 main，也不把整个试验分支合入旧 main。主工作区的写作改造与试验隔离。

最近已核实：

| 提交    | 同步运行    | 独立 Verify 运行 | 结果       |
| ------- | ----------- | ---------------- | ---------- |
| aab9760 | 33967774312 | 33967894871      | 均 success |
| a49f1af | 33969646548 | 33969757919      | 均 success |
| 9aff2c8 | 33970254150 | 33970361975      | 均 success |

最新独立 Verify 由 `sawyeron-astro2026-sync[bot]` 触发，第 1 次运行成功。30 项测试覆盖策略、补图和采集入口的主要保护分支。无变化重跑不产生新提交已在此前 run 33964700603 attempt 2 验收。Artifact 上传输入与 PR JSON 逐字比较已通过；下载 ZIP 后核对仍未完成。真实 Chrome 网络故障及文件系统故障并未完整覆盖。

## 1. 先整理发布集成，不触碰默认分支

从当时最新的发布分支建立独立集成分支，不在带有未提交写作改动的工作区切换分支。以文件差异审阅和移植为主，不盲目 cherry-pick 整条试验提交链。

需要移植的功能文件：

- `scripts/enrich-movie-posters.mjs`
- `scripts/movie-enrichment-plan.mjs`
- `scripts/movie-enrichment-plan.test.mjs`
- `scripts/enrich-movie-posters.integration.test.mjs`
- `scripts/sync-trakt-public.integration.test.mjs`
- `.github/workflows/verify.yml` 的固定 SHA 运行时升级；与发布分支已有修改逐项比对。
- 同步、试验与正式接入文档。

依赖已有 `scripts/sync-trakt-public.mjs` 和 `scripts/movie-snapshot-utils.mjs`，必须验证发布分支仍兼容。不要复制试验数据候选覆盖发布快照；新的数据单独经过同步和审阅。

试验 workflow 不作为正式文件原样移植。正式草案应先保存在 `docs/`，待启用阶段再创建 `.github/workflows/sync-trakt.yml`，避免同时运行两套写入工作流。

集成门禁：Node 22.23.2、干净安装、30 项测试、`npm run verify`、`npm run check:movies:data`、`git diff --exit-code`；并与写作改造做兼容验收。README 保持空文件。

## 2. 正式工作流约定

这些是待实现配置，不是当前启用状态：

- 默认 `contents: read`；只在完整验证后生成 App 安装令牌。
- App 仅限 `sawyeron/astro2026`，Contents/Pull requests 读写，令牌任务结束撤销。不授予 Workflows、Administration 写权限或规则绕过。
- 继续使用 Variable `TRAKT_SYNC_APP_ID`、Secret `TRAKT_SYNC_APP_PRIVATE_KEY`；TMDB Key 只注入补图步骤。Vercel 不配置这些秘密。
- 正式固定数据分支建议 `automation/trakt-data`，PR base 为 main；只提交观影 JSON。首次创建 PR 与后续更新都要验证独立检查自动触发。
- 手动入口 `workflow_dispatch`；job 必须限制仅 main 执行，拒绝其他 ref 的误操作。
- 单一并发组，`cancel-in-progress: false`，避免相互覆盖；保留 30 分钟超时和 7 天 Artifact。
- 先采集、校验、拒绝旧 History ID 消失，再增量补图、校验、语义稳定性处理、完整网站验证，最后保存候选、更新 PR、核对 PR 与 Artifact 输入。
- 现有候选分支只读 JSON，不执行其代码。无真实变化时恢复原文，不提交纯 syncedAt 变化。
- 缺图或部分普通补图失败可保留已验证数据；认证失败或全批非预期失败阻断写入。失败报告必须脱敏。
- 不启用自动批准或自动合并。自动采集和检查不等于自动发布；数据进入 main 仍由维护者审阅合并。

## 3. 默认分支及首次手动验收

仅在写作流程、依赖安全风险与 Preview 验收完成，并另行确认发布安排后，将整理好的网站和手动同步 workflow 进入 main。main 变更可能立即触发 Vercel Production 部署，即使尚未切换自定义域名，也必须按生产变更处理。

先不含 schedule，手动运行一次：核对完整同步、正式数据 PR 的目标和文件范围、独立检查免审批、Artifact 输入一致性。保留旧可靠数据；失败时不合并候选。

## 4. 单独确认后才启用定时

预定每天北京时间 08:17，即 UTC `17 0 * * *`。GitHub schedule 只有默认分支中的 workflow 才生效，并可能延迟，不能承诺准点。

启用前确认唯一正式写入流程；停用试验工作流的触发入口，但保留 PR #6 和验收记录。不通过关闭再重开 PR 触发检查。

观察首次定时运行与下一次重复运行：有新增则更新数据 PR，无变化则不产生新提交。独立检查的 success 只证明当前配置下通过，不保证外部服务永不失败。

## 5. 失败处理与停止

- 采集缺页/数量缩减：保留已有提交，检查公开 History；不自动加 `--allow-history-shrink`。有意删除记录需要独立人工审阅，云端旧 ID 删除保护不直接移除。
- 401/403：检查 App 安装权限、Secret/Variable 名称或代理凭据配置；不要把密钥贴到日志、聊天或 Git。
- PR 推送/检查失败：核对安装范围、分支规则和最新 head；不增授 Workflows 权限或 bypass，不批准旧运行来替代最新检查。
- 临时暂停：在 Actions 中禁用正式同步 workflow。保留快照、分支和审计记录，不撤销共享凭据来替代普通暂停。
- 已合并错误数据：保留出错快照和差异，经独立修复 PR 恢复已知可靠 JSON，重新完整验证；不 force-push main。
- 数据恢复、Vercel 部署回退、自定义域名/DNS 回退是三件事，分别确认；参见 `production-cutover-runbook.md`。

## 未完成清单

- 发布分支集成、正式 workflow 实现与首次正式 PR 创建验收。
- Artifact ZIP 下载后的端到端核对。
- 写作功能、依赖漏洞处理或明确风险决策、完整 Preview 验收。
- 默认分支发布、定时启用、生产域名切换：均需后续确认，当前未执行。
