---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 9d28daf1a7d9923eabbd286698e5ff78_c91d5309b27311f19c7a525400de85a5
    ReservedCode1: BHupqDayoNsTU5D4vTwemphhj0kca+mSi/2ywgZNf8FxTe2zG68YFDdiRc8SPgCzctSenVdQzqZL6v7EguKdqCMoZTcoBECXRp6v/m6+XxpDlVM2LKd8UtcoZQhqNFd10aek19W7mrrGy0IDP4RZ33NpEZMLG8oDVVww+5A7qTB5lI8ci2Uh+vRThZk=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 9d28daf1a7d9923eabbd286698e5ff78_c91d5309b27311f19c7a525400de85a5
    ReservedCode2: BHupqDayoNsTU5D4vTwemphhj0kca+mSi/2ywgZNf8FxTe2zG68YFDdiRc8SPgCzctSenVdQzqZL6v7EguKdqCMoZTcoBECXRp6v/m6+XxpDlVM2LKd8UtcoZQhqNFd10aek19W7mrrGy0IDP4RZ33NpEZMLG8oDVVww+5A7qTB5lI8ci2Uh+vRThZk=
---



# 视频剪辑师个人作品集（零依赖静态站点）

> 🤖 **交给 AI 编程助手维护（Cursor / Claude Code / ChatGPT 等）或需要完整技术交接时，请先读 [AGENTS.md](./AGENTS.md)**：内含数据模型字段表、构建与部署机制、后台 OAuth 原理、约束坑点与当前待办。本 README 侧重人类的日常操作说明。

**线上地址**：<https://portfolio-site-7i5.pages.dev>　|　**仓库**：`zhao6822/portfolio-site`（部署分支 `main`）　|　**后台**：<https://portfolio-site-7i5.pages.dev/admin/>

一个面向**视频剪辑师**的个人作品集网站：首页为 Showreel 主视觉 + 作品类型筛选 + 作品网格，作品详情页支持在线嵌播与本地视频播放，另含作品时间线与关于页。

- **零依赖**：不使用任何框架、CDN、构建工具，全部为原生 HTML / CSS / JavaScript。
- **零构建**：双击 `index.html` 即可在浏览器中本地预览（`file://` 协议下正常工作）。
- **单一数据源**：全站内容（个人信息、Showreel、作品列表、擅长方向、软件、品牌、流程）集中在 `content/data.json` 一个文件里，由 `build.js` 编译为 `assets/js/data.js` 供页面读取。
- **分享卡片可配置**：微信 / 朋友圈 / QQ 转发链接时的标题、描述与缩略图，由数据里的 `share` 分组控制（后台「分享卡片」），构建时注入各页面的 og 标签。
- **可在线编辑**：部署到 Cloudflare Pages 后访问 `/admin/`，用 GitHub 账号登录即可在网页上改内容，保存即自动发布（见第六节）。

---

## 一、目录结构

```
portfolio-site/
├─ index.html                 首页：Showreel 主视觉 + 类型筛选 + 作品网格
├─ timeline.html              时间线：按交付时间倒序的剪辑作品时间轴
├─ project.html               作品详情页（通过 project.html?id=<作品 id> 访问）
├─ about.html                 关于页：擅长方向 / 软件 / 合作品牌 / 工作流程 / 联系方式
├─ build.js                   ★ 构建脚本：content/data.json → assets/js/data.js，并注入四页分享标签
├─ favicon.ico                站点图标
├─ AGENTS.md                  ★ 面向 AI 编程工具的技术交接文档（数据模型 / 部署 / 坑点 / 待办）
├─ README.md                  本文件
├─ content/
│  └─ data.json               ★ 全站唯一数据源（JSON），后台编辑器写入的就是它
├─ admin/
│  ├─ index.html              后台入口（访问 /admin/ 打开）
│  └─ config.yml              ↳ Sveltia CMS 配置：仓库 / 分支 / 域名 / 字段定义
├─ functions/api/             ⚙ Cloudflare Pages Functions（仅线上生效）
│  ├─ auth.js                 登录跳转 GitHub（/api/auth）
│  └─ callback.js             OAuth 回调并回传 token（/api/callback）
├─ assets/
│  ├─ css/style.css           全站样式（含深色主题与渐变占位封面）
│  ├─ js/data.js              ⚙ 由 build.js 自动生成，请勿手动编辑
│  ├─ js/site.js              渲染脚本（按 body[data-page] 分发）
│  ├─ images/                 站点图标与默认分享图（og-cover.png 1200×630 等）
│  ├─ covers/                 封面图目录（把你的封面图放这里）
│  │  └─ README.md            封面图命名规范说明
│  ├─ uploads/                后台编辑器上传图片的目录（首次上传后自动创建）
│  └─ videos/                 本地视频目录（用本地 mp4 播放时放这里）
│     └─ README.md            本地视频说明
└─ _legacy-decap-backup/      迁移前的 Decap CMS 备份（需回退 CMS 时才用）
```

页面的路由方式：

| 页面 | 访问方式 |
| --- | --- |
| 首页 | `index.html` |
| 时间线 | `timeline.html` |
| 关于 | `about.html` |
| 作品详情 | `project.html?id=作品id`（从首页 / 时间线点击进入，无需手写地址） |

---

## 二、新增一件作品（只需改一个文件）

两种改法，改的是同一份数据 `content/data.json`：

| 场景 | 怎么做 |
| --- | --- |
| 站点已部署（推荐） | 打开 `https://你的域名/admin/`，GitHub 登录 → 「全站数据」→「作品列表」→ 点「新增作品」，填完保存即自动发布（详见第六节） |
| 本地 / 不用后台 | 编辑 `content/data.json`，然后在站点根目录执行 `node build.js` 重新生成 `assets/js/data.js`，刷新页面 |

在 `works` 数组里追加一个对象，保存刷新即可，**页面结构不需要做任何改动**：

```js
{
  id: "my-new-work",                 // 唯一标识（英文/数字/中划线），详情页地址由它生成
  title: "《作品名》品牌短片",         // 片名
  client: "客户或品牌名",              // 客户 / 品牌
  category: "商业广告",               // 作品类型，需与 categories 中的某一项一致
  deliveredAt: "2025-07",            // 交付时间，格式 YYYY-MM（时间线按它倒序）
  duration: "1:30",                  // 片长
  roles: ["剪辑", "调色"],            // 担任职责（剪辑 / 调色 / 声音设计 / 动效包装…）
  software: ["Premiere Pro", "DaVinci Resolve"],  // 使用软件
  cover: "assets/covers/my-new-work.jpg",         // 封面图路径，留空字符串则用渐变占位
  video: { type: "iframe", url: "https://player.bilibili.com/player.html?bvid=换成你的BV号" },
  summary: "一句话说明这件作品做了什么、结果如何。",
  background: "项目背景与客户需求，写清素材情况、限制条件与交付节点。",
  approach: ["创作思路与关键处理 1", "创作思路与关键处理 2"],
  results: [{ label: "播放量", value: "300 万" }],
  links: [{ label: "成片链接", url: "https://example.com/work" }]
}
```

要点：

1. `id` 不能重复，且不要包含空格与 `#`、`&` 等符号。
2. `category` 建议复用 `categories` 里已有的类型；若写了新类型也没关系，首页筛选栏会自动补上这个按钮。
3. `deliveredAt` 必须是 `YYYY-MM` 格式（如 `2025-07`），时间线依赖它排序与分组。
4. 新增类型时请三处保持完全一致：作品的 `category`、`categories` 数组、`admin/config.yml` 中 `works → category → options` 下拉选项（当前实际类型为 `Ai短剧 / 真人短剧 / 纪录片 / 预告 / 混剪`，与上面示例代码里的旧分类不同）。

### 修改作品类型按钮

```js
categories: ["商业广告", "品牌内容", "电商", "短视频", "纪录片", "MV", "混剪"],
```

数组顺序就是首页筛选按钮的顺序，`全部` 按钮由页面自动生成。

### 修改个人信息、Showreel、擅长方向

都在 `content/data.json` 的 `profile` 对象里（后台对应「个人信息」分组）：

| 字段 | 作用 |
| --- | --- |
| `name` / `title` / `tagline` / `bio` / `location` / `years` | 首页大标题区与关于页简介 |
| `showreel` | 首页主视觉 Showreel（标题、副标题、片长、封面、视频源） |
| `strengths` | 关于页「擅长方向与风格」卡片 |
| `software` | 关于页「软件与工具」分组标签 |
| `brands` | 关于页「合作品牌」墙 |
| `workflow` | 关于页「工作流程」步骤 |
| `links` | 关于页外链按钮（B站主页、Vimeo 等） |

---

## 三、替换封面图

1. 把封面图放进 `assets/covers/` 目录。
2. 在 `content/data.json` 中把对应作品的 `cover` 改成该文件路径，例如 `assets/covers/my-new-work.jpg`；用后台编辑时，直接在「封面图」字段上传图片（默认存到 `assets/uploads/`）。
3. 命名建议与作品 `id` 保持一致，便于对应管理。

**无图时自动降级为渐变占位封面**：`cover` 留空、或图片路径不存在 / 加载失败时，卡片会自动显示一块渐变封面（背景为渐变色，上面标注作品类型与片名），不会出现破图。渐变颜色由作品 `id` 决定，因此同一件作品的占位封面始终是同一个颜色。全部现有作品默认都没有实际封面图，你替换后即可看到真实画面。

推荐尺寸：16:9（如 1920×1080），单张控制在 500KB 以内，加载更快。

## 四、两种视频播放方式

详情页与首页 Showreel 都采用**点击封面后才加载播放器**的方式：初始只加载封面图，点击后再注入 iframe 或 `<video>`，避免一次性加载多个播放器拖慢页面。

**方式一：在线嵌播（B站 / Vimeo / YouTube 等）**

```js
video: {
  type: "iframe",
  url: "https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&autoplay=1"
}
```

常用嵌入地址格式：

| 平台 | 嵌入地址 |
| --- | --- |
| B站 | `https://player.bilibili.com/player.html?bvid=<BV号>&autoplay=1` |
| Vimeo | `https://player.vimeo.com/video/<视频ID>` |
| YouTube | `https://www.youtube.com/embed/<视频ID>` |

注意：这类在线播放需要联网；部分平台对 `file://` 本地打开的页面可能有限制，若无法播放，请把视频托管后使用嵌入链接，或用下面的本地 mp4 方式。

**方式二：本地 mp4 文件**

```js
video: { type: "file", url: "assets/videos/my-new-work.mp4" }
```

把视频文件放进 `assets/videos/` 目录后填写相对路径即可，用系统默认播放器控件（含进度条、音量、全屏）。本地文件不受网络影响，双击 `index.html` 也能正常播放。

> 现状说明：`assets/videos/` 目录内目前没有实际的 mp4 文件，作品与 Showreel 的视频均使用**外链嵌播**（B站等），且 `profile.showreel.video.url` 里的 BV 号仍是示例值。要改用站内播放，请先把 mp4 放进 `assets/videos/` 再填相对路径；注意 Cloudflare Pages 对单个文件体积有限制（约 25 MiB），成片建议继续走外链。

---

## 五、本地预览与部署

**本地预览**：直接双击 `index.html`，或在浏览器地址栏打开该文件。全部功能（筛选、详情页、时间线、视频播放）在 `file://` 协议下都能正常工作。

**部署到静态托管**（任选其一，整个 `portfolio-site` 文件夹上传即可）：

| 方式 | 步骤 |
| --- | --- |
| GitHub Pages | 把文件夹内容推到仓库根目录 → Settings → Pages → 选择分支 → 访问生成的地址 |
| Netlify / Vercel | 直接把 `portfolio-site` 文件夹拖进部署面板，无需构建命令 |
| 对象存储（OSS / COS / S3） | 上传整个文件夹，开启静态网站托管 |
| 自建服务器 | 上传到站点目录即可，无需安装任何运行环境 |
| Cloudflare Pages | 连接 GitHub 仓库，构建命令 `node build.js`，输出目录留空（见第六节，含在线后台编辑） |

部署后建议把 `assets/covers/` 中的实际封面图一并上传；若暂无封面图，渐变占位封面同样可以正常访问。

---

## 六、后台编辑与部署（Sveltia CMS + Cloudflare Pages）

部署到 Cloudflare Pages 之后，访问 `https://portfolio-site-7i5.pages.dev/admin/`，用 GitHub 账号登录，即可在网页表单里改内容，点保存自动提交并重新发布——不需要本地环境、不需要会 Git。

> 后台已由 Decap CMS 迁移为 **Sveltia CMS**（配置格式兼容，登录方式与 GitHub OAuth 链路不变，原文件备份在 `_legacy-decap-backup/`）。

### 6.1 工作原理

| 环节 | 说明 |
| --- | --- |
| 数据源 | `content/data.json`：后台编辑器读写的就是这一个文件 |
| 构建 | `build.js` 读取 `content/data.json`，生成 `assets/js/data.js`（即 `window.PORTFOLIO_DATA = {...}`），并把 `share` 分享信息注入四页 HTML 的 og / twitter 标签 |
| 页面 | 四个 HTML 页面用 `<script src="assets/js/data.js">` 读取数据，所以本地双击也能预览 |
| 后台 | `admin/index.html` 加载 Sveltia CMS（动态 import 后显式 `CMS.init()`），读取 `admin/config.yml` 里的仓库与字段配置 |
| 登录 | `functions/api/auth.js` 跳转 GitHub 授权 → `functions/api/callback.js` 用 code 换取 token 并回传，Client Secret 全程留在服务端 |
| 发布 | 后台「保存」= 向 GitHub 提交一次 commit → Cloudflare Pages 检测到提交 → 执行 `node build.js` → 发布新版本 |

> `admin/` 与 `api/` 只在 Cloudflare Pages 上生效。本地用 `file://` 双击打开时无法登录后台（属正常现象），本地改内容请直接编辑 `content/data.json` 后执行 `node build.js`。

### 6.2 第一步：把站点上传到 GitHub

1. 在 GitHub 新建仓库（私有仓库也可以），例如 `portfolio-site`，**不要**勾选自动生成 README。
2. 把 `portfolio-site` 文件夹**里面的内容**推到仓库，让 `index.html` 位于仓库根目录：

```bash
cd portfolio-site
git init
git add .
git commit -m "init: 作品集站点"
git branch -M main
git remote add origin https://github.com/你的用户名/portfolio-site.git
git push -u origin main
```

### 6.3 第二步：注册 GitHub OAuth App（用于后台登录）

GitHub 右上角头像 → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**：

| 字段 | 填什么 |
| --- | --- |
| Application name | 任意，例如 `作品集后台` |
| Homepage URL | 站点域名，例如 `https://portfolio-site-7i5.pages.dev` |
| Authorization callback URL | **必须是** `https://你的域名/api/callback`，本站即 `https://portfolio-site-7i5.pages.dev/api/callback`（不能填 `/admin`，也不能漏掉 `/api`） |

创建后点 **Generate a new client secret**，记下 **Client ID** 与 **Client Secret**（Secret 只显示一次，请立即保存）。

> 还没拿到域名时，可先按 6.4 建好 Pages 项目拿到 `xxx.pages.dev` 域名，再回来注册。日后更换自定义域名，记得把 Homepage URL 与回调地址一起改掉。

### 6.4 第三步：创建 Cloudflare Pages 项目

1. 登录 Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，授权并选中刚建的仓库。
2. 构建设置：
   - **Framework preset**：`None`
   - **Build command**：`node build.js`
   - **Build output directory**：留空（或填 `/`）——站点源文件本身就是发布产物
3. **Save and Deploy**，约 1 分钟后拿到访问域名（本站实际为 `https://portfolio-site-7i5.pages.dev`——若默认 `portfolio-site.pages.dev` 子域已被占用，Cloudflare 会自动追加随机后缀，以控制台显示为准），先确认首页能正常打开。

### 6.5 第四步：配置环境变量

Cloudflare Pages 项目 → **Settings** → **Variables and secrets** → **Add**，添加两条（类型选 **Secret**）：

| 变量名 | 值 |
| --- | --- |
| `GITHUB_CLIENT_ID` | 6.3 拿到的 Client ID |
| `GITHUB_CLIENT_SECRET` | 6.3 拿到的 Client Secret |

添加完成后到 **Deployments** 里对最新一次部署点 **Retry deployment**（环境变量需在重新部署后生效）。

### 6.6 第五步：填写后台配置

打开 `admin/config.yml`，确认 backend 段三项与实际部署一致（本项目已按实际情况填好，通常无需改动；仅在更换账号 / 仓库 / 域名时才需修改）：

```yaml
backend:
  name: github
  repo: "zhao6822/portfolio-site"                   # 仓库，格式：用户名/仓库名
  branch: "main"                                    # 部署分支
  base_url: "https://portfolio-site-7i5.pages.dev"  # 站点域名，结尾不要带斜杠
  auth_endpoint: "/api/auth"
```

改完提交推送，Cloudflare Pages 会自动重新部署。

### 6.7 第六步：登录后台编辑（日常使用）

1. 打开 `https://portfolio-site-7i5.pages.dev/admin/`；
2. 点 **Sign in with GitHub**（「使用 GitHub 登录」），在弹出的 GitHub 页面点 **Authorize**；
3. 进入后台 → 左侧「站点内容」→「全站数据」，可编辑四块内容（表单顺序即下列顺序）：
   - **作品列表**：每件作品的标题、id、客户、类型、交付时间、封面图、视频、成果数据等，支持**新增 / 删除 / 拖动排序**；
   - **分享卡片**：微信 / 朋友圈转发链接时的标题、描述与缩略图（见 6.8）；
   - **作品类型**：首页筛选按钮的分类；
   - **个人信息**（默认折叠）：姓名、头衔、简介、联系方式、Showreel、擅长方向、软件、合作品牌、工作流程、外链。
4. 点右上角 **Save**：自动向 GitHub 提交一次 commit，Cloudflare Pages 随即重新构建并发布，约 1 分钟后线上生效。

编辑注意：

- 「作品 ID」用于生成详情页地址，新增作品时请填唯一英文短横线命名（如 `my-new-work`）；已上线作品的 ID 不要修改。
- 封面图点字段旁的 **Choose an image → Upload** 上传，文件会存到 `assets/uploads/`；留空则显示渐变占位封面。
- 「交付时间」保持 `YYYY-MM` 格式（如 `2025-07`），时间线按它倒序排列。
- 视频「播放方式」选「外链嵌播」时填 B站 / Vimeo / YouTube 嵌播地址；选「本站视频文件」时填 `assets/videos/xxx.mp4`（文件需自行放进仓库）。
- 作品序号顺序可在列表里拖动调整，时间线仍以「交付时间」倒序为准。
- 「分享卡片」分组控制微信 / 朋友圈转发链接时显示的标题、描述与缩略图，见 6.8。

### 6.8 修改分享卡片（微信 / 朋友圈转发显示）

后台「全站数据」的第二块即「分享卡片」，对应 `content/data.json` 的 `share` 分组：

| 字段 | 作用 |
| --- | --- |
| 分享标题 | 转发卡片上的标题。**仅首页链接生效**，内页仍显示各页自己的标题；建议 12-24 字 |
| 分享描述 | 标题下方的一行说明。**仅首页链接生效**；建议 16-40 字 |
| 分享缩略图 | 四页共用同一张图；建议 1200×630 像素、文件小于 300KB，上传后自动存到 `assets/uploads/` |

要点：

1. 留空的项自动沿用页面自带的默认值（默认缩略图为 `assets/images/og-cover.png`）。
2. 改动由 `build.js` 在**构建时**注入各页面的 `og:title` / `og:description` / `og:image` 与 `twitter:*` 标签：线上保存后等约 1 分钟重新构建；本地改 `content/data.json` 后必须执行 `node build.js` 才会写入页面。
3. 微信 / QQ 会缓存已抓取过的卡片，验证时请用带参数的新链接（如 `https://portfolio-site-7i5.pages.dev/?v=2`）或在微信里清空缓存后再试。
4. 缩略图必须是公网可访问的图片；相对路径会在构建时自动补成站点绝对地址（微信抓取要求绝对 URL）。

### 6.9 回滚与常见问题

**回滚**：Cloudflare Pages → **Deployments** → 选中要恢复的那次部署 → **Rollback to this deployment**（只回滚线上产物，不改仓库内容）。若要连仓库内容一并退回，在 GitHub 上对 `content/data.json` 执行 **Revert** 提交。

| 现象 | 原因与处理 |
| --- | --- |
| 点登录后空白 / 一直转圈 | `admin/config.yml` 的 `base_url` / `repo` / `branch` 还是占位符，或与实际仓库不一致 |
| 提示 `state 校验未通过` | 登录弹窗停留过久（state Cookie 有效期 10 分钟），关闭弹窗重新登录 |
| 提示缺少 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 环境变量未配置或配置后未重新部署，按 6.5 处理 |
| GitHub 报 `redirect_uri_mismatch` | OAuth App 的 Authorization callback URL 必须与 `https://你的域名/api/callback` 完全一致（含协议与路径） |
| 保存报 404 / 无权限 | 所用 GitHub 账号对该仓库无写权限，或授权时未同意仓库权限，重新授权一次 |
| 保存成功但线上没更新 | 构建失败会保留上一版本：到 Cloudflare Pages → Deployments → 打开最新构建日志（常见原因是 `content/data.json` 被改成了非法 JSON） |
| `*.pages.dev` 能登录、自定义域名不能 | GitHub 一个 OAuth App 只允许一个回调地址，两个域名需分别注册 OAuth App，或只保留一个域名访问 |
| 后台界面是英文 | `admin/config.yml` 中 `locale: zh_Hans` 未生效（语言包未取到），不影响功能使用 |

---

## 七、常见问题

**Q：改了内容，页面没有变化？**
分两种情况：本地直接改 `content/data.json` 后，必须先执行 `node build.js` 重新生成 `assets/js/data.js`（只改 `assets/js/data.js` 的话，下次构建会被覆盖回去）；线上通过 `/admin/` 保存后，等 Cloudflare Pages 重新构建完成（约 1 分钟）。若仍是旧内容，按 `Ctrl + F5` 强制刷新清浏览器缓存。

**Q：作品详情页显示「未找到对应作品」？**
说明地址里的 `id` 与 `data.js` 中的 `id` 不一致，检查是否拼写错误或被改过。

**Q：封面图不显示？**
图片相对路径写错、文件名大小写不符或文件未放进 `assets/covers/` 时，会自动显示渐变占位封面，不会有破图；确认路径后刷新即可。

**Q：想增加新的作品类型？**
在 `content/data.json` 的 `categories` 数组里加一项（后台对应「作品类型」分组），并在作品对象的 `category` 里使用同一名称即可，筛选栏会自动出现该按钮。

**Q：中文字符乱码？**
所有文件均为 UTF-8 编码，用文本编辑器保存时请保持 UTF-8 编码。

**Q：改了分享卡片，微信里还是旧标题 / 旧缩略图？**
微信 / QQ 会缓存已抓取过的卡片。请用带参数的新链接（如 `https://portfolio-site-7i5.pages.dev/?v=2`）验证，或在微信中清空缓存后重试；同时确认 Cloudflare Pages 的重新构建已经完成。

**Q：想让 AI 助手（Cursor / Claude Code）接手维护？**
把仓库克隆下来后，让助手先读仓库根目录的 `AGENTS.md`（数据模型、部署机制、约束坑点与当前待办都在里面），再动手改动。

---

> 技术交接与改动规范详见 [AGENTS.md](./AGENTS.md)。
