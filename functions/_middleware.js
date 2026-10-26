/**
 * 访问门中间件（Cloudflare Pages Functions）
 * ---------------------------------------------------------------------
 *  作用：拦截所有请求，对「页面 HTML」做访问控制（管理员钥匙 + 访客临时码）：
 *    · 放行 /admin 后台与 /api（Decap/Sveltia OAuth 与数据接口不受影响）；
 *    · 放行社交爬虫 UA（微信 / QQ / Facebook / Twitter 等），保证分享
 *      卡片 og 标签可被抓取；
 *    · 放行静态资源（js / css / 图片 / 视频 / 字体等）；
 *    · 管理员：URL query 的 owner 参数与 Cloudflare 环境变量 OWNER_KEY
 *      比对，匹配则放行（OWNER_KEY 由用户在 Cloudflare 面板配置
 *      Secret，绝不写入仓库）；
 *    · 访客：URL query 的 visit 参数命中 access.json 中 accessCodes 数组
 *      任意一个即放行；
 *    · 无有效凭据（owner / visit）的页面请求一律返回 403「无权访问」；
 *      不种 Cookie、不记住身份，每次访问都必须带有效参数。
 *  访客码来源：构建产物 access.json（由 build.js 依据
 *              content/data.json 的 site.accessCodes 生成）。
 */

/* 社交爬虫 / 分享卡片抓取 UA（命中即放行，保证转发时有 og 卡片） */
const SOCIAL_UA_PATTERN =
  /(MicroMessenger|wechat|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|slackbot|Discordbot|WhatsApp|TelegramBot|Pinterest|YandexBot|QQSpider|QQ\/|MQQBrowser|Baiduspider|bingbot|Googlebot|Applebot|MetaInspector)/i;

/* 静态资源扩展名（放行，不参与访问门校验；json 用于中间件读取 access.json） */
const STATIC_EXT_PATTERN =
  /\.(js|css|json|png|jpe?g|webp|gif|svg|ico|avif|mp4|webm|ogv|mp3|wav|m4a|woff2?|ttf|otf|eot|pdf|zip|map)$/i;

/* 中间件内部读取 access.json 的专用令牌（外部请求无法伪造） */
const INTERNAL_ACCESS_TOKEN = "ia-tok-7f3k2v9q";

const ADMIN_PREFIX = "/admin";

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  /* ① 后台与 API 放行（OAuth 回调、CMS 资源不受访问门影响） */
  if (path === ADMIN_PREFIX || path.startsWith(ADMIN_PREFIX + "/") || path.startsWith("/api/")) {
    return next();
  }

  /* ①.4 中间件内部读取数据文件专用放行（令牌校验，外部不可伪造） */
  if (
    (path === "/access.json" || path === "/content/data.json") &&
    request.headers.get("X-Access-Internal") === INTERNAL_ACCESS_TOKEN
  ) {
    return next();
  }

  /* ①.5 敏感数据文件（作品数据、访客码清单）不得裸放行，必须通过访问门校验 */
  const PROTECTED_DATA = /^\/(assets\/js\/data\.js|access\.json|content\/data\.json)$/i;

  /* ② 静态资源放行（页面依赖的 JS / CSS / 图片 / 视频 / 字体等；敏感数据除外） */
  if (!PROTECTED_DATA.test(path) && STATIC_EXT_PATTERN.test(path)) {
    return next();
  }

  /* ③ 社交爬虫识别（微信 / QQ / FB / Twitter 等）：不再直接放行真实页面，
    仅标记 isSocialBot——若未通过凭据校验，只返回不含正文的分享预览壳，
    保证转发分享时 og 卡片可被抓取，但拿不到任何真实内容 */
  const ua = request.headers.get("user-agent") || "";
  const isSocialBot = SOCIAL_UA_PATTERN.test(ua);

  /* ④（已移除）严格模式：不种免码 Cookie，也不接受 Cookie 放行，
    每次访问都必须携带有效 ?owner= 或 ?visit= 参数 */

  /* ⑤ 管理员钥匙：?owner= 与 Cloudflare 环境变量 OWNER_KEY 比对 */
  const ownerKey = env.OWNER_KEY || "";
  const owner = (url.searchParams.get("owner") || "").trim();
  if (ownerKey && owner && owner === ownerKey) {
    return passHtmlCredential(await next(), "owner", owner);
  }

  /* ⑥ 访客临时码：?visit= 命中 access.json 的 accessCodes 数组任意一项 */
  const visit = (url.searchParams.get("visit") || "").trim();
  if (visit) {
    try {
      const accessResp = await fetch(new URL("/access.json", url).toString(), {
        headers: { "X-Access-Internal": INTERNAL_ACCESS_TOKEN },
      });
      if (accessResp.ok) {
        const access = await accessResp.json();
        const codes = Array.isArray(access.accessCodes) ? access.accessCodes : [];
        if (
          codes.some(function (code) {
            return String(code).trim() === visit;
          })
        ) {
          return passHtmlCredential(await next(), "visit", visit);
        }
      }
    } catch (err) {
      /* 读取 access.json 异常时不放行（其它放行条件已在上方处理） */
    }
  }

  /* ⑦ 其余请求：未通过凭据校验。
     - 社交爬虫 / 微信内置浏览器：返回 200 的「访问码表单页」（内含 og 标签，
       微信转发时爬虫可抓取分享卡片，微信内真实用户打开则能看到输码表单）；
     - 其他请求：403 无权访问（同样带表单与 og 标签，方便复制链接到浏览器输码） */
  if (isSocialBot) {
    return new Response(unauthorizedHtml(url), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(unauthorizedHtml(url), {
    status: 403,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function unauthorizedHtml(url) {
  return (
    "<!DOCTYPE html>\n" +
    '<html lang="zh-CN">\n' +
    "<head>\n" +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '  <meta property="og:title" content="赵鹏 · 作品集 — 无限进步">\n' +
    '  <meta property="og:description" content="赵鹏的作品集，访问需授权。">\n' +
    '  <meta property="og:type" content="website">\n' +
    '  <meta property="og:image" content="https://portfolio-site-7i5.pages.dev/assets/images/og-cover.png">\n' +
    '  <meta name="twitter:card" content="summary_large_image">\n' +
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

/* 凭据透传：HTML 页面内的 data.js 引用会被改写为带当前凭据参数的地址，
   保证页面进入后浏览器请求 data.js 时携带有效参数、不被访问门 403 拦截。
   仅处理 text/html 响应，其余响应原样返回。 */
async function passHtmlCredential(response, key, value) {
  if (!response) return response;
  const contentType = response.headers.get("Content-Type") || "";
  if (!/text\/html/i.test(contentType)) return response;

  const html = await response.text();
  const token = encodeURIComponent(value);
  const rewritten = html.replace(
    /(<script\b[^>]*\bsrc\s*=\s*["'])(\/?)(assets\/js\/data\.js)(["'])/gi,
    function (match, pre, slash, path, post) {
      return pre + slash + path + "?" + key + "=" + token + post;
    }
  );

  if (rewritten === html) return response;

  const newHeaders = new Headers(response.headers);
  newHeaders.delete("content-length");
  newHeaders.delete("content-encoding");

  return new Response(rewritten, {
    status: response.status,
    headers: newHeaders,
  });
}
