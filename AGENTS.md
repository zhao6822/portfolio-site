# AGENTS.md — 作品集站维护交接文档（面向 AI 编码工具）

> 本文件是给接手维护本站的 **AI 编程助手**（Cursor / Claude Code / ChatGPT / Codex 等）与任何维护者的**单一入口文档**：读完本文件即可在不知道历史对话的前提下安全改站、提交、发布。
> 面向人类的图文操作手册见同目录 [README.md](./README.md)。

---

## 0. 30 秒速览

| 项 | 值 |
| --- | --- |
| 站点 | 「赵鹏 · 作品集 — 工作成果记录」，视频剪辑师个人作品集（首页 Showreel + 作品筛选网格 + 时间线 + 关于页 + 作品详情页） |
| 线上地址 | `https://portfolio-site-7i5.pages.dev` |
| 仓库 | `zhao6822/portfolio-site`（public），部署分支 **`main`**（推送 main 即触发线上重建） |
| 站点根 | **仓库根目录即站点根**，构建产物就在根目录 |
| 本地工作副本 | `C:\Users\002\AppData\Roaming\Tencent\Marvis\User\oAN1i2Y0kFyRKhFq9rr135Du0c-I\workspace\conv_7a0f0950ca57483489343d86ecbd6ce0\output\portfolio-site` |
| 技术栈 | 原生 HTML / CSS / JavaScript，**零框架、零 npm 依赖**；构建脚本仅用 Node 内置模块 |
| 构建命令 | `node build.js`（Cloudflare Pages 的 Build command 也填这个） |
| 输出目录 | **留空**（站点源文件本身即发布产物） |
| 唯一数据源 | `content/data.json`（后台 `/admin/` 编辑的就是它） |
| 后台 | `https://portfolio-site-7i5.pages.dev/admin/`，Sveltia CMS + GitHub OAuth（Pages Functions） |
| 密钥 | 仅存于 Cloudflare Pages 环境变量 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`，**仓库内不得出现任何凭据明文** |

---

## 1. 项目概述与线上地址

- **定位**：视频剪辑师（赵鹏）的个人作品集，用于对外展示作品、能力与联系方式。
- **页面**：`/`（首页）、`/timeline.html`、`/about.html`、`/project.html?id=<作品id>`。
- **数据流**：`content/data.json` →（`node build.js`）→ `assets/js/data.js`（`window.PORTFOLIO_DATA = {...}`）→ 四页用 `<script src>` 读取并渲染。
- **渲染方式**：客户端 JS 渲染，全部数据一次性内联进 `data.js`，因此双击本地 `index.html`（`file://`）也能完整预览，不受 `fetch` 跨域限制。
- **线上地址**：`https://portfolio-site-7i5.pages.dev`（Cloudflare Pages 默认子域，`portfolio-site` 已被占用故带 `-7i5` 后缀；该域名同样硬编码在 `admin/config.yml` 的 `base_url`、四页 HTML 的 `og:url` / `og:image` 中）。
- **未绑定自定义域名**（截至本文档生成时）。

---

## 2. 技术栈与构建方式

### 2.1 技术栈

| 层 | 说明 |
| --- | --- |
| 前端 | 原生 HTML + CSS + ES5 风格 JavaScript，无框架、无 CDN 依赖（`admin/` 例外，见 5.2） |
| 样式 | 单文件 `assets/css/style.css`，深色主题，含 6 套渐变占位封面（`grad-0` ~ `grad-5`） |
| 渲染 | `assets/js/site.js`，按 `<body data-page="home|timeline|project|about">` 分发渲染逻辑 |
| 数据 | `content/data.json`（JSON），由 `build.js` 编译为 `assets/js/data.js` |
| 构建 | `build.js`，仅用 Node 内置 `fs` / `path`，Node 12+ 即可，**无需 `npm install`** |
| 托管 | Cloudflare Pages（静态托管 + Pages Functions 处理 OAuth） |
| 后台 | Sveltia CMS（Decap CMS 的兼容替代），配置 `admin/config.yml` |

### 2.2 构建命令与行为

```bash
cd <站点根目录>
node build.js
```

`build.js` 做两件事：

1. **数据编译**：读 `content/data.json` → 校验 → 写 `assets/js/data.js`（带固定 banner 注释头，格式为 `window.PORTFOLIO_DATA = <JSON.stringify(data, null, 2)>;`）。
   - 校验项：`profile` / `categories` / `works` 三个顶层键必须存在，`works` 与 `categories` 必须是数组；JSON 非法或字段缺失会**打印错误并 `exit(1)`**（云端表现为构建失败，线上保留上一版本）。
2. **分享卡片注入**：读 `content/data.json` 的 `share` 分组，把分享标题 / 描述 / 缩略图写进四个页面 HTML 的 `og:*` 与 `twitter:*` 标签。
   - 站点域名来源：优先读 `admin/config.yml` 的 `base_url`，读不到则回退到脚本内默认值 `https://portfolio-site-7i5.pages.dev`。
   - 首页 `index.html`：注入 `og:title`、`og:description`、`og:image`、`twitter:title/description/image`、`og:image:alt`；内页（about / timeline / project）：**只注入 `og:image` / `twitter:image`**，各页自己的标题与描述保持 HTML 原样。
   - `share` 中留空的项 → 保留 HTML 里已有的硬编码值（回退策略）。
   - `share.image` 支持绝对网址或相对路径；相对路径会用站点域名补成绝对 URL（微信抓取缩略图要求绝对地址）。
   - ⚠️ **注入是就地写回仓库源文件**（直接 `fs.writeFileSync` 改写根目录四个 HTML），不是写到临时产物。云端构建在临时容器内进行、不回写仓库；但在本地执行 `node build.js` 后，若 `share` 值与 HTML 中硬编码值不同，`git status` 会显示这四个 HTML 被修改。

### 2.3 本地没有 Node 时的等价做法

调用方环境可能没有 Node（例如只能跑 Python 的沙箱）。此时按以下等价方式生成 `assets/js/data.js`，**结果与 `node build.js` 逐字节一致**：

1. 用 `json.load` 读 `content/data.json`；
2. 生成 JSON 文本：`json.dumps(data, ensure_ascii=False, indent=2)`；
3. 前置 `build.js` 中同一段 banner 注释（以 `\n` 连接的行数组，末尾保留两个空串，即注释块后跟一个空行）；
4. 拼接 `window.PORTFOLIO_DATA = ` + JSON 文本 + `;\n` 写入 `assets/js/data.js`；
5. 自校验：截去前缀与结尾分号后 `json.loads`，比对 `len(works)` 是否与源文件一致。

注意：Python 方案只覆盖「数据编译」，**不覆盖 2.2 的第 2 步分享卡片注入**。若改了 `share` 且需要同步页面 og 标签，要么装 Node 跑 `node build.js`，要么手工改四个 HTML 的 `og:*` 标签（值必须与 `share` 保持一致）。

---

## 3. 目录结构与文件职责

```
portfolio-site/                       ← 仓库根 = 站点根
├─ index.html                        首页：Showreel 主视觉 + 类型筛选栏 + 作品网格
├─ timeline.html                     时间线：按交付时间倒序的时间轴
├─ about.html                        关于页：擅长方向 / 软件 / 合作品牌 / 工作流程 / 联系方式
├─ project.html                      作品详情页（经 project.html?id=<作品id> 访问）
├─ build.js                          ★ 构建脚本：data.json → data.js，并注入四页 og 标签
├─ favicon.ico                       站点图标（根目录，索引 favicon）
├─ AGENTS.md                         ★ 本文件：AI 工具交接文档
├─ README.md                         面向人类的操作手册
├─ content/
│  └─ data.json                      ★ 全站唯一数据源（后台读写的唯一文件）
├─ admin/
│  ├─ index.html                     后台入口（/admin/）：动态 import Sveltia CMS 后显式 CMS.init()
│  └─ config.yml                     Sveltia 配置：仓库/分支/域名/媒体目录 + 全部表单字段定义
├─ functions/api/                    ⚙ Cloudflare Pages Functions（仅线上生效，本地 file:// 无效）
│  ├─ auth.js                        GET /api/auth：生成 state Cookie → 302 跳 GitHub 授权
│  └─ callback.js                    GET /api/callback：校验 state → code 换 token → postMessage 回传后台
├─ assets/
│  ├─ css/style.css                  全站样式（含深色主题与渐变占位封面 grad-0~5）
│  ├─ js/data.js                     ⚙ 由 build.js 生成，请勿手改（会被下次构建覆盖）
│  ├─ js/site.js                     渲染脚本（按 body[data-page] 分发）
│  ├─ images/                        站点图标与默认分享图：og-cover.png(1200×630)、favicon-32.png、apple-touch-icon.png
│  ├─ covers/                        封面图目录（现有仅 README.md，实际封面图待补）
│  │  └─ README.md                   封面图命名规范
│  ├─ uploads/                       后台上传图片的落地目录（首次上传时由 CMS 自动创建，未提交空目录）
│  └─ videos/                        站内 mp4 目录（当前无实际视频文件，仅 README.md）
│     └─ README.md                   本地视频说明
└─ _legacy-decap-backup/             迁移前的 Decap CMS 备份（index.html / config.yml / README.md）
```

### 3.1 各文件职责与"能不能改"

| 文件 | 职责 | 修改须知 |
| --- | --- | --- |
| `content/data.json` | 唯一数据源 | ✅ 日常内容改动都改这里 |
| `assets/js/data.js` | 构建产物 | ❌ 不要手改，会被覆盖；改完源文件重新构建 |
| `build.js` | 数据编译 + og 注入 | 改构建逻辑时注意其会就地改写四个 HTML |
| `assets/js/site.js` | 渲染逻辑 | 改字段名/结构时同步改这里，并对缺失字段做回退 |
| `assets/css/style.css` | 样式与主题变量 | 调样式首选改这里的 CSS 变量 |
| 四个 `*.html` | 页面骨架 + 硬编码 head 元信息 | `og:url` / `og:image` 绝对地址硬编码了域名；改域名需一起改 |
| `admin/config.yml` | 后台字段定义 | ⚠️ 单文件集合保存会**按 fields 重建 data.json**，新增顶层字段必须先在此声明 |
| `admin/index.html` | 后台加载器 | ⚠️ 白屏高发点，见坑点 8 |
| `functions/api/*.js` | OAuth 中转 | 密钥只从 `env` 读取，不得写死到代码 |

### 3.2 页面路由

| 页面 | 访问方式 | `<body data-page>` |
| --- | --- | --- |
| 首页 | `index.html` / `/` | `home` |
| 时间线 | `timeline.html` | `timeline` |
| 关于 | `about.html` | `about` |
| 作品详情 | `project.html?id=<作品id>` | `project` |

> 详情页 id 来自 `works[].id`；id 不匹配时页面显示「未找到对应作品」。

---

## 4. `content/data.json` 数据模型

顶层共 4 个键，顺序为 `works` → `share` → `categories` → `profile`（顺序不影响功能，但请保持与 `admin/config.yml` 中字段顺序一致，便于后台阅读）。

```jsonc
{
  "works": [ /* 作品数组，见 4.1 */ ],
  "share": { "title": "", "description": "", "image": "" },  // 见 4.2
  "categories": ["类型A", "类型B"],                            // 见 4.3
  "profile": { /* 个人信息与主页内容，见 4.4 */ }               // 见 4.4
}
```

### 4.1 `works[]` —— 作品数组

| 字段 | 类型 | 必填 | 含义 / 约束 |
| --- | --- | --- | --- |
| `title` | string | ✅ | 作品标题，显示在首页卡片与详情页 |
| `id` | string | ✅ | 唯一标识，小写英文 + 短横线（如 `auto-brand-film`）；**详情页地址 `project.html?id=` 依赖它**，不可重复、不要含空格与 `#`/`&`；已上线作品的 id 不要改 |
| `client` | string | ✖ | 客户 / 品牌 |
| `category` | string | ✖ | 作品类型，需与 `categories[]` 中某一项**完全一致**才能被筛选到 |
| `deliveredAt` | string | ✖ | 交付时间，格式 **`YYYY-MM`**；首页与时间线按它**倒序**排序、按年分组 |
| `duration` | string | ✖ | 成片时长，如 `0:30` / `3:20` |
| `roles` | string[] | ✖ | 担任角色，如 `["剪辑","调色"]` |
| `software` | string[] | ✖ | 使用软件，如 `["Premiere Pro","DaVinci Resolve"]` |
| `cover` | string | ✖ | 封面图路径（相对站点根，如 `assets/covers/xxx.jpg` 或后台上传后的 `assets/uploads/xxx.jpg`）；留空或不存在的路径 → 前台按 `id` 哈希显示渐变占位封面，不会破图 |
| `video` | object | ✖ | `{ type: "iframe" \| "file", url: "..." }`；`iframe` = B站/Vimeo/YouTube 嵌播地址；`file` = `assets/videos/xxx.mp4` |
| `summary` | string | ✖ | 一句话成果，显示在首页卡片与时间线 |
| `background` | string | ✖ | 项目背景（详情页） |
| `approach` | string[] | ✖ | 处理思路要点列表（详情页） |
| `results` | object[] | ✖ | `[{ "label": "全网播放量", "value": "1200 万" }]`，详情页取前 3 条做成数据卡，时间线也读前 3 条 |
| `links` | object[] | ✖ | `[{ "label": "B站成片", "url": "https://..." }]` |

### 4.2 `share` —— 分享卡片（微信 / 朋友圈 / QQ 转发）

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `title` | string | 分享标题，**仅首页链接生效**（内页保留各自标题）；留空回退 HTML 硬编码值 |
| `description` | string | 分享描述，**仅首页链接生效**；留空回退 |
| `image` | string | 分享缩略图，相对路径或绝对 URL，**四页共用**；相对路径会由 `build.js` 补成站点绝对地址。建议 1200×630、<300KB；留空回退 `assets/images/og-cover.png` |

### 4.3 `categories[]` —— 首页筛选按钮

- 字符串数组，顺序即按钮顺序，「全部」按钮由页面自动生成。
- 每项名称必须与 `works[].category` 的值完全一致，否则该作品筛不出来。
- ⚠️ 同时需与 `admin/config.yml` 中 `works → category → options` 保持一致（两处是人工同步关系，无程序校验）。

### 4.4 `profile` —— 个人信息与主页内容

| 字段 | 类型 | 前台位置 |
| --- | --- | --- |
| `name` | string | 顶栏品牌名 + 首页大标题 + 页脚 |
| `title` | string | 职业头衔 |
| `tagline` | string | 首页副标题（一句话主张） |
| `bio` | string | 关于页个人简介 |
| `location` / `years` | string | 所在城市 / 从业年限 |
| `email` / `phone` / `wechat` | string | 关于页联系方式；**留空则该条不显示** |
| `showreel` | object | 首页主视觉：`title` / `subtitle` / `duration` / `cover` / `hint` / `video{type,url}` |
| `strengths` | object[] | 关于页「擅长方向」：`[{title, desc}]` |
| `software` | object[] | 关于页「软件与工具」分组：`[{group, items:[...]}]` |
| `brands` | string[] | 关于页合作品牌墙（首页品牌滚动条也读它） |
| `workflow` | object[] | 关于页工作流程：`[{title, desc}]` |
| `links` | object[] | 关于页外链按钮：`[{label, url}]`（如 B站主页、Vimeo） |

---

## 5. Cloudflare Pages 部署流程与 `/admin` 后台机制

### 5.1 Pages 项目配置

| 配置项 | 值 |
| --- | --- |
| 连接方式 | Connect to Git → GitHub 仓库 `zhao6822/portfolio-site` |
| Framework preset | `None` |
| Build command | `node build.js` |
| Build output directory | **留空**（或 `/`）——站点源文件本身即发布产物 |
| 生产分支 | `main`（推送 main 触发自动构建发布，通常 1 分钟内生效） |
| 环境变量 | `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`（类型选 Secret）。改动环境变量后必须 **Retry deployment** 才生效 |

### 5.2 后台登录机制（Sveltia CMS + Pages Functions OAuth）

1. 打开 `/admin/` → `admin/index.html` 动态 `import()` Sveltia CMS 发行文件（unpkg 主源，失败自动切 jsDelivr），随后**必须显式调用 `window.CMS.init()`**（动态 import 时 `document.currentScript` 为 `null`，Sveltia 不会自动初始化，否则整页白屏）。
2. 读 `admin/config.yml`：`repo` / `branch` / `base_url` / `auth_endpoint` 决定登录目标。
3. 点「使用 GitHub 登录」→ 弹窗打开 `/api/auth`（`functions/api/auth.js`）：生成随机 `state` 写入 `HttpOnly` Cookie（600 秒有效）→ 302 跳 `https://github.com/login/oauth/authorize?scope=repo`。
4. GitHub 回调 `/api/callback`（`functions/api/callback.js`）：校验 `state` 与 Cookie 一致 → 用 `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` 在**服务端**换取 `access_token`（密钥不出服务端）→ 返回极简 HTML，按 CMS 弹窗协议 `postMessage` 回传 token 并自动关窗。
5. 保存内容 = 通过 GitHub API 向 `main` 提交一次 commit（连带 `content/data.json`）→ Pages 检测提交 → 执行 `node build.js` → 发布。
6. 媒体上传落到 `assets/uploads/`（`media_folder` / `public_folder` 均为该目录）。

**GitHub OAuth App 侧必须匹配**：
- Homepage URL = 站点域名
- Authorization callback URL = `https://<站点域名>/api/callback`（**不能**填 `/admin`，也不能漏 `/api`）

### 5.3 后台表单结构（`admin/config.yml`）

保存时**按 fields 声明重建 `content/data.json`**，字段 `name` 必须与 JSON 键名一致（`works` / `share` / `categories` / `profile` 及各自子字段）。表单顺序：① 作品列表 → ② 分享卡片 → ③ 作品类型 → ④ 个人信息（默认折叠，含 showreel / strengths / software / brands / workflow / links）。

### 5.4 更换域名时的检查清单

绑定自定义域名（或更换 Pages 子域）后需同步修改：

1. `admin/config.yml` → `backend.base_url`、`site_url`（结尾不带斜杠）
2. 四个 HTML 的 `og:url`（`og:image` 若为相对路径则不需要改）
3. `build.js` 中 `SITE_URL` 的默认回退值（`base_url` 读到时会自动覆盖，但建议同改）
4. GitHub OAuth App 的 Homepage URL 与 Authorization callback URL
5. ⚠️ 一个 OAuth App 只能登记一个回调地址：新旧域名并存时需各注册一个 OAuth App，或只保留一个域名访问后台

---

## 6. 常见修改任务指引

### 6.1 新增一件作品

1. 后台路径（推荐）：`/admin/` → 站点内容 → 全站数据 → 作品列表 → 新增作品 → 填完 Save（自动发布）。
2. 本地路径：在 `content/data.json` 的 `works` 数组**追加**一个对象（字段见 4.1），然后 `node build.js`，刷新页面。
3. 检查点：`id` 唯一且为小写英文短横线；`category` 与 `categories[]` 中某项完全一致；`deliveredAt` 为 `YYYY-MM`；封面图放进 `assets/covers/`（或后台直接上传到 `assets/uploads/`）后把路径填进 `cover`。
4. 页面结构无需改动，首页/时间线/详情页会自动收录。

### 6.2 更换分享卡片（微信 / 朋友圈缩略图与文案）

1. 后台：站点内容 → 全站数据 → ② 分享卡片 → 改「分享标题 / 分享描述 / 分享缩略图」→ Save。
2. 或改 `content/data.json` 的 `share` 分组，然后 `node build.js`（必须跑构建，标签注入发生在构建阶段）。
3. 缩略图建议 1200×630 横图、< 300KB；上传后路径形如 `assets/uploads/xxx.jpg`。
4. 验证：用带参数的链接（如 `https://portfolio-site-7i5.pages.dev/?v=2`）在微信里测试，避免命中旧缓存（见坑点 4）。

### 6.3 改联系方式 / 个人信息

- 后台：全站数据 → ④ 个人信息（姓名 / 头衔 / 一句话主张 / 简介 / 城市 / 年限 / 邮箱 / 电话 / 微信）。
- 本地：`content/data.json` → `profile` → 对应键，改完 `node build.js`。
- 留空某项则该联系方式不在前台显示（页面按存在的字段渲染）。
- 改 `name` 会同时影响顶栏品牌名与页脚文案。

### 6.4 调整样式

- 样式集中在 `assets/css/style.css`；优先改顶部的 CSS 变量（主题色、间距、圆角、字体）。
- 渐变占位封面共 6 套（`grad-0` ~ `grad-5`），由作品 `id` 哈希决定颜色；想改配色改这些 class。
- 改结构/class 名时需同步 `assets/js/site.js` 中的渲染函数（`renderBrand` / `renderFooter` / `workCardHtml` / `playerHtml` / `coverHtml` / 各页面 `render*`）。

### 6.5 增加作品类型按钮

1. `content/data.json` 的 `categories` 数组加一项；
2. `admin/config.yml` 的 `works → category → options` 同步加一项（否则后台下拉里选不到）；
3. 已有作品的 `category` 想归入新类型需逐个改值。

### 6.6 修改视频播放方式

- 外链嵌播：`video: { type: "iframe", url: "https://player.bilibili.com/player.html?bvid=<BV号>&autoplay=1" }`（Vimeo 用 `https://player.vimeo.com/video/<id>`，YouTube 用 `https://www.youtube.com/embed/<id>`）。
- 站内文件：把 mp4 放进 `assets/videos/`，填 `{ type: "file", url: "assets/videos/xxx.mp4" }`（见坑点 1、9）。
- 播放器为点击封面后才注入，避免首屏拖慢。

### 6.7 回滚

- 只回滚线上产物：Cloudflare Pages → Deployments → 目标部署 → Rollback。
- 连仓库内容一起退回：GitHub 上对相关文件 Revert，或 `git revert <commit>` 后推送。

---

## 7. 约束与已知坑点

1. **单文件体积上限 / 视频一律走外链**：Cloudflare Pages 对单个文件体积有限制（约 25 MiB 量级），仓库内不放成片。视频默认使用 B站等外部嵌播地址；`assets/videos/` 目前没有实际 mp4 文件。
2. **微信内域名拦截**：`*.pages.dev` 在微信内可能被拦截或提示非安全域名；正式对外传播建议绑定已备案的自有域名。
3. **微信内 `mailto:` 不可用**：微信内置浏览器点击邮箱链接无反应，联系方式建议同时提供微信号并提示手动复制。
4. **og 卡片缓存**：微信 / QQ 会缓存首次抓取到的卡片。改完 `share` 后需用带参数的新链接（`?v=2`）或在微信里清缓存验证，否则看不到变化。
5. **`content/data.json` 格式易错**：中文引号（`“ ”`）、行尾多余逗号、注释都会导致 `build.js` 报错退出（JSON 不支持注释）。改完先用本地 `node build.js` 或 `python -c "import json;json.load(open('content/data.json',encoding='utf-8'))"` 校验。构建失败时线上保留上一版本，需到 Pages → Deployments 查看构建日志。
6. **`build.js` 会就地改写四个 HTML**：本地跑构建后若 `share` 值与 HTML 中硬编码值不同，`git status` 会出现 `index/about/timeline/project.html` 的修改。这属预期行为（可连同 `assets/js/data.js` 一起提交）；不要为此把注入逻辑误判为 bug。
7. **Sveltia 单文件集合保存会按 fields 重建文件**：在 `content/data.json` 顶层新增字段（如曾经的 `share`）时，**必须**同时在 `admin/config.yml` 顶层 `fields` 中声明同名 `name`，否则用户第一次在后台保存后该字段会被整体丢弃；同时前端读取处应做默认回退（`site.js` 中大量使用 `|| {}` / `|| []` 模式）。
8. **`admin/` 白屏**：`admin/index.html` 用动态 `import()` 加载 Sveltia，此时 `document.currentScript` 为 `null`，Sveltia 不会自动初始化，必须显式 `window.CMS.init()`。修复此类问题时**只改 `admin/index.html`**，不要动 `content/data.json` 与 `admin/config.yml`。
9. **本站点没有 Node 环境时的替代**：见 2.3，用 Python 等价生成 `assets/js/data.js`；但 og 标签注入不会被执行。
10. **`works` 空态与占位卡片**：`site.js` 的空态判断是 `WORKS.length === 0`。保留 1 条字段全空的模板会渲染出一张「（待填写）」占位卡片而非空态；若期望空态需把 `works` 置为 `[]`。
11. **后台 `category` 下拉与 `categories` 数组是人工同步**：两处不一致会导致筛选失效或后台选不到想要的类型（见当前待办）。
12. **本地 `file://` 预览的已知限制**：B站 iframe 在部分浏览器 `file://` 下受限；`iframe` 播放器无 `playsinline`，移动端会自动全屏；`/admin/` 与 `/api/*` 在本地不可用（属正常，OAuth 必须跑在 Pages 上）。
13. **图片路径大小写敏感**：Pages（Linux）区分大小写，`Assets/Covers/x.jpg` 与 `assets/covers/x.jpg` 在线上会 404；本地 Windows 可能正常，发布后才暴露。
14. **git 推送凭据**：本机若 `git push` 因 Windows 凭据管理器（wincredman）失败，先执行 `gh auth setup-git` 再推送；推送时需保持网络可达。
15. **密钥纪律**：仓库内**不得**出现任何 Client Secret、token 明文。OAuth 密钥只存在于 Cloudflare Pages 环境变量；`functions/api/*.js` 一律从 `env` 读取。本地 `.env`、证书、`.ssh` 等敏感文件不要提交。
16. **`_legacy-decap-backup/` 为回滚用备份**：内含迁移前的 Decap CMS 版 `index.html` 与 `config.yml`，除回退 CMS 外不要修改。

---

## 8. 当前待办（截至本文档生成，按优先级）

| # | 待办 | 位置 / 说明 |
| --- | --- | --- |
| 1 | **填入真实作品**：`works` 目前只有 1 条字段全空的模板（`title: "（待填写）作品标题"`, `id: "template-01"`），前台会渲染一张占位卡片 | `content/data.json` → `works`；不想要占位卡片则置为 `[]` |
| 2 | **修正姓名**：`profile.name` 当前为测试值 `"abc"`，影响顶栏品牌名、首页大标题与页脚 | `content/data.json` → `profile.name`（后台：个人信息 → 姓名） |
| 3 | **统一作品类型**：`categories` 现为 `["Ai短剧","真人短剧","纪录片","预告","混剪"]`，而 `admin/config.yml` 中 `works → category → options` 仍是旧分类 `["商业广告","品牌内容","电商","短视频","纪录片","MV","混剪"]`，两边不一致 | 分别改 `content/data.json` 与 `admin/config.yml`，保持完全一致 |
| 4 | **替换示例文案**：`profile` 的 `strengths` / `software` / `brands` / `workflow` 仍是示例内容（含「蔚蓝汽车」等虚构品牌），`showreel` 标题为「个人记录」、BV 号是示例值 `BV1xx411c7mD` | `content/data.json` → `profile` |
| 5 | **补封面图**：`assets/covers/` 内没有任何实际图片，`showreel.cover` 指向的 `assets/covers/showreel.jpg` 不存在，首页主视觉靠渐变占位 | 放图到 `assets/covers/`，或在后台「封面图」字段上传（落到 `assets/uploads/`） |
| 6 | **确认联系方式公开范围**：`email` / `phone` / `wechat` 已填真实值，属公开信息，请确认是否全部对外展示 | `content/data.json` → `profile`；不需要的项留空即可隐藏 |
| 7 | **视频落位**：当前无任何本地 mp4，作品视频需补真实嵌播地址或上传 mp4 | `works[].video` / `profile.showreel.video` |
| 8 | **可选增强**：绑定自有域名（需同步 5.4 清单）、移动端二维码、访问统计、分享卡片内页差异化文案 | — |

---

## 9. 改动后的自检清单

1. `content/data.json` 是合法 JSON（无注释、无中文引号、无尾逗号）。
2. 执行 `node build.js`（或 2.3 的 Python 等价方案）后，`assets/js/data.js` 的 `works` 条数与源文件一致。
3. 本地打开 `index.html` / `timeline.html` / `about.html`、以及 `project.html?id=<某作品id>`，确认渲染正常、无控制台报错。
4. 若改了 `share`：确认四个 HTML 的 `og:image` 为站点绝对地址。
5. 若改了 `admin/config.yml`：确认新字段的 `name` 与 `data.json` 键名一致，否则后台保存会丢字段。
6. 提交信息建议使用 `feat(scope): 说明` / `fix(scope): 说明` 格式（历史提交示例：`feat(share): 分享卡片标题/描述/缩略图支持在后台随时修改`）。
7. 推送 `main` 后到 Cloudflare Pages → Deployments 确认构建成功（约 1 分钟），再强制刷新线上页面核对。
8. **提交前搜索确认无凭据明文**（Client Secret / token / 私钥）混入改动。
