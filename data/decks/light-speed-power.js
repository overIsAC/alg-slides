/* =====================================================================
 * 课件：光速幂（Light Speed Power / 分块预处理幂）
 * 对应笔记：100-基础算法/80-乘方/20-光速幂
 *
 * 本文件只负责往 window.DECKS 注册这一份课件；
 * 由 index.html 在 data/decks.js 之后、assets/app.js 之前引入。
 *
 * 页类型：
 *   {tag,title} + 以下之一：
 *     body      —— 自由 HTML（支持 $...$ / $$...$$ 数学公式，运行时 KaTeX 渲染）
 *     code:{label,text} —— 深色代码块（运行时高亮 + 行号）
 *     app:'demo-lsp' —— 分块定位交互演示（在 assets/app.js 里实现）
 * 注意：body/code 内不要写 </script>；数学公式用 $ 包裹，反斜杠要双写。
 * ===================================================================== */
(function () {
  'use strict';

  var D = window.DECKS = window.DECKS || {};

  /* ---------- 公共代码片段 ---------- */
  var HL = {
    lspC: {
      label: '光速幂（B1 = B2 = B）',
      text: [
        'const int B = 1e5;',
        'int x, n;',
        'int f1[N], f2[N];',
        '',
        '',
        '//预处理',
        'f1[0] = 1;',
        'for (int i = 1; i <= B; ++i) {',
        '    f1[i] = (LL)f1[i - 1] * x % mod;',
        '}',
        'f2[0] = 1;',
        'for (int i = 1; i <= B; ++i) {',
        '    f2[i] = (LL)f2[i - 1] * f1[B] % mod;',
        '}',
        '',
        '// 计算x^a',
        '(LL)f2[a / B] * f1[a % B] % mod;',
        ''
      ].join('\n')
    }
  };

  /* ===================== 课件主体 ===================== */
  D['100-基础算法/80-乘方/20-光速幂'] = {
    title: '光速幂',
    subtitle: '100-基础算法 · 乘方',
    pages: [
      /* ===================== 01 · 问题 ===================== */
      {
        tag: '01 · 问题',
        title: '反复问 aᵇ mod p，还能更快吗？',
        body:
          '<div class="prob-card">' +
          '  <div class="prob-q">多次询问形如：</div>' +
          '  <div class="prob-formula">$a^{b} \\bmod p$</div>' +
          '  <div class="prob-sub">其中<b>底数 $a$</b>、<b>模数 $p$</b> 都固定，只有指数 $b$ 在变</div>' +
          '</div>' +
          '<div class="grid2">' +
          '  <div class="card bad">' +
          '    <div class="card-title">每次都跑一遍快速幂？❌</div>' +
          '    <p>每次询问 $O(\\log b)$，问得多了还是吃不消。</p>' +
          '  </div>' +
          '  <div class="card good">' +
          '    <div class="card-title">光速幂的思路 🔑</div>' +
          '    <p>既然 $a$ 和 $p$ 都固定，就<b>对指数 $b$ 分块预处理</b>，之后每次询问 $O(1)$ 出结果。</p>' +
          '  </div>' +
          '</div>'
      },

      /* ===================== 02 · 做法 ===================== */
      {
        tag: '02 · 做法',
        title: '做法：对指数分块',
        body:
          '<p class="lead">核心一句话：<b>对指数分块</b>，选择两个数字 $B1, B2$。</p>' +
          '<div class="grid2v">' +
          '  <div class="card">' +
          '    <div class="card-title">为什么要分块？</div>' +
          '    <p>指数 $b$ 可能很大，不可能把 $a^{0}\\sim a^{b}$ 全都预处理出来。</p>' +
          '    <p>把指数拆成「整块」+「零头」两部分，就只需要预处理 $B1+B2$ 个数。</p>' +
          '  </div>' +
          '  <div class="card">' +
          '    <div class="card-title">两个数组的职责</div>' +
          '    <p><code>f1</code>：存「零头」—— $a^{0},a^{1},a^{2},\\dots$</p>' +
          '    <p><code>f2</code>：存「整块」—— $a^{B1\\times 0},a^{B1\\times 1},a^{B1\\times 2},\\dots$</p>' +
          '  </div>' +
          '</div>'
      },

      /* ===================== 03 · 预处理 ===================== */
      {
        tag: '03 · 预处理',
        title: '预处理：两个数组怎么填',
        body:
          '<p class="lead">两步就把两个数组填满：</p>' +
          '<div class="grid2v">' +
          '  <div class="step-card">' +
          '    <div class="n-label">① 填 f1</div>' +
          '    <div class="n-step">$a^{0},a^{1},a^{2},\\dots,a^{B1}$</div>' +
          '    <div class="n-desc">共 $B1+1$ 个数字，结果存到 <code>f1</code>。<br>每次乘一个 $a$ 即可：$f1[i]=f1[i-1]\\times a$</div>' +
          '  </div>' +
          '  <div class="step-card">' +
          '    <div class="n-label">② 填 f2</div>' +
          '    <div class="n-step">$a^{B1\\times 0},a^{B1\\times 1},\\dots,a^{B1\\times (B2-1)}$</div>' +
          '    <div class="n-desc">共 $B2$ 个数字，结果存到 <code>f2</code>。<br>每次乘一个 $a^{B1}$（也就是 <code>f1[B1]</code>）：$f2[i]=f2[i-1]\\times a^{B1}$</div>' +
          '  </div>' +
          '</div>' +
          '<div class="tip-card">' +
          '  <b>衔接：</b>$a^{B1}$ 在上一步已经算好放在 <code>f1[B1]</code> 了，直接拿来用。' +
          '</div>'
      },

      /* ===================== 04 · 计算 ===================== */
      {
        tag: '04 · 计算',
        title: '计算：把 b 拆成两部分',
        body:
          '<p class="lead">要算 $a^{b}$，而 $f1,f2$ 里不一定直接有它 —— 用两块<b>组合</b>出来：</p>' +
          '<div class="formula-row">' +
          '  <div class="fm"><span>拆法</span><b>$x=\\lfloor \\frac{b}{B1} \\rfloor$　$y=b \\bmod B1$</b></div>' +
          '</div>' +
          '<div class="grid2v">' +
          '  <div class="step-card">' +
          '    <div class="n-label">① 整块部分 $a^{B1\\times x}$</div>' +
          '    <div class="n-step">在 <code>f2[x]</code> 这个位置</div>' +
          '    <div class="n-desc">需要保证 <b>$x \\lt B2$</b> —— 否则 <code>f2</code> 里没有这个位置（只预处理到 <code>f2[B2-1]</code>）</div>' +
          '  </div>' +
          '  <div class="step-card">' +
          '    <div class="n-label">② 零头部分 $a^{y}$</div>' +
          '    <div class="n-step">在 <code>f1[y]</code> 这个位置</div>' +
          '    <div class="n-desc">因为 $y$ 是取模得到的，肯定有 <b>$y \\lt B1$</b></div>' +
          '  </div>' +
          '</div>' +
          '<div class="req-card">' +
          '  <div class="req-title">答案</div>' +
          '  <div class="req-formula">$a^{b}=a^{B1\\times x}\\times a^{y}$　→　<code>f2[x] * f1[y]</code></div>' +
          '</div>'
      },

      /* ===================== 05 · B1、B2 的选择 ===================== */
      {
        tag: '05 · B1、B2 的选择',
        title: 'B1、B2 怎么选？',
        body:
          '<p class="lead">两个约束，一上一下夹住选择范围：</p>' +
          '<div class="grid2">' +
          '  <div class="card bad">' +
          '    <div class="card-title">不能太小 ⚠️</div>' +
          '    <p>要能覆盖到最大的指数 $b$：</p>' +
          '    <div class="mini-formula">$B1\\times B2 \\gt b$</div>' +
          '    <p class="faint">否则 $x=\\lfloor \\frac{b}{B1} \\rfloor \\ge B2$，<code>f2[x]</code> 这个位置没有预处理出来。</p>' +
          '  </div>' +
          '  <div class="card good">' +
          '    <div class="card-title">不能太大 ⚠️</div>' +
          '    <p>要能<b>预处理得动</b>：数组开得下、时间跑得完。</p>' +
          '    <div class="mini-formula">预处理 $O(B1+B2)$ 时间与空间</div>' +
          '  </div>' +
          '</div>' +
          '<div class="req-card">' +
          '  <div class="req-title">省事写法：两个取成一样</div>' +
          '  <p class="req-desc">把 $B1,B2$ 都写成 $B$，那么为了覆盖到最大指数 $b$：</p>' +
          '  <div class="req-formula">$B^{2} \\gt b$　→　$B \\ge \\lceil\\sqrt{b}\\rceil$</div>' +
          '</div>'
      },

      /* ===================== 06 · 演示（分块定位） ===================== */
      {
        tag: '06 · 演示',
        title: '演示：预处理出来的表',
        body:
          '<p class="lead">下面这张表就是预处理出来的全部结果：<b>行</b>是 $f1$（零头 $a^{y}$），<b>列</b>是 $f2$（整块 $a^{B1\\times x}$）。<br>' +
          '格子里填的是两者相乘得到的 $a^{b}$ —— 输入 $B1,B2$ 和要算的指数 $b$，看它落在哪一格，<b>没选中的格子会淡下去</b>。</p>' +
          '<div class="demo-wrap"><div class="demo-body" data-app="demo-lsp"></div></div>',
        app: 'demo-lsp'
      },

      /* ===================== 07 · 代码 ===================== */
      {
        tag: '07 · 代码',
        title: '代码',
        body:
          '<p class="lead">预处理时填两个数组，询问时一次乘法出结果：</p>',
        code: HL.lspC
      },

      /* ===================== 08 · 常数优化 ===================== */
      {
        tag: '08 · 常数优化',
        title: '常数优化：把除法换成位运算',
        body:
          '<p class="lead">如果 $B1,B2$ 都取 <b>2 的次方</b>，除法和取模就能换成更快的位运算。</p>' +
          '<div class="grid2v">' +
          '  <div class="card">' +
          '    <div class="card-title">举例：$B1=B2=2^{16}=65536$</div>' +
          '    <p><code>a / B</code>　→　<code>a &gt;&gt; 16</code></p>' +
          '    <p><code>a % B</code>　→　<code>a &amp; 65535</code></p>' +
          '  </div>' +
          '  <div class="card">' +
          '    <div class="card-title">为什么可以？</div>' +
          '    <p>除以 $2^{16}$ 就是右移 16 位；对 $2^{16}$ 取模就是<b>保留低 16 位</b>。</p>' +
          '    <p class="faint">具体原理可以思考二进制。</p>' +
          '  </div>' +
          '</div>' +
          '<div class="arrow-line">两次除法 → 两次位运算，常数直接小一截。</div>'
      },

      /* ===================== 09 · 更大的指数 ===================== */
      {
        tag: '09 · 更大的指数',
        title: '指数再大怎么办？',
        body:
          '<p class="lead">如果指数 $b$ 大到两个块也覆盖不了，有两条路：</p>' +
          '<div class="grid2v">' +
          '  <div class="card">' +
          '    <div class="card-title">想法一：分更多的块</div>' +
          '    <p>分成 $B1,B2,B3,B4\\dots$，一层层循环起来。</p>' +
          '    <p class="faint">（作者没有尝试过，仅作思路）</p>' +
          '  </div>' +
          '  <div class="card good">' +
          '    <div class="card-title">更好的做法：扩展欧拉定理 ✅</div>' +
          '    <p>先用扩展欧拉定理把指数<b>降下来</b>。</p>' +
          '    <p>模数 $10^{9}$ 量级时，不管指数多大，分两个块 $B1,B2$ 就足够了。</p>' +
          '  </div>' +
          '</div>' +
          '<div class="req-card">' +
          '  <div class="req-title">具体要覆盖到多少？</div>' +
          '  <div class="edge-steps">' +
          '    <div class="edge-row"><span class="e-cond">底数、模数互质</span><span class="e-why">覆盖到 $\\varphi(p)$ 即可</span></div>' +
          '    <div class="edge-row"><span class="e-cond">底数、模数不互质</span><span class="e-why">覆盖到 $2\\varphi(p)$ 即可</span></div>' +
          '  </div>' +
          '</div>'
      },

      /* ===================== 10 · 习题 ===================== */
      {
        tag: '10 · 习题',
        title: '习题',
        body:
          '<div class="ex-table">' +
          '  <table>' +
          '    <thead><tr><th>题号</th><th>题目</th><th>备注</th><th>难度</th></tr></thead>' +
          '    <tbody>' +
          '      <tr><td class="mono">loj162</td><td><a href="https://loj.ac/p/162" target="_blank" rel="noopener">快速幂 2</a></td><td></td><td></td></tr>' +
          '    </tbody>' +
          '  </table>' +
          '</div>'
      }
    ]
  };
})();
