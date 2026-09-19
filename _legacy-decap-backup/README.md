# 后台回滚说明（Sveltia CMS → Decap CMS）

本目录保存了 **2026-09-19 迁移到 Sveltia CMS 之前**的原始后台文件，用于随时回滚：

| 文件 | 说明 |
| --- | --- |
| `config.yml` | 迁移前的 Decap CMS 配置（199 行，含原字段顺序与全部原有 hint） |
| `index.html` | 迁移前的后台入口页（通过 unpkg 加载 decap-cms@3.3.3，并手动注入 zh_Hans 中文界面） |

## 方式一：只把后台退回 Decap（保留新版配置里的字段改进不影响）

1. 用本目录的 `index.html` 覆盖 `admin/index.html`；
2. 提交推送到 `main` 分支，等 Cloudflare Pages 重新构建（约 1 分钟）；
3. 刷新 `https://portfolio-site-7i5.pages.dev/admin/` 即为原 Decap 界面。

> 注意：新版 `admin/config.yml` 使用 Sveltia 与 Decap 共有的字段写法（object / list / select / datetime / image），
> 因此**新版 config.yml 同时兼容 Decap 与 Sveltia**，只替换 `index.html` 即可完成回滚。

## 方式二：完全回到迁移前的状态

1. 用本目录的 `config.yml` 覆盖 `admin/config.yml`；
2. 用本目录的 `index.html` 覆盖 `admin/index.html`；
3. 提交推送到 `main` 分支。

## 方式三：用 Git 历史回滚

```bash
git log --oneline -- admin/                 # 找到本次迁移的上一个提交号
git checkout <上一个提交号> -- admin/config.yml admin/index.html
git commit -m "revert: 后台退回 Decap CMS"
git push origin main
```

## 数据安全说明

本次迁移**未改动** `content/data.json`；后台无论用 Decap 还是 Sveltia，
保存时都按 `admin/config.yml` 的字段声明重建该文件，
本次迁移保持了全部字段名与嵌套层级不变，因此前端 `build.js` / `site.js` 不受影响。
