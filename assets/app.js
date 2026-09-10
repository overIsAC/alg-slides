/* ============================================================
 * alg-lecture-slides / assets/app.js
 *  - 左侧多级文件树（来自 LECTURE_DATA.tree）
 *  - 右侧 PPT 式单屏翻页（精调课件 DECKS / 原始笔记 articles）
 *  - 运行时 C++ 迷你高亮 + 行号
 *  - 内置动画：递归拆解演示、两两配对合并演示
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };

  /* ---------------- 轻提示 toast：显示约 2.2 秒后自动消失 ---------------- */
  function toast(msg, kind) {
    var host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.textContent = msg;
    host.appendChild(el);
    raf(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 240);
    }, 2200);
  }

  /* throw 出来的既可能是字符串也可能是 Error，统一取成文字 */
  function errText(e) {
    if (typeof e === 'string') return e;
    if (e && e.message) return e.message;
    return String(e);
  }

  /* ---------------- 演示页输入框读取 + 校验 ----------------
   * 空 / 非数字 / 小数 / 超范围 一律 throw，由调用处 catch 后弹 toast。
   * rangeText 只用于提示文案；extra 是追加在范围后的补充说明。
   */
  function readInt(input, name, lo, hi, rangeText, extra) {
    var raw = (input.value === null || input.value === undefined) ? '' : String(input.value).trim();
    var tail = rangeText + (extra ? '（' + extra + '）' : '');
    if (raw === '') throw name + '不能为空 —— 请填 ' + tail + ' 之间的整数';
    if (!/^-?\d+$/.test(raw)) throw name + '只能是整数，不能填小数、字母或符号 —— 请填 ' + tail + ' 之间的整数';
    var v = parseInt(raw, 10);
    if (!(v >= lo && v <= hi)) throw name + '超出范围：需在 ' + tail + ' 之间';
    return v;
  }

  /* ---------------- 状态 ---------------- */
  var state = {
    rel: null,
    deck: false,
    mode: 'deck',
    idx: 0,
    pageCount: 0,
    pageEls: []
  };

  var CURATED = {};
  if (window.LECTURE_DATA && window.LECTURE_DATA.curated) {
    window.LECTURE_DATA.curated.forEach(function (r) { CURATED[r] = true; });
  }

  /* frontmatter aliases 反查：rel → [别名…]（别名并入文件树行搜索标签） */
  var ALIAS_BY_REL = {};
  (function () {
    var am = (window.LECTURE_DATA && window.LECTURE_DATA.aliases) || {};
    Object.keys(am).forEach(function (a) {
      am[a].forEach(function (rel) {
        (ALIAS_BY_REL[rel] = ALIAS_BY_REL[rel] || []).push(a);
      });
    });
  })();

  /* ---------------- 工具 ---------------- */
  function cleanName(n) {
    return String(n).replace(/\.md$/i, '').replace(/^\d+[-_]\s*/, '');
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(n) {
    var s = String(n);
    var neg = s[0] === '-';
    if (neg) s = s.slice(1);
    var out = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return neg ? '-' + out : out;
  }
  function approxPow(q, n) {
    /* q = 0 时 log10(0) = -Infinity，位数会算成 -Infinity，这里直接特判 */
    if (q === 0) return { digits: 1, mant: n > 0 ? 0 : 1 };
    var l = n * Math.log10(q);
    var digits = Math.floor(l) + 1;
    var mant = Math.pow(10, l - Math.floor(l));
    return { digits: digits, mant: mant };
  }
  function bigPow(q, n) {
    var b = BigInt(q), e = n, r = 1n;
    while (e > 0) { if (e % 2) r *= b; b *= b; e = Math.floor(e / 2); }
    return r;
  }
  function expLabel(q, e) {
    var qs = fmt(q);
    if (e <= 1) return qs;
    return qs + '<sup>' + e + '</sup>';
  }
  /* 需要“始终带上标指数”的场合用这个（expLabel 在 e<=1 时不显示指数） */
  function expSup(q, e) {
    return fmt(q) + '<sup>' + e + '</sup>';
  }
  function prettyBig(big) {
    var s = big.toString();
    if (s.length <= 24) return fmt(s);
    return s[0] + '.' + s.slice(1, 5) + '×10<sup>' + (s.length - 1) + '</sup>';
  }

  /* ---------------- 迷你 C++ 高亮 ---------------- */
  var KWS = 'auto|bool|break|case|catch|char|class|const|constexpr|continue|default|delete|do|double|else|enum|explicit|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|nullptr|operator|private|protected|public|register|return|short|signed|sizeof|static|struct|switch|template|this|throw|true|try|typedef|typename|union|unsigned|using|virtual|void|volatile|while';
  var TYPES = 'LL|ull|size_t|ssize_t|string|vector|map|set|pair|queue|stack|deque|priority_queue|bitset';

  function hlLine(line) {
    var re = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(#[a-zA-Z_][\w]*)|(\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?[uUlLfF]*\b)|(\b(?:' + KWS + ')\b)|(\b(?:' + TYPES + ')\b)/g;
    var out = '', last = 0, m;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) out += esc(line.slice(last, m.index));
      var cls = m[1] ? 'tk-c' : m[2] ? 'tk-s' : m[3] ? 'tk-p' : m[4] ? 'tk-n' : m[5] ? 'tk-k' : 'tk-t';
      out += '<span class="' + cls + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    out += esc(line.slice(last));
    return out;
  }

  function buildCodePanel(code, hlRows) {
    var langName = ({ cpp: 'C++', c: 'C', py: 'Python', python: 'Python', txt: 'TEXT' })[code.lang || 'cpp'] || 'CODE';
    var wrap = document.createElement('div');
    wrap.className = 'code-panel';
    var head = document.createElement('div');
    head.className = 'code-head';
    head.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>' +
      '<span class="code-label">' + esc(code.label || '') + '</span>' +
      '<span class="code-lang">' + langName + '</span>';
    var sc = document.createElement('div');
    sc.className = 'code-scroll';
    // 末尾空行要保留（md 里有就照显示），不要 strip
    var lines = String(code.text).split('\n');
    lines.forEach(function (ln, i) {
      var row = document.createElement('div');
      row.className = 'cl';
      if (hlRows && hlRows.indexOf(i + 1) >= 0) row.classList.add('hl-row');
      row.innerHTML = '<span class="n">' + (i + 1) + '</span>' +
        '<span class="c">' + (ln === '' ? '&nbsp;' : hlLine(ln)) + '</span>';
      sc.appendChild(row);
    });
    wrap.appendChild(head);
    wrap.appendChild(sc);
    return wrap;
  }

  /* ---------------- KaTeX ---------------- */
  function renderMath(el) {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false,
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
        });
      } catch (e) { /* ignore */ }
    } else {
      document.body.classList.add('offline-math');
    }
  }

  /* ============================================================
   * 文件树
   * ============================================================ */
  var openPaths = {};
  var countCache = {};
  function countLeaves(node) {
    if (node.f) return 1;
    if (countCache[node.key]) return countCache[node.key];
    var c = 0;
    (node.c || []).forEach(function (ch) { c += countLeaves(ch); });
    countCache[node.key] = c;
    return c;
  }

  function buildTree(container) {
    container.innerHTML = '';
    var root = window.LECTURE_DATA.tree || [];
    root.forEach(function (node) { container.appendChild(nodeEl(node)); });
    Object.keys(CURATED).forEach(function (rel) {
      var parts = rel.split('/'), acc = '';
      for (var i = 0; i < parts.length - 1; i++) {
        acc = acc ? acc + '/' + parts[i] : parts[i];
        openPaths[acc] = true;
      }
    });
    applyOpen(container);
  }

  function nodeEl(node) {
    if (node.f) {
      var row = document.createElement('div');
      row.className = 'trow file';
      row.dataset.rel = node.rel;
      var aliases = ALIAS_BY_REL[node.rel] || [];
      row.dataset.label = (cleanName(node.f) + ' ' + node.rel + ' ' + aliases.join(' ')).toLowerCase();
      var curated = !!CURATED[node.rel];
      row.innerHTML =
        '<span class="caret"></span><span class="tic"></span>' +
        '<span class="tlbl">' + esc(cleanName(node.f)) + '</span>' +
        (curated ? '<span class="star">课件</span>' : '<span class="nf">笔记</span>');
      row.title = node.rel + (curated ? '（精调课件 · 点击进入 PPT 演示）' : '（原始笔记 · 点击阅读）');
      row.addEventListener('click', function (ev) {
        ev.stopPropagation();
        selectNote(node.rel);
      });
      return row;
    }
    var grp = document.createElement('div');
    grp.className = 'treegrp';
    grp.dataset.key = node.key || '';
    var frow = document.createElement('div');
    frow.className = 'trow folder';
    frow.dataset.key = node.key || '';
    frow.innerHTML =
      '<span class="caret">▶</span><span class="tic">📁</span>' +
      '<span class="tlbl">' + esc(cleanName(node.n)) + '</span>' +
      '<span class="tcount">' + countLeaves(node) + '</span>';
    var kids = document.createElement('div');
    kids.className = 'tchildren';
    (node.c || []).forEach(function (ch) { kids.appendChild(nodeEl(ch)); });
    frow.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var key = frow.dataset.key;
      var open = frow.classList.toggle('open');
      kids.classList.toggle('open', open);
      if (open) openPaths[key] = true; else delete openPaths[key];
    });
    grp.appendChild(frow);
    grp.appendChild(kids);
    return grp;
  }

  function applyOpen(root) {
    $$('.trow.folder', root).forEach(function (r) {
      var key = r.dataset.key;
      if (openPaths[key]) {
        r.classList.add('open');
        var nxt = r.nextElementSibling;
        if (nxt && nxt.classList.contains('tchildren')) nxt.classList.add('open');
      }
    });
  }

  /* ---------------- 笔记选择 ---------------- */
  function selectNote(rel) {
    if (rel === state.rel) {
      if (state.mode !== 'deck') { state.mode = state.deck ? 'deck' : 'note'; syncModeUI(); }
      return;
    }
    state.rel = rel;
    state.idx = 0;
    $$('.trow.sel').forEach(function (r) { r.classList.remove('sel'); });
    var hit = $('.trow.file[data-rel="' + CSS.escape(rel) + '"]');
    if (hit) { hit.classList.add('sel'); ensureVisible(hit); }
    state.deck = !!(window.DECKS && window.DECKS[rel]);
    if (state.deck) { buildDeck(rel); state.mode = 'deck'; }
    else { buildArticle(rel); articleBuiltFor = rel; state.mode = 'note'; }
    updateChip();
    syncModeUI();
  }

  function ensureVisible(row) {
    var p = row.parentElement;
    while (p && p.classList && !p.classList.contains('side-tree')) {
      if (p.classList.contains('tchildren')) {
        p.classList.add('open');
        var prev = p.previousElementSibling;
        if (prev && prev.classList.contains('trow')) prev.classList.add('open');
      }
      p = p.parentElement;
    }
    var sc = $('.side-tree');
    if (sc && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  }

  function updateChip() {
    var rel = state.rel || '';
    var parts = rel.split('/');
    var file = parts.pop();
    var folder = parts.join(' / ');
    $('#chipFolder').textContent = folder ? folder + ' / ' : '';
    $('#chipFile').textContent = file ? cleanName(file) : '请从左侧选择笔记';
    var b = $('#badgeDeck');
    if (state.deck) { b.style.display = ''; b.textContent = '课件 ' + state.pageCount + ' 页'; }
    else { b.style.display = 'none'; }
    if (file) document.title = cleanName(file) + ' · 算法课件演示';
  }

  function syncModeUI() {
    var deckBtn = $('#modeDeck'), noteBtn = $('#modeNote');
    var hasDeck = state.deck && state.rel;
    deckBtn.disabled = !hasDeck;
    noteBtn.disabled = !state.rel;
    deckBtn.classList.toggle('on', !!(hasDeck && state.mode === 'deck'));
    noteBtn.classList.toggle('on', !!(state.rel && state.mode === 'note'));
    $('#pager').style.display = (hasDeck && state.mode === 'deck') ? '' : 'none';
    $('#articleWrap').classList.toggle('active', !!(state.rel && state.mode === 'note'));
    $('#pageHost').classList.toggle('active', !!(hasDeck && state.mode === 'deck'));
  }

  /* ============================================================
   * 课件渲染
   * ============================================================ */
  function buildDeck(rel) {
    var deck = window.DECKS[rel];
    var host = $('#pageHost');
    host.innerHTML = '';
    state.pageEls = [];
    state.pageCount = deck.pages.length;
    var prog = $('#progFill');
    if (prog) prog.style.width = '0%';

    deck.pages.forEach(function (p, i) {
      var page = document.createElement('div');
      page.className = 'page';
      var card = document.createElement('div');
      card.className = 'page-card';
      var head = document.createElement('div');
      head.className = 'page-head';
      head.innerHTML = '<span class="kicker">' + esc(p.tag || '') + '</span>' +
        '<h2 class="page-title">' + esc(p.title || '') + '</h2>';
      card.appendChild(head);

      var body = document.createElement('div');
      body.className = 'page-body';
      if (p.body) body.innerHTML = p.body;
      if (p.code) body.appendChild(buildCodePanel(p.code));
      if (p.footnote) {
        var fn = document.createElement('div');
        fn.innerHTML = p.footnote;
        body.appendChild(fn);
      }
      card.appendChild(body);
      page.appendChild(card);
      host.appendChild(page);
      state.pageEls.push(page);

      if (p.app) mountDemo(p.app, page);
      renderMath(page);
    });
    showPage(0);
  }

  function showPage(i) {
    if (!state.pageEls.length) return;
    state.idx = Math.max(0, Math.min(state.pageCount - 1, i));
    state.pageEls.forEach(function (el, k) {
      el.classList.toggle('active', k === state.idx);
      if (k === state.idx) el.scrollTop = 0;
    });
    var p = $('#progFill');
    if (p) p.style.width = ((state.idx + 1) / state.pageCount * 100) + '%';
    var c = $('#pgCount');
    if (c) {
      c.innerHTML = '<input id="pgJump" type="text" value="' + (state.idx + 1) + '">' +
        '<span class="pg-of"> / ' + state.pageCount + '</span>';
    }
    var bp = $('#btnPrev'), bn = $('#btnNext');
    if (bp) bp.disabled = state.idx === 0;
    if (bn) bn.disabled = state.idx >= state.pageCount - 1;
  }
  function next() { if (state.deck && state.mode === 'deck') showPage(state.idx + 1); }
  function prev() { if (state.deck && state.mode === 'deck') showPage(state.idx - 1); }

  /* ============================================================
   * 原始笔记渲染
   * ============================================================ */
  function buildArticle(rel) {
    var wrap = $('#articleWrap');
    var html = (window.LECTURE_DATA && window.LECTURE_DATA.articles && window.LECTURE_DATA.articles[rel]) || '';
    if (!html) {
      wrap.innerHTML = '<div class="article-card"><div class="note-empty"><div class="big">📄</div>' +
        '暂无内容</div></div>';
    } else {
      wrap.innerHTML = '<div class="article-card">' + html + '</div>';
      $$('#articleWrap pre > code').forEach(function (codeEl) {
        var pre = codeEl.parentElement;
        var lm = (codeEl.className || '').match(/language-(\w+)/);
        var panel = buildCodePanel({ label: '', lang: lm ? lm[1] : 'cpp', text: codeEl.textContent });
        pre.parentElement.replaceChild(panel, pre);
      });
      renderMath(wrap);
    }
    wrap.scrollTop = 0;
  }

  /* Obsidian 内链锚点（[[目标#标题|别名]]）：目标笔记打开后滚动到匹配标题 */
  function scrollToAnchor(anchor) {
    if (!anchor) return;
    var key = anchor.replace(/\s+/g, '');
    var heads = $$('#articleWrap h1, #articleWrap h2, #articleWrap h3, #articleWrap h4, #articleWrap h5, #articleWrap h6');
    for (var i = 0; i < heads.length; i++) {
      var hk = (heads[i].textContent || '').replace(/\s+/g, '');
      if (hk === key || hk.indexOf(key) >= 0 || key.indexOf(hk) >= 0) {
        if (heads[i].scrollIntoView) heads[i].scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
    }
  }

  /* ============================================================
   * 顶部栏 / 分页器 / 快捷键
   * ============================================================ */
  var articleBuiltFor = null;
  function ensureArticle() {
    if (state.rel && articleBuiltFor !== state.rel) {
      buildArticle(state.rel);
      articleBuiltFor = state.rel;
    }
  }

  function wireChrome() {
    $('#btnSide').addEventListener('click', function () { $('#shell').classList.toggle('tree-hidden'); });
    $('#btnFull').addEventListener('click', function () { try { toggleFull(); } catch (e) {} });
    $('#modeDeck').addEventListener('click', function () { if (state.deck) { state.mode = 'deck'; syncModeUI(); } });
    $('#modeNote').addEventListener('click', function () {
      if (state.rel) { ensureArticle(); state.mode = 'note'; syncModeUI(); }
    });
    $('#btnPrev').addEventListener('click', function () { prev(); });
    $('#btnNext').addEventListener('click', function () { next(); });

    // 监听全局 click 委托：
    //  - a.wiki-link（笔记正文的 Obsidian 内链）→ 跳转对应笔记（可选锚点标题）
    //  - 只有真正点到 #pgJump 本身才 focus（其它位置不会乱跳光标）
    document.addEventListener('click', function (e) {
      var t = e.target;
      var a = t && t.closest && t.closest('a.wiki-link');
      if (a) {
        e.preventDefault();
        e.stopPropagation();
        var rel = a.getAttribute('data-rel');
        var anchor = a.getAttribute('data-anchor') || '';
        if (rel && rel === state.rel && state.mode === 'note') {
          if (anchor) scrollToAnchor(anchor);
        } else if (rel) {
          selectNote(rel);
          if (anchor && !state.deck) scrollToAnchor(anchor);
        }
        return;
      }
      var inp = t && t.closest && t.closest('#pgJump');
      if (inp) { inp.focus(); inp.select(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.target && e.target.id === 'pgJump' && e.key === 'Enter') {
        var v = parseInt(e.target.value, 10);
        if (!isNaN(v) && v >= 1 && v <= state.pageCount) showPage(v - 1);
        e.target.blur();
      }
    });
    $('#sideSearch').addEventListener('input', function () { applyFilter(this.value); });
  }

  function applyFilter(q) {
    q = (q || '').trim().toLowerCase();
    var tree = $('.side-tree');
    if (!tree) return;
    if (!q) {
      $$('.trow, .treegrp', tree).forEach(function (r) { r.classList.remove('hide'); });
      applyOpen(tree);
      return;
    }
    $$('.trow.file', tree).forEach(function (r) {
      r.classList.toggle('hide', (r.dataset.label || '').indexOf(q) < 0);
    });
    $$('.trow.file:not(.hide)', tree).forEach(revealAncestors);
    $$('.treegrp', tree).forEach(function (g) {
      g.classList.toggle('hide', !g.querySelector('.trow.file:not(.hide)'));
    });
  }
  function revealAncestors(row) {
    var p = row.parentElement;
    while (p && !p.classList.contains('side-tree')) {
      if (p.classList.contains('tchildren')) {
        p.classList.add('open');
        var prev = p.previousElementSibling;
        if (prev && prev.classList.contains('trow')) { prev.classList.add('open'); prev.classList.remove('hide'); }
      }
      p = p.parentElement;
    }
  }

  function toggleFull() {
    if (!document.fullscreenElement) {
      var el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else if (document.exitFullscreen) document.exitFullscreen();
  }

  function wireKeys() {
    window.addEventListener('keydown', function (e) {
      var ae = document.activeElement;
      var tag = (ae && ae.tagName) || '';
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        (ae && ae.isContentEditable);
      if (typing) return;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
          e.preventDefault(); next(); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
          e.preventDefault(); prev(); break;
        case 'Home': e.preventDefault(); showPage(0); break;
        case 'End': e.preventDefault(); showPage(state.pageCount - 1); break;
        case 'f': case 'F': try { toggleFull(); } catch (err) {} break;
        case 'b': case 'B': $('#shell').classList.toggle('tree-hidden'); break;
        case 'n': case 'N':
          if (state.rel) {
            if (state.mode === 'note' && state.deck) { state.mode = 'deck'; }
            else { ensureArticle(); state.mode = state.deck ? 'note' : 'note'; }
            syncModeUI();
          }
          break;
      }
    });
  }

  /* ============================================================
   * 演示页（动画实现已拆分到各课件目录：
   *   assets/decks/fast-power/demo-recursion.js、demo-pairing.js
   *   assets/decks/light-speed-power/demo-lsp.js
   * 它们把实现挂到 window.DEMOS，这里只负责挂载）
   * ============================================================ */
  var DEMOS = window.DEMOS = window.DEMOS || {};
  function mountDemo(name, page) {
    var el = page.querySelector('[data-app]');
    if (el && DEMOS[name]) DEMOS[name](el);
  }


  /* ============================================================
   * 初始化
   * ============================================================ */
  function init() {
    if (!window.LECTURE_DATA) {
      $('#stageArea').innerHTML = '<div class="note-empty"><div class="big">⚠️</div>缺少 data/notes.js —— 请先运行 build/build.py。</div>';
      return;
    }
    wireChrome();
    wireKeys();
    buildTree($('.side-tree'));

    var total = 0;
    (function walk(ns) {
      ns.forEach(function (nd) { if (nd.f) total++; else walk(nd.c || []); });
    })(window.LECTURE_DATA.tree || []);
    $('#statNotes').textContent = total + ' 篇';
    $('#statDecks').textContent = Object.keys(window.DECKS || {}).length + ' 个课件';

    var rels = Object.keys(window.DECKS || {});
    var start = rels[0] || null;
    if (start) selectNote(start);
    else {
      syncModeUI();
      $('#chipFile').textContent = '（目录中暂无精调课件，可直接点左侧任意笔记阅读）';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SlideApp = { next: next, prev: prev, showPage: showPage };

  // 暴露演示所需的全局 helper（演示实现已拆到 assets/decks/<课件>/*.js，各自 IIFE 访问不到本作用域）
  window.$ = $;
  window.$$ = $$;
  window.readInt = readInt;
  window.toast = toast;
  window.errText = errText;
  window.renderMath = renderMath;
  window.fmt = fmt;
  window.expLabel = expLabel;
  window.expSup = expSup;
  window.prettyBig = prettyBig;
  window.approxPow = approxPow;
  window.bigPow = bigPow;
})();
