/* 快速幂课件 · 内置演示（demo-recursion / demo-pairing）
 * 由 assets/app.js 的 mountDemo 通过 window.DEMOS["demo-xxx"] 调用。
 * 依赖的全局 helper（readInt / $ / $$ / toast / errText / renderMath / fmt / expLabel …）
 * 都由 assets/app.js 在运行期提供，这里只负责把实现挂到 window.DEMOS。
 */
(function () {
  "use strict";
  var DEMOS = window.DEMOS = window.DEMOS || {};

  /* ================= 05 页：配对合并 ================= */
  DEMOS['demo-pairing'] = function (holder) {
    holder.innerHTML =
      '<div class="dctrl">' +
      '  <label>底数 q</label><input id="pdQ" type="number" min="0" max="99" value="5">' +
      '  <label>指数 n（个数）</label><input id="pdN" type="number" min="0" max="40" value="11">' +
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

    function readParams() {
      return {
        q: readInt(qIn, '底数 q', 0, 99, '0 ~ 99'),
        n: readInt(nIn, '指数 n', 0, 40, '0 ~ 40', '太多屏幕放不下')
      };
    }

    function buildFrames() {
      var p = readParams(), q = p.q, n = p.n;
      frames = []; fidx = 0;
      stage.innerHTML = '';
      formula.innerHTML = '';

      /* n = 0：一个 q 都没有，压根进不了配对循环，直接出结果 */
      if (n === 0) {
        frames.push({
          cap: 'n = 0：一个 <b>' + fmt(q) + '</b> 都没有 —— 没有东西可以配对',
          stage: '<div class="tok-row"><span class="tok">（空空的，一个都没有）</span></div>',
          collect: []
        });
        frames.push({
          cap: '🎉 什么都不用乘，结果直接就是 <b>1</b>',
          stage: '<div class="tok-row"><span class="tok got">1</span></div>',
          collect: [],
          formula:
            '<span class="ph">' + expSup(q, 0) + ' = 1</span>' +
            '<div style="margin-top:8px;font-size:13px;line-height:1.8;color:#4b5563">' +
            '取出区里<b>一个幂都没有</b>，指数和 = 0，正好等于原来的 <b>0</b>。<br>' +
            '和循环代码对应：<code>n = 0</code> 时循环<b>一次都不进</b>，直接返回初始的 <code>ans = 1</code>。' +
            (q === 0 ? '<br>注意：数学上 0⁰ 没有定义，但快速幂代码实现会返回 1。' : '') +
            '</div>'
        });
        return;
      }

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
      var lastCap = (n === 1)
        ? '一开始只有 1 个 <b>' + expLabel(q, lastExp) + '</b>，一步都不用配对 → 直接放进取出区'
        : '只剩 1 个 <b>' + expLabel(q, lastExp) + '</b>，没法再配对 → 最后也放进取出区';
      frames.push({
        cap: lastCap,
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
      /* 取出区只有 1 项时（如 n=1、n=2），别写成 “5 = 5 = 5” 这种重复式子 */
      var headHtml = exps.length > 1
        ? '<span class="ph">' + piecesHtml + '</span> <span class="sep2">= ' + expSup(q, sum) + '</span>'
        : '<span class="ph">' + expSup(q, sum) + '</span>';
      frames.push({
        cap: '🎉 取出区凑齐了 —— 把它们全部乘起来：',
        stage: '<div class="tok-row">' + exps.map(function (e) { return chipHtml(q, e, 'got'); }).join('') + '</div>',
        collect: collected.slice(),
        formula:
          headHtml + valHtml +
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
      var q = parseInt(qIn.value, 10) || 0, n = parseInt(nIn.value, 10) || 0;
      var html = '';
      for (var i = 0; i < Math.min(n, 40); i++) html += chipHtml(q, 1);
      stage.innerHTML = '<div class="pair-round-cap">初始：<b>' + n + '</b> 个 ' + fmt(q) +
        ' —— 要算 <b>' + expSup(q, n) + '</b>' +
        (n === 0 ? '，一个都不用配对，结果直接就是 <b>1</b>。' : '。点 ▶ 自动演示，看它们一轮轮两两配对、数量减半。') +
        '</div>' + '<div class="tok-row">' + html + '</div>';
      formula.innerHTML = '<span class="dstatus">按 ▶ 自动演示 或 单步 逐帧播放</span>';
      scrollActivePageToBottom();
    }

    var curKey = null;   // 当前演示用的 q|n，用来判断“点 ▶ 是暂停还是重播”
    runB.addEventListener('click', function () {
      var p;
      try { p = readParams(); } catch (e) { stB.textContent = ''; toast('⚠ ' + errText(e), 'warn'); return; }
      var key = p.q + '|' + p.n;
      /* 参数没变：暂停/继续；参数改了：直接重播新的（否则会停在上一次的旧画面上，看着像卡住） */
      if (auto && key === curKey) { stopAll(); stB.textContent = '已暂停（点 ▶ 继续）'; return; }
      curKey = key;
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
      var p3, k3;
      try { p3 = readParams(); k3 = p3.q + '|' + p3.n; } catch (e) { stB.textContent = ''; toast('⚠ ' + errText(e), 'warn'); return; }
      /* 没演示过、或参数改了 → 按新参数重建，否则会接着走上一轮的旧帧 */
      if (!frames.length || k3 !== curKey) {
        try { buildFrames(); } catch (e) { stB.textContent = ''; toast('⚠ ' + errText(e), 'warn'); return; }
        fidx = 0; curKey = k3;
        stB.textContent = '单步模式（每点一次走一步）';
      }
      if (!stepOnce() && frames.length) stB.textContent = '单步模式（重按 ▶ 重播）';
    });
    resetB.addEventListener('click', reset);
    preview();
  };
})();
