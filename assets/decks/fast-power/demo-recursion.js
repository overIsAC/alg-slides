/* 快速幂课件 · 内置演示（demo-recursion / demo-pairing）
 * 由 assets/app.js 的 mountDemo 通过 window.DEMOS["demo-xxx"] 调用。
 * 依赖的全局 helper（readInt / $ / $$ / toast / errText / renderMath / fmt / expLabel …）
 * 都由 assets/app.js 在运行期提供，这里只负责把实现挂到 window.DEMOS。
 */
(function () {
  "use strict";
  var DEMOS = window.DEMOS = window.DEMOS || {};

  /* ================= 02 页：递归拆解 ================= */
  DEMOS['demo-recursion'] = function (holder) {
    holder.innerHTML =
      '<div class="dctrl">' +
      '  <label>底数 q</label><input id="rdQ" type="number" min="0" max="1000000000" value="5">' +
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
      var q = readInt(qIn, '底数 q', 0, 1e9, '0 ~ 10⁹');
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
        if (q === 0) out.push({ html: '<span class="cm">注意：数学上 0⁰ 没有定义，但快速幂代码实现会返回 1。</span>' });
        return out;
      }
      if (n === 1) {
        out.push({ html: 'n = 1 → 一进来就命中递归出口，直接返回 <span class="ok">' + fmt(q) + '</span>' });
        out.push({ html: '<span class="cm">既不用折半、也不用回溯 —— 这是最短的一条路径。</span>' });
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

    var curKey = null;   // 当前演示用的 q|n，用来判断“点 ▶ 是暂停还是重播”
    runB.addEventListener('click', function () {
      var parsed;
      try { parsed = parse(); } catch (e) { stB.textContent = ''; toast('⚠ ' + errText(e), 'warn'); return; }
      var key = parsed.q + '|' + parsed.n;
      /* 参数没变：暂停/继续；参数改了：直接重播新的（否则会停在上一次的旧画面上，看着像卡住） */
      if (auto && key === curKey) { stopAll(); stB.textContent = '已暂停（点 ▶ 继续 / 单步推进）'; return; }
      curKey = key;
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
      var p2, k2;
      try { p2 = parse(); k2 = p2.q + '|' + p2.n; } catch (e) { stB.textContent = ''; toast('⚠ ' + errText(e), 'warn'); return; }
      /* 没演示过、或参数改了 → 按新参数重建，否则会接着走上一轮的旧步骤 */
      if (!rows.length || k2 !== curKey) {
        rows = buildRows(p2.q, p2.n); idx = 0; curKey = k2;
        stB.textContent = '单步模式（每点一次走一步）';
      }
      if (!stepOnce() && rows.length) stB.textContent = '单步模式（重按 ▶ 重播）';
    });
    resetB.addEventListener('click', reset);

    stage.innerHTML = '<div class="rec-row cm" style="opacity:1">点击 <span class="ph">▶ 自动演示</span> 或 <span class="ph">单步</span>，' +
      '观看递归把 q^n 一层层折半、再乘回去的完整过程（可修改上方 q、n）。</div>';
  };
})();
