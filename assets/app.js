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
    var lines = String(code.text).replace(/\n+$/, '').split('\n');
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
   * 演示页（内置动画）
   * ============================================================ */
  var DEMOS = {};
  function mountDemo(name, page) {
    var el = page.querySelector('[data-app]');
    if (el && DEMOS[name]) DEMOS[name](el);
  }

  /* ================= 02 页：递归拆解 ================= */
  DEMOS['demo-recursion'] = function (holder) {
    holder.innerHTML =
      '<div class="dctrl">' +
      '  <label>底数 q</label><input id="rdQ" type="number" min="1" max="1000000000" value="5">' +
      '  <label>指数 n</label><input id="rdN" type="number" min="0" max="1000000000" value="22">' +
      '  <button class="dbtn primary" id="rdRun">▶ 自动演示</button>' +
      '  <button class="dbtn" id="rdStep">单步</button>' +
      '  <button class="dbtn ghost" id="rdReset">↺ 重置</button>' +
      '  <span class="dstatus" id="rdSt"></span>' +
      '</div>' +
      '<div class="dctrl"><div class="dpreset">' +
      '  <span class="dstatus">预设：</span>' +
      '  <span class="pchip" data-q="5" data-n="22">5^22</span>' +
      '  <span class="pchip" data-q="3" data-n="10">3^10</span>' +
      '  <span class="pchip" data-q="2" data-n="12">2^12</span>' +
      '  <span class="pchip" data-q="5" data-n="1000">5^1000（大指数）</span>' +
      '</div></div>' +
      '<div class="rec-stage" id="rdStage"></div>' +
      '<div class="rec-fin" id="rdFin"></div>';

    var $id = function (s) { return holder.querySelector(s); };
    var qIn = $id('#rdQ'), nIn = $id('#rdN');
    var runB = $id('#rdRun'), stepB = $id('#rdStep'), resetB = $id('#rdReset');
    var stB = $id('#rdSt'), stage = $id('#rdStage'), fin = $id('#rdFin');
    var token = 0, rows = [], idx = 0, auto = false;

    $$('.pchip', holder).forEach(function (c) {
      c.addEventListener('click', function () {
        qIn.value = c.dataset.q; nIn.value = c.dataset.n;
        if (rows.length === 0) reset();
      });
    });

    function parse() {
      var q = readInt(qIn, '底数 q', 1, 1e9, '1 ~ 10⁹');
      var n = readInt(nIn, '指数 n', 0, 1e9, '0 ~ 10⁹');
      return { q: q, n: n };
    }

    function buildRows(q, n) {
      var out = [];
      var chain = [];
      var e = n;
      while (e >= 1) { chain.push(e); if (e === 1) break; e = Math.floor(e / 2); }
      if (n === 0) {
        out.push({ html: 'n = 0 → 递归出口直接返回 <span class="ok">1 % mod</span>' });
        out.push({ html: '<span class="cm">一次都不折半 —— 这就是“边界条件”。</span>' });
        return out;
      }
      out.push({ cls: 'rec-sep', html: '┌ 递归调用：从 ' + expLabel(q, n) + ' 开始一层层“折半”往下拆' });
      for (var i = 0; i < chain.length - 1; i++) {
        var cur = chain[i], half = chain[i + 1];
        var odd = cur % 2 === 1;
        var rowHtml =
          '<span class="ph">' + expLabel(q, cur) + '</span>' +
          ' = <span class="ok">' + expLabel(q, half) + ' × ' + expLabel(q, half) + '</span>' +
          (odd ? ' <span class="ok">× ' + fmt(q) + '</span>' : '') +
          ' <span class="tk-c">(n=' + fmt(cur) + (odd ? ' 奇数 → 还要再乘 1 个 ' + fmt(q) : ' 偶数 → 正好两半') + ')</span>';
        out.push({ html: rowHtml });
      }
      out.push({ cls: 'rec-sep', html: '└ 折半到指数 1 → 到达递归出口' });
      out.push({ html: '指数已经到 1：直接返回 <span class="ok">' + fmt(q) + '</span>' });
      out.push({ cls: 'rec-sep', html: '┌ 回溯：带着子结果一层层“乘回去”' });

      var rev = chain.slice().reverse();
      var val = null;
      if (approxPow(q, rev[0]).digits <= 60) val = BigInt(q);
      for (var j = 0; j < rev.length - 1; j++) {
        var prevE = rev[j], nextE = rev[j + 1];
        var odd2 = nextE % 2 === 1;
        var row2 =
          '<span class="ph">' + expLabel(q, nextE) + '</span>' +
          ' = <span class="cm">' + (val !== null ? prettyBig(val) + ' × ' + prettyBig(val) : expLabel(q, prevE) + ' × ' + expLabel(q, prevE)) + '</span>' +
          (odd2 ? ' <span class="cm">× ' + fmt(q) + '</span>' : '');
        var est = approxPow(q, nextE);
        if (est.digits <= 60) {
          val = (val !== null) ? (odd2 ? val * val * BigInt(q) : val * val) : null;
          row2 += ' = <span class="ok">' + (val !== null ? prettyBig(val) : '…') + '</span>';
        } else {
          val = null;
          row2 += ' <span class="rec-huge">(数值位数过多，仅示意过程)</span>';
        }
        out.push({ html: row2 });
      }
      return out;
    }

    function stepOnce() {
      if (idx >= rows.length) return false;
      var r = rows[idx];
      var div = document.createElement('div');
      div.className = 'rec-row' + (r.cls ? ' ' + r.cls : '');
      div.innerHTML = r.html;
      stage.appendChild(div);
      stage.scrollTop = stage.scrollHeight;
      idx++;
      if (idx >= rows.length) { finish(); return false; }
      return true;
    }

    function finish() {
      auto = false;
      runB.textContent = '▶ 重播';
      var q = parseInt(qIn.value, 10), n = parseInt(nIn.value, 10);
      fin.innerHTML =
        '<b>✅ 演示结束 · 关键结论：</b>每次把指数<b>折半</b>，折半直到指数是 1 为止，再不断<b>乘回去</b> —— ' +
        '这其实就是“递归”的过程。<br>' +
        '<span style="opacity:.85">' + fmt(q) + '^' + fmt(n) + ' 一共只往下拆了 ' +
        (n === 0 ? 0 : Math.floor(Math.log2(n))) + ' 次（调用 ' + (n === 0 ? 0 : chainDepth(n)) + ' 次函数）→ 下一页看递归代码。</span>';
      fin.classList.add('show');
      stB.textContent = '完成';
    }
    function chainDepth(n) {
      var d = 0; while (n > 1) { d++; n = Math.floor(n / 2); } return d + 1;
    }

    function stopAll() { token++; auto = false; runB.textContent = '▶ 自动演示'; }
    function reset() {
      token++; stage.innerHTML = ''; fin.classList.remove('show');
      rows = []; idx = 0; auto = false; runB.textContent = '▶ 自动演示'; stB.textContent = '';
    }

    runB.addEventListener('click', function () {
      if (auto) { stopAll(); stB.textContent = '已暂停（点 ▶ 继续 / 单步推进）'; return; }
      var parsed;
      try { parsed = parse(); } catch (e) { stB.textContent = ''; toast('⚠ ' + errText(e), 'warn'); return; }
      stage.innerHTML = '';
      fin.classList.remove('show');
      rows = buildRows(parsed.q, parsed.n);
      idx = 0;
      auto = true;
      runB.textContent = '⏸ 暂停';
      stB.textContent = '播放中…';
      (function tick() {
        var tok = token;
        (function inner() {
          if (tok !== token) return;
          if (!stepOnce()) return;
          if (auto && tok === token) setTimeout(inner, 850);
        })();
      })();
    });

    stepB.addEventListener('click', function () {
      if (auto) stopAll();
      if (!rows.length) {
        try { var p2 = parse(); rows = buildRows(p2.q, p2.n); idx = 0; stB.textContent = '单步模式（每点一次走一步）'; }
        catch (e) { stB.textContent = ''; toast('⚠ ' + errText(e), 'warn'); return; }
      }
      if (!stepOnce() && rows.length) stB.textContent = '单步模式（重按 ▶ 重播）';
    });
    resetB.addEventListener('click', reset);

    stage.innerHTML = '<div class="rec-row cm" style="opacity:1">点击 <span class="ph">▶ 自动演示</span> 或 <span class="ph">单步</span>，' +
      '观看递归把 q^n 一层层折半、再乘回去的完整过程（可修改上方 q、n）。</div>';
  };

  /* ================= 05 页：配对合并 ================= */
  DEMOS['demo-pairing'] = function (holder) {
    holder.innerHTML =
      '<div class="dctrl">' +
      '  <label>底数 q</label><input id="pdQ" type="number" min="2" max="99" value="5">' +
      '  <label>指数 n（个数）</label><input id="pdN" type="number" min="1" max="40" value="11">' +
      '  <button class="dbtn primary" id="pdRun">▶ 自动演示</button>' +
      '  <button class="dbtn" id="pdStep">单步</button>' +
      '  <button class="dbtn ghost" id="pdReset">↺ 重置</button>' +
      '  <span class="dstatus" id="pdSt"></span>' +
      '</div>' +
      '<div class="dctrl"><div class="dpreset">' +
      '  <span class="dstatus">预设：</span>' +
      '  <span class="pchip" data-q="5" data-n="11">5^11</span>' +
      '  <span class="pchip" data-q="5" data-n="22">5^22</span>' +
      '  <span class="pchip" data-q="2" data-n="10">2^10</span>' +
      '  <span class="pchip" data-q="3" data-n="13">3^13</span>' +
      '</div></div>' +
      '<div class="pair-stage" id="pdStage"></div>' +
      '<div class="pair-formula" id="pdFormula"></div>' +
      '<div class="pair-note" id="pdNote"></div>';

    var $id = function (s) { return holder.querySelector(s); };
    var qIn = $id('#pdQ'), nIn = $id('#pdN');
    var runB = $id('#pdRun'), stepB = $id('#pdStep'), resetB = $id('#pdReset');
    var stB = $id('#pdSt'), stage = $id('#pdStage'),
        formula = $id('#pdFormula'), note = $id('#pdNote');
    var token = 0, frames = [], fidx = 0, auto = false;

    $$('.pchip', holder).forEach(function (c) {
      c.addEventListener('click', function () {
        qIn.value = c.dataset.q; nIn.value = c.dataset.n;
        if (!frames.length) preview();
      });
    });

    function chipHtml(q, exp, extra) {
      return '<span class="tok ' + (extra || '') + '">' + expLabel(q, exp) + '</span>';
    }
    function pairGrp(q, exp) {
      return '<span class="pair-grp">' + chipHtml(q, exp) + chipHtml(q, exp) + '</span>';
    }
    function keptRowHtml(q, collected) {
      if (!collected.length) return '';
      return '<div class="kept-row"><span class="kr-label">取出区（一直保留）：</span>' +
        collected.slice().sort(function (a, b) { return b.exp - a.exp; })
          .map(function (c) { return chipHtml(q, c.exp, 'got'); }).join('') +
        '</div>';
    }
    function stageWithKept(q, tokRow, collected) {
      return tokRow + keptRowHtml(q, collected);
    }
    function scrollActivePageToBottom() {
      var p = holder.closest('.page');
      if (p) p.scrollTop = p.scrollHeight;
    }

    function buildFrames() {
      var q = readInt(qIn, '底数 q', 2, 99, '2 ~ 99');
      var n = readInt(nIn, '指数 n', 1, 40, '1 ~ 40', '太多屏幕放不下');
      frames = []; fidx = 0;
      stage.innerHTML = '';
      formula.innerHTML = '';
      var tokens = [];
      for (var i = 0; i < n; i++) tokens.push({ exp: 1 });
      var collected = [];   // 取出区：每轮奇数“多出的 1 个”和最后剩下的 1 个，取出后一直保留、不再配对
      var round = 1;

      while (tokens.length > 1) {
        var cnt = tokens.length;
        var exp = tokens[0].exp;
        var odd = cnt % 2 === 1;
        var pairs = Math.floor(cnt / 2);
        var lbl = expLabel(q, exp);

        // 帧 A：先把它们摆出来两两分组，多出的 1 个标出来（这一帧还没取走）
        var htmlA = '';
        for (var k = 0; k + 1 < cnt; k += 2) htmlA += pairGrp(q, exp);
        if (odd) htmlA += chipHtml(q, exp, 'loner');
        frames.push({
          cap: '第 ' + round + ' 轮 · 现在有 <b>' + cnt + '</b> 个 ' + lbl +
            (odd
              ? '，是<b>奇数</b>：两两配对后会多出 1 个，这一轮把它取出（取出后一直保留，不再参与配对）'
              : '，是<b>偶数</b>：正好全部两两配对'),
          stage: '<div class="tok-row">' + htmlA + '</div>' + keptRowHtml(q, collected),
          collect: collected.slice()
        });

        // 奇数多出的这 1 个：进入取出区，从下一帧起一直都在
        if (odd) collected.push({ exp: exp });

        var newCnt = pairs;
        var htmlB = '';
        for (var m = 0; m < newCnt; m++) htmlB += chipHtml(q, exp * 2, 'final-tok');
        frames.push({
          cap: '每对 ' + lbl + ' 合并成 1 个 <b>' + expLabel(q, exp * 2) + '</b>，剩下 <b>' + newCnt + '</b> 个' +
            (odd ? '；多出的 1 个 ' + lbl + ' 进入取出区' : '；本轮没有取出'),
          stage: '<div class="tok-row">' + htmlB + '</div>' + keptRowHtml(q, collected),
          collect: collected.slice()
        });

        tokens = [];
        for (var t2 = 0; t2 < newCnt; t2++) tokens.push({ exp: exp * 2 });
        round++;
      }

      // 最后只剩 1 个，没法再配对：也把它放进取出区
      var lastExp = tokens[0].exp;
      frames.push({
        cap: '只剩 1 个 <b>' + expLabel(q, lastExp) + '</b>，没法再配对 → 最后也放进取出区',
        stage: '<div class="tok-row">' + chipHtml(q, lastExp, 'loner') + '</div>' + keptRowHtml(q, collected),
        collect: collected.slice()
      });
      collected.push({ exp: lastExp });

      // 收尾帧：取出区凑齐，全部乘起来验证
      var exps = collected.map(function (c) { return c.exp; }).sort(function (a, b) { return b - a; });
      var sum = exps.reduce(function (a, b) { return a + b; }, 0);
      var piecesHtml = exps.map(function (e) { return expLabel(q, e); }).join(' × ');
      var valHtml = '';
      var est = approxPow(q, sum);
      if (est.digits <= 24) valHtml = ' = <span class="val">' + fmt(bigPow(q, sum).toString()) + '</span>';
      else valHtml = ' ≈ <span class="val">' + est.mant.toFixed(4) + ' × 10<sup>' + (est.digits - 1) + '</sup></span>';
      frames.push({
        cap: '🎉 取出区凑齐了 —— 把它们全部乘起来：',
        stage: '<div class="tok-row">' + exps.map(function (e) { return chipHtml(q, e, 'got'); }).join('') + '</div>',
        collect: collected.slice(),
        formula:
          '<span class="ph">' + piecesHtml + '</span>' +
          ' <span class="sep2">= ' + expLabel(q, sum) + '</span>' + valHtml +
          '<div style="margin-top:8px;font-size:13px;line-height:1.8;color:#4b5563">' +
          '取出区里的幂指数 {<b>' + exps.join(', ') + '</b>} 加起来正好等于原来的 <b>' + n + '</b>，全程一个都没丢。<br>' +
          '和循环代码对应：个数是<b>奇数</b>就取出当前这个幂（对应 <code>ans *= q</code>），' +
          '然后<b>个数除以 2</b>（对应 <code>n /= 2</code>）、每个 q 自己乘自己（对应 <code>q *= q</code>）。' +
          '</div>'
      });
    }

    function renderFrame() {
      if (!frames.length) return;
      var f = frames[Math.min(fidx, frames.length - 1)];
      var blk = document.createElement('div');
      blk.className = 'pair-block';
      blk.innerHTML = '<div class="pair-round-cap">' + f.cap + '</div>' + f.stage;
      stage.appendChild(blk);
      scrollActivePageToBottom();
      if (f.formula) { formula.innerHTML = f.formula; formula.style.display = ''; }
    }

    function finish() {
      auto = false;
      runB.textContent = '▶ 重播';
      stB.textContent = '完成';
    }
    function stopAll() { token++; auto = false; runB.textContent = '▶ 自动演示'; }
    function reset() {
      token++; frames = []; fidx = 0; auto = false; runB.textContent = '▶ 自动演示';
      stage.innerHTML = ''; formula.innerHTML = ''; note.innerHTML = ''; stB.textContent = '';
      preview();
    }
    function stepOnce() {
      if (!frames.length || fidx >= frames.length) return false;
      renderFrame();
      fidx++;
      if (fidx >= frames.length) { finish(); return false; }
      return true;
    }
    function preview() {
      var q = parseInt(qIn.value, 10), n = parseInt(nIn.value, 10);
      var html = '';
      for (var i = 0; i < Math.min(n, 40); i++) html += chipHtml(q, 1);
      stage.innerHTML = '<div class="pair-round-cap">初始：<b>' + n + '</b> 个 ' + q +
        ' —— 要算 <b>' + expLabel(q, n) + '</b>。点 ▶ 自动演示，看它们一轮轮两两配对、数量减半。</div>' +
        '<div class="tok-row">' + html + '</div>';
      formula.innerHTML = '<span class="dstatus">按 ▶ 自动演示 或 单步 逐帧播放</span>';
      scrollActivePageToBottom();
    }

    runB.addEventListener('click', function () {
      if (auto) { stopAll(); stB.textContent = '已暂停（点 ▶ 继续）'; return; }
      try { buildFrames(); } catch (e) { stB.textContent = ''; toast('⚠ ' + errText(e), 'warn'); return; }
      token++;
      fidx = 0;
      auto = true;
      runB.textContent = '⏸ 暂停';
      stB.textContent = '播放中…';
      (function tick() {
        var tok = token;
        (function inner() {
          if (tok !== token) return;
          if (!stepOnce()) return;
          if (auto && tok === token) setTimeout(inner, 1350);
        })();
      })();
    });
    stepB.addEventListener('click', function () {
      if (auto) stopAll();
      if (!frames.length) {
        try { buildFrames(); fidx = 0; stB.textContent = '单步模式（每点一次走一步）'; }
        catch (e) { stB.textContent = ''; toast('⚠ ' + errText(e), 'warn'); return; }
      }
      if (!stepOnce() && frames.length) stB.textContent = '单步模式（重按 ▶ 重播）';
    });
    resetB.addEventListener('click', reset);
    preview();
  };

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
})();
