/**
 * /api/links —— 访客链接管理接口（仅后台 /admin/links 页面调用）
 * ---------------------------------------------------------------------
 *  路径映射：functions/api/links.js → https://站点域名/api/links
 *
 *  鉴权（复用现有 GitHub OAuth，服务端不存 token）：
 *    · 页面通过 /api/auth → GitHub → /api/callback 弹窗流程拿到 access_token
 *      （scope=repo），保存在浏览器 sessionStorage；
 *    · 每次请求带  Authorization: Bearer <token>；
 *    · 本函数用该 token 调 GitHub API 校验身份（GET /user 成功且 login 为
 *      仓库 owner），再用同一 token 调 Contents API 读写仓库。
 *    · 未带 / 无效 token 一律 401，绝不会把访客码列表暴露给未登录者。
 *
 *  接口：
 *    GET  /api/links                     → { ok, codes: [{code, url, createdAt, status, note}] }
 *    POST /api/links  {action:"generate"}→ { ok, code, url, commit }
 *    POST /api/links  {action:"revoke", code:"XXXX"} → { ok, revoked, commit }
 *
 *  数据流：直接修改 content/data.json 的 site.accessCodes（数组）并新增/更新
 *          site.accessCodeMeta（code → {createdAt, status, note}）记录，然后
 *          通过 GitHub Contents API（PUT）提交推送到 main 分支。
 *          Cloudflare Pages 检测到 main 新提交后自动构建（约 1-2 分钟），
 *          build.js 读取新的 accessCodes 重新生成 access.json 生效。
 *          注意：OWNER_KEY（管理员钥匙）是 Cloudflare 环境变量，本接口完全不触碰。
 * ---------------------------------------------------------------------
 */

const REPO = "zhao6822/portfolio-site"; // 仓库 owner/name，与 admin/config.yml 一致
const BRANCH = "main";
const DATA_PATH = "content/data.json";

/* 生成码字符集：去掉易混淆的 0/O/1/I，32 个字符，8 位 → 32^8 ≈ 1.1e12 空间 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/* ---------- 工具：UTF-8 安全 base64 ---------- */
function base64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/* ---------- GitHub API 封装 ---------- */
async function ghApi(path, token, options) {
  const resp = await fetch("https://api.github.com" + path, {
    method: options && options.method ? options.method : "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "User-Agent": "portfolio-site-links-manager",
      ...(options && options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options && options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await resp.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    json = null;
  }
  return { status: resp.status, json };
}

/* 校验 token：必须有效且属于仓库 owner */
async function verifyOwner(token) {
  const { status, json } = await ghApi("/user", token);
  if (status !== 200 || !json || !json.login) return false;
  const owner = REPO.split("/")[0];
  return String(json.login).toLowerCase() === String(owner).toLowerCase();
}

/* 读取 data.json：返回 { sha, data } */
async function fetchDataFile(token) {
  const { status, json } = await ghApi(
    "/repos/" + REPO + "/contents/" + DATA_PATH + "?ref=" + BRANCH,
    token
  );
  if (status !== 200 || !json || !json.content) {
    throw new Error("读取 content/data.json 失败（HTTP " + status + "），请稍后重试");
  }
  let data;
  try {
    data = JSON.parse(base64ToUtf8(json.content));
  } catch (err) {
    throw new Error("content/data.json 解析失败：文件可能被手动编辑损坏");
  }
  return { sha: json.sha, data: data };
}

/* 写入 data.json（Contents API 提交推送）；409 冲突时自动重试一次 */
async function saveDataFile(token, data, message) {
  const newJson = JSON.stringify(data, null, 2) + "\n";
  const content = utf8ToBase64(newJson);

  async function putWithSha(sha) {
    return ghApi("/repos/" + REPO + "/contents/" + DATA_PATH, token, {
      method: "PUT",
      body: {
        message: message,
        content: content,
        sha: sha,
        branch: BRANCH
      }
    });
  }

  let resp = await putWithSha((await fetchDataFile(token)).sha);
  if (resp.status === 409) {
    // 远端在此期间有新提交（如 Sveltia 后台保存），重新取 sha 再试一次
    resp = await putWithSha((await fetchDataFile(token)).sha);
  }
  if (resp.status !== 200 && resp.status !== 201) {
    const msg = resp.json && resp.json.message ? resp.json.message : "未知错误";
    throw new Error("提交推送失败（HTTP " + resp.status + "）：" + msg);
  }
  return resp.json && resp.json.commit ? resp.json.commit.sha : "";
}

/* 生成 8 位随机访客码（不与现有码重复） */
function generateCode(existingCodes) {
  const existing = new Set(
    (existingCodes || []).map(function (c) {
      return String(c).trim().toUpperCase();
    })
  );
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  throw new Error("生成访客码失败：连续 50 次未得到唯一码，请重试");
}

/* 组装当前有效访客码列表 */
function buildCodeList(data, origin) {
  const codes = Array.isArray(data.site && data.site.accessCodes)
    ? data.site.accessCodes
    : [];
  const meta =
    data.site && typeof data.site.accessCodeMeta === "object" && data.site.accessCodeMeta !== null
      ? data.site.accessCodeMeta
      : {};
  return codes
    .filter(function (code) {
      return typeof code === "string" && code.trim().length > 0;
    })
    .map(function (code) {
      code = code.trim();
      const m = meta[code] || {};
      return {
        code: code,
        url: origin + "/?visit=" + encodeURIComponent(code),
        createdAt: m.createdAt || "",
        status: m.status === "revoked" ? "revoked" : "active",
        note: m.note || ""
      };
    });
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

/* ---------- GET：当前访客码列表 ---------- */
export async function onRequestGet({ request, env }) {
  const auth = (request.headers.get("Authorization") || "").trim();
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return jsonResponse(401, { ok: false, error: "未登录：请先在管理页完成 GitHub 登录" });
  }
  const ownerOk = await verifyOwner(token);
  if (!ownerOk) {
    return jsonResponse(401, { ok: false, error: "登录状态无效或非仓库管理员，已拒绝访问" });
  }

  try {
    const { data } = await fetchDataFile(token);
    const origin = new URL(request.url).origin;
    return jsonResponse(200, { ok: true, codes: buildCodeList(data, origin) });
  } catch (err) {
    return jsonResponse(500, { ok: false, error: err && err.message ? err.message : "读取失败" });
  }
}

/* ---------- POST：生成 / 收回 ---------- */
export async function onRequestPost({ request, env }) {
  const auth = (request.headers.get("Authorization") || "").trim();
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return jsonResponse(401, { ok: false, error: "未登录：请先在管理页完成 GitHub 登录" });
  }
  const ownerOk = await verifyOwner(token);
  if (!ownerOk) {
    return jsonResponse(401, { ok: false, error: "登录状态无效或非仓库管理员，已拒绝访问" });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(400, { ok: false, error: "请求体不是合法 JSON" });
  }
  const action = body && body.action;

  if (action !== "generate" && action !== "revoke") {
    return jsonResponse(400, { ok: false, error: "未知操作：action 仅支持 generate / revoke" });
  }

  try {
    const { data } = await fetchDataFile(token);
    if (!data.site) data.site = {};
    if (!Array.isArray(data.site.accessCodes)) data.site.accessCodes = [];
    if (
      typeof data.site.accessCodeMeta !== "object" ||
      data.site.accessCodeMeta === null ||
      Array.isArray(data.site.accessCodeMeta)
    ) {
      data.site.accessCodeMeta = {};
    }
    data.site.accessCodes = data.site.accessCodes.filter(function (code) {
      return typeof code === "string" && code.trim().length > 0;
    });

    const origin = new URL(request.url).origin;
    let result = {};

    if (action === "generate") {
      const code = generateCode(data.site.accessCodes);
      data.site.accessCodes.push(code);
      data.site.accessCodeMeta[code] = {
        createdAt: new Date().toISOString(),
        status: "active"
      };
      const message = "chore(access): 新增访客链接 " + code;
      const commit = await saveDataFile(token, data, message);
      result = { ok: true, code: code, url: origin + "/?visit=" + encodeURIComponent(code), commit: commit };
    } else {
      // revoke
      const code = String((body && body.code) || "").trim().toUpperCase();
      if (!code) {
        return jsonResponse(400, { ok: false, error: "缺少要收回的访客码" });
      }
      const before = data.site.accessCodes.length;
      data.site.accessCodes = data.site.accessCodes.filter(function (c) {
        return String(c).trim().toUpperCase() !== code;
      });
      if (data.site.accessCodes.length === before) {
        return jsonResponse(404, { ok: false, error: "访客码 " + code + " 不存在或已收回" });
      }
      const prevMeta = data.site.accessCodeMeta[code] || {};
      data.site.accessCodeMeta[code] = {
        createdAt: prevMeta.createdAt || "",
        status: "revoked",
        note: prevMeta.note || ""
      };
      const message = "chore(access): 收回访客链接 " + code;
      const commit = await saveDataFile(token, data, message);
      result = { ok: true, revoked: code, commit: commit };
    }

    return jsonResponse(200, result);
  } catch (err) {
    return jsonResponse(500, { ok: false, error: err && err.message ? err.message : "操作失败" });
  }
}
