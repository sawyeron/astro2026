# 迁移实施设计与工作拆解

- **项目**：小法进阶（`imouyang.com`）从 Hexo 到 Astro 的迁移与主题重构
- **新项目路径**：`/Users/otis/Documents/sawyeron/astro2026`
- **状态**：已批准立项；本文为实施基线，尚未开始迁移或切换生产站点
- **旧项目路径**：`/Users/otis/Documents/hexoblog/blog`
- **正式域名**：`https://imouyang.com`
- **日期**：2026-08-27

## 1. 决策摘要

新站使用 **Astro 静态输出**，以 **Node.js 22 LTS** 为唯一受支持的构建基线；源码放在独立 GitHub 仓库，经 Vercel 构建部署，由 Cloudflare 承担 DNS、TLS、缓存及 Web Analytics。

站点定位是：**以专业律师形象为主轴、以技术知识与方法为细节的个人知识档案**。它不是律所官网：不展示机构、地区、明确业务承诺或旧评论；访客经公开邮箱和 PGP 联系作者。

旧站保持原样至少 90 天。所有已公开历史文章的实际线上路径必须保持；新文章才使用新的、ASCII 友好的 slug 约定。

## 2. 已确认范围

### 2.1 必须交付

- 迁移全部公开文章、独立页面、草稿和静态资源；草稿在 Git 中保留但生产构建中不可见。
- 保持现有文章 URL；兼容现有的归档、标签、分类、分页及页面 URL，不能原生生成的旧路径通过永久重定向维持。
- 重做首页、文章、归档、分类、标签、搜索、关于、PGP、影视页以及 404 页面。
- 保留历史分类与标签；新增面向首页的手工精选专题（`topics`）。
- 为时效性法律资料增加顶部提示；法律类文章默认追加底部免责声明，可通过 Front Matter 关闭。
- 生成 `/rss.xml`、兼容 `/atom.xml`、`/sitemap-index.xml`（或站点地图入口）、`robots.txt`，保留 CNAME、Google Search Console 验证文件、Keybase 文件和必要 PGP 公钥。
- 静态全文搜索：构建期索引，不接入 Algolia 或云端搜索。
- 图片原文件无损备份，并生成 WebP/AVIF 与多尺寸派生资源；首版资源本地化部署。
- 使用 Cloudflare Web Analytics，并在页脚提供简短隐私说明。
- 影视页支持 Trakt 的构建期同步、缓存快照和失败降级；读书页首版隐藏或保留非公开占位。
- Node 22 下干净构建；Vercel Preview 验收；域名切换后至少 90 天保留回滚路径。

### 2.2 明确非目标

- 不升级、继续维护或复用 Hexo、Gulp、EJS 主题与旧插件链。
- 不引入 CMS、数据库、Headless CMS、Notion、Algolia 或运行时第三方内容 API。
- 不迁移或重做评论。
- 不使用 Google Fonts、Font Awesome、jsDelivr、unpkg 等公共 CDN 作为页面关键依赖。
- 不承诺无备案情形下中国大陆的 CDN 级低延迟；只通过静态化、资源本地化和体积控制改善体验。
- 不在首版同步图书数据；不在首版引入 R2 或其他对象存储。
- 不自动改写历史法律观点或正文。AI 仅协助提出专题、法律属性和时效风险候选值，必须人工复核后落库。

## 3. 现状盘点与影响

### 3.1 本地旧项目（盘点于 2026-08-27）

| 项目            | 观察结果                                                          | 实施影响                                                                        |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Markdown        | 84 篇公开文章、19 篇草稿；正文约 379 KB、草稿约 12 KB             | 规模适合一次性脚本转换 + 人工审阅                                               |
| 独立页面        | `about`、`archives`、`categories`、`tags`、`timeline`、`PGP`      | 多数应由 Astro 动态页面重建；About / PGP 转为内容页                             |
| 图片            | `source/images/` 有 67 个文件，约 16.2 MB，以 PNG/JPG 为主        | 复制原图、生成派生资源、审查相对图片链接                                        |
| 已生成站点      | `public/` 有 1329 文件，约 50.3 MB                                | 它是“实际线上路径”的重要证据，不可当作权威内容源                                |
| URL             | Hexo 源设为 `:title/`，但实际公开路径是拼音化 slug                | 必须以 `public/**/index.html` 和线上 sitemap 为事实来源；不可用文件名或标题推导 |
| 部署            | 请求头显示 Cloudflare + Vercel（曾命中 `fra1`）                   | 采用新 Vercel 项目 Preview → Production 切换                                    |
| 旧 Git          | 当前 `blog/` 根目录不是 Git 仓库；`.deploy_git/` 是旧静态输出仓库 | 新站必须建立真正的源码 Git 仓库；旧目录仅作只读备份                             |
| 外部引用        | 历史 Markdown 存在 GitHub、微博图床、七牛、Picsum 等外链          | 正文链接保留；影响阅读的远程图片列为审查项，不应静默下载有版权风险的第三方图片  |
| 非标准 Markdown | 至少 3 篇有 inline HTML/SVG/iframe 等                             | 必须在迁移后做渲染快照审查，禁止盲目转换                                        |

### 3.2 两个 URL 范围必须分开管理

1. **文章规范 URL**：全部公开文章必须静态生成，HTTP 200，保留尾随 `/`。
2. **历史辅助 URL**：旧首页分页、年/月归档分页、分类/标签分页等。新架构会尽量静态生成主页面；无法逐一原生重建的路径，应写入 Vercel 永久重定向规则，通常重定向到最接近的归档、标签或分类主页面。

“URL 100% 保持”在验收上细化为：文章 URL 100% 200；已捕获的旧辅助 URL 100% 200 或单跳 301/308 到语义等价页面；不得 404 或循环跳转。

### 3.3 部署环境备注

当前命令环境的 Node 为 `v25.5.0`。实施时不得把它作为生产标准：需先安装 / 激活 Node 22 LTS，并在 `.nvmrc`、`package.json#engines`、Vercel Project Settings 和 CI 中锁定该基线。文档中所有本地命令均假设 Node 22。

## 4. 目标架构

```text
GitHub（Astro 源码仓库）
  ├─ src/content/blog/       已发布 Markdown
  ├─ src/content/drafts/     私有草稿，生产排除
  ├─ src/content/pages/      About / PGP 等内容页
  ├─ src/data/               专题、重定向、Trakt 缓存、站点配置
  ├─ public/                 原图、验证文件、robots、PGP 公钥等
  ├─ scripts/                导入、验证、资源优化、Trakt 同步
  └─ docs/                   清单、审计报告、操作手册
          ↓ Node 22 LTS build
Vercel（Preview 与 Production，纯静态输出）
          ↓
Cloudflare（DNS、TLS、缓存、Web Analytics）
          ↓
https://imouyang.com
```

### 4.1 静态站点原则

- 不采用 SSR、数据库和 Vercel Functions 作为主站依赖。
- 搜索由构建期生成静态索引（候选：Pagefind）；无 API Key、无访客搜索请求上游依赖。
- Trakt 仅在构建前脚本中读取数据，生成本地 JSON 与已缓存海报。同步失败时，使用上一次成功快照；无快照时跳过影视数据但不使全站失败。
- 站点字体、图标、脚本、搜索索引和高亮资源均来自本站构建产物。

## 5. 内容模型、数据契约和路由策略

### 5.1 文章 Front Matter 目标模型

```yaml
title: 标题
date: 2018-04-12T19:58:54+08:00
updated: 2018-04-12T19:58:54+08:00
slug: jian-qiao-fen-xi # 固定历史路由片段或新文章规范 slug
legacyPath: /jian-qiao-fen-xi/ # 公开文章必须显式保存
categories: [Blog]
tags: [logo, 熟人社会]
top: false
draft: false
description: 可选 SEO 描述
topics: [] # AI 预分类，人工复核后启用
contentKind: legal | technical | note | culture | personal | mixed
timeSensitive: false
legalDisclaimer: false
```

转换规则：

- 保留原 `title`、`date`、`tags`、`categories`、`top`、`thumbnail`、`cover`、`coverimg`、`id` 等有价值信息；不被使用的 Hexo 显示字段先置于 `legacy` 节点或迁移报告中，不能无记录丢弃。
- `permalink` 为空时由 URL 清单填充 `legacyPath`；不将文件名直接视作线上路径。
- 旧的 `comment` 字段不再驱动 UI，保留至迁移报告即可；新文章不使用。
- `<!-- more -->` 从正文去除，摘要采用显式 description 或正文首段提取。
- 相对图片如 `../images/...` 必须在迁移脚本中统一为站点根路径或 Astro 资源引用；每一个改写都需进入审计记录。
- 保留 Markdown 中外部网页链接；仅对图片/嵌入等视觉资源进行人工审计或明确降级。

### 5.2 URL Manifest（上线阻断契约）

建立 `src/data/url-manifest.json`，从旧 `public/`、旧 `sitemap.xml` 和文章映射汇总生成，至少包括：

```json
{
  "source": "source/_posts/2018-04-12-剑桥分析.md",
  "title": "谈谈剑桥分析公司的Logo",
  "legacyPath": "/jian-qiao-fen-xi/",
  "kind": "post",
  "status": "must-render"
}
```

生成优先级：

1. 旧线上 sitemap 的 canonical URL（若可可靠获取）；
2. `public/<route>/index.html` 中 canonical `<link>` 或 Open Graph URL；
3. 已生成目录名；
4. 仅在以上均不存在时，结合 Hexo pinyin 行为推导，并将其标记为人工核对项。

不可只用 `public` 目录名：例如 `public/` 可能因构建时配置差异而遗漏或包含过期路径。清单必须记录来源、置信度和人工复核状态。

### 5.3 新文章 slug 约定

只适用于迁移完成后新建的文章：

- 使用小写 ASCII、数字与单个连字符；例如 `/legal-research-workflow/`；
- 不在 slug 中塞入日期，除非日期对内容身份有意义；
- 标题可以完整使用中文；
- slug 发布后不可修改。若确有修改，必须新增永久重定向。

### 5.4 页面与辅助路由策略

| 旧路径类别                                | 新站策略                                                              |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `/about/`、`/PGP/`、`/timeline/`          | 原路径静态渲染                                                        |
| `/archives/`、`/categories/`、`/tags/`    | 原路径静态渲染                                                        |
| `/tags/<tag>/`、`/categories/<category>/` | 原路径静态渲染，需谨慎 URL 编码                                       |
| `/page/<n>/`                              | 旧页码路径静态生成或 308 至首页/对应分页，按 manifest 验收            |
| `/archives/<year>/...`                    | 尽量静态生成年度/月度归档；非关键分页可 308 至对应年度或总归档        |
| `/books/`                                 | 初版不在主导航显示，但维持页面或 308 至归档；最终规则经上线前审计确认 |
| `/movies/`                                | 静态影视页，Trakt 数据为可选增强                                      |
| 旧文章路径                                | 100% 静态渲染，不允许重定向替代                                       |

Vercel 的配置中只允许**单跳永久重定向**。在 Cloudflare、Vercel 与应用层不得同时定义同一跳转，以免循环或链路过长。

## 6. 页面、主题和交互实施规范

### 6.1 设计方向

采用“法律期刊 / 个人档案馆”的编辑式界面：克制、可信、可长期阅读。避免法律天平/法槌意象、轮播、瀑布卡片、漂浮装饰和大图首屏。

- 中文正文以本地部署且许可明确的字体为主；字体授权和子集化是单独任务。
- 使用 CSS 自定义属性构建颜色、排版、间距、边框与暗色主题令牌。
- 技术感只出现在索引、锚点、代码、脚注、数据和微交互中，不抢占专业感。
- 交互仅在必要处加载：目录折叠、移动导航、主题切换、搜索。

### 6.2 页面优先级

**P0（上线不可缺）**

1. 全局基础设施：Header、Footer、导航、移动菜单、SEO head、404。
2. 首页：身份宣言、精选专题、代表文章、近期更新、档案入口。
3. 文章页：元信息、目录、阅读进度、代码/引文/表格/脚注、相邻文章、时效提示与法律声明。
4. 归档、分类、标签与搜索。
5. About、PGP、RSS/Atom、Sitemap、Robots。

**P1（首版应完成；不应阻塞 P0 的内容迁移）**

- 暗色模式；
- 时间线；
- 影视页及 Trakt 快照同步；
- 图片响应式派生与使用；
- Cloudflare Web Analytics 与隐私说明；
- 旧辅助 URL 的精细化重定向。

**P2（上线后评估）**

- R2/对象存储和相册；
- 图书页；
- 内容专题扩展；
- 双节点或镜像以进一步改善大陆访问。

### 6.3 联系与隐私

- About 和 Footer 展示公开邮箱；邮箱地址由用户在实施前提供。可使用 `mailto:`，必要时作可访问的轻度混淆，但不能牺牲可用性。
- PGP 页面提供公钥下载、指纹、Key ID、使用说明与更新时间。现有指纹/公钥需实施时验证是否仍有效；不应自动假定 2018 年密钥仍是现行密钥。
- 页脚提供简短声明：站点使用 Cloudflare Web Analytics 收集汇总访问数据；不提供评论系统；通过邮箱联系即视为按邮件服务商的政策处理数据。正式措辞需在上线前由站主确认。

## 7. 内容治理流程

### 7.1 专题与风险标注

建议初始专题：

- 民商事与公司法
- 劳动与社会保障
- 侵权与交通事故
- 法律实务与研究方法
- 律师工具箱
- 技术、效率与数字生活
- 随笔与观察

流程：

1. 提取每篇文章的标题、日期、分类、标签、首段/摘要；
2. AI 生成 `topics`、`contentKind`、`timeSensitive`、`legalDisclaimer` 的候选值与理由；
3. 站主优先复核 20–30 篇首页候选文章和所有 `timeSensitive: true` 的文章；
4. 通过后才写入公开内容 Front Matter；
5. 剩余文章可先保留空 topics，不以低置信度自动归类。

### 7.2 时效提示判定（辅助，不替代审核）

高风险候选包括但不限于：年度赔偿标准、最低工资、产假政策、疫情政策、收费规定、通知、司法解释、统计数据。满足以下任一条件先标记候选：

- 标题或标签含年份、标准、通知、规定、办法、政策、统计、赔偿、工资、产假等；
- 法律类别且发布时间较早；
- 正文引用可能已变动的法规/司法文件。

最终是否展示时效提示由人工判断。

### 7.3 内容安全与专业边界

- 不批量改写正文，避免改变历史陈述、引文和时间语境。
- 时效提示和免责声明是新增的页面层 UI，而不是侵入正文；可由元数据控制。
- 对明显失效的外链或远程图片做报告，不为了“绿灯”而静默删改内容。
- 历史内容的错误或过时之处后续可逐篇增补勘误，但不混入技术迁移提交。

## 8. 图片与资源实施设计

### 8.1 迁移目录

```text
public/
  images/
    original/               # 从旧 source/images 无损复制，保留可追溯目录结构
    derived/                # 生成的 webp/avif、不同宽度版本
  fonts/                    # 已核实许可的自托管字体与子集
  Sawyer.asc                # 经验证的 PGP 公钥（若仍使用）
  CNAME
  google*.html
  keybase.txt
  robots.txt
```

为避免破坏历史 Markdown 的根路径，发布时应保留 `/images/<year>/<file>` 兼容路径。原始备份位置可以在仓库中单独维护，但**网站对外路径**要么沿用 `/images/...`，要么通过生成阶段复制到该路径；不能直接把所有旧引用改成 `/images/original/...` 后遗漏 HTML/SVG/CSS 内引用。

### 8.2 图片处理流水线

1. `scripts/inventory-assets`：以 SHA-256、尺寸、格式、文件大小建立清单。
2. 将 `source/images/` 完整复制为原始备份；源文件绝不覆盖。
3. `scripts/derive-images`：对可处理的 JPG/PNG 生成 AVIF、WebP 及预定宽度；记录源文件哈希与输出关系。
4. Markdown/HTML 引用统一解析，验证每个本地目标实际存在。
5. 文章布局对正文图片使用 `width`/`height` 或构建期元数据，减少 CLS；截图、GIF/SVG 需要专项审查。
6. 保留原格式降级 URL；不支持现代格式的浏览器仍可显示内容。

验收不只看“文件生成成功”：应抽查带中文文件名、URL 编码、相对路径、引用式图片、HTML `img`、内联 SVG 背景图片和动图。

## 9. 搜索、Feed、SEO、统计

### 9.1 搜索

- 候选实现：Pagefind 的构建后索引；最终依赖版本在初始化时验证 Astro/Vercel 兼容性。
- 索引范围：公开文章正文、标题、标签、分类、精选专题；不索引草稿、私密数据、Trakt token 或构建日志。
- 搜索页应提供键盘可用性、空结果状态、中文查询测试与无 JS 基础降级说明。

### 9.2 Feed

- `/rss.xml`：新 RSS 2.0 主入口。
- `/atom.xml`：保持历史订阅 URL。可使用相同文章集合生成 Atom 1.0，而不是简单 302 到 RSS；这样对旧阅读器兼容性更好。
- Feed 只含公开文章，绝不含草稿；文章 URL 使用 `https://imouyang.com` canonical URL。

### 9.3 SEO 与外部验证

- 生产 URL 统一 canonical 到 `https://imouyang.com`；`www` 必须单跳永久跳转至裸域。
- 保留 Google Search Console 验证文件，或在迁移前确认已改为 DNS 验证；不得先删除旧文件。
- 自动生成 sitemap；上线后在 GSC 提交新 sitemap，并记录提交日期与覆盖率基线。
- 迁移前后抓取对比：首页、10 篇代表文章、历史文章、归档、标签、Feed、Sitemap、404。
- 保留 `CNAME`、`robots.txt`、`keybase.txt`、现行许可证文件；核实 `cclisence` 的拼写与实际用途后决定是否保留旧别名。

### 9.4 Cloudflare Web Analytics

通过 Cloudflare 提供的轻量 beacon 集成。必须：

- 只在 production 启用，Preview 默认关闭；
- 不加载 Google Analytics；
- 不影响页面主功能；
- 在隐私说明中披露；
- 上线后以 Cloudflare 面板确认数据到达，而非只凭代码存在。

## 10. Trakt 影视页设计

### 10.1 构建期数据链

```text
Trakt API（凭据只在环境变量 / Secret）
       ↓
scripts/sync-trakt
       ↓ 成功：更新 src/data/watching.json 与海报缓存
       ↓ 失败：保留最后一次有效快照，输出告警但构建继续
Astro 静态影视页 /movies/
```

### 10.2 凭据与触发方式

- 站主创建 Trakt App 后，提供 Client ID；如需 OAuth，Refresh Token 仅放入 Vercel Environment Variables 或 GitHub Actions Secrets。
- 不在 Git 历史、Markdown、示例 `.env` 或 Vercel 客户端代码暴露 Secret。
- 初版可以先手动运行同步脚本并审查差异；稳定后再选择 Vercel 构建前触发或受保护 GitHub Actions 定时生成快照。
- 影视页是增强能力：无数据时显示诚实的空状态，不显示失败栈或阻断部署。

## 11. 分阶段工作拆解

### Phase 0 — 取证、冻结与迁移清单（阻断后续）

**目的**：让旧站实际输出而不是推测成为迁移的可测基线。

- [x] 创建新项目 Git 仓库及初始 `.gitignore`；不得移动/删除旧项目文件。
- [ ] 对旧 `source/`、`public/`、`.deploy_git/` 生成只读 SHA-256 清单（不把旧 `node_modules` 复制进新仓库）。
- [x] 从 `public/` 和 `/sitemap.xml` 提取全量路由、canonical、文章标题、发布日期、资源引用，生成 `docs/audit/legacy-routes.*`。
- [x] 对比公开文章源文件数、生成的文章路由数、sitemap URL 数，标出孤儿/缺失/重复项。
- [x] 导出所有 Markdown Front Matter、HTML 块、图片/附件引用、外部图片、绝对/相对内部链接，生成报告。
- [ ] 保存线上关键页面和响应头快照；不能通过本地 DNS 访问时，记录代理/fake-IP 限制及替代取证方式。
- [ ] 检查旧 GitHub Pages 静态仓库与现 Vercel 项目访问权；只读保留策略写入 README。

**出口条件**：`url-manifest` 有版本化来源；每个公开文章均能关联到一个实际路径或明确异常；没有未解释的路由碰撞。

### Phase 1 — Astro 基座与构建可重复性

- [x] 安装并激活 Node 22 LTS；写入 `.nvmrc` 和 package engines。
- [x] 初始化 Astro TypeScript 项目，明确 static output、时区 `Asia/Shanghai`、站点 URL 和严格内容 schema。
- [x] 配置格式化、lint、类型检查、构建、内容校验和链接校验命令。
- [x] 添加 GitHub Actions：Node 22 下 install / check / build；不在 CI 里需要生产凭据。
- [ ] 新建 Vercel 项目并连接新仓库；Preview 可构建，但暂不绑定正式域名。
- [x] 设置最小安全头、缓存头与 Vercel redirect 配置骨架；所有规则后续由 manifest 生成。

**出口条件**：空站和示例内容在本地 Node 22、GitHub CI、Vercel Preview 三处构建一致。

### Phase 2 — 内容迁移与 URL 固化

- [ ] 编写可重复执行、干跑（dry-run）优先的转换脚本；源文件只读，输出到新项目。
- [ ] 迁移公开文章、草稿、About、PGP 等内容页面；动态页面（归档/标签/分类）由代码重建，不复制旧占位 Markdown。
- [ ] 注入经 manifest 确认的 slug / legacyPath；生成未映射、冲突、格式错误报告。
- [ ] 规范日期、标签、分类、摘要、`<!-- more -->`、本地图片路径及旧字段映射。
- [ ] 建立内容 collection schema，使不合法 front matter 在 build 时失败。
- [ ] 为每篇文章生成正文渲染快照或结构化摘要，抽样审查复杂 Markdown/HTML。

**出口条件**：公开文章数量、草稿数量、canonical 路由数量与 manifest 可对账；文章路由 100% 静态生成。

### Phase 3 — 主题与核心页面（P0）

- [ ] 确认字体许可、下载自托管字体、完成必要子集与 fallback 栈。
- [ ] 实现全局 layout、语义化导航、可访问移动菜单、Footer、404 和 SEO component。
- [ ] 实现首页的身份宣言、专题、代表内容和近期更新；首页不使用轮播或大图。
- [ ] 实现文章页：目录、阅读进度、脚注、引用、代码、表格、图片、相邻文章、时效/法律 UI。
- [ ] 实现 archives、categories、tags、topics、About、PGP、Timeline 和联系入口。
- [ ] 实现 Pagefind 搜索页与索引构建；中文、标签、正文、键盘操作测试。
- [ ] 实现 Atom/RSS、sitemap、robots、验证文件与 PGP 公钥输出。

**出口条件**：P0 页面在 Preview 可用；无外部公共 CDN；可在窄屏、键盘和无 JavaScript 基础场景阅读核心内容。

### Phase 4 — 内容治理与资源优化

- [ ] AI 生成文章专题/时效/法律属性候选清单与置信理由。
- [ ] 人工复核所有时效候选及首批 20–30 篇首页代表文章；写入已确认元数据。
- [ ] 落地页面层时效提示与法律免责声明，并对非法律文章进行反向抽查。
- [ ] 无损复制原始图片、生成派生图、建立 hash 映射、修复本地资源引用。
- [ ] 审查远程图片、iframe、SVG、内嵌 HTML；明确保留、降级、替换或移除原因。
- [ ] 对至少 10 篇有图片/复杂排版的文章做视觉比对。

**出口条件**：不存在批量图片 404；原图可追溯；时效/免责声明覆盖经人工批准的范围。

### Phase 5 — 扩展、兼容与性能

- [ ] 实现 `/movies/` 静态壳、Trakt 同步脚本、缓存快照与失败降级；配置 Secret 后再接实数据。
- [ ] 将 `/books/` 从主导航隐藏，配置保留或重定向行为并加入 URL 验收。
- [ ] 生成/验证历史辅助 URL 的静态路由与单跳永久重定向。
- [ ] 启用暗色模式、图片 lazy loading、关键 CSS、合理缓存与最小 JavaScript。
- [ ] 加入 Cloudflare Web Analytics（production only）与经确认的隐私说明。
- [ ] 在 Vercel Preview 和实际网络环境做 Lighthouse、链接、Feed、Sitemap 与移动端测试。

**出口条件**：P1 能力可用；没有以 Trakt 或统计脚本为前提的首屏；核心页面按 Lighthouse 90+ 目标优化。

### Phase 6 — 预发布、切换与 90 天观察

- [ ] 生成最终 URL 验收报告：文章必须 200；辅助路径必须 200/单跳 301/308；无链路循环。
- [ ] 验证 `www` 到裸域、HTTP 到 HTTPS、canonical、Open Graph、robots、sitemap、RSS、Atom、GSC 验证、CNAME、PGP 下载。
- [ ] 在临时 Vercel URL 完成代表页面的人工验收与性能测试；Preview 不含 Analytics。
- [ ] 新站 Vercel 项目绑定 `imouyang.com`；DNS/Cloudflare 规则切换时只保留一套权威重定向。
- [ ] 立即提交 sitemap 到 Google Search Console；记录切换时间、URL 清单版本、旧部署 ID、回滚操作。
- [ ] 第 1、7、30、90 天检查 GSC 覆盖率、404、Core Web Vitals 与 Cloudflare Analytics；严重问题按回滚 SOP 处理。

**出口条件**：90 天无系统性 404、索引异常或关键性能回退后，旧站从“可回滚”降级为长期只读归档。

## 12. 测试与验收矩阵

| 类别      | 自动化检查                           | 人工检查                               | 通过标准                                     |
| --------- | ------------------------------------ | -------------------------------------- | -------------------------------------------- |
| 内容数量  | 比较文章/草稿/页面计数               | 抽样核正文与 metadata                  | 不丢公开内容；草稿不公开                     |
| URL       | manifest 对 build 输出 + HTTP 状态   | 打开代表文章及旧深链                   | 文章 100% 200；辅助 URL 200 或单跳永久跳转   |
| 图片      | 本地引用存在性、hash 清单            | 中文名、相对路径、HTML/SVG、长文截图   | 无系统性图片失效；原图可定位                 |
| 链接      | 内部链接 checker                     | 外部链接按风险抽样                     | 内部无断链；外部失败记录而非静默删除         |
| 内容 UI   | 结构化渲染快照                       | 代码、表格、引文、脚注、HTML           | 可读、无明显内容损坏                         |
| 搜索      | 构建有索引、关键 query 回归          | 中文词、标题、正文、标签、无结果、键盘 | 可检索公开内容，无草稿泄露                   |
| Feed/SEO  | XML 解析、canonical 与 sitemap check | 阅读器/GSC 抽样                        | 两种 feed 有效，URL 正确                     |
| 性能      | Lighthouse CI 或脚本                 | 移动真实网络抽样                       | 性能、可访问性、SEO 目标 90+；分析脚本不阻断 |
| 安全/隐私 | Secret scan、依赖审计                | 隐私文案/邮箱/PGP                      | 无密钥泄露；生产统计披露完整                 |
| 构建      | Node 22 CI、Vercel Preview           | 干净 clone 本地构建                    | 三处可重复成功                               |

## 13. 风险、缓解措施与阻断项

| 风险                                | 概率/影响 | 缓解                                                           | 阻断条件                                   |
| ----------------------------------- | --------- | -------------------------------------------------------------- | ------------------------------------------ |
| 公共文章的实际 URL 与源文件名不一致 | 高/高     | 用 public + sitemap + HTML canonical 建 manifest；人工核验异常 | 任一公开文章无明确路径或路径冲突           |
| 图片引用形态多样                    | 高/高     | 解析 Markdown/HTML/SVG/CSS；生成资源报告和视觉抽样             | 存在批量本地图片 404                       |
| 本地 Node 非 LTS                    | 高/中     | 锁定 Node 22，CI/Vercel 同步                                   | 未能在 Node 22 成功构建                    |
| 旧主题依赖产生隐藏内容              | 中/中     | 源内容与公开 HTML 对账；不复制主题逻辑                         | 无法解释的公开页面/内容差异                |
| 中大陆跨境链路波动                  | 高/中     | 静态化、本地资源、压缩、缓存；后续评估 R2/镜像                 | 不作为首版阻断，但必须在发布说明中明确边界 |
| 旧法律文章被误解为现行意见          | 高/高     | 人工确认的时效提示 + 免责声明                                  | 所有确认高风险文章没有提示                 |
| Trakt token/API 失败或泄露          | 中/中     | Secret 管理、缓存、构建降级                                    | 凭据入库或使主站构建失败                   |
| SEO 迁移导致流量下降                | 中/高     | URL manifest、canonical、301、GSC 监控、90 天回滚              | 大批文章 404 或 canonical 改变未解释       |
| 外部图片/嵌入不可用                 | 中/中     | 报告、降级占位或经确认本地化                                   | 关键正文理解依赖失效资源且没有说明         |
| 自托管字体授权不清                  | 中/中     | 仅使用许可证明确的字体；保留 LICENSE/来源                      | 许可不明确时不引入该字体                   |

## 14. 发布、回滚与责任边界

### 14.1 发布顺序

1. 新仓库创建并推送；Vercel 新项目成功 Preview。
2. 迁移和测试全部在临时 Vercel 域名执行，正式域名不变。
3. 在切换窗口前导出：最终 manifest、构建 hash、旧站部署信息、DNS 截图、回滚步骤。
4. 将 `imouyang.com` 绑定到新 Vercel 项目；确认 Cloudflare 代理和 TLS 正常。
5. 验证关键 URL 后才提交 sitemap。

### 14.2 回滚触发

满足任一条件，优先恢复旧 Vercel 部署/项目绑定：

- 首页、文章页或大量已索引路径持续 5xx/404；
- URL 映射或重定向出现循环；
- 核心内容/图片系统性不可读；
- Cloudflare/Vercel 域名绑定错误且无法在切换窗口内修复；
- 出现未预期的草稿/隐私内容泄露。

### 14.3 回滚前提

- 不覆盖、不删除旧 `blog/`；
- 保留旧 `.deploy_git/`、GitHub 静态仓库和旧 Vercel 最后有效部署至少 90 天；
- 新旧生产绑定变更要记录具体时间和操作者；
- DNS TTL 与 Cloudflare 缓存行为须在切换前确认，避免“以为已经回滚但边缘仍缓存”。

## 15. 实施前待输入（不阻塞设计；部分阻塞对应功能）

| 输入                        | 阻塞范围                    | 说明                                             |
| --------------------------- | --------------------------- | ------------------------------------------------ |
| 公开联系邮箱                | About、Footer、PGP 联系说明 | 可先使用明确 TODO 占位，生产前必须替换           |
| 现行 PGP 公钥与指纹确认     | PGP 页面、公钥下载          | 旧文档写有 Key ID `0D6F056A`；需验证是否继续使用 |
| GitHub 新仓库创建/权限      | Vercel 接入和 CI            | 本地可先初始化 Git，远程可后接                   |
| Vercel 项目访问权限         | Preview、上线               | 阶段 0–4 不被阻断                                |
| Cloudflare Zone 权限        | Analytics、DNS 切换         | 阶段 0–5 不被阻断                                |
| Trakt App Client ID / Token | 影视数据同步                | 不阻断 P0；不可写入仓库                          |
| 主题字体选择与许可证确认    | 最终视觉                    | 可先用合法本地 fallback，切换前完成              |

## 16. 下一步执行顺序

下一次实施会严格按以下顺序推进，不跳过数据基线：

1. **Phase 0**：初始化 `astro2026` 的 Git 与文档结构；从旧 `public/`、sitemap、HTML canonical 生成可审计的 URL/资源/内容清单。
2. 审阅 Phase 0 报告，先处理路由异常、缺失文章、复杂 Markdown 和外部资源的迁移策略。
3. **Phase 1**：准备 Node 22 并初始化 Astro 骨架、构建/校验基础设施。
4. **Phase 2**：写幂等迁移脚本并执行内容复制与 URL 固化；先以数据正确性为准，不进入视觉开发。
5. 之后按 Phase 3–6 进行。任何“先出主题再补链接”的捷径均不采用。
