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
