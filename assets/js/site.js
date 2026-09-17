/* =====================================================================
 *  剪辑师作品集 · 渲染脚本（零依赖原生 JavaScript）
 * ---------------------------------------------------------------------
 *  · 按 <body data-page="home|timeline|project|about"> 分发渲染逻辑
 *  · 数据全部读取自 window.PORTFOLIO_DATA（assets/js/data.js）
 *  · 视频采用「点击封面后再注入播放器」的懒加载方式
 * ===================================================================*/

(function (global) {
  "use strict";

  var DATA = global.PORTFOLIO_DATA || {};
  var PROFILE = DATA.profile || {};
  var WORKS = Array.isArray(DATA.works) ? DATA.works : [];
  var CATEGORIES = Array.isArray(DATA.categories) ? DATA.categories : [];
  var GRAD_COUNT = 6;

  /* ---------------- 基础工具 ---------------- */

  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function $(id) {
    return document.getElementById(id);
  }

  /* 稳定哈希：同一作品始终得到同一套占位渐变 */
  function hashIndex(str, n) {
    var s = String(str || "x");
    var h = 7;
    for (var i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) % 99991;
    }
    return h % n;
  }

  /* "2025-08" -> "2025年8月" */
  function formatMonth(date, short) {
    var parts = String(date || "").split("-");
    if (parts.length < 2) return esc(date);
    if (short) return parts[0] + "." + parts[1];
    return parts[0] + "年" + parseInt(parts[1], 10) + "月";
  }

  /* 按交付时间倒序（YYYY-MM 字符串可直接比较） */
  function sortedWorks() {
    return WORKS.slice().sort(function (a, b) {
      return String(b.deliveredAt).localeCompare(String(a.deliveredAt));
    });
  }

  function getParam(name) {
    var match = new RegExp("[?&]" + name + "=([^&#]*)").exec(global.location.search);
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
  }

  function workUrl(id) {
    return "project.html?id=" + encodeURIComponent(id);
  }

  function linkTarget(url) {
    return /^https?:/i.test(String(url)) ? ' target="_blank" rel="noopener"' : "";
  }

  function uniqueCategories() {
    var list = CATEGORIES.slice();
    WORKS.forEach(function (w) {
      if (w.category && list.indexOf(w.category) === -1) list.push(w.category);
    });
    return list;
  }

  /* ---------------- 公共片段 ---------------- */

  /* 封面：图片加载失败时露出渐变占位（.cover 自带渐变底） */
  function coverHtml(work) {
    var grad = "grad-" + hashIndex(work.id || work.title, GRAD_COUNT);
    var img = work.cover
      ? '<img class="cover-img" src="' + esc(work.cover) + '" alt="' + esc(work.title) +
        '" loading="lazy" onerror="this.style.display=\'none\'">'
      : "";

    return '<div class="cover ' + grad + '">' +
      '<div class="cover-fallback">' +
        '<span class="cover-fallback-cat">' + esc(work.category || "作品") + "</span>" +
        '<span class="cover-fallback-title">' + esc(work.title) + "</span>" +
      "</div>" +
      img +
      (work.duration ? '<span class="cover-duration">' + esc(work.duration) + "</span>" : "") +
      '<span class="cover-play" aria-hidden="true"></span>' +
      "</div>";
  }

  /* 播放器：点击封面后才注入 iframe / video */
  function playerHtml(video, cover, key, title, hint) {
    var type = video && video.type === "file" ? "file" : "iframe";
    var url = video && video.url ? video.url : "";
    var grad = "grad-" + hashIndex(key || title, GRAD_COUNT);
    var img = cover
      ? '<img class="cover-img" src="' + esc(cover) + '" alt="' + esc(title) +
        '" onerror="this.style.display=\'none\'">'
      : "";

    return '<div class="player cover ' + grad + '" data-type="' + type + '" data-url="' + esc(url) +
      '" data-title="' + esc(title) + '" role="button" tabindex="0" aria-label="播放视频">' +
      '<div class="cover-fallback">' +
        '<span class="cover-fallback-cat">' + esc(type === "file" ? "本地视频" : "在线播放") + "</span>" +
        '<span class="cover-fallback-title">' + esc(title) + "</span>" +
      "</div>" +
      img +
      '<span class="cover-play cover-play-lg" aria-hidden="true"></span>' +
      '<span class="player-hint">' + esc(hint || "点击封面播放") + "</span>" +
      "</div>";
  }

  function tagsHtml(items) {
    if (!items || !items.length) return "";
    return '<div class="tag-row">' + items.map(function (t) {
      return '<span class="tag">' + esc(t) + "</span>";
    }).join("") + "</div>";
  }

  function chipsHtml(items) {
    if (!items || !items.length) return "";
    return '<div class="chip-list">' + items.map(function (i) {
      return '<span class="chip">' + esc(i) + "</span>";
    }).join("") + "</div>";
  }

  function metricCardsHtml(metrics) {
    if (!metrics || !metrics.length) return "";
    return '<div class="metric-grid">' + metrics.map(function (m) {
      return '<div class="metric-card">' +
        '<span class="value">' + esc(m.value) + "</span>" +
        '<span class="label">' + esc(m.label) + "</span>" +
        "</div>";
    }).join("") + "</div>";
  }

  function linkButtonsHtml(links) {
    if (!links || !links.length) return "";
    return '<div class="link-list">' + links.map(function (l) {
      return '<a class="link-btn" href="' + esc(l.url) + '"' + linkTarget(l.url) + ">" +
        esc(l.label) + "</a>";
    }).join("") + "</div>";
  }

  function workCardHtml(work) {
    var roles = (work.roles || []).slice(0, 4).map(function (r) {
      return '<span class="tag">' + esc(r) + "</span>";
    }).join("");

    return '<article class="work-card" data-cat="' + esc(work.category || "") + '">' +
      '<a class="work-cover-link" href="' + workUrl(work.id) + '" aria-label="' + esc(work.title) + '">' +
        coverHtml(work) +
      "</a>" +
      '<div class="work-body">' +
        '<div class="work-cat">' + esc(work.category || "") + "</div>" +
        '<h3 class="work-title"><a href="' + workUrl(work.id) + '">' + esc(work.title) + "</a></h3>" +
        '<ul class="work-meta">' +
          "<li><span>客户</span>" + esc(work.client || "—") + "</li>" +
          "<li><span>类型</span>" + esc(work.category || "—") + "</li>" +
          "<li><span>片长</span>" + esc(work.duration || "—") + "</li>" +
          "<li><span>交付</span>" + formatMonth(work.deliveredAt) + "</li>" +
        "</ul>" +
        (roles ? '<div class="tag-row">' + roles + "</div>" : "") +
        '<p class="work-summary">' + esc(work.summary) + "</p>" +
        '<div class="work-foot"><a href="' + workUrl(work.id) + '">查看作品详情 →</a></div>' +
      "</div>" +
      "</article>";
  }

  function renderBrand() {
    var name = PROFILE.name || "";
    var mark = $("brandMark");
    var brand = $("brandName");
    if (mark) mark.textContent = name.slice(0, 1) || "作";
    if (brand) brand.textContent = name || "作品集";
  }

  function renderFooter() {
    var el = $("footerText");
    if (el) {
      el.innerHTML = "&copy; " + new Date().getFullYear() + " " + esc(PROFILE.name || "") +
        " · " + esc(PROFILE.title || "") + " · 静态站点，零依赖运行";
    }
  }

  /* ---------------- 播放器懒加载 ---------------- */

  function mountPlayer(box) {
    if (!box || box.classList.contains("playing")) return;
    var url = box.getAttribute("data-url");
    if (!url) return;

    var type = box.getAttribute("data-type");
    var media;

    if (type === "file") {
      media = '<video controls autoplay playsinline preload="auto" src="' + esc(url) + '"></video>' +
        '<p class="player-note">若画面未出现，请确认文件已放入 assets/videos/ 目录</p>';
    } else {
      media = '<iframe src="' + esc(url) + '" title="' + esc(box.getAttribute("data-title") || "") +
        '" frameborder="0" scrolling="no" allowfullscreen ' +
        'allow="autoplay; fullscreen; picture-in-picture; encrypted-media"></iframe>';
    }

    box.classList.add("playing");
    box.insertAdjacentHTML("beforeend", '<div class="player-media">' + media + "</div>");

    var video = box.querySelector("video");
    if (video) {
      video.addEventListener("playing", function () {
        var note = box.querySelector(".player-note");
        if (note) note.style.display = "none";
      });
    }
  }

  function bindPlayers() {
    document.addEventListener("click", function (e) {
      var box = e.target.closest ? e.target.closest(".player") : null;
      if (box) mountPlayer(box);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var box = e.target && e.target.classList && e.target.classList.contains("player") ? e.target : null;
      if (box) {
        e.preventDefault();
        mountPlayer(box);
      }
    });
  }

  /* ---------------- 页面渲染 ---------------- */

  var App = {

    /* ---------- 首页：Showreel + 类型筛选 + 作品网格 ---------- */
    home: function () {
      var heroCopy = $("heroCopy");
      var heroMedia = $("heroMedia");
      var list = sortedWorks();
      var cats = uniqueCategories();

      if (heroCopy) {
        var stats = [
          { value: String(WORKS.length), label: "收录作品" },
          { value: String(cats.length), label: "作品类型" },
          { value: String((PROFILE.brands || []).length), label: "合作品牌" },
          { value: PROFILE.years || "—", label: "从业经验" }
        ];

        heroCopy.innerHTML =
          '<span class="hero-label">' + esc(PROFILE.title || "") + " · " + esc(PROFILE.location || "") + "</span>" +
          "<h1>" + esc(PROFILE.name || "") + "</h1>" +
          '<p class="hero-tagline">' + esc(PROFILE.tagline || "") + "</p>" +
          '<p class="hero-bio">' + esc(PROFILE.bio || "") + "</p>" +
          '<div class="hero-actions">' +
            '<a class="btn btn-primary" href="#works">浏览全部作品</a>' +
            '<a class="btn btn-ghost" href="about.html">关于我</a>' +
          "</div>" +
          '<div class="hero-stats">' + stats.map(function (s) {
            return '<div class="stat"><span class="stat-value">' + esc(s.value) +
              '</span><span class="stat-label">' + esc(s.label) + "</span></div>";
          }).join("") + "</div>";
      }

      if (heroMedia) {
        var sr = PROFILE.showreel || {};
        heroMedia.innerHTML =
          playerHtml(sr.video, sr.cover, "showreel", sr.title || "Showreel", sr.hint) +
          '<div class="showreel-info">' +
            "<strong>" + esc(sr.title || "Showreel") + "</strong>" +
            "<span>" + esc(sr.subtitle || "") + (sr.duration ? " · " + esc(sr.duration) : "") + "</span>" +
          "</div>";
      }

      /* 类型筛选 */
      var bar = $("filterBar");
      if (bar) {
        var all = ["全部"].concat(cats);
        bar.innerHTML = all.map(function (c, i) {
          var count = c === "全部" ? WORKS.length : WORKS.filter(function (w) {
            return w.category === c;
          }).length;
          return '<button type="button" class="filter-btn' + (i === 0 ? " active" : "") +
            '" data-cat="' + esc(c) + '">' + esc(c) + '<em>' + count + "</em></button>";
        }).join("");

        bar.addEventListener("click", function (e) {
          var btn = e.target.closest ? e.target.closest(".filter-btn") : null;
          if (!btn) return;
          var cat = btn.getAttribute("data-cat");
          Array.prototype.forEach.call(bar.querySelectorAll(".filter-btn"), function (b) {
            b.classList.toggle("active", b === btn);
          });
          renderGrid(cat);
        });
      }

      var countEl = $("workCount");
      if (countEl) {
        countEl.textContent = "共 " + WORKS.length + " 件作品，按交付时间倒序展示";
      }

      function renderGrid(cat) {
        var grid = $("workGrid");
        if (!grid) return;
        var items = list.filter(function (w) {
          return !cat || cat === "全部" || w.category === cat;
        });
        if (!items.length) {
          grid.innerHTML = '<div class="empty-state"><h2>该类型下暂无作品</h2>' +
            "<p>可以切换其他类型，或在 assets/js/data.js 的 works 数组中添加作品。</p></div>";
          return;
        }
        grid.innerHTML = items.map(workCardHtml).join("");
      }

      renderGrid("全部");
    },

    /* ---------- 时间线：按交付时间倒序的剪辑作品时间轴 ---------- */
    timeline: function () {
      var box = $("timelineBox");
      if (!box) return;
      var list = sortedWorks();

      var countEl = $("timelineCount");
      if (countEl) {
        var span = "";
        if (list.length) {
          var years = list.map(function (w) { return String(w.deliveredAt).split("-")[0]; });
          span = "，时间跨度 " + years[years.length - 1] + " 年 - " + years[0] + " 年";
        }
        countEl.textContent = "共 " + list.length + " 件作品" + span;
      }

      if (!list.length) {
        box.innerHTML = '<div class="empty-state"><h2>暂无作品数据</h2>' +
          "<p>请在 assets/js/data.js 的 works 数组中添加作品后刷新页面。</p></div>";
        return;
      }

      var groups = [];
      list.forEach(function (w) {
        var key = String(w.deliveredAt);
        var last = groups[groups.length - 1];
        if (!last || last.key !== key) {
          groups.push({ key: key, items: [w] });
        } else {
          last.items.push(w);
        }
      });

      box.innerHTML = '<div class="timeline">' + groups.map(function (g) {
        var items = g.items.map(function (w) {
          var metrics = (w.results || []).slice(0, 3).map(function (m) {
            return '<span class="tl-metric"><b>' + esc(m.value) + "</b> " + esc(m.label) + "</span>";
          }).join("");

          return '<div class="tl-item">' +
            '<a class="tl-thumb" href="' + workUrl(w.id) + '" aria-label="' + esc(w.title) + '">' +
              '<div class="cover ' + "grad-" + hashIndex(w.id, GRAD_COUNT) + '">' +
                '<div class="cover-fallback"><span class="cover-fallback-title">' + esc(w.category || "") + "</span></div>" +
                (w.cover ? '<img class="cover-img" src="' + esc(w.cover) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : "") +
              "</div>" +
            "</a>" +
            '<div class="tl-body">' +
              '<div class="tl-head">' +
                "<h3><a href=" + '"' + workUrl(w.id) + '"' + ">" + esc(w.title) + "</a></h3>" +
                '<span class="tl-client">' + esc(w.client || "") + "</span>" +
              "</div>" +
              '<div class="tl-meta">' +
                "<span>" + esc(w.category || "") + "</span>" +
                "<span>片长 " + esc(w.duration || "—") + "</span>" +
                "<span>" + formatMonth(w.deliveredAt) + " 交付</span>" +
                "<span>职责：" + esc((w.roles || []).join(" / ") || "—") + "</span>" +
              "</div>" +
              '<p class="tl-summary">' + esc(w.summary) + "</p>" +
              (metrics ? '<div class="tl-metrics">' + metrics + "</div>" : "") +
              '<div class="tl-foot"><a href="' + workUrl(w.id) + '">查看作品详情 →</a></div>' +
            "</div>" +
            "</div>";
        }).join("");

        return '<div class="tl-group">' +
          '<span class="tl-month">' + formatMonth(g.key) + "</span>" +
          items +
          "</div>";
      }).join("") + "</div>";
    },

    /* ---------- 作品详情 ---------- */
    project: function () {
      var box = $("projectDetail");
      if (!box) return;

      var id = getParam("id");
      var current = null;
      for (var i = 0; i < WORKS.length; i++) {
        if (String(WORKS[i].id) === id) { current = WORKS[i]; break; }
      }

      if (!current) {
        box.innerHTML = '<div class="container section"><div class="empty-state">' +
          "<h2>" + (id ? "未找到对应作品" : "请从作品列表进入详情页") + "</h2>" +
          "<p>" + (id
            ? "地址中的作品标识「" + esc(id) + "」在数据文件中不存在，可能已被重命名或删除。"
            : "详情页需要通过 URL 参数指定作品，例如 project.html?id=auto-brand-film-north。") + "</p>" +
          '<a class="btn btn-primary" href="index.html">返回首页</a>' +
          "</div></div>";
        return;
      }

      var ordered = sortedWorks();
      var pos = ordered.map(function (w) { return w.id; }).indexOf(current.id);
      var newer = pos > 0 ? ordered[pos - 1] : null;
      var older = pos >= 0 && pos < ordered.length - 1 ? ordered[pos + 1] : null;

      var approach = (current.approach && current.approach.length)
        ? '<ul class="detail-list">' + current.approach.map(function (a) {
            return "<li>" + esc(a) + "</li>";
          }).join("") + "</ul>"
        : '<p class="section-sub">暂无记录</p>';

      var videoHint = current.video && current.video.type === "file"
        ? "点击封面播放本地视频"
        : "点击封面加载在线播放器";

      box.innerHTML =
        '<section class="detail-top"><div class="container">' +
          '<div class="breadcrumb"><a href="index.html">首页</a> / <a href="timeline.html">时间线</a> / ' +
            esc(current.category || "作品") + "</div>" +
          '<h1 class="detail-title">' + esc(current.title) + "</h1>" +
          '<div class="detail-meta">' +
            "<span>客户 / 品牌：<b>" + esc(current.client || "—") + "</b></span>" +
            "<span>类型：<b>" + esc(current.category || "—") + "</b></span>" +
            "<span>交付时间：<b>" + formatMonth(current.deliveredAt) + "</b></span>" +
            "<span>片长：<b>" + esc(current.duration || "—") + "</b></span>" +
          "</div>" +
          '<p class="detail-summary">' + esc(current.summary) + "</p>" +
          tagsHtml(current.roles) +
        "</div></section>" +

        '<div class="container section">' +
          '<div class="detail-player">' +
            playerHtml(current.video, current.cover, current.id, current.title, videoHint) +
          "</div>" +

          '<div class="detail-block"><h2>项目背景与需求</h2><p>' + esc(current.background) + "</p></div>" +
          '<div class="detail-block"><h2>创作思路与关键处理</h2>' + approach + "</div>" +

          '<div class="detail-two-col">' +
            '<div class="detail-block"><h2>担任职责</h2>' +
              (chipsHtml(current.roles) || '<p class="section-sub">暂无记录</p>') + "</div>" +
            '<div class="detail-block"><h2>使用软件</h2>' +
              (chipsHtml(current.software) || '<p class="section-sub">暂无记录</p>') + "</div>" +
          "</div>" +

          '<div class="detail-block"><h2>成果数据</h2>' +
            (metricCardsHtml(current.results) || '<p class="section-sub">暂无记录</p>') + "</div>" +
          '<div class="detail-block"><h2>相关链接</h2>' +
            (linkButtonsHtml(current.links) || '<p class="section-sub">暂无链接</p>') + "</div>" +

          '<div class="detail-nav">' +
            (newer ? '<span>较新作品：<a href="' + workUrl(newer.id) + '">' + esc(newer.title) + "</a></span>"
                   : '<span class="disabled">已是最新作品</span>') +
            (older ? '<span>较早作品：<a href="' + workUrl(older.id) + '">' + esc(older.title) + "</a></span>"
                   : '<span class="disabled">已是最早作品</span>') +
          "</div>" +
        "</div>";
    },

    /* ---------- 关于：擅长方向 / 软件 / 品牌 / 流程 / 联系方式 ---------- */
    about: function () {
      var box = $("aboutContent");
      if (!box) return;

      var list = sortedWorks();
      var years = list.map(function (w) { return String(w.deliveredAt).split("-")[0]; });
      var span = years.length ? years[years.length - 1] + " - " + years[0] : "—";

      var strengths = (PROFILE.strengths || []).map(function (s) {
        return '<div class="strength-card"><h3>' + esc(s.title) + "</h3><p>" + esc(s.desc) + "</p></div>";
      }).join("");

      var software = (PROFILE.software || []).map(function (g) {
        return '<div class="skill-group"><h4>' + esc(g.group) + "</h4>" + chipsHtml(g.items) + "</div>";
      }).join("");

      var brands = (PROFILE.brands || []).map(function (b) {
        return '<span class="brand-chip">' + esc(b) + "</span>";
      }).join("");

      var flow = (PROFILE.workflow || []).map(function (f, i) {
        return '<li class="flow-item">' +
          '<span class="flow-index">' + String(i + 1).padStart(2, "0") + "</span>" +
          '<div class="flow-body"><h4>' + esc(f.title) + "</h4><p>" + esc(f.desc) + "</p></div>" +
          "</li>";
      }).join("");

      var contactRows = [
        ["邮箱", PROFILE.email ? '<a href="mailto:' + esc(PROFILE.email) + '">' + esc(PROFILE.email) + "</a>" : "—"],
        ["电话", esc(PROFILE.phone || "—")],
        ["微信", esc(PROFILE.wechat || "—")],
        ["城市", esc(PROFILE.location || "—")]
      ].map(function (row) {
        return '<li><span class="k">' + row[0] + '</span><span class="v">' + row[1] + "</span></li>";
      }).join("");

      var external = (PROFILE.links || []).length
        ? '<div class="link-list" style="margin-top:16px">' + PROFILE.links.map(function (l) {
            return '<a class="link-btn" href="' + esc(l.url) + '"' + linkTarget(l.url) + ">" + esc(l.label) + "</a>";
          }).join("") + "</div>"
        : "";

      box.innerHTML =
        '<div class="container section">' +
          '<div class="section-head"><h2>关于我</h2><p>' + esc(PROFILE.title || "") + "</p></div>" +
          '<p class="section-sub">' + esc(PROFILE.bio || "") + "</p>" +

          '<div class="section-head" style="margin-top:44px"><h2>擅长方向与风格</h2>' +
            "<p>商业表达与情绪节奏并重</p></div>" +
          '<div class="strength-grid">' + strengths + "</div>" +

          '<div class="two-col" style="margin-top:44px">' +
            '<div class="about-card"><h3>软件与工具</h3>' + software + "</div>" +
            '<div class="about-card"><h3>联系方式</h3>' +
              '<ul class="info-list">' + contactRows + "</ul>" + external + "</div>" +
          "</div>" +

          '<div class="section-head" style="margin-top:44px"><h2>合作品牌</h2>' +
            "<p>共 " + (PROFILE.brands || []).length + " 个品牌与客户</p></div>" +
          '<div class="brand-wall">' + brands + "</div>" +

          '<div class="section-head" style="margin-top:44px"><h2>工作流程</h2>' +
            "<p>从需求对齐到多规格交付</p></div>" +
          '<ul class="flow-list">' + flow + "</ul>" +

          '<div class="section-head" style="margin-top:44px"><h2>成果概览</h2>' +
            "<p>数据来源：assets/js/data.js</p></div>" +
          '<div class="metric-grid">' +
            '<div class="metric-card"><span class="value">' + WORKS.length + '</span><span class="label">收录作品</span></div>' +
            '<div class="metric-card"><span class="value">' + uniqueCategories().length + '</span><span class="label">作品类型</span></div>' +
            '<div class="metric-card"><span class="value">' + (PROFILE.brands || []).length + '</span><span class="label">合作品牌</span></div>' +
            '<div class="metric-card"><span class="value">' + esc(span) + '</span><span class="label">作品时间跨度</span></div>' +
          "</div>" +
          '<p class="section-sub" style="margin-top:18px"><a href="timeline.html">前往时间线查看全部作品 →</a></p>' +
        "</div>";
    }
  };

  /* ---------------- 初始化 ---------------- */

  function initNav() {
    var toggle = $("navToggle");
    var nav = $("siteNav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.addEventListener("click", function (e) {
      if (e.target && e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  function init() {
    initNav();
    renderBrand();
    renderFooter();
    bindPlayers();
    var page = document.body.getAttribute("data-page");
    if (page && typeof App[page] === "function") {
      App[page]();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.CutSite = App;
})(window);
