# Trakt 云端试验

试验目标为 `automation/trakt-trial-data → ci/trakt-cloud-trial`，不针对 main，未启用定时或自动合并。Vercel 仅构建快照，不获取 Trakt/TMDB 凭据。

## 已验证

PR #6 的候选提交 bfe88f6 经维护者批准后，独立 PR 检查完整通过，包括 `npm run verify` 和 `git diff --exit-code`。Vercel 报告 Preview Ready，不代表真实图片及所有浏览器功能已经验收。

初次大差异中，已有 History 的 media 有 770 处 title 变化、10 处 lastWatchedAt 变化；不是新增 780 条观看记录。同步前后精确比较曾确认新增 1 条、删除 0 条。

## 按需补图

云端调用 `npm run enrich:movie-posters -- --previous "$RUNNER_TEMP/trakt-before.json"`。按 movie/show 命名空间及 TMDB 关联比较，只复用基准快照中的允许格式远程海报或本地海报。已有远程海报的标题沿用基准，避免反复本地化。已有本地兜底不每天重试补图；需要刷新标题或尝试修复本地兜底时，本机仍可运行不带参数的全量补图命令。

新条目、缺图、TMDB 关联改变进入请求队列。零任务不请求代理。已知缺失（404、缺 ID、无 poster path）可保留采集结果；401/403 或全批网络失败仍阻断写入。数据检查继续校验本地文件。引用复用不意味着每次都验证远程可访问性，失效远程图仍需手动刷新。

云端额外拒绝自动删除任何基准 History ID；用户主动删除观看记录也需要人工审阅，不自动放行。无变化比较只忽略 syncedAt，不忽略观看事件或数组顺序。

## 检查与下载

先检查最新 PR head 的 Verify Astro site。此前 GITHUB_TOKEN 流程需要人工批准；受限 App 已通过云端验证：同步 run 33966415276 全步骤 success，随后独立 Verify run 33966534819 由 `sawyeron-astro2026-sync[bot]` 通过 pull_request 事件触发，第 1 次运行直接 success，actor 与 triggering_actor 均为该 App。新候选 df81c47 的观影 JSON 与旧候选 2084d91 字节相同。旧 head 上的 action_required 不代表最新候选失败。若未来出现 awaiting approval，应调查运行来源与仓库策略，不关闭安全保护。

2026-09-05 核实 [GitHub 官方触发文档](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow)：GITHUB_TOKEN 引起的 pull_request opened/synchronize/reopened 事件会创建 approval-required 运行。不是仓库所有者配置错误，关闭再重开也不是正式解决方案。此前“不触发 PR 检查”的描述不准确。官方支持用 GitHub App installation token 创建/更新 PR，使其不受这项 GITHUB_TOKEN 审批提示限制。

2026-09-05 所有者确认私有 GitHub App 已创建、仅安装到 astro2026，并配置 Repository Variable `TRAKT_SYNC_APP_ID` 与 Repository Secret `TRAKT_SYNC_APP_PRIVATE_KEY`。工作流默认 GITHUB_TOKEN 降为 contents: read；完整验证后才生成仅限 astro2026、Contents/Pull requests 读写的 installation token，并仅传给 PR Action，任务结束自动撤销。不申请 Administration、Workflows 写权限，不配置规则绕过或自动合并。如果试验 base 的工作流变化导致推送权限错误，停止调查，不通过增加 Workflows 权限解决。

最新公开 API 确认 Trakt run 33964150041 和 Verify run 33964256135 均 success；PR head 8c5b150 相对基准新增 1、删除 0，已有 media 仅 10 处 lastWatchedAt 变化，770 处标题变化已消除。Artifact 9968905323 存在且未过期，但匿名下载返回 401，尚未下载逐字核实。

重复运行除比较基准外，也比较现有 PR JSON（只读取数据，不执行候选分支代码）；语义相同则恢复候选原文，以免未合并 PR 因 syncedAt 被改写。创建 PR 后按 Action 输出 head SHA 读取 JSON，与保留的 Artifact 输入逐字比较并输出 SHA-256。此检查验证上传输入，不能替代下载 ZIP 后的端到端核对。

候选 JSON 在创建 PR 前复制到 runner 临时目录，从该副本上传，避免 PR Action 恢复基准 checkout 后上传旧数据。Artifact 保留 7 天。PR 仅提交观影 JSON。

## 尚待验证及完善

- run 33964700603 第 2 次运行全部成功；远端候选仍为 2084d91aa4d21a84d267e42aa745d13120af61a7，无变化重跑未产生新提交，PR 与 Artifact 上传输入逐字比较通过。Artifact ZIP 下载核对仍待完成。
- App 接入后真实推送与独立 PR 检查免逐次审批已验收；不代表定时、自动合并或生产发布已启用。
- 新增 8 项补图脚本级回归：临时项目执行真实入口，以模拟 fetch 和假 Key 测试 401/403、全批断网、损坏图片、TMDB ID 不匹配、并发写入保护、允许的 404 及成功写入。验证失败时原文件字节不变（并发情形保留外部写入），无残留临时文件、日志不输出假 Key；不使用真实代理或仓库快照。仍待 Trakt 分页、浏览器网络失败、429/5xx 退避及混合批次回归。
- 试验工作流 upload-artifact 升至 v6、create-pull-request 升至 v8，独立 verify 的 checkout/setup-node 升至 v5，均固定 SHA 并使用 Node 24 runtime；项目仍为 Node 22.23.2。引用升级已由同步 run 33967333383 和 App 自动触发的独立 Verify run 33967444765 验收通过，不启用不安全 Node 20 开关。
- 正式工作流进入默认分支后才考虑每天 UTC 00:17（北京时间 08:17）定时；上线另行确认。
- 依赖审计仍有 2 high、1 low，不执行强制主版本升级。
