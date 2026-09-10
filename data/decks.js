/* =====================================================================
 * DECKS 入口 —— 只负责建立注册表，不存放具体课件
 *
 * 每份课件单独一个文件，放在 data/decks/ 下，例如：
 *   data/decks/fast-power.js      快速幂
 *   data/decks/<英文名>.js         以后新增的课件
 *
 * 课件文件自己往注册表里挂，写法：
 *   var D = window.DECKS = window.DECKS || {};
 *   D['<笔记 rel 路径，去掉 .md>'] = { title, subtitle, pages: [...] };
 *
 * 新增一份课件时：
 *   1. 在 data/decks/ 下新建 <英文名>.js
 *   2. 在 index.html 里，本文件之后、assets/app.js 之前，加一行 <script src="...">
 *
 * 页对象字段、公式写法、CSS 组件等规范见 skill「制作课件约束」。
 * ===================================================================== */
(function () {
  'use strict';
  window.DECKS = window.DECKS || {};
})();
