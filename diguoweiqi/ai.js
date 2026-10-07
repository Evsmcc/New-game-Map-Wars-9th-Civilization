/* ============================================================
 * 奇趣落子棋 —— AI 托管（Minimax + Alpha-Beta，纯得分评估）
 * 依赖 game.js 暴露的 window.GameAPI。
 *
 * 设计要点：
 *   - 评估函数只看游戏得分：evaluate = 我方分 - 对方分，
 *     不含任何棋形/气数/位置启发项；同分时仅用固定规则破平；
 *   - 搜索只在「克隆状态」上进行：applyMove 是纯函数，完整结算
 *     提子 / 收取特殊棋子 / 围吃 / 自杀判定，不触碰 DOM 与随机刷棋子；
 *   - 子节点只结算一次并缓存（expand），搜索直接复用，避免重复模拟；
 *     走法排序按「该手的直接得分增益」，与评估目标完全同源；
 *   - 根节点动作必须通过 GameAPI.isPlaceable（真实合法动作空间），
 *     AI 只从合法落点中选，再交 GameAPI.placeAt 落地。
 * ============================================================ */

(function () {
  'use strict';

  var api = window.GameAPI;
  if (!api) return;

  var SIZE = api.SIZE;
  var DIRS = api.DIRS;
  var SPECIALS = api.SPECIALS;
  var KILL_SCORE = api.KILL_SCORE;

  var SEARCH_DEPTH = 4;   // 推演层数（我方 → 对手 → 我方）
  var ROOT_K = 16;        // 根层最大候选数
  var NODE_K = 4;         // 其余层最大候选数
  var PRESCREEN_MULT = 3; // 轻量预筛后进入完整结算的倍数
  var THINK_MIN = 450;
  var THINK_MAX = 2950;

  var aiEnabled = { b: false, w: false };
  var timer = null;
  var thinking = false;

  function opponent(p) { return p === 'b' ? 'w' : 'b'; }

  // ---------- 纯模拟层（与 game.js 同一套规则语义） ----------

  function isOpenVal(v) {
    if (v === null) return true;
    if (v && v.skull) return true;                 // ☠ 算一口气
    var s = v && v.e ? SPECIALS[v.e] : null;
    return s ? (s.placeable || !s.sieges) : false;
  }
  function isPlaceableVal(v) {
    if (v === null) return true;
    if (v && v.skull) return false;                // ☠ 占位不可落
    var s = v && v.e ? SPECIALS[v.e] : null;
    return s ? s.placeable : false;
  }

  // 取棋块及气数（在给定克隆棋盘上）
  function blockInfo(g, r, c, color) {
    var stones = [], liberties = {}, seen = {}, stack = [[r, c]];
    while (stack.length) {
      var cur = stack.pop(), rr = cur[0], cc = cur[1], key = rr + ',' + cc;
      if (seen[key]) continue;
      seen[key] = true;
      if (g[rr][cc] !== color) continue;
      stones.push([rr, cc]);
      for (var i = 0; i < DIRS.length; i++) {
        var nr = rr + DIRS[i][0], nc = cc + DIRS[i][1];
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (isOpenVal(g[nr][nc])) liberties[nr + ',' + nc] = true;
        else if (g[nr][nc] === color) stack.push([nr, nc]);
      }
    }
    return { stones: stones, liberties: Object.keys(liberties).length };
  }

  // 可被吃的特殊棋子的气（四向开放格）
  function specialLiberties(g, r, c) {
    var n = 0;
    for (var i = 0; i < DIRS.length; i++) {
      var nr = r + DIRS[i][0], nc = c + DIRS[i][1];
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && isOpenVal(g[nr][nc])) n++;
    }
    return n;
  }

  function restoreFor(emoji) {
    if (emoji === '🟦' || emoji === '🟨') return { e: emoji };
    return { e: '🟩' };
  }

  // 纯状态：{ g: 棋盘二维数组, score: {b,w} }
  function cloneState(st) {
    return { g: st.g.map(function (row) { return row.slice(); }),
             score: { b: st.score.b, w: st.score.w } };
  }

  // 在克隆状态上结算一手；非法（自杀/不可落）返回 null
  function applyMove(st, r, c, player) {
    var g = st.g;
    if (!isPlaceableVal(g[r][c])) return null;

    var ns = cloneState(st);
    var ng = ns.g;
    var foe = opponent(player);
    var orig = ng[r][c];

    // 落在特殊棋子上：收取得分
    if (orig && orig.e) ns.score[player] += SPECIALS[orig.e].score;
    ng[r][c] = player;

    // 提子：相邻敌方 0 气棋块整组移除
    var seenOpp = {};
    for (var i = 0; i < DIRS.length; i++) {
      var nr0 = r + DIRS[i][0], nc0 = c + DIRS[i][1];
      if (nr0 < 0 || nr0 >= SIZE || nc0 < 0 || nc0 >= SIZE) continue;
      if (ng[nr0][nc0] !== foe || seenOpp[nr0 + ',' + nc0]) continue;
      var blk = blockInfo(ng, nr0, nc0, foe);
      blk.stones.forEach(function (s) { seenOpp[s[0] + ',' + s[1]] = true; });
      if (blk.liberties === 0) {
        ns.score[player] += blk.stones.length * KILL_SCORE;
        blk.stones.forEach(function (s) { ng[s[0]][s[1]] = null; });
      }
    }

    // 围吃可被吃的特殊棋子（0 气）：
    // 一手棋只会把落子格由开放变占据，故只有与落子格相邻的特殊棋子可能被堵住最后一气；
    // 提子移除棋子只会增加气，不可能造成围吃 —— 只查四邻即可，与全盘扫描等价
    var checkedSpec = {};
    for (var k = 0; k < DIRS.length; k++) {
      var sr = r + DIRS[k][0], sc = c + DIRS[k][1];
      if (sr < 0 || sr >= SIZE || sc < 0 || sc >= SIZE) continue;
      var skey = sr + ',' + sc;
      if (checkedSpec[skey]) continue;
      checkedSpec[skey] = true;
      var sv = ng[sr][sc];
      var sdef = sv && sv.e ? SPECIALS[sv.e] : null;
      if (sdef && sdef.capturable && specialLiberties(ng, sr, sc) === 0) {
        ns.score[player] += sdef.score;
        ng[sr][sc] = restoreFor(sv.e);
      }
    }

    // 自杀判定：己方棋块必须还有气
    var own = blockInfo(ng, r, c, player);
    if (own.liberties === 0) return null;

    // 落在 🟦 水域上：该棋子回合末被冲走，水域恢复
    if (orig && orig.e === '🟦') ng[r][c] = { e: '🟦' };

    return ns;
  }

  // ---------- 评估：固定得分 + 实时分享光环 ----------
  // 光环分由当前棋盘实时算出：棋子被提/冲走、分享棋子被吃都会自动反映
  function shareBonusOf(g) {
    var bn = { b: 0, w: 0 };
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = g[r][c];
        var def = v && v.e && !v.skull ? SPECIALS[v.e] : null;
        if (!def || !def.share) continue;
        var q = def.score / 4;
        for (var i = 0; i < DIRS.length; i++) {
          var nr = r + DIRS[i][0], nc = c + DIRS[i][1];
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
          var nv = g[nr][nc];
          if (nv === 'b') bn.b += q;
          else if (nv === 'w') bn.w += q;
        }
      }
    }
    return bn;
  }

  function evaluate(st, me) {
    var bn = shareBonusOf(st.g);
    return (st.score[me] + bn[me]) - (st.score[opponent(me)] + bn[opponent(me)]);
  }

  // ---------- 候选展开（每个合法动作结算一次，结果供搜索复用） ----------
  // 返回 [{m:[r,c], ns:结算后状态, gain:行动方本手得分增益}]，按 gain 降序
  function expand(st, player, realLegality, limit) {
    var g = st.g, hot = {};

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = g[r][c];
        if (v !== 'b' && v !== 'w' && !(v && v.e)) continue;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
            if (!isPlaceableVal(g[nr][nc])) continue;
            if (realLegality && !api.isPlaceable(nr, nc)) continue;  // ☠ 等真实占位
            hot[nr + ',' + nc] = [nr, nc];
          }
        }
      }
    }

    var points = Object.keys(hot).map(function (k) { return hot[k]; });
    if (points.length === 0) {
      // 全盘没有任何棋子/特殊棋子锚点（极端情况）：走中心附近
      var mid = Math.floor(SIZE / 2);
      points = [[mid, mid], [mid - 1, mid], [mid, mid - 1], [mid - 1, mid - 1]];
    }

    // 轻量预筛：不落子估算本手的得分相关性——
    //   进攻①：直接收取所在格特殊棋子；
    //   进攻②：提掉四邻 1 气敌块；
    //   进攻③：落在最后一口气上围吃相邻可被吃特殊棋子；
    //   防守：给四邻己方 1 气棋块长气（否则下一手被提，失分等价于 stones×KILL_SCORE）。
    // 均严格围绕游戏得分，仅用于候选入选排序，不进入叶子评估。
    var foe = opponent(player);
    var center = (SIZE - 1) / 2;

    // 数某特殊棋子除 (br,bc) 外的开放邻格数（判断落子是否堵上它最后一气）
    function otherLiberties(sr, sc, br, bc) {
      var n = 0;
      for (var d = 0; d < DIRS.length; d++) {
        var nr = sr + DIRS[d][0], nc = sc + DIRS[d][1];
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (nr === br && nc === bc) continue;
        if (isOpenVal(g[nr][nc])) n++;
      }
      return n;
    }

    var prescreen = points.map(function (m) {
      var r = m[0], c = m[1], q = 0;
      var orig = g[r][c];
      if (orig && orig.e) q += SPECIALS[orig.e].score;   // 进攻①
      var seenFoe = {}, seenFriend = {};
      for (var i = 0; i < DIRS.length; i++) {
        var nr = r + DIRS[i][0], nc = c + DIRS[i][1];
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        var key = nr + ',' + nc;
        var nv = g[nr][nc];
        if (nv === foe && !seenFoe[key]) {
          var info = blockInfo(g, nr, nc, foe);          // 进攻②
          info.stones.forEach(function (s) { seenFoe[s[0] + ',' + s[1]] = true; });
          if (info.liberties === 1) q += info.stones.length * KILL_SCORE;
        } else if (nv === player && !seenFriend[key]) {
          var own = blockInfo(g, nr, nc, player);        // 防守
          own.stones.forEach(function (s) { seenFriend[s[0] + ',' + s[1]] = true; });
          if (own.liberties === 1) q += own.stones.length * KILL_SCORE * 0.9; // 略低于真吃子
        } else if (nv && nv.e && !nv.skull) {
          var sdef = SPECIALS[nv.e];                     // 进攻③ 围吃特殊棋子（排除 ☠ 标记）
          if (sdef) {
            // 落在分享棋子相邻格：本手起获得其 1/4 光环分
            if (sdef.share) q += sdef.score * 0.25;
            if (sdef.capturable && otherLiberties(nr, nc, r, c) === 0) q += sdef.score;
          }
        }
      }
      return { m: m, q: q,
               d: Math.abs(r - center) + Math.abs(c - center) };
    });
    prescreen.sort(function (a, b) {
      if (b.q !== a.q) return b.q - a.q;
      return a.d - b.d;
    });
    // 正收益候选（q>0）全部保留进入完整结算，名额只用于裁剪零/负收益点
    var gainersQ = prescreen.filter(function (p) { return p.q > 0; });
    var othersQ = prescreen.filter(function (p) { return p.q <= 0; });
    var shortlist = gainersQ.concat(
      othersQ.slice(0, Math.max(0, limit * PRESCREEN_MULT - gainersQ.length))
    );

    // 落子后该棋子在新盘上获得的分享光环分（四邻 share 棋子的 score/4 之和）
    function auraAt(ng, r, c, color) {
      if (ng[r][c] !== color) return 0;   // 水域冲走等：棋子已不在
      var a = 0;
      for (var ai2 = 0; ai2 < DIRS.length; ai2++) {
        var anr = r + DIRS[ai2][0], anc = c + DIRS[ai2][1];
        if (anr < 0 || anr >= SIZE || anc < 0 || anc >= SIZE) continue;
        var anv = ng[anr][anc], ad = anv && anv.e && !anv.skull ? SPECIALS[anv.e] : null;
        if (ad && ad.share) a += ad.score / 4;
      }
      return a;
    }
    function makeChild(m, ns) {
      var fixedGain = ns.score[player] - st.score[player];
      return {
        m: m, ns: ns, gain: fixedGain,
        aura: auraAt(ns.g, m[0], m[1], player),
        ord: fixedGain + auraAt(ns.g, m[0], m[1], player)  // 1 层真实总分增量
      };
    }

    // 完整结算（自杀过滤 + 精确得分增益）
    var children = [];
    shortlist.forEach(function (p) {
      var ns = applyMove(st, p.m[0], p.m[1], player);
      if (ns) children.push(makeChild(p.m, ns));
    });

    // 兜底：热点（锚点 ±2）内没有任何合法动作时（拥挤局面：热点格全为
    // ☠/不可落/自杀点，但远处仍有合法空格），全盘扫描，保证 AI 永远有棋可走。
    // 正增益点全部保留，中性点取 limit 个即可。
    if (children.length === 0) {
      var neutralKept = 0;
      for (var br = 0; br < SIZE; br++) {
        for (var bc = 0; bc < SIZE; bc++) {
          if (!isPlaceableVal(g[br][bc])) continue;
          if (realLegality && !api.isPlaceable(br, bc)) continue;
          var bns = applyMove(st, br, bc, player);
          if (!bns) continue;
          var ch = makeChild([br, bc], bns);
          if (ch.ord > 0) {
            children.push(ch);                 // 正收益点（固定分/光环）全部保留
          } else if (neutralKept < limit) {
            children.push(ch);
            neutralKept++;
          }
        }
      }
    }

    // 排序：1 层总分增量高的优先（对 max/min 层都是最好的走法排序）；
    // 同增量按靠近中心破平（确定性）
    children.sort(function (a, b) {
      if (b.ord !== a.ord) return b.ord - a.ord;
      var da = Math.abs(a.m[0] - center) + Math.abs(a.m[1] - center);
      var db = Math.abs(b.m[0] - center) + Math.abs(b.m[1] - center);
      return da - db;
    });
    // 真实正收益动作（固定分或光环分 >0）全部保留交给搜索，limit 只裁剪零收益动作，
    // 从根因上杜绝“明明可以得分却没考虑那步”的剪枝漏招
    var gainers = children.filter(function (ch) { return ch.ord > 0; });
    var neutral = children.filter(function (ch) { return ch.ord <= 0; });
    return gainers.concat(neutral.slice(0, Math.max(0, limit - gainers.length)));
  }

  // ---------- Minimax + Alpha-Beta ----------
  function minimax(st, depth, alpha, beta, player, me) {
    if (depth === 0) return evaluate(st, me);

    var children = expand(st, player, false, NODE_K);
    if (children.length === 0) return evaluate(st, me);

    if (player === me) {
      var best = -Infinity;
      for (var i = 0; i < children.length; i++) {
        var val = minimax(children[i].ns, depth - 1, alpha, beta, opponent(player), me);
        if (val > best) best = val;
        if (best > alpha) alpha = best;
        if (beta <= alpha) break;
      }
      return best;
    } else {
      var worst = Infinity;
      for (var j = 0; j < children.length; j++) {
        var val2 = minimax(children[j].ns, depth - 1, alpha, beta, opponent(player), me);
        if (val2 < worst) worst = val2;
        if (worst < beta) beta = worst;
        if (beta <= alpha) break;
      }
      return worst;
    }
  }

  function chooseMove(player) {
    var grid = api.getGrid();
    var sc = api.getScores ? api.getScores() : { b: 0, w: 0 };
    var st = { g: grid.map(function (row) { return row.slice(); }),
               score: { b: sc.b, w: sc.w } };

    // 根层：真实合法动作 + 模拟合法（非自杀）
    var children = expand(st, player, true, ROOT_K);
    if (children.length === 0) return null;

    var best = null, bestVal = -Infinity;
    children.forEach(function (ch) {
      var val = minimax(ch.ns, SEARCH_DEPTH - 1, -Infinity, Infinity, opponent(player), player);
      // 搜索值完全相同（得分等价）时加 <0.5 的扰动，仅影响同分选择，不颠倒任何分差
      val += Math.random() * 0.4;
      if (val > bestVal) { bestVal = val; best = ch.m; }
    });
    return best;
  }

  // ---------- 回合调度 ----------
  function schedule() {
    // 已有待执行决策时不要打断（连续勾选两个托管方时）
    if (thinking || api.gameOver) return;
    var player = api.currentPlayer;
    if (!aiEnabled[player]) return;
    clearTimeout(timer);
    var delay = THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN);
    thinking = true;
    timer = setTimeout(function () {
      thinking = false;
      try {
        if (api.gameOver || !aiEnabled[api.currentPlayer]) return;
        var move = chooseMove(api.currentPlayer);
        if (move && api.isPlaceable(move[0], move[1])) {
          api.placeAt(move[0], move[1]);
        }
        // placeAt 后 game.js 触发 onTurn；另一方也托管则自动接续
      } catch (err) {
        if (window && window.console) console.warn('AI move skipped:', err);
      }
    }, delay);
  }

  api.onTurn(schedule);

  // 暴露给 game.js：查询某方是否处于托管（玩家不可代下）
  window.AIControl = {
    isManaged: function (player) { return !!aiEnabled[player]; }
  };

  // 玩家点击被托管方棋盘时，抖动对应勾选项作为提示
  window.addEventListener('ai-blocked', function (ev) {
    var id = ev.detail && ev.detail.player === 'b' ? 'aiBlack' : 'aiRed';
    var box = document.getElementById(id);
    var label = box && box.closest ? box.closest('.ai-opt') : null;
    if (!label) return;
    label.classList.remove('ai-blocked-flash');
    void label.offsetWidth;          // 重置动画
    label.classList.add('ai-blocked-flash');
    label.addEventListener('animationend', function handler() {
      label.classList.remove('ai-blocked-flash');
      label.removeEventListener('animationend', handler);
    });
  });

  // ---------- UI 绑定 ----------
  function bind(id, player) {
    var el = document.getElementById(id);
    if (!el) return;
    aiEnabled[player] = el.checked;   // 同步勾选框初始状态（默认红方托管）
    el.addEventListener('change', function () {
      aiEnabled[player] = el.checked;
      if (el.checked) schedule();
      else { clearTimeout(timer); thinking = false; }
    });
  }
  bind('aiBlack', 'b');
  bind('aiRed', 'w');

  // 脚本加载时（晚于 game.js 初始 reset）：若当前方默认托管则立即启动
  schedule();
})();
