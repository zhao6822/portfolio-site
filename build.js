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

/* =====================================================================
 *  未传封面自动生成
 * ---------------------------------------------------------------------
 *  作用：works 里没有 cover（缺失或留空）的作品，在构建时自动生成一张
 *        1920×1080 的渐变 SVG 封面（类别标签 + 作品标题），写入
 *        assets/covers/，并把该作品的 cover 指向这张自动封面；
 *        已有 cover 的作品保持原样，不受影响。
 *  说明：文件名由作品 id 派生（auto-<id>.svg），同一作品每次构建结果
 *        稳定、幂等；以后给作品补上真实封面后，构建会自动跳过该作品。
 * ===================================================================== */

var COVERS_DIR = path.join(ROOT, "assets", "covers");
var AUTO_COVER_PREFIX = "auto-";

/* 与 site.js 渐变占位同风格的深色渐变（深底叠白字，简洁专业） */
var AUTO_COVER_GRADIENTS = [
  ["#1f2937", "#111827"],
  ["#312e81", "#1e1b4b"],
  ["#7c2d12", "#431407"],
  ["#134e4a", "#022c22"],
  ["#6b21a8", "#3b0764"],
  ["#7f1d1d", "#450a0a"]
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hashId(str) {
  var h = 0;
  for (var i = 0; i < String(str).length; i++) {
    h = (h * 31 + String(str).charCodeAt(i)) >>> 0;
  }
  return h;
}

/* 标题过长时拆成最多两行，每行不超过 16 个字符 */
function splitTitle(title) {
  var t = String(title || "").trim();
  if (!t) t = "未命名作品";
  var maxLine = 16;
  if (t.length <= maxLine) return [t];
  var first = t.slice(0, maxLine);
  var rest = t.slice(maxLine);
  if (rest.length <= maxLine) return [first, rest];
  return [first, rest.slice(0, maxLine - 1) + "…"];
}

/* 由作品 id 派生安全文件名；id 缺失时回退到 work-<序号> */
function safeCoverName(id, index) {
  var base = String(id || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!base) base = "work-" + (index + 1);
  return AUTO_COVER_PREFIX + base + ".svg";
}

/* 由分类 id 反查显示名称，用于 SVG 上的类别标签。
   categories 可能是字符串数组（显示名即值），也可能是 {id,name} 对象数组，两者都兼容。 */
function categoryLabel(catId) {
  if (!catId) return "";
  var categories = data.categories || [];
  for (var i = 0; i < categories.length; i++) {
    var c = categories[i];
    if (typeof c === "string") {
      if (c === String(catId)) return c;
    } else if (c && String(c.id) === String(catId)) {
      return String(c.name) || String(catId);
    }
  }
  return String(catId);
}

function buildAutoCoverSvg(work, index) {
  var id = String(work.id || "");
  var titleLines = splitTitle(work.title);
  var cat = categoryLabel(work.category);
  var g = AUTO_COVER_GRADIENTS[hashId(id) % AUTO_COVER_GRADIENTS.length];
  var gradId = "auto-grad-" + index;
  var font = 'font-family="PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"';
  var parts = [];

  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">');
  parts.push("  <defs>");
  parts.push('    <linearGradient id="' + gradId + '" x1="0" y1="0" x2="1" y2="1">');
  parts.push('      <stop offset="0%" stop-color="' + g[0] + '"/>');
  parts.push('      <stop offset="100%" stop-color="' + g[1] + '"/>');
  parts.push("    </linearGradient>");
  parts.push("  </defs>");
  parts.push('  <rect width="1920" height="1080" fill="url(#' + gradId + ')"/>');
  parts.push('  <rect x="0" y="0" width="1920" height="1080" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="6"/>');

  if (cat) {
    var labelW = 80 + cat.length * 40;
    var labelX = 960 - labelW / 2;
    parts.push('  <rect x="' + labelX + '" y="356" width="' + labelW + '" height="68" rx="34" fill="rgba(255,255,255,0.16)"/>');
    parts.push('  <text x="960" y="400" text-anchor="middle" ' + font + ' font-size="38" fill="rgba(255,255,255,0.92)" letter-spacing="8">' + escapeXml(cat) + "</text>");
  }

  var firstY = titleLines.length === 1 ? 600 : 520;
  titleLines.forEach(function (line, i) {
    var y = firstY + i * 130;
    parts.push('  <text x="960" y="' + y + '" text-anchor="middle" ' + font + ' font-size="112" font-weight="600" fill="#ffffff" letter-spacing="4">' + escapeXml(line) + "</text>");
  });

  parts.push("</svg>");
  return parts.join("\n");
}

/* 遍历作品：为缺失封面的作品生成自动封面，并回写 cover 字段 */
var autoCovers = [];
fs.mkdirSync(COVERS_DIR, { recursive: true });
(data.works || []).forEach(function (work, index) {
  var cover = work.cover != null ? String(work.cover).trim() : "";
  if (cover) return; /* 已有封面：保持原样 */
  var fileName = safeCoverName(work.id, index);
  fs.writeFileSync(path.join(COVERS_DIR, fileName), buildAutoCoverSvg(work, index), "utf8");
  work.cover = "assets/covers/" + fileName;
  autoCovers.push(fileName);
});

if (autoCovers.length) {
  console.log("[build] 自动封面生成：" + autoCovers.length + " 张（" + autoCovers.join("、") + "）");
}

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