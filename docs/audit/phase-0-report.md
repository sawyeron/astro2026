# Phase 0 审计报告：遗留站点取证与迁移基线

- **审计时间（UTC）**：2026-08-27T10:51:35.582Z
- **遗留项目**：`/Users/otis/Documents/hexoblog/blog`
- **审计方式**：只读扫描 `source/` 与 `public/`；未修改旧 Hexo 项目。
- **可重复命令**：`node scripts/audit-legacy.mjs`
- **生成原始证据**：`docs/audit/generated/`（被 `.gitignore` 排除；可随时重建）
- **批准的文章路由清单**：[`url-manifest-v1.json`](url-manifest-v1.json)

## 结论

Phase 0 的核心路由取证通过：**84/84 篇公开文章均已与遗留静态输出的实际页面路径唯一匹配**，没有重复的实际生成路径。批准的文章路由清单包含 84 条 `legacyPath`，后续迁移必须用该清单生成文章路由。

但 Phase 0 不能直接放行 Phase 2：发现 **19 个正文引用的本地图片文件已同时缺失于遗留 `source/images/` 与遗留 `public/images/`**。这不是新迁移引入的问题，而是当前旧站的既有资源缺口。迁移时必须明确采用“寻找原文件 / 取得合法替代 / 保留原文并显示缺失资源状态”之一；不得静默忽略或用无关图片代替。

## 核心基线

| 项目                     |    结果 |
| ------------------------ | ------: |
| `source/` 文件           |     179 |
| `public/` 文件           |    1329 |
| 遗留 HTML 页面 / 路由    |     309 |
| 公开 Markdown 文章       |      84 |
| 私有草稿                 |      19 |
| 独立 Markdown 页面       |       7 |
| `source/images/` 资产    |      66 |
| 旧 Sitemap URL           |     230 |
| 路由重复                 |       0 |
| 文章路径唯一匹配         | 84 / 84 |
| 本地图片引用             |      52 |
| 源与产物均缺失的本地图片 |      19 |
| 远程 URL 涉及主机        |      82 |

## 路由取证规则与重要发现

1. 不使用 Hexo 源配置的 `permalink: :title/` 或 Markdown 文件名推导 URL。现有实际文章路径为拼音化 slug，例如 `2018-04-12-剑桥分析.md` 对应 `/jian-qiao-fen-xi/`。
2. 每篇文章使用遗留生成 HTML 的 `<title>` 与发布日期进行匹配；有显式 `permalink` 的文章优先以显式路径匹配。
3. 4 个非 `index.html` 的遗留 HTML 页面此前若只扫描 `**/index.html` 会漏掉：`/cclisence`、`/icloud-terms` 等。审计脚本现按 HTML 内容识别，实际共得到 309 个页面。
4. 两篇文章在源文件中标题相同（“2021年度湖北省交通事故赔偿标准”），但发布日期不同，实际路径分别是：
   - `2021-10-10-2021年度湖北省交通事故赔偿标准.md` → `/2021-nian-du-hu-bei-sheng-jiao-tong-shi-gu-pei-chang-biao-zhun/`
   - `2024-01-29-2023年度湖北省交通事故赔偿标准的统计数据.md` → `/2023-nian-du-hu-bei-sheng-jiao-tong-shi-gu-pei-chang-biao-zhun-de-tong-ji-shu-ju/`
5. 旧 sitemap 有 230 个 URL，少于 309 个本地 HTML 路由。因此它是重要证据但不是完整路由权威；最终辅助 URL manifest 需合并 HTML、Sitemap 与线上抓取结果。

## 阻断项：缺失本地图片

以下资源引用在遗留源和遗留静态产物中均不存在：

| 文章                                                         | 引用路径                          |
| ------------------------------------------------------------ | --------------------------------- |
| `2018-06-25-杠精五个半.md`                                   | `/images/2018/dnt.jpg`            |
| `2018-06-25-杠精五个半.md`                                   | `/images/2018/yjs.jpg`            |
| `2019-03-14-湖北省分区域最低工资标准.md`                     | `/images/2019/min-wages.jpg`      |
| `2019-04-30-我在用的安卓APP-201904.md`                       | `/images/2019/googlenms.jpg`      |
| `2020-02-19-MoneyWiz中新建贷款帐户付款计划闪烁的处理.md`     | `/images/2020/mz-newloan.gif`     |
| `2020-02-19-MoneyWiz中新建贷款帐户付款计划闪烁的处理.md`     | `/images/2020/mz-support.png`     |
| `2020-02-25-四地关于新冠肺炎疫情期间生活费发放标准的梳理.md` | `/images/2020/min-wages.png`      |
| `2020-03-06-oh-my-zsh升级失败的解决方法.md`                  | `/images/2020/zsh-commit.png`     |
| `2020-03-06-oh-my-zsh升级失败的解决方法.md`                  | `/images/2020/zsh-done.png`       |
| `2020-03-06-oh-my-zsh升级失败的解决方法.md`                  | `/images/2020/zsh-status.png`     |
| `2020-03-06-oh-my-zsh升级失败的解决方法.md`                  | `/images/2020/zsh-upgrade.png`    |
| `2020-05-02-为什么你就不喜欢发关于我的朋友圈了呢.md`         | `/images/2020/t&t-wechat.jpeg`    |
| `2020-05-02-为什么你就不喜欢发关于我的朋友圈了呢.md`         | `/images/2020/t&t-zhihu.png`      |
| `2020-09-20-2020年度湖北省道路交通事故损害赔偿标准.md`       | `/images/2020/cs1-hubei-2020.png` |
| `2020-09-20-2020年度湖北省道路交通事故损害赔偿标准.md`       | `/images/2020/cs2-hubei-2020.png` |
| `2021-02-28-伪手写HTML排版公众号文章的几点笔记.md`           | `/images/2021/A.jpeg`             |
| `2021-07-28-湖北省分区域最低工资标准2021.md`                 | `/images/2021/min-wages-2021.png` |
| `2021-10-10-2021年度湖北省交通事故赔偿标准.md`               | `/images/2021/cs-hubei-2021.jpg`  |
| `2024-01-29-2023年度湖北省交通事故赔偿标准的统计数据.md`     | `/images/2021/cs-hubei-2023.jpg`  |

**处理决策（迁移前必选其一）：**

1. 在旧备份、电脑、历史仓库、图床或 Web Archive 找回原文件并记录来源/许可；
2. 若有权替换，使用同一语义的合法资源，并在迁移记录中登记；
3. 找不回且不宜替换时，保留图片 alt 文本和正文，输出可访问的“原始图片未能恢复”占位，而非 404。

第 3 项适合过时的截图；法律数据图或正文理解必需的图应优先找回。**不得从不明来源批量抓取图片。**

## 需要专项渲染复核的 Markdown

| 源文件                                                                                     | 特征                  |
| ------------------------------------------------------------------------------------------ | --------------------- |
| `source/_posts/2018-04-12-剑桥分析.md`                                                     | hexo-more-marker      |
| `source/_posts/2018-04-13-冷冻胚胎的法律地位.md`                                           | hexo-more-marker      |
| `source/_posts/2018-05-05-那个可爱的老头子走了.md`                                         | hexo-more-marker      |
| `source/_posts/2018-06-07-大雄的金银岛.md`                                                 | hexo-more-marker      |
| `source/_posts/2018-06-25-杠精五个半.md`                                                   | hexo-more-marker      |
| `source/_posts/2018-07-01-LaTeX与论文排版.md`                                              | hexo-more-marker      |
| `source/_posts/2018-07-25-Vcard与二维码名片.md`                                            | hexo-more-marker      |
| `source/_posts/2018-08-22-Expert.md`                                                       | hexo-more-marker      |
| `source/_posts/2018-08-24-Mackup备份出错的临时解决办法.md`                                 | hexo-more-marker      |
| `source/_posts/2018-09-03-我的macOS和iOS设置.md`                                           | hexo-more-marker      |
| `source/_posts/2018-09-06-金钱不能买什么.md`                                               | hexo-more-marker      |
| `source/_posts/2018-09-09-趁着Tampermonkey回归的脚本盘点.md`                               | hexo-more-marker      |
| `source/_posts/2018-09-09-Homebrew离线安装方式变更.md`                                     | hexo-more-marker      |
| `source/_posts/2018-09-13-AppleScript脚本两个半.md`                                        | hexo-more-marker      |
| `source/_posts/2018-09-16-iPhone-Xʀ与小型大写字母.md`                                      | hexo-more-marker      |
| `source/_posts/2018-10-26-已预付全部房租的未到期房屋租赁合同不应解除.md`                   | hexo-more-marker      |
| `source/_posts/2018-10-31-银行能否就破产债务人的存款行使抵销权.md`                         | hexo-more-marker      |
| `source/_posts/2018-11-16-第三次签订劳动合同与二倍工资.md`                                 | hexo-more-marker      |
| `source/_posts/2018-11-17-乱弹20181116.md`                                                 | hexo-more-marker      |
| `source/_posts/2018-12-05-盘古之白.md`                                                     | hexo-more-marker      |
| `source/_posts/2018-12-05-省司法厅关于律师服务和基层法律服务收费不再实行政府定价的通知.md` | hexo-more-marker      |
| `source/_posts/2019-03-14-湖北省分区域最低工资标准.md`                                     | hexo-more-marker      |
| `source/_posts/2019-03-14-武汉产假是多久.md`                                               | hexo-more-marker      |
| `source/_posts/2019-04-18-碎碎念之「我们与恶的距离」.md`                                   | hexo-more-marker      |
| `source/_posts/2020-02-17-乱弹20200217.md`                                                 | hexo-more-marker      |
| `source/_posts/2021-02-28-伪手写HTML排版公众号文章的几点笔记.md`                           | div, img, svg         |
| `source/_posts/2021-07-28-湖北省分区域最低工资标准2021.md`                                 | hexo-more-marker      |
| `source/_posts/ban-dao-mac.md`                                                             | hexo-more-marker      |
| `source/_posts/bao-guan-qin-zhan.md`                                                       | hexo-more-marker      |
| `source/_posts/bao-li-yu-qu-cai-qiang-jie.md`                                              | hexo-more-marker      |
| `source/_posts/cetrain-issues-iv-for-company-law.md`                                       | div, hexo-more-marker |
| `source/_posts/cs-hubei-2017.md`                                                           | hexo-more-marker      |
| `source/_posts/due-pin-workflow.md`                                                        | hexo-more-marker      |
| `source/_posts/iCloud.md`                                                                  | hexo-more-marker      |
| `source/_posts/jdsnk.md`                                                                   | hexo-more-marker      |
| `source/_posts/jianguoyun-keepass.md`                                                      | hexo-more-marker      |
| `source/_posts/llfxdmw.md`                                                                 | hexo-more-marker      |
| `source/_posts/opoo-zhe-teng.md`                                                           | hexo-more-marker      |
| `source/_posts/others-00s.md`                                                              | hexo-more-marker      |
| `source/_posts/qxpj.md`                                                                    | hexo-more-marker      |
| `source/_posts/shuang-pin-vs-quan-pin.md`                                                  | hexo-more-marker      |
| `source/_posts/software-reverse-engineering.md`                                            | hexo-more-marker      |
| `source/_posts/tai-er-gu-shang.md`                                                         | hexo-more-marker      |
| `source/_posts/webfont-yu-zhe-zuo-quan.md`                                                 | hexo-more-marker      |
| `source/_posts/wei-ji-hou-ban-quan.md`                                                     | hexo-more-marker      |
| `source/_posts/work-rules-mindmap.md`                                                      | hexo-more-marker      |
| `source/_posts/yu-ming-zhuan-yi.md`                                                        | hexo-more-marker      |

另有 46 篇文章含 `<!-- more -->`。迁移时移除该 Hexo 摘要标记，摘要由 `description` 或正文首段生成，不能将标记渲染给读者。

## 外部依赖观察

- 最多的是 `picsum.photos`（99 次），主要来自旧文章 `thumbnail` 字段；新主题不应继续将其作为缩略图来源。迁移时保存该字段到遗留元数据，但不渲染为站点关键图片。
- 远程图片/内容还涉及新浪图床、豆瓣、GitHub、七牛等；文章外部超链接可原样保留，**会阻碍页面理解的远程图片/嵌入**需要在 Phase 4 列出保留、替换、降级或移除决策。
- 旧生成页面载入 Google Analytics、jsDelivr、Font Awesome 等，这些旧 HTML 仅作取证，不会进入新站。

## Phase 0 出口判定

| 条件                                 | 状态                              |
| ------------------------------------ | --------------------------------- |
| 新项目目录、设计文档、审计脚本已建立 | 通过                              |
| 脚本只读审计、可重复运行             | 通过                              |
| 全部公开文章有唯一实际路径           | 通过                              |
| 路由碰撞                             | 通过（0）                         |
| 源/产物完整性清单                    | 通过                              |
| 图片引用完整性                       | **未通过：19 个既有缺失资源待决** |
| 辅助历史路由重定向方案               | 待 Phase 0.5 / Phase 5 完成       |
| 线上抓取与 GSC 覆盖率比对            | 待站主可访问 GSC 后完成           |

## 接下来的最小执行单元

1. 将 `url-manifest-v1.json` 视为只增不隐式改的路由契约；后续内容迁移脚本必须读取它。
2. 建立 `asset-recovery-register.json`，逐项处理 19 个缺失图片；允许先以“待恢复”状态继续搭建，但在上线验收前必须无 404。
3. 进入 Phase 1：固定 Node 22、初始化 Astro、配置 CI 与 Vercel Preview。它不依赖图片恢复或 Trakt 凭据。
4. Phase 2 开始前，先为新内容转换脚本设计可重复运行和 dry-run 输出；绝不直接改写旧 `blog/source`。
