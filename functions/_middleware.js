/**
 * 访问门中间件（Cloudflare Pages Functions）
 * ---------------------------------------------------------------------
 *  作用：拦截所有请求，对「页面 HTML」做访问控制（管理员钥匙 + 访客临时码）：
 *    · 放行 /admin 后台与 /api（Decap/Sveltia OAuth 与数据接口不受影响）；
 *    · 放行社交爬虫 UA（微信 / QQ / Facebook / Twitter 等），保证分享
 *      卡片 og 标签可被抓取；
 *    · 放行静态资源（js / css / 图片 / 视频 / 字体等）；
 *    · 管理员：URL query 的 owner 参数与 Cloudflare 环境变量 OWNER_KEY
 *      比对，匹配则放行并种 30 天免码 Cookie（OWNER_KEY 由用户在
 *      Cloudflare 面板配置 Secret，绝不写入仓库）；
 *    · 访客：URL query 的 visit 参数命中 access.json 中 accessCodes 数组
 *      任意一个即放行并种 Cookie；
 *    · 已通过校验（携带 Cookie）的请求放行；
 *    · 其余页面请求返回 403「无权访问」。
 *  访客码来源：构建产物 access.json（由 build.js 依据
 *              content/data.json 的 site.accessCodes 生成）。
 */

/* 社交爬虫 / 分享卡片抓取 UA（命中即放行，保证转发时有 og 卡片） */
const SOCIAL_UA_PATTERN =
  /(MicroMessenger|wechat|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|slackbot|Discordbot|WhatsApp|TelegramBot|Pinterest|YandexBot|QQSpider|QQ\/|MQQBrowser|Baiduspider|bingbot|Googlebot|Applebot|MetaInspector)/i;

/* 静态资源扩展名（放行，不参与访问门校验） */
const STATIC_EXT_PATTERN =
  /\.(js|css|png|jpe?g|webp|gif|svg|ico|avif|mp4|webm|ogv|mp3|wav|m4a|woff2?|ttf|otf|eot|pdf|zip|map)$/i;

const ADMIN_PREFIX = "/admin";
const COOKIE_NAME = "site_visit_ok";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; /* 30 天 */

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  /* ① 后台与 API 放行（OAuth 回调、CMS 资源不受访问门影响） */
  if (path === ADMIN_PREFIX || path.startsWith(ADMIN_PREFIX + "/") || path.startsWith("/api/")) {
    return next();
  }

  /* ② 静态资源放行（页面依赖的 JS / CSS / 图片 / 视频 / 字体等） */
  if (STATIC_EXT_PATTERN.test(path)) {
    return next();
  }

  /* ③ 社交爬虫放行（分享卡片 og 标签可被微信 / QQ / FB / Twitter 抓取） */
  const ua = request.headers.get("user-agent") || "";
  if (SOCIAL_UA_PATTERN.test(ua)) {
    return next();
  }

  /* ④ 已通过校验的会话（Cookie）放行 */
  if (parseCookies(request.headers.get("cookie"))[COOKIE_NAME] === "1") {
    return next();
  }

  /* ⑤ 管理员钥匙：?owner= 与 Cloudflare 环境变量 OWNER_KEY 比对 */
  const ownerKey = env.OWNER_KEY || "";
  const owner = (url.searchParams.get("owner") || "").trim();
  if (ownerKey && owner && owner === ownerKey) {
    const resp = await next();
    resp.headers.append(
      "Set-Cookie",
      COOKIE_NAME + "=1; Path=/; Max-Age=" + COOKIE_MAX_AGE + "; SameSite=Lax"
    );
    return resp;
  }

  /* ⑥ 访客临时码：?visit= 命中 access.json 的 accessCodes 数组任意一项 */
  const visit = (url.searchParams.get("visit") || "").trim();
  if (visit) {
    try {
      const accessResp = await env.ASSETS.fetch(new URL("/access.json", url));
      if (accessResp.ok) {
        const access = await accessResp.json();
        const codes = Array.isArray(access.accessCodes) ? access.accessCodes : [];
        if (
          codes.some(function (code) {
            return String(code).trim() === visit;
          })
        ) {
          const resp = await next();
          resp.headers.append(
            "Set-Cookie",
            COOKIE_NAME + "=1; Path=/; Max-Age=" + COOKIE_MAX_AGE + "; SameSite=Lax"
          );
          return resp;
        }
      }
    } catch (err) {
      /* 读取 access.json 异常时不放行（其它放行条件已在上方处理） */
    }
  }

  /* ⑦ 其余请求：403 无权访问 */
  return new Response(unauthorizedHtml(url), {
    status: 403,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach(function (part) {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

function unauthorizedHtml(url) {
  return (
    "<!DOCTYPE html>\n" +
    '<html lang="zh-CN">\n' +
    "<head>\n" +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "  <title>无权访问</title>\n" +
    "  <style>\n" +
    "    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111827;color:#e5e7eb;font-family:'PingFang SC','Microsoft YaHei',sans-serif;}\n" +
    "    .box{max-width:420px;width:88%;text-align:center;}\n" +
    "    .code{font-size:64px;font-weight:700;color:#f59e0b;margin:0 0 8px;}\n" +
    "    h1{font-size:20px;margin:0 0 12px;}\n" +
    "    p{font-size:14px;color:#9ca3af;line-height:1.6;margin:0 0 20px;}\n" +
    '    input{width:100%;box-sizing:border-box;padding:10px 14px;border:1px solid #374151;border-radius:8px;background:#1f2937;color:#fff;font-size:16px;text-align:center;letter-spacing:4px;outline:none;}\n' +
    "    input:focus{border-color:#f59e0b;}\n" +
    '    button{margin-top:12px;width:100%;padding:10px;border:0;border-radius:8px;background:#f59e0b;color:#111827;font-size:16px;font-weight:600;cursor:pointer;}\n' +
    "  </style>\n" +
    "</head>\n" +
    "<body>\n" +
    '  <div class="box">\n' +
    '    <div class="code">403</div>\n' +
    '    <h1>此页面需要访问码</h1>\n' +
    '    <p>请输入访问码后继续访问作品集。<br>若您没有访问码，请联系站点主人获取。</p>\n' +
    '    <form method="get" action="' +
    escapeAttr(url.pathname) +
    '">\n' +
    '      <input type="text" name="visit" placeholder="访问码" autocomplete="off" autofocus>\n' +
    '      <button type="submit">进入作品集</button>\n' +
    "    </form>\n" +
    "  </div>\n" +
    "</body>\n" +
    "</html>"
  );
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
