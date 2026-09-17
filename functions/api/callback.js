/**
 * GET /api/callback —— 后台登录第二步（GitHub 授权回调）
 * ---------------------------------------------------------------------
 *  路径映射：functions/api/callback.js  →  https://站点域名/api/callback
 *
 *  流程：
 *   1. GitHub 授权后带 code + state 回调到本地址；
 *   2. 校验 state 与 /api/auth 写入的 Cookie 是否一致（防 CSRF）；
 *   3. 用 code 向 GitHub 换取 access_token（服务端换，secret 不外泄）；
 *   4. 返回一个极简 HTML，按 Decap CMS 的弹窗通信协议用 postMessage
 *      把 token 回传给 /admin 页面，随后自动关闭弹窗。
 *
 *  Decap CMS 弹窗协议要点（必须严格一致，否则后台会一直停在登录中）：
 *   · 弹窗页先向 window.opener 发送  authorizing:github
 *   · opener（/admin）收到后用同样字符串回复  authorizing:github
 *   · 弹窗页收到回复后发送  authorization:github:success:<token 的 JSON 字符串>
 *     失败时为           authorization:github:error:<错误信息的 JSON 字符串>
 *
 *  依赖环境变量：GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
 * ---------------------------------------------------------------------
 */

const PROVIDER = "github";
const CALLBACK_PATH = "/api/callback";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDesc = url.searchParams.get("error_description");

  if (oauthError) {
    return resultPage(null, "GitHub 授权被拒绝或失败：" + oauthError + (oauthErrorDesc ? "（" + oauthErrorDesc + "）" : ""));
  }

  if (!code) {
    return resultPage(null, "回调地址缺少 code 参数，请从站点 /admin 重新发起登录。");
  }

  // ---- 1. state 校验（与 /api/auth 写入的 Cookie 比对）----
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)decap_oauth_state=([^;]+)/);
  const cookieState = match ? match[1] : "";
  if (!cookieState || cookieState !== state) {
    return resultPage(null, "state 校验未通过（Cookie 缺失或已过期），请重新从 /admin 登录。");
  }

  // ---- 2. 环境变量检查 ----
  const clientId = (env.GITHUB_CLIENT_ID || "").trim();
  const clientSecret = (env.GITHUB_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    return resultPage(
      null,
      "缺少环境变量 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET，请在 Cloudflare Pages 项目设置中添加后重新部署。"
    );
  }

  // ---- 3. 用 code 换 access_token ----
  let token = "";
  try {
    const resp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "decap-cms-oauth-function"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: url.origin + CALLBACK_PATH,
        state: state
      })
    });
    const payload = await resp.json();
    if (payload.error || !payload.access_token) {
      return resultPage(
        null,
        "换取 access_token 失败：" + (payload.error_description || payload.error || "未知错误")
      );
    }
    token = payload.access_token;
  } catch (err) {
    return resultPage(null, "请求 GitHub 失败：" + (err && err.message ? err.message : String(err)));
  }

  // ---- 4. 成功：回传 token 给 /admin 弹窗调用方 ----
  return resultPage(token, null);
}

/**
 * 生成回传页面。
 * @param {string|null} token 成功时的 access_token；失败时传 null
 * @param {string|null} errorMessage 失败原因；成功时传 null
 */
function resultPage(token, errorMessage) {
  const isError = !token;
  const payload = isError
    ? JSON.stringify({ message: errorMessage || "登录失败" })
    : JSON.stringify({ token: token, provider: PROVIDER });

  // 作为 JS 源码字面量注入，避免引号/特殊字符破坏脚本
  const payloadLiteral = JSON.stringify(payload);
  const status = isError ? "error" : "success";

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${isError ? "登录失败" : "登录成功"}</title>
</head>
<body style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;padding:32px;color:#222">
  <p>${isError ? "登录失败，此窗口将自动关闭，请返回后台重试。" : "登录成功，此窗口将自动关闭。"}</p>
  <script>
    (function () {
      var provider = ${JSON.stringify(PROVIDER)};
      var payload = ${payloadLiteral};
      var status = ${JSON.stringify(status)};
      var message = "authorization:" + provider + ":" + status + ":" + payload;

      function receiveMessage(event) {
        // 只在收到 opener 的握手请求后回传结果
        if (event.data === "authorizing:" + provider) {
          try {
            window.opener.postMessage(message, event.origin);
          } catch (e) {
            window.opener.postMessage(message, "*");
          }
          window.removeEventListener("message", receiveMessage, false);
          setTimeout(function () { window.close(); }, 300);
        }
      }

      window.addEventListener("message", receiveMessage, false);
      // 主动发起握手（部分浏览器会先丢弃一次消息，因此同时做一次延迟重发）
      if (window.opener) {
        window.opener.postMessage("authorizing:" + provider, "*");
        setTimeout(function () {
          window.opener.postMessage("authorizing:" + provider, "*");
        }, 500);
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: isError ? 400 : 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // 用完即清，避免 state 复用
      "Set-Cookie": "decap_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
    }
  });
}
