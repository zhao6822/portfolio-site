/**
 * GET /api/auth —— 后台登录第一步
 * ---------------------------------------------------------------------
 *  路径映射：functions/api/auth.js  →  https://站点域名/api/auth
 *
 *  Decap CMS 点击「使用 GitHub 登录」时，会打开一个弹窗指向
 *  admin/config.yml 中的 auth_endpoint（即本站 /api/auth）。
 *  本函数负责：生成防 CSRF 的 state → 写入 HttpOnly Cookie →
 *  302 跳转到 GitHub 授权页。
 *
 *  依赖环境变量（在 Cloudflare Pages 项目的 Settings → Variables and secrets 中配置）：
 *    GITHUB_CLIENT_ID      GitHub OAuth App 的 Client ID
 *    GITHUB_CLIENT_SECRET  GitHub OAuth App 的 Client Secret（仅在 callback.js 中使用）
 *
 *  注意：GitHub OAuth App 后台填写的 Authorization callback URL 必须是
 *        https://你的域名/api/callback
 * ---------------------------------------------------------------------
 */

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clientId = (env.GITHUB_CLIENT_ID || "").trim();

  if (!clientId) {
    return new Response(
      "缺少环境变量 GITHUB_CLIENT_ID。\n" +
        "请在 Cloudflare Pages 项目 → Settings → Variables and secrets 中添加后重新部署。\n" +
        "（本地开发环境无法完成 GitHub 登录，请部署到 Cloudflare Pages 后再测试后台。）",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  // 回调地址必须与 GitHub OAuth App 中登记的一致（同域名下的 /api/callback）
  const redirectUri = url.origin + "/api/callback";

  // 随机 state：回调时校验，防止授权码被冒用（CSRF）
  const state = crypto.randomUUID();

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "repo"); // 需要有仓库读写权限才能提交编辑
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("allow_signup", "true");

  const headers = new Headers();
  headers.set("Location", authorizeUrl.toString());
  headers.set("Cache-Control", "no-store");
  headers.append(
    "Set-Cookie",
    "decap_oauth_state=" + state + "; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax"
  );

  return new Response(null, { status: 302, headers });
}
