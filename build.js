/* =====================================================================
 *  build.js · 静态构建脚本
 * ---------------------------------------------------------------------
 *  作用：把后台编辑器写入的数据源 content/data.json 编译成浏览器可直接
 *        用 <script> 标签加载的 assets/js/data.js（即 window.PORTFOLIO_DATA = {...}）。
 *
 *  为什么这样做：站点是零依赖纯静态站，页面用 <script src> 引入数据，
 *        双击 index.html（file:// 协议）也能预览，不受 fetch 跨域限制；
 *        而 CMS 后台只能编辑标准 JSON，因此需要这一步「JSON → JS 赋值」编译。
 *
 *  使用方式：
 *    · 本地：在站点根目录执行   node build.js
 *    · 线上：Cloudflare Pages 的「构建命令」填   node build.js
 *
 *  依赖：仅使用 Node 内置模块（Node 12+ 即可），无需 npm install。
 * ===================================================================== */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SOURCE = path.join(ROOT, "content", "data.json");
const TARGET = path.join(ROOT, "assets", "js", "data.js");

function fail(msg) {
  console.error("[build] 构建失败：" + msg);
  process.exit(1);
}

if (!fs.existsSync(SOURCE)) {
  fail("找不到数据源文件 content/data.json，请确认仓库结构完整。");
}

let data;
try {
  data = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
} catch (err) {
  fail("content/data.json 不是合法 JSON：" + err.message);
}

/* 基础结构校验：页面依赖 profile / categories / works 三块，缺一不可 */
["profile", "categories", "works"].forEach(function (key) {
  if (!(key in data)) fail('数据源缺少必需字段 "' + key + '"。');
});
if (!Array.isArray(data.works)) fail('"works" 必须是数组。');
if (!Array.isArray(data.categories)) fail('"categories" 必须是数组。');

/* content/data.json 里的封面/视频路径直接用相对路径（如 assets/covers/x.jpg）。
   在 Cloudflare Pages 上根目录即站点根，相对路径同样可用，且能兼容 file:// 本地预览。 */

const banner = [
  "/* =====================================================================",
  " *  剪辑师作品集 · 数据文件",
  " * ---------------------------------------------------------------------",
  " *  · 本文件由 build.js 依据 content/data.json 自动生成，请勿直接编辑。",
  " *  · 日常维护请打开站点 /admin 后台，或直接修改 content/data.json。",
  " *  · 本地生成命令：node build.js",
  " * =====================================================================*/",
  "",
  ""
].join("\n");

const output = banner + "window.PORTFOLIO_DATA = " + JSON.stringify(data, null, 2) + ";\n";

fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(TARGET, output, "utf8");

console.log(
  "[build] 构建完成：assets/js/data.js  ←  content/data.json" +
    "（作品 " + data.works.length + " 条，类型 " + data.categories.length + " 个）"
);

/* =====================================================================
 *  分享卡片注入
 * ---------------------------------------------------------------------
 *  作用：把 content/data.json 里 share 分组（后台「分享卡片」）的
 *        分享标题 / 分享描述 / 分享缩略图，写进各页面 HTML 的
 *        og:title / og:description / og:image 等标签，微信、朋友圈、
 *        QQ 转发链接时就会显示带缩略图的富卡片。
 *
 *  规则：
 *    · 首页 index.html ：og:title、og:description、og:image 均用 share 的值；
 *    · 内页 about / timeline / project ：只把 og:image 换成 share 的缩略图，
 *      它们各自的标题与描述保持 HTML 里原有的文案不变；
 *    · share 中留空的项 —— 保留 HTML 里已有的硬编码值作为默认回退；
 *    · share.image 支持绝对网址或相对路径（相对路径会补成站点绝对地址，
 *      微信抓取缩略图要求绝对 URL）。
 *  说明：注入结果只写入构建产物，不会改动仓库里的源文件。
 * ===================================================================== */

/* 站点域名：优先读 admin/config.yml 的 base_url，读不到则用下面的默认值 */
var SITE_URL = "https://portfolio-site-7i5.pages.dev";
try {
  var cfgText = fs.readFileSync(path.join(ROOT, "admin", "config.yml"), "utf8");
  var cfgMatch = cfgText.match(/base_url:[ \t]*["']?([^"'\r\n]+)/);
  if (cfgMatch && cfgMatch[1].trim()) {
    SITE_URL = cfgMatch[1].trim().replace(/\/+$/, "");
  }
} catch (err) {
  /* 读不到配置就用上面的默认域名，不影响构建 */
}

var share = data.share && typeof data.share === "object" ? data.share : {};
var shareTitle = String(share.title || "").trim();
var shareDesc = String(share.description || "").trim();
var shareImage = String(share.image || "").trim();

function attrValue(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/* 相对路径 → 站点绝对地址；已是 http(s) 开头的原样返回 */
function toAbsolute(p) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return SITE_URL + "/" + p.replace(/^[./]+/, "");
}

/* 替换 <meta property|name="key" content="…"> 中 content 的值；找不到标签则原样返回 */
function setMeta(html, attr, key, value) {
  var head = "<meta " + attr + '="' + key + '" content="';
  var start = html.indexOf(head);
  if (start === -1) return html;
  var contentStart = start + head.length;
  var contentEnd = html.indexOf('"', contentStart);
  if (contentEnd === -1) return html;
  return html.slice(0, contentStart) + attrValue(value) + html.slice(contentEnd);
}

var SHARE_PAGES = [
  { file: "index.html", useTitle: true, useDesc: true },
  { file: "about.html", useTitle: false, useDesc: false },
  { file: "timeline.html", useTitle: false, useDesc: false },
  { file: "project.html", useTitle: false, useDesc: false }
];

var absImage = toAbsolute(shareImage);
var injected = [];

SHARE_PAGES.forEach(function (page) {
  var filePath = path.join(ROOT, page.file);
  if (!fs.existsSync(filePath)) return;

  var html = fs.readFileSync(filePath, "utf8");
  var original = html;

  if (page.useTitle && shareTitle) {
    html = setMeta(html, "property", "og:title", shareTitle);
    html = setMeta(html, "name", "twitter:title", shareTitle);
    html = setMeta(html, "property", "og:image:alt", shareTitle);
  }
  if (page.useDesc && shareDesc) {
    html = setMeta(html, "property", "og:description", shareDesc);
    html = setMeta(html, "name", "twitter:description", shareDesc);
  }
  if (absImage) {
    html = setMeta(html, "property", "og:image", absImage);
    html = setMeta(html, "name", "twitter:image", absImage);
  }

  if (html !== original) {
    fs.writeFileSync(filePath, html, "utf8");
    injected.push(page.file);
  }
});

console.log(
  "[build] 分享卡片注入：" +
    (injected.length
      ? injected.join("、") + "（标题：" + (shareTitle || "沿用页面默认值") + "）"
      : "未注入，页面保留原有默认值")
);

