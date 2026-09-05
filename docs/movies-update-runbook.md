# 观影记录更新

使用 Node 22，在仓库根目录运行。观看记录与图片补全是两步独立操作。

云端受限 App 试验已通过，当前仍仅更新 PR #6，不针对 main、未启用每日定时或自动合并。试验结果见 [trakt-cloud-trial.md](trakt-cloud-trial.md)，正式接入顺序见 [trakt-production-integration-plan.md](trakt-production-integration-plan.md)。以下是本机操作，不等于执行生产发布。

## 1. 备份并抓取公开观看记录

```sh
export PATH="/usr/local/opt/node@22/bin:$PATH"
cp src/data/trakt-public-history.json /tmp/astro2026-before-sync.json
npm run sync:trakt-public
npm run check:movies:data
```

此命令不读取 TMDB 凭据、不查询元数据；保留按电影/剧集命名空间匹配的已有本地和远程海报。
公开抓取失败、分页不完整或观看数量意外减少时拒绝覆盖。
只有确认在 Trakt 有意删除记录后，才可使用 `--allow-history-shrink`。

## 2. 按需补全 TMDB 海报

在已加载本机 TMDB_PROXY_API_KEY 和 TMDB_PROXY_BASE 的终端运行：

```sh
npm run enrich:movie-posters -- --previous /tmp/astro2026-before-sync.json
npm run check:movies:data
```

`--previous` 必须指向本轮采集前的备份；复用可信已有海报，仅新增、缺图或关联改变进入补图队列。本地兜底不会每天重试。若明确需要手动全量刷新标题和海报，才运行不带 `--previous` 的 `npm run enrich:movie-posters`。

元数据和图片都通过 fzzapi；使用 w342。凭据不进入快照。
个别缺 ID、404、缺海报或图片失败保留原引用；认证失败或全批失败不写入。
脚本打印脱敏报告及系统临时目录下的备份路径。不根据同名搜索结果自动替换 ID。
两步分别保存，因此补全失败不会撤销已验证的观看记录更新。

## 3. 发布前检查

```sh
npm run verify
# 另一个终端启动预览：npm exec astro preview -- --host 0.0.0.0 --port 49152
npm run check:movies:browser
```

浏览器交互测试使用本地图片替身，不证明远程代理速度。真实图片仍需人工查看。
检查新旧事件 ID、数量、缺图报告与 git diff，再提交。不要提交临时备份或凭据。
恢复时先确认备份内容、保留当前快照，然后用备份替换并重新验证构建。

## 最近真实同步复测

2026-09-05：48 页，4780 → 4782 个事件，旧事件遗漏 0；44 部电影、173 部剧集不变。
216 个远程海报引用全部保留；无完全缺图作品。
上述是本机历史验收数，不是当前实时总数。随后云端候选曾达到 4783 个事件；判断本轮增删应以该轮输入、候选和摘要为准，不固定写死该数值。

目前已有 30 项策略与脚本入口测试，可运行：

```sh
node --test scripts/movie-enrichment-plan.test.mjs scripts/enrich-movie-posters.integration.test.mjs scripts/sync-trakt-public.integration.test.mjs
```

测试使用临时项目、模拟响应及假凭据，覆盖主要分页/补图失败保护，不代表所有真实浏览器和文件系统故障已覆盖。
