/* 光速幂课件 · 预处理表演示（demo-lsp）
 * 由 assets/app.js 的 mountDemo 通过 window.DEMOS["demo-lsp"] 调用。
 * 依赖的全局 helper（readInt / $ / $$ / toast / errText / renderMath …）由 assets/app.js 运行期提供。
 */
(function () {
  "use strict";
  var DEMOS = window.DEMOS = window.DEMOS || {};

  /* ================= 光速幂：预处理表（demo-lsp） =================
   * 行 = f1（零头 a^y，y = b mod B1），列 = f2（整块 a^{B1*x}，x = b/B1）。
   * 格子 (y, x) = a^{y + B1*x} = a^b，未选中的淡下去。
   */
  DEMOS['demo-lsp'] = function (holder) {
    var LSP_MAX = 12;   // B1 / B2 上限：再大表格就装不下了
    holder.innerHTML =
      '<div class="dctrl">' +
      '  <label>B1（块大小 / 行数）</label><input id="lpB1" type="number" min="2" max="' + LSP_MAX + '" value="5">' +
      '  <label>B2（块数 / 列数）</label><input id="lpB2" type="number" min="2" max="' + LSP_MAX + '" value="5">' +
      '  <label>指数 b</label><input id="lpB" type="number" min="0" max="24" value="11">' +
      '  <button class="dbtn primary" id="lpRun">▶ 生成表格</button>' +
      '  <button class="dbtn ghost" id="lpReset">↺ 重置</button>' +
      '  <span class="dstatus" id="lpSt"></span>' +
      '</div>' +
      '<div class="dctrl"><div class="dpreset">' +
      '  <span class="dstatus">预设：</span>' +
      '  <span class="pchip" data-b1="5" data-b2="5" data-b="11">B=5，b=11</span>' +
      '  <span class="pchip" data-b1="4" data-b2="4" data-b="13">B=4，b=13</span>' +
      '  <span class="pchip" data-b1="10" data-b2="10" data-b="57">B=10，b=57</span>' +
      '  <span class="pchip" data-b1="3" data-b2="6" data-b="16">B1=3 B2=6，b=16</span>' +
      '</div></div>' +
      '<div class="lsp-stage" id="lpStage"></div>' +
      '<div class="lsp-fin" id="lpFin"></div>';

    var $id = function (s) { return holder.querySelector(s); };
    var b1In = $id('#lpB1'), b2In = $id('#lpB2'), bIn = $id('#lpB');
    var runB = $id('#lpRun'), resetB = $id('#lpReset');
    var stB = $id('#lpSt'), stage = $id('#lpStage'), fin = $id('#lpFin');

    /* B1 / B2 一变，b 的可选上限就跟着变：要能被 B1×B2 覆盖 */
    function syncBTop() {
      var b1 = parseInt(b1In.value, 10), b2 = parseInt(b2In.value, 10);
      if (!(b1 >= 2 && b1 <= LSP_MAX) || !(b2 >= 2 && b2 <= LSP_MAX)) return;
      var top = b1 * b2 - 1;
      bIn.max = String(top);
      if (parseInt(bIn.value, 10) > top) bIn.value = String(top);
    }
    b1In.addEventListener('input', syncBTop);
    b2In.addEventListener('input', syncBTop);

    function parse() {
      var b1 = readInt(b1In, 'B1', 2, LSP_MAX, '2 ~ ' + LSP_MAX, '太小没意义，太大表格装不下');
      var b2 = readInt(b2In, 'B2', 2, LSP_MAX, '2 ~ ' + LSP_MAX, '太小没意义，太大表格装不下');
      var top = b1 * b2 - 1;
      var b = readInt(bIn, '指数 b', 0, top, '0 ~ ' + top, '要能被 B1×B2 = ' + (b1 * b2) + ' 覆盖');
      return { b1: b1, b2: b2, b: b, top: top };
    }

    function build(b1, b2, b) {
      var x = Math.floor(b / b1);   // f2 下标（整块）
      var y = b % b1;               // f1 下标（零头）
      var top = b1 * b2 - 1;
      var html = '<table class="lsp-tbl"><thead><tr>';
      html += '<th class="lsp-corner">f1 \\ f2</th>';
      for (var j = 0; j < b2; j++) {
        html += '<th class="lsp-h' + (j === x ? ' sel' : '') + '">$a^{' + b1 + '\\times ' + j + '}$' +
          '<span class="lsp-tag">f2[' + j + ']</span></th>';
      }
      html += '</tr></thead><tbody>';
      for (var i = 0; i < b1; i++) {
        html += '<tr><th class="lsp-h' + (i === y ? ' sel' : '') + '">$a^{' + i + '}$' +
          '<span class="lsp-tag">f1[' + i + ']</span></th>';
        for (var j2 = 0; j2 < b2; j2++) {
          var e = i + b1 * j2;
          html += '<td class="lsp-cell' + (e === b ? ' sel' : '') + '">$a^{' + e + '}$</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      stage.innerHTML = html;
      renderMath(stage);

      fin.innerHTML =
        '<div><b>✅ 拆解结果：</b>把 <b>$b = ' + b + '$</b> 拆成 ' +
        '<span class="ok">$x = \\lfloor b/B1\\rfloor = ' + x + '$</span>（→ <code>f2[' + x + ']</code>）与 ' +
        '<span class="ok">$y = b \\bmod B1 = ' + y + '$</span>（→ <code>f1[' + y + ']</code>）</div>' +
        '<div class="lsp-eq">$a^{' + b + '} = a^{' + (b1 * x) + '} \\times a^{' + y + '} = $ <b>f2[' + x + '] × f1[' + y + ']</b></div>' +
        '<div class="faint">高亮的这一格，正好是它所在<b>行</b> f1[' + y + '] 与<b>列</b> f2[' + x + '] 的乘积；' +
        '表里一共 $B1\\times B2 = ' + (b1 * b2) + '$ 个结果都能这样拼出来，而实际只预处理了 $B1+B2 = ' + (b1 + b2) + '$ 个数。</div>';
      renderMath(fin);
      fin.classList.add('show');
      stB.textContent = 'B1=' + b1 + ' B2=' + b2 + ' → b 可选 0~' + top;
    }

    function apply() {
      var p;
      try { p = parse(); } catch (e) { toast('⚠ ' + errText(e), 'warn'); return; }
      build(p.b1, p.b2, p.b);
    }

    $$('.pchip', holder).forEach(function (c) {
      c.addEventListener('click', function () {
        b1In.value = c.dataset.b1; b2In.value = c.dataset.b2; bIn.value = c.dataset.b;
        syncBTop();
        build(parseInt(c.dataset.b1, 10), parseInt(c.dataset.b2, 10), parseInt(c.dataset.b, 10));
      });
    });

    runB.addEventListener('click', apply);
    resetB.addEventListener('click', function () {
      b1In.value = '5'; b2In.value = '5'; bIn.value = '11';
      syncBTop(); build(5, 5, 11);
    });
    [b1In, b2In, bIn].forEach(function (el) {
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') apply(); });
    });

    syncBTop();
    build(5, 5, 11);
  };
})();
